---
status: draft
issue: 443
epic: 313
artifact_store: openspec
topic_key: sdd/issue-443-tranche-tier-budget/proposal
---

# Proposal: the tranche evaluator's diff budget must follow the tier (issue #443)

Issue #443. Epic #313, Lane B (reviewer / M3 feeders).
Change folder: `openspec/changes/issue-443-tranche-tier-budget/`.

## Intent

`brain/scripts/review/evaluators/tranche.mjs:34` declares `const LINE_BUDGET = 400`.
ADR-0026 (Q5) tiered that budget — **lite 1000 · standard 400 · regulated 200**,
`TIER_PARAMS.diffBudget` — and every other consumer already reads it: the governance
`diff-size` gate goes through `governance-tiers.mjs`'s `printDiffBudget` CLI printer,
which exists precisely so that "no second budget literal" holds (REQ-TIER-9). The
reviewer is that second literal.

The consequence is not cosmetic, and it is asymmetric in the worst direction:

- At `regulated` (budget 200) the reviewer **APPROVES a 350-line PR that doctrine
  forbids** — a false negative on the one tier that pays for `/2` in the first place.
- At `lite` (budget 1000) it flags a 500-line PR governance allows — a false positive
  that erodes trust in the verdict.
- At `standard` the hardcode coincides with the correct value by accident, and
  `cli.test.mjs`'s tranche fixtures pin `tier: 'standard'`. That coincidence is why a
  2470-test suite never saw it.

Found by the #409 e2e **on its first run**: the fixture tripped a 250-line diff at
`regulated` expecting a budget finding and got `verdict: APPROVE, findings: []`.

## Decision

Thread the tier's `diffBudget` through the seam that already resolves the tier.
`gatherTrancheInputs` calls `resolveTier(readConfig())` today to derive
`requiredJobs`/`detectionJobs`; the budget is the same resolution and belongs in the
same place. `evaluateTranche` gains a `diffBudget` parameter defaulting to
`tierParams('standard').diffBudget` — **imported, not re-declared**, so the literal
`400` leaves this file entirely and the mirroring comment at lines 29-34 becomes
obsolete rather than merely stale.

The finding's `cites:` currently reads `governance.yml diff-size gate (400-line
budget)` — a citation that names a number the code may no longer be using. It becomes
`governance-tiers.mjs tierParams(tier).diffBudget`, mirroring the sibling gate
finding's `governance-tiers.mjs requiredJobs(tier)` exactly, with the resolved tier and
value carried in the evidence so the finding remains self-evidencing.

## Scope

- `brain/scripts/review/evaluators/tranche.mjs` — the parameter, the resolution, the
  citation, the removal of `LINE_BUDGET`.
- `brain/scripts/review/evaluators/tranche.test.mjs` — red-first cases at `lite` and
  `regulated`; the `standard` no-op guarantee pinned explicitly rather than
  incidentally.
- `test/review-regulated/fixture.mjs` + its README and `regulated-review.e2e.test.mjs`
  — restore the diff-budget breach as #409's deterministic finding, which is the
  restoration the harness README already instructs (`redJob` was the documented
  workaround for this exact ticket).

Out of scope: `honorSizeException` (tranche reads no labels at all — the waiver lives
in the governance gate, and wiring it here would be a new behaviour, not this fix);
#405; #408; #442.

## Why the reach into `test/review-regulated/`

The #409 harness carries a written instruction naming this ticket: *"When #443 lands,
restore `diffLines`-driven breaches and retire this parameter's default."* Landing the
production fix without it would leave the e2e asserting on a red required gate while
the defect it was built to catch stays unexercised end to end — the fix would be
covered by unit tests only, which is the exact condition that let the defect live.
