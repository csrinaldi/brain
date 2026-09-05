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

### Scenario: GitLab without the approval-rules API
- WHEN the approval-rules endpoint answers 403/404/Premium-gated
- THEN `approvalCount` is `unavailable` with a remedy naming what would change
  it — never absent, and never assumed from a plan name.

### Scenario: probed, never priced
- WHEN either provider is asked
- THEN the answer comes from the platform's response, and no code path decides
  it from a hardcoded plan or tier table.

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
