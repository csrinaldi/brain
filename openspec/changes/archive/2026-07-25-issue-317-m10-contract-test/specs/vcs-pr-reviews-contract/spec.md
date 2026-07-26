# vcs-pr-reviews-contract Specification

## Purpose

Cross-provider contract-test coverage for the `prReviews` verb as it exists
**today**: `Promise<Array<{ state, author }>|null>`. Closes M10 Gap A —
`prReviews` is the last verdict-path read verb with zero contract-test
coverage. This spec pins the current shape and its consumer chain; it does
NOT change `prReviews`' behavior. The deferred `body` defect is owned by
`vcs-pr-review-bodies` (`issue-317-prreviews-empty-body`).

## Requirements

### Requirement: `prReviews` contract shape assertion

The system MUST have an automated contract test asserting that both
provider normalizers (`github`, `gitlab`) emit `prReviews` results
conforming to `Array<{ state, author }>|null`, parameterized across both
providers following the existing `labelEvents` pattern.

The test MUST assert `null` (uncomputable — fetch failed) is never
conflated with `[]` (genuinely zero reviews/approvals). The test MUST
assert the returned shape contains ONLY `state` and `author` keys — a
`body` field MUST NOT be present, and the test MUST fail if a future change
adds one without updating this contract deliberately.

#### Scenario: Happy path shape on both providers

- GIVEN a recorded/derived fixture representing a PR/MR with at least one review
- WHEN `prReviews` is called against each provider's normalizer
- THEN the result is an array of entries containing exactly `{ state, author }`
- AND no entry contains a `body` key

#### Scenario: Fetch failure yields null, never a fabricated array

- GIVEN the underlying API call throws or rejects
- WHEN `prReviews` is called
- THEN the result is `null`, never `[]` or a fabricated array
- AND the function never throws

### Requirement: GitHub recorded fixtures

The system MUST provide `github-prReviews-happy.json`, recorded from a real
GitHub Reviews API response (not hand-authored), carrying
`_provenance.recorded` and scrubbed of sensitive repo/user data following
the `github-prView-happy.json` discipline. `github-prReviews-failure.json`
MAY be hand-authored (a fetch-failure case cannot be recorded) and MUST
carry `_provenance.derived`.

#### Scenario: Recorded fixture provenance

- GIVEN `github-prReviews-happy.json`
- WHEN its provenance is inspected
- THEN `_provenance.recorded` is present and true
- AND the fixture contains a real review entry with non-null `state` and `author`

### Requirement: GitLab derived fixtures

The system MUST provide `gitlab-prReviews-happy.json` and
`gitlab-prReviews-failure.json` as hand-derived fixtures (GitLab's
approvals endpoint MUST NOT be recorded live per existing convention), each
carrying `_provenance.derived`. The happy fixture MUST reflect the
approvals-API-to-`{state:'APPROVED', author}` normalization documented in
`vcs-contract.md`, including the GitLab-specific limitation that no
per-reviewer state history exists (one entry per approver only).

#### Scenario: GitLab happy fixture normalizes via approvals mapping

- GIVEN `gitlab-prReviews-happy.json` representing an `approved_by[]` payload
- WHEN normalized
- THEN the result contains one `{state:'APPROVED', author}` entry per approver
- AND no entry carries any state other than `'APPROVED'`

### Requirement: Chain assertion through the live consumer

The system MUST have a chain assertion driving a `prReviews`-shaped
normalizer output into `evaluateBrainWritesReviewed` (the DETECTION gate
that consumes `prReviews` in production today), with no inline fakes
standing in for the normalizer's real output. This targets the current
consumer deliberately so the test remains green after `prReviewBodies`
(the deferred split-verb fix) lands, since `prReviews` and its callers are
explicitly unchanged by that future work.

#### Scenario: Reviewed PR passes the DETECTION gate

- GIVEN a `prReviews` happy fixture normalized into `{state, author}` entries
- WHEN the result is passed as `reviews` into `evaluateBrainWritesReviewed`
- THEN the gate does not return `level: 'warn'` for missing reviews
- AND the gate's reasoning reflects the real normalized entries, not a fixture-shaped fake

#### Scenario: Fetch failure propagates to a warn, never a throw

- GIVEN a `prReviews` failure fixture normalizing to `null`
- WHEN the gate receives an empty `reviews` array as the caller's fallback for `null`
- THEN `evaluateBrainWritesReviewed` returns `level: 'warn'` with a reason citing missing/unsupported reviews
- AND the gate never throws
