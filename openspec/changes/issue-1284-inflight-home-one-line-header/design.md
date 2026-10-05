---
status: draft
issue: 1284
---

# Design — inflight-home-one-line-header (issue 1284)

## Technical approach

Numbering continues from #1276 (D86–D93) at D94. The rulings R-A..R-H of `proposal.md` are binding. Every join, filter and ordering lives in pure `ui/lib/*.mjs`. `app.js` only places elements.

```
snapshot.mjs readChanges(+_run) ── 1 git log ──▶ changes[i].lastCommit           (D94)
changes · localWorktrees · remoteChanges · prs · hierarchy · graph(titles)
   └─▶ lib/inflight-model.mjs buildInflight(sections, {nowMs}) ─▶ {rows, stale, unknown, missingSources}   (D95-D98)
         └─▶ app.js renderInflight()  first child of mounts.canvas in renderLanes   (R-H)
lib/header-model.mjs epic {short, reason} ─▶ renderStatus (one line, title) + degradationBands 'epic'  (D99-D100)
lib/sdd-model.mjs sddForIssue {absent} + quietAbsence() ─▶ renderNodeSdd returns null   (D101)
```

## Decisions

| # | Decision | Rejected | Why |
|---|---|---|---|
| D94 | **R-G is measured server-side, once per snapshot.** `readChanges` takes `_run` (`buildSnapshot` passes its `run`, `snapshot.mjs:534`). After the active rows are built, ONE call: `git log --no-renames --format=%x1e%cI%x1f%an --name-only -- <dir…>` over the non-archived dirs only. The log is newest first; the first record naming a path under a dir sets that dir. Each active row gains `lastCommit`: `{ok:true, at, author}`, or `{ok:false, reason}` with `no commit touches <dir> on the served tree` (untracked dir) or `the change-dir log could not be read: <git line>` (the call threw; every active row gets it). Archived rows get `{ok:false, reason:'not read for archived dirs'}`, so both kinds keep one shape (`snapshot.mjs:242`). With zero active dirs no git call is made. | `git log -1` per dir; a new snapshot section | 57 dirs would be 57 spawns. A separate section duplicates the dir list and can disagree with `changes`. |
| D95 | **`buildInflight(sections, {nowMs})`** in a new `lib/inflight-model.mjs`. `sections = {changes, localWorktrees, remoteChanges, prs, hierarchy, graph}`. It returns `{ok:true, value:{rows, unknown, stale, missingSources}}`; it never returns `ok:false` (R-C). `missingSources` is `[{name, state:'pending'|'failed', reason}]` for each of the five data sections whose `ok !== true`, using `pending === true` as `banners.mjs:68` does. `graph` supplies titles only and is not listed. | Returning `ok:false` when a source is missing | One unread source must not hide the others' rows. |
| D96 | **The in-flight filter (R-B, R-F).** `hierarchyOf` (`rollup-model.mjs:15`) gives the state. An issue is a candidate if `changes` (non-archived), `localWorktrees.entries`, `remoteChanges.branches` (`kind:'grammar'`) or `prs` names it. It is kept when its entry's `state` is `open`, or when it is in the map with `state: null` (row `state:'unknown'`, R-F). An issue absent from the map is not open: the open list feeds the map completely (`hierarchy-adapter.mjs:30`). While `hierarchy` is not ok, no row is drawn; the value carries `candidates: N` and the section says `N candidate issue(s); their open/closed state is not read yet (hierarchy: <reason>)`. It never renders "nothing in flight" while `missingSources` is non-empty. | Provisional rows before the filter | On 2026-10-04 that is 54 closed change dirs of 57. See the first MAINTAINER QUESTION. |
| D97 | **One row per issue.** `{issue, title, state, activityAt, activityFrom, worktrees:[{leaf, dirState}], branches:[{branch, author, tipAt}], prs:[number], changeDir, authors:[name], onThisMachine}`. `onThisMachine` is true when any worktree holds the issue. A worktree has no author field (`local-worktrees.mjs:124`), so the row says `on this machine` and invents no name. `authors` are the distinct branch `author`s, plus `lastCommit.author` for a change-dir-only row, worded with `authorLine` (`remote-model.mjs:17`). | Reading `git config user.name` | That is a new read and says who is configured, not who did the work. |
| D98 | **Activity, order and stale (R-A, R-G).** `activityAt` is the latest of the non-null worktree `touchedAt` values and branch `tipAt` values. For a change-dir-only row it is `lastCommit.at`. If there is none, the row goes to `unknown` and is marked `activity unknown`. `STALE_DAYS = 7` is exported. A row is stale when `nowMs - Date.parse(activityAt) >= STALE_DAYS * 86400000`. The order is `rows` newest first (ties by issue ascending), then `unknown` by issue, then the collapsed `stale (N)` group, newest first, where N is `stale.length`. `nowMs` is a parameter, because `source-guard.test.mjs:79` forbids `Date.now` in `lib/`; `app.js` passes its own `nowMs()`. | The model reading the clock | Tests pin `nowMs`, so they are deterministic. |
| D99 | **The one-line header (R-D).** `buildHeaderModel` returns `epic: {ok:false, short:'epic: not resolved', reason: EPIC_JOIN_PENDING}`. `renderStatus` (`app.js:522-523`) draws only `short`, with `title = reason`, and the `status-epic-reason` span is deleted. Facts that stay inline: wordmark, served branch with its stamp, live, poll text, countdown, epic short, counts, theme, the three controls. A span that can grow long (`.served-branch`, `.poll-indicator`, the counts reason) carries its full text in `title`. | Moving counts or controls out of the bar | Every current fact stays where it is, so nothing is lost. |
| D100 | **CSS: no wrap.** `.status-bar` changes `flex-wrap: wrap` (`app.css:161`) to `nowrap` and gains `overflow: hidden`. The long spans get `min-width:0; flex:0 1 auto; white-space:nowrap; overflow:hidden; text-overflow:ellipsis`. Buttons, the theme control and `.title` get `flex:none`. `.status-epic-reason` (`:225`) is removed. At 1600 px the bar fits. Narrower, the long spans truncate, and their full text stays in `title`. | Horizontal scroll | A scrolling header hides its controls. |
| D101 | **`degradationBands` gains an `epic` input.** It adds the band `{id:'epic', text: epic.reason}` when `epic.ok === false`, after the sections band. `renderBands` (`app.js:469`) passes `buildHeaderModel(...).value.epic`. | A tooltip only | R-D names both `title` and `#banners`. |
| D102 | **Card absence (R-E).** `sddForIssue` adds `absent: true` to its result when the issue has no change dir and `localOnlyReason` is null (`sdd-model.mjs:273`). The reason text is unchanged. A new export, `quietAbsence(found, localSection, remoteSection, issue)`, is true when `found.absent`, both sections are ok, no `localWorktrees` entry has that issue (any `dirState`), and no `remoteChanges` branch has it. If either section is unread, the line stays, because no work was not measured. `renderNodeSdd` returns `null` when it is true, and `renderNodeCard` (`app.js:898`) appends the strip only when it is not null. The drawer is untouched. Its tabs already say `no change dir at openspec/changes/issue-N-*` (`change-route.mjs:63`) and its empty state says `no change dir for this issue in the read model` (`app.js:1705`). | Dropping the line when a source is unread | That treats "not read" as "nothing there", the empty-on-failure defect. |
| D104 | **Kind and progress on the row (R1284-14).** `rowOf` adds `kind` and `progress`. `kind` is the hierarchy entry's `level` only when `levelSource` is a non-null value other than `'default'` (the adapter sets `'block'` for declared epics and `'default'` for everything else, so a defaulted `ticket` is not claimed as measured); otherwise `null`. `progress` is `progressLabel(change.progress, SOURCE.workingTree, {prefix:'tasks'})` of the first non-archived change dir row that carries a `progress` value, else `null`. Worktree-, branch- and PR-only rows get `null`. `facts` leads with the kind and progress strings. | Showing `level` always; reading tasks.md per row | The default level is not data; the snapshot measures progress only for the served tree. |
| D105 | **Activity is the max of every measured time.** `activityOf` takes the latest of worktree `touchedAt`, branch `tipAt` and change dir `lastCommit.at` (when `ok`) together. `headCommitAt` (D103) is consulted only when that pool is empty, so a newer head commit never outranks a measured time. | Dir commit only for dir-only rows | A fresher dir commit was ignored while a branch tip existed, understating activity. |

