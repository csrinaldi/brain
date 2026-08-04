---
status: design
issue: 409
epic: 313
artifact_store: openspec
topic_key: sdd/issue-409-regulated-review-e2e/design
---

# Design — the `regulated`-tier reviewer e2e (issue #409)

## D1 — fake at the binary boundary, not the deps seams

The production chain is `cli.mjs → identity/cold-boot/evaluators/poster → vcs port →
run('gh', …) → network`. Every in-process seam bypasses the layer it fakes; the ONLY
place a fake leaves the whole production chain intact is the `gh` binary itself. A
stub `gh` (executable script, prepended to PATH for the spawned process) dispatches on
its argv (`api /user`, `pr view`, `api …/reviews`, …) and serves canned JSON from the
fixture dir; write calls (`POST …/reviews`) append the request body to
`posted/reviews.jsonl` — **the posted artifact the assertions read**. The stub also
logs every invocation (`calls.log`) so REQ-409-5(a) can assert the identity endpoint
was actually hit.

Precedent: exec.mjs's `setSpawn` is this same idea one level down; the PATH stub is
its process-boundary equivalent, and `test/fresh-install` already established
faking-the-environment-not-the-code as this repo's e2e shape.

## D2 — the fixture is a real git repo pair

Cold-boot performs real `git fetch origin <sha>` + detached-worktree checkout
(COLDBOOT-CWD). So the fixture is a **bare origin + working clone**: the "PR" is a
real branch whose head sha the stub's `pr view` response reports. No git behaviour is
faked; the sha the stub advertises must exist in origin or the run fails exactly as it
would in production — that is a feature, and a fixture-integrity assertion pins it.

## D3 — tier via the fixture's OWN config

The spawned CLI reads `brain.config.json` from its cwd (the fixture repo), which
declares `governance.tier: "regulated"`. No override seam is added to production code
— `resolveTier` stays untouched; the fixture IS a regulated consumer. The `lite`
control (REQ-409-4) is the same fixture with one config line changed.

## D4 — what makes findings exist at all

A `/2` verdict with zero findings would satisfy REQ-409-1..3 vacuously. The fixture's
PR-shape includes a diff that trips at least one deterministic tranche check (e.g. a
diff-budget breach at `regulated`'s 200-line budget), so the posted body carries at
least one finding whose annotations REQ-409-3 can inspect. The fixture README records
which check is tripped and why that choice is stable.

## D5 — OPEN, for a human answer: should brain itself declare `regulated`?

This e2e makes `/2` *tested*; it does not make it *dogfooded*. Switching brain's own
tier is a governance change with ADR-0026 consequences (budget 200, `size:exception`
refused, panel review) — the epic already lists it in the HUMAN row. This harness
neither needs nor prejudges that decision; it is the evidence base for making it.

## D6 — placement and cost

`test/review-regulated/*.e2e.test.mjs`, node:test like everything else, run by the
normal `npm test` glob — NOT a separate opt-in script, because an e2e that must be
remembered is an e2e that stops running. Each case spawns one CLI process (~seconds);
the suite stays well under the existing integration tests' cost envelope.

## Alternatives rejected

- **In-process with injected deps** — asserts the wiring of the seams, not the
  product; could not have caught #400's entry-guard class of defect.
- **A real GitHub repo + real token** — network-dependent, unrunnable in agent
  containers, secrets in CI; and the ticket's point is exercising `/2`, not GitHub.
- **Tier override env var in production code** — a production seam whose only
  consumer is the test; D3 gets the same result with zero new surface.
