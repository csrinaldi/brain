# vcs-issue-view-contract Specification

## Purpose

Cross-provider contract-test coverage for the `issueView` verb:
`({ project, number }) -> { number, title, labels, body, author }`. Closes one
M10 Gap-A verb (zero contract-test coverage today). This is the read that
`ship-pr-label-resolution` (sibling spec, same change) consumes to source the
issue's `type:*` label — if this contract drifts, label resolution silently
breaks downstream. `vcs-label-preflight` is a separate, independently
testable seam that validates the label this contract returns actually exists
on the remote.

## Requirements

### Requirement: `issueView` contract shape assertion

The system MUST have an automated contract test asserting that both provider
normalizers (`github`, `gitlab`) emit `issueView` results conforming to
`{ number, title, labels, body, author }`, parameterized across both
providers following the existing `labelEvents`/`prReviews` pattern.

#### Scenario: Happy path shape on both providers

- GIVEN a recorded/derived fixture representing an open issue with labels
- WHEN `issueView` is called against each provider's normalizer
- THEN the result contains exactly `{ number, title, labels, body, author }`
- AND `number` is numeric, `title`/`body` are strings, `author` is a string or `null`

#### Scenario: Fetch failure is surfaced, never fabricated

- GIVEN the underlying API call throws or rejects
- WHEN `issueView` is called
- THEN the function's documented failure behavior is asserted explicitly (no silent fabricated issue object)

### Requirement: GitHub recorded fixtures

The system MUST provide `github-issueView-happy.json`, recorded from a real
GitHub Issues API response (not hand-authored), carrying
`_provenance.recorded` and scrubbed of sensitive repo/user data following the
`github-prView-happy.json` discipline. `github-issueView-failure.json` MAY be
hand-authored and MUST carry `_provenance.derived`.

#### Scenario: Recorded fixture provenance

- GIVEN `github-issueView-happy.json`
- WHEN its provenance is inspected
- THEN `_provenance.recorded` is present and true
- AND the fixture contains at least one `type:*` label

### Requirement: GitLab derived fixtures

The system MUST provide `gitlab-issueView-happy.json` and
`gitlab-issueView-failure.json` as hand-derived fixtures, each carrying
`_provenance.derived`, reflecting GitLab's `iid`/`description`/
`author.username` → `number`/`body`/`author` field mapping documented in
`vcs-contract.md`.

#### Scenario: GitLab happy fixture normalizes field names correctly

- GIVEN `gitlab-issueView-happy.json` representing an `iid`/`description`-shaped payload
- WHEN normalized
- THEN `number` derives from `iid` and `body` derives from `description`
- AND `author` derives from `author.username`

### Requirement: Labels array invariant

The system MUST assert that `labels` is always an array of strings, never
`null`/`undefined`, and MAY be empty when the issue carries no labels. No
provider-specific label formatting (e.g. GitLab's `::` scoped labels) MUST
leak past normalization — the array elements MUST be plain strings.

#### Scenario: Issue with no labels yields an empty array, not null

- GIVEN a fixture representing an issue with zero labels
- WHEN `issueView` is called
- THEN `labels` is `[]`, never `null` or `undefined`

#### Scenario: Every label element is a string

- GIVEN a fixture with multiple labels including a GitLab-scoped label
- WHEN `issueView` is called
- THEN every element of `labels` is a string
- AND no element is an object (e.g. `{ name }`)