RULED 2026-10-04 (maintainer): D96 as written. While `hierarchy` is pending or failed the section shows only the candidate count and the missing sources, never unfiltered provisional rows.

RULED 2026-10-04 (orchestrator default, maintainer delegated "go to the PR"; stated in the PR body): yes. One extra local call, `git show -s --format=%cI <sha…>` over the head shas of worktrees whose change dir is `missing` and that have no branch time, gives those rows an activity time (`activityFrom: worktree head commit`). If that call fails, the rows stay in `activity unknown`, never stale. This is decision D103.

## Contract / API impact

The change is additive. `changes[i].lastCommit` is new, and the CLI text mode ignores it. `buildHeaderModel().value.epic` gains `short`. `degradationBands` accepts `epic`. `sddForIssue` may carry `absent`. No route or generation step changes.

## File changes (gated size, tests and openspec excluded)

| File | Action | Lines |
|---|---|---|
| `ui/lib/inflight-model.mjs` | Create | ~150 |
| `status/snapshot.mjs` | Modify (D94) | ~35 |
| `ui/lib/header-model.mjs`, `ui/lib/banners.mjs` | Modify | ~10 |
| `ui/lib/sdd-model.mjs` | Modify | ~15 |
| `ui/static/app.js` | `renderInflight`, header, bands, card | ~80 |
| `ui/static/app.css` | Header, in-flight section | ~40 |

