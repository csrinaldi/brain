# Delta for mrlist-contract

Issue #355 — M10 Phase 2 rank-3. `mrList` is the fan-out verb of the reviewer
subsystem (`review/board.mjs:71`, `review/queue.mjs:50`, `brain-next.mjs:128`,
`project-status.mjs:122` all start from it and iterate its output) and has zero
cross-provider contract-parity coverage today — only two isolated per-provider
happy-path unit tests exist (`providers.test.mjs:155-165`). This is a new
capability spec, sibling to `vcs-issue-view-contract` and `vcs-pr-reviews-contract`,
plus one amendment to the existing `vcs-contract.md` documentation.

## ADDED Requirements

### Requirement: `mrList` contract shape assertion across providers

The system MUST have an automated contract test asserting that both provider
normalizers (`github`, `gitlab`) emit `mrList` results conforming to exactly
`{ number, title, headBranch }` per entry, parameterized across both providers
in `vcs.contract.test.mjs` following the existing `labelEvents`/`prReviews`/
`issueView` pattern. The shape lock MUST be exact-key (`deepEqual` on sorted
`Object.keys`), rejecting both a narrowed and a widened normalizer output —
mirroring rank-2's `{ state, author }` lock on `prReviews`.

#### Scenario: Happy path shape on both providers

- GIVEN a recorded/derived fixture representing an open MR/PR list with multiple entries
- WHEN `mrList` is called against each provider's normalizer
- THEN each entry contains exactly `{ number, title, headBranch }` (`deepEqual` on sorted keys)
- AND the full normalized array is asserted via `deepEqual` against the fixture's expected shape

#### Scenario: Empty result is `[]`, never null or undefined

- GIVEN a fixture representing zero open MRs/PRs
- WHEN `mrList` is called against each provider's normalizer
- THEN the result is `[]` exactly, never `null` or `undefined` — `board.mjs` and
  `queue.mjs` iterate the result unguarded

#### Scenario: Transport failure is asserted as a throw, not fabricated as null

- GIVEN the underlying transport call (`runJson`) rejects on a non-zero exit or malformed JSON
- WHEN `mrList` is called against each provider's normalizer
- THEN the call is asserted via `assert.rejects` on both providers — locking today's
  actual throw-on-failure behavior rather than asserting a `null`-on-uncomputable
  convention `mrList` does not implement
- AND this scenario is documented in-test as a divergence from the never-throws
  discipline the sibling read verbs (`prView`, `prReviews`, `labelEvents`,
  `prStatusRollup`) follow, not an endorsement of the divergence

### Requirement: GitHub `mrList` fixture provenance

The system MUST provide `github-mrList-happy.json`, recorded from a real GitHub
API response via a new `recordGithubMrList` case in `fixtures/record-fixtures.mjs`
(not hand-authored), carrying `_provenance.recorded`, following the
`github-prView-happy.json` discipline. `github-mrList-empty.json` and
`github-mrList-failure.json` MAY be hand-authored and MUST carry
`_provenance.derived`.

#### Scenario: Recorded fixture provenance

- GIVEN `github-mrList-happy.json`
- WHEN its provenance is inspected
- THEN `_provenance.recorded` is present and true

### Requirement: GitLab `mrList` fixtures and shared spawn-transport seam

The system MUST provide `gitlab-mrList-{happy,empty,failure}.json` as
hand-derived fixtures, each carrying `_provenance.derived`, reflecting
GitLab's `merge_requests`/`source_branch` → `headBranch` field mapping
documented in `vcs-contract.md`. Because `gitlab.mrList` spawns `glab` via
`runJson` (`lib/exec.mjs:29`) rather than going through `gitlabApiFetch`, the
existing `gitlabCallArgs` fetch-injection helper does not apply; the suite
MUST instead drive both providers through the shared `runJson`/`setSpawn` seam
already used by GitHub's JSON-spawn verbs, renaming `githubJsonCallArgs` to a
provider-neutral `jsonSpawnCallArgs` and registering it under both provider
entries.

#### Scenario: GitLab happy fixture normalizes field names correctly

- GIVEN `gitlab-mrList-happy.json` representing a `merge_requests`/`source_branch`-shaped payload
- WHEN normalized
- THEN each entry's `headBranch` derives from `source_branch`

#### Scenario: Every fixture passes provenance assertion

- GIVEN all six `mrList` fixtures (three GitHub, three GitLab)
- WHEN `assertProvenance` runs against each
- THEN each carries exactly one of `_provenance.recorded` / `_provenance.derived`

## MODIFIED Requirements

### Requirement: `vcs-contract.md` `mrList` row documents failure and pagination semantics

The `vcs-contract.md` `Required verbs` table row for `mrList` MUST document
that the verb throws on transport failure — `runJson` throws on a non-zero
exit or malformed JSON and neither provider wraps the call in a try/catch —
in explicit contrast to the never-throws, null-on-uncomputable convention
documented for `prView`, `prReviews`, `labelEvents`, and `prStatusRollup` in
the same table. The row MUST also document the pagination asymmetry: GitHub
requests `per_page=100`, GitLab requests `per_page=50`, and neither provider
paginates beyond the first page, so a project with more open MRs/PRs than the
lower threshold silently truncates at a different point per provider.

(Previously: the row stated only the normalized return shape and the
`source_branch` → `headBranch` mapping; it was silent on failure behavior and
on pagination, leaving both as undocumented, fixture-unobservable defects.)

#### Scenario: Documentation reflects the throw-on-failure divergence

- GIVEN a reader consults the `vcs-contract.md` `mrList` row
- WHEN checking whether `mrList` follows the never-throws discipline of its sibling read verbs
- THEN the row states explicitly that `mrList` throws on transport failure, unlike `prView`/`prReviews`/`labelEvents`/`prStatusRollup`

#### Scenario: Documentation reflects the pagination asymmetry

- GIVEN a reader consults the `vcs-contract.md` `mrList` row
- WHEN checking whether large MR/PR lists are fully returned
- THEN the row states that GitHub requests `per_page=100`, GitLab requests `per_page=50`, and neither paginates further — noted as a follow-up issue, not fixed in this change
