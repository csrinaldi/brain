---
issue: 348
phase: design
---

# Design — #348

## D1 — the answer is probed, never priced

Both `capabilities()` implementations already ask the platform and translate
the response. `approvalCount` joins them the same way. A hardcoded plan table
would be wrong on a schedule nobody in this repository controls, and would put
brain in the business of tracking two vendors' pricing.

This is the same rule the last several changes converged on: when a tool
already knows the answer, ask it.

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
