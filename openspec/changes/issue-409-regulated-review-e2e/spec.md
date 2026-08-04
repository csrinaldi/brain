---
status: spec
issue: 409
epic: 313
artifact_store: openspec
topic_key: sdd/issue-409-regulated-review-e2e/spec
---

# Spec — the `regulated`-tier reviewer e2e (issue #409)

Requirements tagged `REQ-409-N`. The core cases spawn the REAL `brain:review` CLI
(`node brain/scripts/review/cli.mjs`, real argv, real process boundary); the only fake
is the `gh` binary on PATH.

## REQ-409-1 — a `regulated` run posts a `/2` verdict, end to end

Fixture repo declares `governance.tier: "regulated"`. `brain:review --pr <n>` (NOT
dry-run) exits 0 and the captured posted body contains `protocol: brain-review/2`.
**Red today by construction** — nothing exercises this path outside unit tests; the
case must also be proven red against a mutation that forces `/1` (REQ-409-4's control).

## REQ-409-2 — the posted artifact is parseable by the real parser

`parseVerdict` (production import, no test re-implementation) over the captured body
yields the verdict, findings, and `follow_ups`. The #381 class — render/parse
asymmetry — becomes impossible to reintroduce silently on `/2`.

## REQ-409-3 — causal admission ran, visibly

Every finding in the posted `/2` body carries `evidence_class` and
`causal_disposition` (the causal-admission vocabulary). A `/2` verdict whose findings
lack the annotation is red — that is `/2` in name only.

## REQ-409-4 — degradation to `/1` is a failure, not a fallback

Negative control: the same fixture with `tier: "lite"` posts `brain-review/1` (proves
the harness detects the difference), and the `regulated` case FAILS if the posted
protocol is `/1`. Guards the exact silent degradation observed live on PR #412.

## REQ-409-5 — the identity gates execute for real

The spawned process receives `BRAIN_REVIEWER_TOKEN`; the stub serves `gh api /user` →
the configured handle. Three sub-cases: (a) matching handle → run proceeds (#413's
verification EXECUTED — assert the stub's /user endpoint was hit, from its call log);
(b) stub returns a different login → boot refusal, nothing posted; (c) no token →
boot refusal, nothing posted. (b) and (c) pin that the e2e passes THROUGH the gates,
not around them.

## REQ-409-6 — `/2` plumbing honesty (the #408 boundary) — AMENDED after review

`follow_ups` is asserted **ABSENT**, not "present and empty". The review of PR #444
found the original wording was not what the tree does, and that the assertion could
not tell the two apart: `renderVerdict` omits the key when the list is empty, and
`parseVerdict` only assigns the field when the key was found, so `verdict.follow_ups
?? []` deepEqual `[]` compared `[]` to `[]` having observed nothing —
`evidence-reader-empty-on-failure` in the assertion layer, on the one field with a
documented render/parse asymmetry (#381).

The pin is therefore two-layered: `!('follow_ups' in verdict)` AND the posted body
carries no `^follow_ups:` block. The refuter stays asserted **silent** (no
`inferential` finding exists to trigger it). A flip in either layer means #408 landed
or the render/parse contract changed — the message tells the implementer to check
WHICH before moving the assertion, never to delete it.

## REQ-409-3 addendum — the annotation loop must not pass over an empty array

A zero-length `findings` iterates zero times and would turn the causal-annotation
check green over nothing. REQ-409-1's length assertion is a different test over a
different fixture instance and cannot cover it, so REQ-409-3 carries its own guard.
This is load-bearing rather than defensive: when #443 lands and the fixture swaps its
finding source back to the diff-budget breach, a breach producing no finding would
turn REQ-409-1 red and leave REQ-409-3 green.

## REQ-409-8 — the harness leaves no fixtures behind

Each fixture vendors `brain/core` + `brain/scripts` plus a clone and a bare origin
(~8 MB measured). Since this suite now runs on every `npm test`, an un-cleaned run
leaks ~57 MB per pass — measured on the development tree before the fix: 47 orphaned
trees, 383 MB. Every case registers removal via `t.after`.

## REQ-409-7 — the harness is reusable, and documented as such

Fixture builder and stub take parameters (tier, PR shape, canned findings inputs) so
#405 (inline comments) and #408 (producers) can land on them. A README in
`test/review-regulated/` states the contract.
