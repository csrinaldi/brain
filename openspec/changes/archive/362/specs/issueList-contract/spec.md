# Delta for issueList-contract

Issue #362 — M10 Phase 2 rank-4. `issueList` is the fan-out verb behind
`tracker-board.mjs` and `project-status.mjs`'s issue views and has zero
cross-provider contract-parity coverage today — only two isolated per-provider
unit tests exist (`providers.test.mjs:136-151`, driven by hand-built
`fakeSpawn` payloads, not recorded/derived fixtures). This is a new capability
spec, sibling to `vcs-issue-view-contract`, `vcs-pr-reviews-contract`, and
`mrlist-contract` (issue #355, rank-3), plus one amendment to the existing
`vcs-contract.md` documentation.

## ADDED Requirements

### Requirement: `issueList` contract shape assertion across providers

The system MUST have an automated contract test asserting that both provider
normalizers (`github`, `gitlab`) emit `issueList` results conforming to
exactly `{ number, title, labels }` per entry, parameterized across both
providers in `vcs.contract.test.mjs` following the existing
`labelEvents`/`prReviews`/`issueView`/`mrList` pattern. The shape lock MUST be
exact-key (`deepEqual` on sorted `Object.keys`), rejecting both a narrowed and
a widened normalizer output — mirroring rank-3's `{ number, title, headBranch }`
lock on `mrList`.

#### Scenario: Happy path shape on both providers

- GIVEN a recorded/derived fixture representing an open-issue list with multiple entries
- WHEN `issueList` is called against each provider's normalizer
- THEN each entry contains exactly `{ number, title, labels }` (`deepEqual` on sorted keys)
- AND the full normalized array is asserted via `deepEqual` against the fixture's expected shape, pinning both values and order

#### Scenario: Empty result is `[]`, never null or undefined

- GIVEN a fixture representing zero open issues
- WHEN `issueList` is called against each provider's normalizer
- THEN the result is `[]` exactly, never `null` or `undefined` — `tracker-board.mjs`
  and `project-status.mjs` iterate the result unguarded

#### Scenario: Transport failure is asserted as a throw, not fabricated as null

- GIVEN the underlying transport call (`runJson`) rejects on a non-zero exit or malformed JSON
- WHEN `issueList` is called against each provider's normalizer
- THEN the call is asserted via `assert.rejects` on both providers — locking today's
  actual throw-on-failure behavior rather than asserting a `null`-on-uncomputable
  convention `issueList` does not implement
- AND this scenario is documented in-test as a divergence from the never-throws
  discipline the sibling read verbs (`prView`, `prReviews`, `labelEvents`,
  `prStatusRollup`) follow, and as the same divergence already pinned for
  `mrList` (rank-3) — not an endorsement of the divergence

#### Scenario: GitHub happy fixture proves the pull_request filter under contract

- GIVEN `github-issueList-happy.json`, recorded from a real GitHub `/issues`
  response, which returns both plain issues and PR entries (each PR entry
  carries a `pull_request` field) from the same endpoint
- WHEN normalized by `github.issueList`
- THEN every entry in the result corresponds to a source item lacking
  `pull_request` — the PR entries are filtered out, not merely ignored by
  coincidence of the fixture's contents

#### Scenario: GitHub label objects normalize to flat name strings

- GIVEN a GitHub fixture entry whose `labels` field is an array of label
  objects (`{ name, color, ... }`)
- WHEN normalized by `github.issueList`
- THEN the entry's `labels` is an array of plain name strings
  (`labels.map(l => l.name)`), matching GitLab's already-flat `labels` shape —
  the two providers converge on the same wire shape from different source
  shapes

### Requirement: GitHub `issueList` fixture provenance

The system MUST provide `github-issueList-happy.json`, recorded from a real
GitHub API response via a new `recordGithubIssueList` case in
`fixtures/record-fixtures.mjs` (not hand-authored), carrying
`_provenance.recorded`, following the `github-mrList-happy.json` discipline
established in rank-3. The recorded response MUST include at least one PR
entry alongside plain issues so the `pull_request` filter is exercised against
a real payload shape, not a hand-simulated one. `github-issueList-empty.json`
and `github-issueList-failure.json` MAY be hand-authored and MUST carry
`_provenance.derived`.

#### Scenario: Recorded fixture provenance

- GIVEN `github-issueList-happy.json`
- WHEN its provenance is inspected
- THEN `_provenance.recorded` is present and true

### Requirement: GitLab `issueList` fixtures and shared spawn-transport seam

The system MUST provide `gitlab-issueList-{happy,empty,failure}.json` as
hand-derived fixtures, each carrying `_provenance.derived`, reflecting
GitLab's `iid` → `number` field mapping and its already-flat `labels` array
(no per-label object unwrapping needed) documented in `vcs-contract.md`.
Because `gitlab.issueList` spawns `glab` via `runJson` (`lib/exec.mjs:29`)
rather than going through `gitlabApiFetch`, the existing `gitlabCallArgs`
fetch-injection helper does not apply; the suite MUST instead drive both
providers through the shared `runJson`/`setSpawn` seam via the
provider-neutral `jsonSpawnCallArgs` helper already established in rank-3 for
`mrList` — registering `issueList` under both provider entries reuses that
helper as-is, with no further renaming or seam changes required.

#### Scenario: GitLab happy fixture normalizes field names correctly

- GIVEN `gitlab-issueList-happy.json` representing an `iid`-keyed issue-list payload
- WHEN normalized
- THEN each entry's `number` derives from `iid`, and `labels` passes through unchanged (already a flat string array)

#### Scenario: Every fixture passes provenance assertion

- GIVEN all six `issueList` fixtures (three GitHub, three GitLab)
- WHEN `assertProvenance` runs against each
- THEN each carries exactly one of `_provenance.recorded` / `_provenance.derived`

## MODIFIED Requirements

### Requirement: `vcs-contract.md` `issueList` row documents failure, pagination, and normalization semantics

The `vcs-contract.md` `Required verbs` table row for `issueList` MUST document
that the verb throws on transport failure — `runJson` throws on a non-zero
exit or malformed JSON and neither provider wraps the call in a try/catch —
in explicit contrast to the never-throws, null-on-uncomputable convention
documented for `prView`, `prReviews`, `labelEvents`, and `prStatusRollup` in
the same table, and consistent with the divergence already documented for
`mrList` (rank-3). The row MUST also document the pagination asymmetry:
GitHub requests `per_page=100`, GitLab requests `per_page=50`, and neither
provider paginates beyond the first page. The row MUST additionally document
two GitHub-only normalization steps absent on GitLab: (1) GitHub's `/issues`
endpoint returns both issues and PRs, so `github.issueList` filters out any
entry carrying a `pull_request` field before mapping; (2) GitHub's `labels`
field is an array of label objects, unwrapped to plain name strings via
`.map(l => l.name)`, whereas GitLab's `labels` field is already a flat string
array requiring no unwrapping.

(Previously: the row stated only the normalized return shape and the
`state`/`assignee` parameter semantics; it was silent on failure behavior,
pagination, the PR-filtering step, and the label-shape normalization,
leaving all four as undocumented, fixture-unobservable behaviors.)

#### Scenario: Documentation reflects the throw-on-failure divergence

- GIVEN a reader consults the `vcs-contract.md` `issueList` row
- WHEN checking whether `issueList` follows the never-throws discipline of its sibling read verbs
- THEN the row states explicitly that `issueList` throws on transport failure, unlike `prView`/`prReviews`/`labelEvents`/`prStatusRollup`, matching `mrList`'s already-documented divergence

#### Scenario: Documentation reflects the pagination asymmetry

- GIVEN a reader consults the `vcs-contract.md` `issueList` row
- WHEN checking whether large issue lists are fully returned
- THEN the row states that GitHub requests `per_page=100`, GitLab requests `per_page=50`, and neither paginates further

#### Scenario: Documentation reflects the GitHub-only filtering and label normalization

- GIVEN a reader consults the `vcs-contract.md` `issueList` row
- WHEN checking why GitHub and GitLab converge on the same `{ number, title, labels }` shape from different source payloads
- THEN the row states that GitHub filters out `pull_request`-carrying entries and unwraps label objects to name strings, while GitLab's `iid`/flat-`labels` payload needs only the `iid` → `number` rename
