---
status: tasked
issue: 886
---

# mrAutoMerge Specification (#886)

Refines archive/862/spec.md's requirement "merge auto-merges only where the tier allows"
(owning slice: 2.5, ADR-0034 L2) into the verb's own testable contract. D1–D6 ratified
2026-09-09 (`sdd/issue-886-mr-auto-merge/ruling`).

## Requirements

### Requirement: signature and fail-closed default (D1)

The verb MUST expose `mrAutoMerge({ project, number, requiredReviews = 1, apiBase?, token?,
proxyUrl?, fetchImpl? })`. An omitted `requiredReviews` MUST refuse, mirroring
`branchProtect`'s default.

#### Scenario: default refuses
- GIVEN `requiredReviews` is omitted
- WHEN `mrAutoMerge` is called
- THEN it returns `{enabled:false,reason:'requires-human-approval'}`

### Requirement: tier refusal never touches the provider (D1)

When `requiredReviews > 0`, the verb MUST refuse WITHOUT calling the provider seam (`gh`
spawn / `fetchImpl`).

#### Scenario: refusal is provable, not assumed
- GIVEN `requiredReviews: 1` and a provider seam that fails the test if invoked
- WHEN `mrAutoMerge` is called
- THEN it returns `{enabled:false,reason:'requires-human-approval'}` AND the seam records
  zero calls

### Requirement: armed merge, squash hardcoded (D2 happy path, D3)

When `requiredReviews: 0`, the verb MUST arm auto-merge with squash, hardcoded — no
`method` parameter. GitHub: `gh pr merge <number> --auto --squash --repo <project>`.
GitLab: `PUT projects/{enc}/merge_requests/{iid}/merge` with
`merge_when_pipeline_succeeds: true, squash: true`.

#### Scenario: GitHub arms
- GIVEN `requiredReviews: 0` and a successful `gh pr merge --auto --squash`
- WHEN `mrAutoMerge` is called
- THEN it returns `{enabled:true,url}`

#### Scenario: GitLab arms
- GIVEN `requiredReviews: 0` and a successful merge PUT
- WHEN `mrAutoMerge` is called
- THEN it returns `{enabled:true,url}`

### Requirement: url is reported, never constructed (D4)

`url` MUST be `string | null`, taken from the provider response. It MUST NOT be built from
`project` plus a guessed host.

#### Scenario: no url reported
- GIVEN a provider response that carries no url
- WHEN `mrAutoMerge` arms successfully
- THEN `url` is `null`

### Requirement: enabled:true means armed, never merged (D4)

`{enabled:true}` MUST mean "auto-merge is armed"; the shape MUST NOT carry `merged`, `sha`,
or any provider field.

#### Scenario: armed is distinct from merged
- GIVEN a successful arm on a PR whose required checks have not gone green yet
- WHEN the result's keys are inspected
- THEN they are exactly `{enabled,url}` — no `merged`, no `sha`

### Requirement: unsupported vs transport (D2)

`unsupported` MUST cover the forge refusing the operation itself — GitHub's "auto-merge is
not allowed for this repository" stderr class (captured live, not invented); GitLab `405`/
`406`. Network failure, `5xx`, `401`, `403` MUST classify as `transport`, carrying `error`.

#### Scenario: GitHub unsupported
- GIVEN `gh pr merge --auto` fails with the captured "auto-merge is not allowed" stderr
- WHEN `mrAutoMerge` is called
- THEN it returns `{enabled:false,reason:'unsupported'}`

#### Scenario: GitLab unsupported
- GIVEN the merge PUT responds `405` or `406`
- WHEN `mrAutoMerge` is called
- THEN it returns `{enabled:false,reason:'unsupported'}`

#### Scenario: transport failure
- GIVEN a network error, a `5xx`, or a `401`/`403` response
- WHEN `mrAutoMerge` is called
- THEN it returns `{enabled:false,reason:'transport',error}`

### Requirement: fixed key set, never throws (D4)

Every outcome MUST carry exactly the keys its branch defines, pinned by
`Object.keys(result).sort()`. The verb MUST NOT throw on any path.

#### Scenario: pinned keys
- GIVEN any of the outcomes above
- WHEN its key set is sorted
- THEN it matches the pinned set for that outcome, exactly

#### Scenario: never throws
- GIVEN a mocked provider call that itself throws
- WHEN `mrAutoMerge` is called
- THEN the promise resolves, never rejects

### Requirement: dispatchable and documented (D5)

`mrAutoMerge` MUST be a member of `cli.mjs`'s `VERBS` array AND a row in
`vcs-contract.md`'s Required Verbs table. Neither may ship without the other.

#### Scenario: drift guard stays green
- GIVEN both providers export `mrAutoMerge`, it is in `VERBS`, and the doc row is committed
- WHEN `verb-contract-drift-guard.test.mjs` runs, unmodified
- THEN all three of its checks pass

### Requirement: scope boundary (D6)

This slice MUST NOT wire a caller, enable `allow_auto_merge` on any repository, or ship the
collector. `mrCreate` and every other verb MUST be unchanged.

#### Scenario: no caller, no enablement
- GIVEN this slice ships alone
- WHEN the repository's `allow_auto_merge` setting and `cli.mjs`'s other verbs are inspected
- THEN neither changed, and no caller invokes `mrAutoMerge`

## STRICT TDD test map

All rows below are `providers/vcs.contract.test.mjs`'s `MR_AUTO_MERGE_PROVIDERS` block
(except the last). Titles omit the shared `${providerName}.mrAutoMerge (contract): ` prefix;
`gh:`/`gl:` mark provider-specific titles.

| Requirement | Test case title suffix |
|---|---|
| fail-closed default | an omitted requiredReviews refuses |
| tier refusal, seam uncalled | requiredReviews>0 refuses, provider seam UNCALLED |
| armed, GitHub | gh: armed → {enabled:true,url} via gh pr merge --auto --squash |
| armed, GitLab | gl: armed → {enabled:true,url} via PUT .../merge, pipeline+squash |
| url never constructed | url is null when the provider reports none |
| armed ≠ merged | armed shape carries no merged/sha field |
| unsupported, GitHub | gh: captured "auto-merge not allowed" stderr → unsupported |
| unsupported, GitLab | gl: 405/406 merge response → unsupported |
| transport | network/5xx/401/403 → transport, carries error |
| pinned keys | outcome key set is pinned, exactly |
| never throws | never throws, even under a mocked transport failure |
| drift guard (D5, acceptance) | `verb-contract-drift-guard.test.mjs` unmodified: checks `:74`/`:82`/`:120` |

## Non-goals (D6)

#888 (caller, lane push + PR), #887 (collector), #889 (lane-paths/lane-scrub contexts),
production `allow_auto_merge` enablement (#805), any change to `mrCreate` or any other verb.
