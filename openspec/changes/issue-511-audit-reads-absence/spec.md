---
status: draft
issue: 511
---

# Spec — the audit reads absence with the meaning absence has there

## REQ-511-1 — one implementation of the rule

The audit MUST call `evaluateBrainWritesReviewed` rather than re-implement L6's tier matrix,
agent-authorship exclusion or approver-set logic. Two implementations of one rule is the
class #340 records for `issue-link`.

## REQ-511-2 — absence is read by the moment, not by the check

At PR time an absent review is *not reviewed yet* (`warn`). On merged history it is *never
reviewed* (`fail`). The check MUST state which reading it takes.

## REQ-511-3 — abstention is absence from the result set

A merge with no resolvable PR MUST NOT be failed, passed, or reported uncomputable: #474
established that such a merge stays evaluable. The check abstains, expressed as absence from
`realResults`, so the walk learns no fourth state.

## REQ-511-4 — a capability gap is not a failed read

An adapter that does not implement `prReviews` cannot answer the question at all → abstain.
A `prReviews` that EXISTS and returns null is a failed read → the established `prMetaError`
channel, which the audit already handles before any check runs.

## REQ-511-5 — not tree-keyed

The check MUST NOT be a member of `TREE_KEYED_CHECKS`: it keys on PR metadata, like
`issueLink`. It never emits `[FAIL-SHA]` and never auto-reverts — the remedy for "nobody
reviewed this" is a human reviewing it.

## REQ-511-6 — A10's property survives on the invariant that owns it

A10's frozen invariants (`^M`, never `^A`) stay untouched. A10b/A10c pin the same property
through the human-gate invariant: an unreviewed ADR edit is reported and names
`writesGoverned`; a reviewed one is not. A10b is the control that makes A10c meaningful —
without it, an abstaining check would satisfy A10c vacuously.

## REQ-511-7 — every guard proven red by mutation

Each guard MUST be shown RED against a seeded defect, with the mutation's diff printed before
the run. Four proven here: the `warn`→pass reading, the abstention branch, the tier
pass-through, and neutralising the check against A10b.
