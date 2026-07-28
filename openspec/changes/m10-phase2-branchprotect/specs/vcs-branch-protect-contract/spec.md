# vcs-branch-protect-contract Specification

## Purpose

Cross-provider contract-test coverage for the `branchProtect` verb —
`(...) -> { enforced: boolean, reason?: string, remedy?: string }`. Closes
the last mutating-write gap in the #336 Phase-2 ranking (rank 2):
`branchProtect` has 15 provider-siloed tests in `providers.test.mjs` but zero
contract-parity coverage in `vcs.contract.test.mjs`, so nothing today asserts
GitHub and GitLab honour the same shape. This spec also converts GitLab's
undocumented `requiredReviews` no-op from a silent behavior into a locked,
change-detecting fact — pinning the gap, not closing it.

## Requirements

### Requirement: `branchProtect` contract shape assertion across both providers

The system MUST have an automated contract-parity test in
`vcs.contract.test.mjs` asserting that both provider implementations
(`github`, `gitlab`) return `branchProtect` results conforming to
`{ enforced: boolean, reason?: string, remedy?: string }`, parameterized
over `['github', 'gitlab']` using one shared assertion body and inline
mocks — matching the existing `prReviewComment`/`labelAdd`/`labelRemove`/
`labelList` precedent. The return shape MUST NOT include `enabled` or
`rules`, and MUST NOT surface `requiredReviews` as an output field —
`requiredReviews` is an input parameter only.

#### Scenario: Happy path shape on both providers

- GIVEN `branchProtect()` is called against a branch that is successfully protected
- WHEN invoked through each provider's inline-mocked transport
- THEN the result is exactly `{ enforced: true }` for both GitHub and GitLab

#### Scenario: Failure path shape on both providers

- GIVEN `branchProtect()` is called and protection cannot be applied (permissions, tier limit, branch not found, API error)
- WHEN invoked through each provider's inline-mocked transport
- THEN the result has `enforced: false`, a string `reason`, and a string `remedy`
- AND the exact `reason`/`remedy` text is NOT asserted identical across providers — only presence and type

#### Scenario: `branchProtect` never throws

- GIVEN any uncomputable or errored protection state, on either provider
- WHEN `branchProtect()` is invoked
- THEN it resolves rather than throws
- AND the resolved value is `{ enforced: false, reason: <string>, remedy: <string> }`

### Requirement: GitLab `requiredReviews` no-op is test-verified, scoped to the function body

The system MUST have a source-scan test asserting that the `branchProtect`
function body in `gitlab.mjs` (approx. lines 477–529) does not call any
GitLab approvals or approval-rules endpoint. The scan MUST be scoped to the
`branchProtect` function's own source slice — never file-wide — because
`gitlab.mjs` already calls `.../approvals` inside `prReviews` (~line 271);
a file-wide match on `approvals` would false-positive on that unrelated
call. This test pins the limitation as an intentional, tested fact so any
future change to this behavior (in either direction) is caught, rather than
drifting silently.

#### Scenario: GitLab `branchProtect` body makes no approval-rules call

- GIVEN the extracted source slice of `gitlab.mjs`'s `branchProtect` function body only
- WHEN the slice is scanned for approval/approval-rules endpoint patterns
- THEN no match is found
- AND the same scan applied to the full file WOULD match (via `prReviews`), proving the narrow scope is load-bearing

#### Scenario: Scan does not false-positive on `prReviews`' legitimate approvals call

- GIVEN the full `gitlab.mjs` source contains an `.../approvals` call inside `prReviews`
- WHEN the source-scan test runs
- THEN it asserts the absence of the call only within the `branchProtect` slice
- AND does not fail due to `prReviews`' unrelated, correct usage

## Non-Goals (this slice)

- No changes to `github.mjs` or `gitlab.mjs` — both are read-only.
- No behavioral fix for GitLab's `requiredReviews` no-op. Whether to (a)
  implement GitLab approval-rules enforcement or (b) ratify the limitation
  by having the verb report it is a design-level decision, deferred to
  `sdd-design`.
- No fixture files — `branchProtect` is a mutating write; inline mocks only.
- No rewrite of `vcs-contract.md` — the contract shape is already documented
  there; this slice only adds the missing assertion.
