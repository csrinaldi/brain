---
issue: 348
phase: design
---

# Design — #348

## D1 — the capability reported is BRAIN's, not the platform's

This section first said both providers "ask the platform" for `approvalCount`.
That was true of the first implementation and false of the one that shipped —
the review caught the drift (round 1), and the implementation is the half that
was right.

The reframing: the question is not *"can this GitLab plan enforce approvals?"*
but **"will brain enforce it?"** #348 ratified not implementing the
approval-rules call, so the answer is no under every plan. Probing would answer
a question nobody asked, at the cost of a second spawn — and `capabilities()`
has a one-spawn-per-project cache contract that a test enforced immediately.

GitHub's answer still comes from a probe, because there the same endpoint
carries `required_approving_review_count`: it is derived from the call that
already happened. Neither provider consults a plan name, which is the part that
mattered — brain does not track two vendors' pricing, and a hardcoded table
would be wrong on a schedule nobody here controls.

## D2 — two axes, never one

`hardEnforcement` and `approvalCount` are reported separately because the
account types make them independent: GitLab Free has the first without the
second; GitHub Free-private has neither. Collapsing them into one "protected"
boolean would make GitLab Free look like GitHub Free-private, which is exactly
backwards — GitLab Free reaches rung 1 and GitHub Free-private does not.

## D3 — the return value carries the partiality

`{ enforced: true }` over an ignored parameter is the shape this session has
been removing everywhere: a result that reports success for work it did not do.
The fix is not a new field family — it is the existing `reason` slot, used to
name what was NOT applied, so the caller learns it from the value rather than
from the source.

## D4 — silence when nothing was asked

At `lite`, `requiredReviews` is 0. A verb that announced an unapplied approval
count there would be noise about a capability nobody wanted — and noise is how
a real signal stops being read.

## D5 — the source-scan lock stays

PR #346's bidirectional scan fails if an approval-rules call appears inside
`branchProtect`. This change does not add one, and the lock keeps forcing that
decision into the open for whoever tries.
