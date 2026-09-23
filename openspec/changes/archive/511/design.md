---
status: retro-fitted
issue: 511
---

# Design

## The one idea

A check is a question plus a reading of its evidence. L6 and the audit share the question and
cannot share the reading, because **absence means different things at different moments**:
before the merge, *not yet*; after it, *never*. Nothing in either check said which reading it
took, which is why one function looked reusable and was not.

## Three shapes that are not verdicts

| shape | what it is | handling |
|---|---|---|
| no PR resolvable | a fact about the merge (#474: it stays evaluable) | **abstain** |
| adapter without `prReviews` | a capability gap — the question cannot be asked | **abstain** |
| `prReviews` exists and returns null | a failed read | the established `prMetaError` channel |

**Abstention is expressed as ABSENCE from `realResults`.** That is the load-bearing choice: it
means the walk, the reverter-skip, the metrics parity and the exit contract learn no fourth
state. The first attempt added one and cost 16 tests.

## Not tree-keyed

`TREE_KEYED_CHECKS` licenses the reverter-skip and the `[FAIL-SHA]` auto-revert signal, and it
is licensed by a check being a pure function of the tree. Review evidence is PR metadata, like
`issueLink`, which is excluded for the same reason.

So this check never auto-reverts — and that is right on its face: the remedy for *"nobody
reviewed this"* is a human reviewing it, not a machine undoing it.

## Why `lite` passes an unreviewed ADR edit

ADR-0026 ratified it. L6's evidence at `lite` is `agent-authorship-exclusion`, and the tier's
own description accepts that *"two-human constraints are unsatisfiable by construction"*. A10
was frozen in #297, **before** the tiering work, so its property is a `standard`/`regulated`
property. Agent containment still does not tier: an agent-authored ADR change fails everywhere.

## A10 reinforced, not retired

Its fixture is a synthetic repo with no PR, so under this design it would **abstain** — and
A10 would keep passing on `adrPresence`'s imprecision, which #510 removes. A10b/A10c give it a
PATH-stubbed `gh` serving one reviewed PR and pin the property through the invariant that now
owns it.

**A10b is the control that makes A10c meaningful.** Without a case proving the stub delivers
reviews, an abstaining check would satisfy A10c vacuously — the shape of green this repo keeps
paying for.
