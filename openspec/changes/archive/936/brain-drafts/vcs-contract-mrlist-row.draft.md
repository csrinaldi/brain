# Amendment draft — `vcs-contract.md`, the `mrList` row gains `state`/`merged` and the `headBranch` filter (issues #930, #936)

> **Tier 2 draft. Not yet promoted.** `brain/core/**` is never edited by an agent. The
> maintainer promotes it after #1077 merges:
>
> ```
> npm run brain:promote -- openspec/changes/archive/936/brain-drafts/vcs-contract-mrlist-row.draft.md
> ```
>
> The code shipped in PR #1074 (`1f12020d`). The rationale is in
> `vcs-contract-mrlist-row.md` in this folder.

```brain-amendment/1
target: brain/core/methodology/vcs-contract.md
issue: 936
```

## Edit 1 — the `mrList` row (`vcs-contract.md:29`)

```amend-find
| `mrList` | `({ project, state }) -> Promise<[{ number, title, headBranch }]>` | GL `merge_requests`/`source_branch` → `headBranch`. Unlike `prView`/`prReviews`/`labelEvents`/`prStatusRollup`, `mrList` does not wrap its transport call — `runJson` throws on a non-zero exit or malformed JSON and neither provider catches it, so a transport failure REJECTS rather than yielding a null-shape (issue #355, M10 Phase 2 rank-3). Pagination: GH requests `per_page=100`, GL requests `per_page=50`; neither provider paginates beyond the first page, so a project with more open MRs/PRs than the lower threshold silently truncates at a different point per provider (follow-up issue, not fixed here). |
```

```amend-replace
| `mrList` | `({ project, state, headBranch? }) -> Promise<[{ number, title, headBranch, state, merged }]>` | GL `merge_requests`/`source_branch` → `headBranch`. Unlike `prView`/`prReviews`/`labelEvents`/`prStatusRollup`, `mrList` does not wrap its transport call — `runJson` throws on a non-zero exit or malformed JSON and neither provider catches it, so a transport failure REJECTS rather than yielding a null-shape (issue #355, M10 Phase 2 rank-3). Additive `state`/`merged` (issue #930, #936 D1): every item now also carries the PR's `state` (`'open'\|'closed'`) and a `merged` boolean\|null, alongside the unchanged `number`/`title`/`headBranch`. GH: `state = r.state` verbatim; `merged = r.merged_at !== undefined ? r.merged_at !== null : null`. GL has no separate `merged` boolean of its own — `mapGitlabMrState()` folds GitLab's three-state native `state` into the shared pair: `opened`→`open`/`false`, `closed`→`closed`/`false`, `merged`→`closed`/`true`; anything else (e.g. `locked`) is unrepresentable in the shared enum and maps to `null`/`null` rather than guessed. Optional `headBranch` filter (#936 D2), added so a caller (the lane sweep, #936) can bound a closed-PR lookup to one branch instead of scanning the whole repo: GH adds `head=<owner>:<branch>` (`owner` derived from `project`, URL-encoded); GL adds `source_branch=<branch>` (URL-encoded) and raises its own page size to 100 (matching GH's). Unfiltered calls stay byte-identical to the pre-#930/#936 query on both providers — no new param is ever sent unless `headBranch` is explicitly passed. When `headBranch` is set and the page comes back full (100 items), BOTH providers THROW rather than risk deciding a closed-PR outcome from a silently truncated page. Pagination: GH requests `per_page=100` (unfiltered or filtered), GL requests `per_page=50` unfiltered / `per_page=100` when `headBranch` is set; neither provider paginates beyond the first page otherwise, so a project with more open MRs/PRs than the lower threshold silently truncates at a different point per provider (follow-up issue, not fixed here). |
```