About 330 lines against the `lite` budget of 1000. One PR.

## Testing strategy (strict TDD, node:test)

**First RED:** `ui/lib/inflight-model.test.mjs` uses a fixture built from the 2026-10-04 shapes. #267, #284 and #864 are rows. Closed-issue dirs and branches are not. #1114 (6 worktrees), #1263 (5) and #978 (7 branches) give one row each. #1273 and #1283 are present. It fails today because the module does not exist.

| File | Covers |
|---|---|
| `ui/lib/inflight-model.test.mjs` (new) | D95–D98: filter, `state unknown`, aggregation, author vs `on this machine`, ordering with a pinned `nowMs`, the 7-day boundary (exactly 7 days is stale), `activity unknown` never stale, pending vs failed in `missingSources`, the count while `hierarchy` is pending |
| `status/snapshot.test.mjs` (modify) | D94: one `git log` for N dirs (recording `_run`), the first record wins, an untracked dir, a throwing run, archived rows, no call for zero dirs |
| `ui/lib/header-model.test.mjs`, `static/degradation-banner.test.mjs` (modify) | D99, D101 |
| `ui/lib/sdd-model.test.mjs` (modify) | D102: `absent`, `quietAbsence` with unread sections |
| `static/inflight-render.test.mjs` (new) | The section is the first child of the canvas, the stale toggle shows `stale (N)`, missing sources are named, and the text never contains `nothing in flight` while a source is missing |
| `static/header-render.test.mjs` (new) | No `status-epic-reason` element; `epic: not resolved` with `title === EPIC_JOIN_PENDING`; `#banners` holds it; a CSS scan finds `.status-bar` with `nowrap`; every fact listed in D99 is in the DOM |
| `static/views-owned.test.mjs`, `local-render.test.mjs` (modify) | A quiet card has no `.node-sdd`; its drawer still says `no change dir` |

## Migration / rollout

None. Revert the merge commit.

## Risks

- **Log size (D94).** `run` uses execFileSync's default `maxBuffer` (1 MiB). Apply records the byte count and time of the call on this repo. An overflow degrades to `activity unknown`, never to a wrong time.
- **The open list must be complete (D96).** If the forge list were truncated, an open issue would read as not open. This is the same assumption `local-worktrees.mjs:109` already makes.
- Both MAINTAINER QUESTIONs above are ruled (D96 kept; D103 added).
