---
status: spec
issue: 443
epic: 313
artifact_store: openspec
topic_key: sdd/issue-443-tranche-tier-budget/spec
---

# Spec — the tranche diff budget follows the tier (issue #443)

Requirements tagged `REQ-443-N`.

## REQ-443-1 — the budget is the tier's budget, at every tier

`evaluateTranche` emits the `budget` blocker finding when
`budget.lines > diffBudget(tier)`, and only then. Pinned in both directions at the two
tiers the hardcode got wrong:

- `regulated` (200): 250 lines **MUST** produce the finding. Red against the shipped
  code, which approves it.
- `lite` (1000): 500 lines **MUST NOT** produce it. Red against the shipped code,
  which flags it.

Each case must also be proven from the other side (a `regulated` diff under 200 stays
silent; a `lite` diff over 1000 fires), so neither test can pass by a constant that
happens to sit on the correct side of one threshold.

## REQ-443-2 — `standard` is byte-identical (the no-op guarantee)

`standard`'s budget is 400, which is what the hardcode was. REQ-TIER-10's
no-op-migration discipline applies: at `standard` the finding's presence, `id`,
`severity` and `evidence` string are unchanged by this change. This is asserted
explicitly rather than inferred from the suite staying green — the whole reason the
defect survived is that `standard` was the only tier under test, so "standard still
passes" is precisely the evidence that carries no information here.

## REQ-443-3 — one budget literal in the repo

`400` is no longer declared in `tranche.mjs`. The value arrives from
`governance-tiers.mjs`'s `tierParams`, the same module the governance `diff-size` gate
reads through `printDiffBudget`. REQ-TIER-9 ("no second budget literal") becomes true
of the reviewer, not just of the shell consumers.

The default for callers that skip the gather seam is `tierParams('standard').diffBudget`
— mirroring how `requiredJobs`/`detectionJobs` default to the stale `'standard'`
snapshot. Same convention, same tier, so the two defaults cannot drift apart.

## REQ-443-4 — the citation names the tiered source, not a number

The finding's `cites` becomes `governance-tiers.mjs tierParams(tier).diffBudget`,
mirroring the sibling gate finding's `governance-tiers.mjs requiredJobs(tier)`. The
resolved tier and the resolved budget appear in the `evidence` line, so a reader of the
posted verdict can check the arithmetic without knowing the tier table:

```
git diff --numstat <base>...<head> | diff-size-count.mjs = 250 > 200 (tier: regulated)
```

A citation that hardcodes `(400-line budget)` while the code uses 200 is a review
defect in its own right — the verdict would be quoting doctrine it did not apply.

## REQ-443-5 — the fix reaches `evaluateCheckpoint` for free, and that is pinned

`checkpoint.mjs` gathers through `gatherTrancheInputs` and passes the result verbatim
to `evaluateTranche`. Adding `diffBudget` to the gather's return therefore fixes the
checkpoint evaluator with no edit — but "for free" is a claim, and this repo's standing
rule is that an unexercised protection carries no information. One checkpoint case at
`regulated` pins it.

## REQ-443-6 — #409's e2e restores its designed finding source

`test/review-regulated/fixture.mjs` returns to the diff-budget breach as its
deterministic finding (design D4's original choice), retiring the `redJob` workaround's
default. The harness README's #443 note is updated to record that the restoration
happened rather than remaining an instruction. The e2e then exercises the tiered budget
across the real process boundary — which is the only reason the defect was findable.

`redJob` is kept as an opt-in parameter (a red required gate is still a useful second
finding source for #405/#408) but stops being the default.
