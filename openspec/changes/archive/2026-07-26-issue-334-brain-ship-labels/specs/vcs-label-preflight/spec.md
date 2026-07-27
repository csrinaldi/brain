# vcs-label-preflight Specification

## Purpose

A pre-flight conformance check confirming a label exists in a remote's
declared label set **before** a mutating write (`mrCreateFn`) is attempted.
This is the root-cause guard for issue #334: the `type:*` label sourced from
`issueView` (sibling spec `vcs-issue-view-contract`) may not exist on the
target remote at all, and `ship-pr-label-resolution` (sibling spec, same
change) MUST call this seam before opening a PR. This spec is independently
testable — it does not depend on `brain:ship` internals, only on the
provider's label-list API surface.

## Requirements

### Requirement: Preflight input/output contract

The system MUST expose a preflight function with input
`{ provider, project, label }` and output `{ exists: boolean, error?: string }`.
The function MUST NOT throw; any lookup failure MUST resolve to
`{ exists: false, error }`, never leave the caller to catch an exception.

#### Scenario: Label exists on the remote

- GIVEN a remote whose label set includes `type:bug`
- WHEN the preflight is called with `{ label: 'type:bug' }`
- THEN it resolves `{ exists: true }`

#### Scenario: Label absent from the remote

- GIVEN a remote whose label set does not include `type:bug`
- WHEN the preflight is called with `{ label: 'type:bug' }`
- THEN it resolves `{ exists: false }`, with no `error` required

#### Scenario: Lookup failure resolves, never throws

- GIVEN the underlying label-list API call throws or rejects
- WHEN the preflight is called
- THEN it resolves `{ exists: false, error }`, describing the failure
- AND the function never throws

### Requirement: GitHub label-set lookup

The system MUST implement the GitHub lookup as `GET /repos/{owner}/{repo}/labels`,
filtering the response on `name` (case-sensitive exact match against the
input `label`).

#### Scenario: GitHub exact-match filter

- GIVEN a GitHub labels response containing `type:bug` and `type:feature`
- WHEN the preflight checks for `type:bug`
- THEN it resolves `{ exists: true }`
- AND checking for `type:Bug` (different case) resolves `{ exists: false }`

### Requirement: GitLab label-set lookup

The system MUST implement the GitLab lookup as `GET /projects/{id}/labels`,
filtering the response on `name`, provider-aware of GitLab's `::` scoped
label convention (matches `vcs-contract.md`'s existing provider-aware
pattern, e.g. `approved-label.mjs`).

#### Scenario: GitLab exact-match filter

- GIVEN a GitLab labels response containing `type::bug`
- WHEN the preflight checks for `type::bug`
- THEN it resolves `{ exists: true }`

### Requirement: Synchronous, uncached, pre-write ordering

The system MUST perform the preflight check synchronously before
`mrCreateFn` is invoked, on every call — no caching of prior results across
invocations. The caller MUST NOT proceed to the mutating write when
`exists: false`.

#### Scenario: Preflight blocks the write on rejection

- GIVEN the preflight resolves `{ exists: false }`
- WHEN the caller evaluates the result
- THEN `mrCreateFn` is never invoked

#### Scenario: Repeated calls always re-check the remote

- GIVEN two preflight calls for the same `{ provider, project, label }` in sequence
- WHEN the second call is made
- THEN the label-list lookup is performed again (no cached short-circuit)
