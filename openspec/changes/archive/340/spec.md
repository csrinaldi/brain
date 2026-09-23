---
status: draft
issue: 340
---

# Spec

## REQ-340-1 — local is never laxer than CI
For any input, `brain:check` MUST NOT report a check as passing when the CI evaluator fails it
on the same evidence.

## REQ-340-2 — one implementation of each rule
`brain:check` MUST invoke the CI evaluator for any check that applies policy on top of a pure
function. A second implementation of the policy is not acceptable, aligned or otherwise.

## REQ-340-3 — a deliberate divergence is stated and safe
Any check left on a pure function MUST be either aligned by construction or divergent in the
STRICTER direction only, and the reason MUST be recorded where the call is made.

## REQ-340-4 — fail closed on an unresolvable base
An indeterminate target or default branch MUST NOT be resolved to a guess. `brain:check` MUST
report the check as unverified.

## REQ-340-5 — the target branch defaults to the stricter rule
With no explicit target, `brain:check` MUST assume the default branch (closing keyword
required). Assuming a slice target is forbidden. An explicit `BASE_BRANCH` MAY select it.

## REQ-340-6 — three states, and no claim without evidence
Unverifiable MUST render distinctly from passing, MUST be named with a remedy, and MUST
suppress the "Ready to brain:ship" claim. It MUST NOT exit non-zero.

## REQ-340-7 — the parity is pinned
A suite MUST feed identical fixtures to both surfaces and assert REQ-340-1, and MUST cover
every check `brain:check` runs — not only `issue-link`.
