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

## REQ-409-6 — `/2` plumbing honesty (the #408 boundary)

`follow_ups` is asserted **present and empty**, with a comment naming #408 as the
missing producer. The refuter is asserted **silent** (no `inferential` findings exist
to trigger it). If either assertion ever flips, that is #408 landing — the test tells
the implementer to move it, not delete it.

## REQ-409-7 — the harness is reusable, and documented as such

Fixture builder and stub take parameters (tier, PR shape, canned findings inputs) so
#405 (inline comments) and #408 (producers) can land on them. A README in
`test/review-regulated/` states the contract.
