# Draft update for `vcs-contract.md`'s `mrList` row (Tier 2, maintainer moves it)

Target: `brain/core/methodology/vcs-contract.md`, the `mrList` row (currently
line 29). `brain/core/**` is Tier 3 — this file only proposes the wording;
applying it is a maintainer step, following the
`issue-606-rollup-reports-its-cause/brain-drafts/vcs-contract-prStatusRollup-row.patch`
precedent's shape (a factual, single-row diff against the same file).

## Current text

```
| `mrList` | `({ project, state }) -> Promise<[{ number, title, headBranch }]>` | GL `merge_requests`/`source_branch` → `headBranch`. Unlike `prView`/`prReviews`/`labelEvents`/`prStatusRollup`, `mrList` does not wrap its transport call — `runJson` throws on a non-zero exit or malformed JSON and neither provider catches it, so a transport failure REJECTS rather than yielding a null-shape (issue #355, M10 Phase 2 rank-3). Pagination: GH requests `per_page=100`, GL requests `per_page=50`; neither provider paginates beyond the first page, so a project with more open MRs/PRs than the lower threshold silently truncates at a different point per provider (follow-up issue, not fixed here). |
```

## Proposed text (issue #930, #936 — decisions D1/D2)

```
| `mrList` | `({ project, state, headBranch? }) -> Promise<[{ number, title, headBranch, state, merged }]>` | GL `merge_requests`/`source_branch` → `headBranch`. Unlike `prView`/`prReviews`/`labelEvents`/`prStatusRollup`, `mrList` does not wrap its transport call — `runJson` throws on a non-zero exit or malformed JSON and neither provider catches it, so a transport failure REJECTS rather than yielding a null-shape (issue #355, M10 Phase 2 rank-3). Additive `state`/`merged` (issue #930, #936 D1): every item now also carries the PR's `state` (`'open'\|'closed'`) and a `merged` boolean\|null, alongside the unchanged `number`/`title`/`headBranch`. GH: `state = r.state` verbatim; `merged = r.merged_at !== undefined ? r.merged_at !== null : null`. GL has no separate `merged` boolean of its own — `mapGitlabMrState()` folds GitLab's three-state native `state` into the shared pair: `opened`→`open`/`false`, `closed`→`closed`/`false`, `merged`→`closed`/`true`; anything else (e.g. `locked`) is unrepresentable in the shared enum and maps to `null`/`null` rather than guessed. Optional `headBranch` filter (#936 D2), added so a caller (the lane sweep, #936) can bound a closed-PR lookup to one branch instead of scanning the whole repo: GH adds `head=<owner>:<branch>` (`owner` derived from `project`, URL-encoded); GL adds `source_branch=<branch>` (URL-encoded) and raises its own page size to 100 (matching GH's). Unfiltered calls stay byte-identical to the pre-#930/#936 query on both providers — no new param is ever sent unless `headBranch` is explicitly passed. When `headBranch` is set and the page comes back full (100 items), BOTH providers THROW rather than risk deciding a closed-PR outcome from a silently truncated page. Pagination: GH requests `per_page=100` (unfiltered or filtered), GL requests `per_page=50` unfiltered / `per_page=100` when `headBranch` is set; neither provider paginates beyond the first page otherwise, so a project with more open MRs/PRs than the lower threshold silently truncates at a different point per provider (follow-up issue, not fixed here). |
```

## Why now

`#936`'s R8 reversal (D4) needs `mrList` to see closed-and-unmerged PRs, not
only open ones, to decide whether a branch's only PR was human-closed. The
cross-day sweep (`lane/sweep.mjs`) reuses the same additive fields and the
`headBranch` filter to classify each `memory/<host>-*` branch's PR status
without a repo-wide scan. Both fields and the filter are purely additive —
every pre-#930 caller (`board`, `queue`, `stranded`) keeps reading
`number`/`title`/`headBranch` unchanged (see `vcs.contract.test.mjs`'s own
"existing consumers unaffected" scenario, and design.md's D2 rationale).

No policy change is proposed here — this is a factual contract update only.
