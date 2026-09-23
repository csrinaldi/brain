---
issue: 348
phase: spec
capability: capability-honesty
---

# Spec — a verb reports what it applied, and what it could not

## Requirement: capabilities answers for the approval count (R348-1)

`capabilities()` MUST report `approvalCount` on both providers, with the same
vocabulary `hardEnforcement` already uses: `available` | `unavailable` |
`unknown`, plus a `remedy` when unavailable.

### Scenario: GitLab
- WHEN `capabilities()` is asked on GitLab
- THEN `approvalCount` is `unavailable`, with a remedy naming both the plan
  that would offer it AND that the human signature does not depend on it.

  The capability reported is **brain's, not the platform's**. #348 ratified not
  implementing the approval-rules call, so brain enforces no approval count on
  GitLab under ANY plan — which makes probing the endpoint a question nobody
  asked, at the cost of a second spawn this function's cache contract forbids.
  An earlier draft of this spec described that probe; the implementation
  reasoned its way out of it and the spec had not caught up (review round 1).

### Scenario: GitHub, from the probe already made
- WHEN `capabilities()` is asked on GitHub
- THEN `approvalCount` follows `hardEnforcement`, because the same protection
  endpoint carries `required_approving_review_count` — derived from the probe
  that already happened, never from a plan name.

### Scenario: never priced
- WHEN either provider answers
- THEN no code path decides it from a hardcoded plan or tier table. Brain does
  not track two vendors' pricing; it reports what it will do.

### Scenario: the two axes are independent
- WHEN protected branches are available but the approval count is not
- THEN `hardEnforcement: 'available'` and `approvalCount: 'unavailable'` are
  reported together — one capability may not stand in for the other.

## Requirement: branchProtect states its own partiality (R348-2)

When `branchProtect` is asked for a `requiredReviews` it cannot enforce, the
result MUST say so.

### Scenario: GitLab, requiredReviews > 0
- WHEN protection is applied but the approval count is not
- THEN the result carries `enforced: true` for the protection AND names the
  unapplied part, so a reader learns it from the return value rather than from
  the source.

### Scenario: nothing was asked for
- WHEN `requiredReviews` is 0 — the `lite` tier's value
- THEN nothing is reported as unapplied, because nothing was.

### Scenario: GitHub is unchanged
- WHEN GitHub applies `required_approving_review_count`
- THEN its result is exactly what it is today.

## Requirement: the status surface shows the new axis (R348-3)

`brain:governance-status` MUST print the approval-count capability beside the
platform line it already prints.

### Scenario: an operator reads the status
- WHEN the approval count is unavailable
- THEN the output says so and prints the remedy, in the same shape as the
  existing `platform UNAVAILABLE → remedy` line.
