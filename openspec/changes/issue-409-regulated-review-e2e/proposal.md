---
status: draft
issue: 409
epic: 313
artifact_store: openspec
topic_key: sdd/issue-409-regulated-review-e2e/proposal
---

# Proposal: the `regulated`-tier reviewer e2e (issue #409)

Issue #409. Epic #313 (M3 closure, track 1 — runs in parallel with #401).
Change folder: `openspec/changes/issue-409-regulated-review-e2e/`.

## Intent

brain declares `governance.tier: "lite"`, so the entire `/2` reviewer path — causal
admission, the refuter fork, `/2` findings, `follow_ups` — is exercised by unit tests
and by **nothing else**. The measured consequences this month: #381 and #413 were found
by reading, not by a failing test; a live `brain:review` run on PR #412 returned
`brain-review/1, findings: []` ("nobody looked", not "clean"); and the #397 review had
to be performed manually. This is the "green in test, inert in production" class M10
exists to close, sitting on the reviewer itself.

## Decision

An e2e that **spawns the real `brain:review` CLI** (the epic's standing method rule —
twice this week a green suite hid a product that did not run) against a **local git
fixture repo** declaring `regulated`, with the provider transport faked at the **binary
boundary**: a PATH-stubbed `gh` that serves canned API responses and captures the
posted review body to a file. The assertions read that captured artifact and parse it
with the real `parseVerdict`.

Why the binary boundary and not the deps seams: every in-process seam
(`identityDeps.whoami`, `coldBootDeps.fetchPr`, `writeVerbs`) bypasses the layer it
fakes. A PATH stub fakes only the network: the real `cli.mjs` process boots, the real
`identity.mjs` verifies the handle against `whoami({token})` (#413's gate EXECUTES,
against the stub transport), the real cold-boot fetches and checks out a detached
worktree from a real local origin, the real poster renders and posts. No gate weakened,
no production line skipped.

## Scope

- `test/review-regulated/`: the fixture builder (consumer-shaped git repo + bare
  origin + PR-shaped branch), the `gh` stub, the runner.
- The e2e cases (spec REQ-409-1..7): a `/2` verdict is posted, parseable, causally
  admitted; degradation to `/1` is red; the identity gates run for real.
- Ticket-mandated honesty: `follow_ups` asserted **present and empty** (no producer
  exists — #408), the refuter asserted **wired and silent** (no `inferential` producer
  — #408). Plumbing, not population.
- Docs: the harness documented as the landing pad for #405/#408, implementing neither.

Out of scope: switching brain itself to `regulated` (HUMAN row of the epic — raised in
design.md D5), #405, #408, any change under `brain/**`.
