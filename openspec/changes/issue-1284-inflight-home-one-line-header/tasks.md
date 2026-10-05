---
status: draft
issue: 1284
---

# Tasks — inflight-home-one-line-header (issue 1284)

Strict TDD: every phase is RED -> GREEN -> REFACTOR. A RED task names the test and why it fails today; a GREEN task makes exactly that test pass with the least code; a REFACTOR task changes no behaviour and keeps the suite green. Test runner: `npm test`; one file runs with `node --test <path>`. No network and no real timers. Requirement and decision numbers refer to `spec.md` and `design.md`. All paths are under `brain/scripts/`.

**Gate before apply: cleared.** D96 and D103 are ruled (design.md, RULED lines). The proposal has no open questions.

## Phase 1 — Snapshot: lastCommit and worktree head times (R1284-4, R1284-13, D94, D103)

- [x] 1.1 RED — `status/snapshot.test.mjs`, D94: a recording `_run` sees exactly ONE `git log --no-renames --format=%x1e%cI%x1f%an --name-only -- <dir...>` for N active dirs; the first (newest) record naming a path under a dir sets that dir's `lastCommit {ok:true, at, author}`; an untracked dir gets `{ok:false, reason:'no commit touches <dir> on the served tree'}`; a throwing run gives every active row `the change-dir log could not be read: <git line>`; archived rows get `{ok:false, reason:'not read for archived dirs'}`; zero active dirs makes no git call. Fails today: `readChanges` takes no `_run` and rows have no `lastCommit`.
- [x] 1.2 GREEN — `status/snapshot.mjs`: `readChanges(+_run)`, `buildSnapshot` passes its `run` (`snapshot.mjs:534`); one `git log` over non-archived dirs; `lastCommit` on every row, one shape for active and archived.
- [x] 1.3 RED — `status/snapshot.test.mjs` (or the local-worktrees test file that owns the entry shape), D103: one `git show -s --format=%cI <sha...>` over the head shas of worktrees whose change dir is `missing` and that have no branch time gives those entries a head commit time (`activityFrom: worktree head commit`); a throwing call leaves them without a time; no call when no worktree qualifies. Fails today: no such read.
- [x] 1.4 GREEN — add the single `git show -s` call and the head-commit time on the qualifying worktree entries; failure degrades to no time, never a wrong one.
- [x] 1.5 REFACTOR — share one parse helper between the two reads if duplicated; the CLI text mode still ignores `lastCommit` (assert in the existing CLI test).

## Phase 2 — Pure inflight model (R1284-1..8, R1284-13, D95–D98)

- [x] 2.1 RED (the design's first RED) — create `ui/lib/inflight-model.test.mjs` with a fixture built from the 2026-10-04 shapes: #267, #284 and #864 are rows; closed-issue dirs and branches are not (R1284-1); #1114 (6 worktrees), #1263 (5) and #978 (7 branches) give one row each with those counts (R1284-2); #1273 and #1283 (`dirState` `missing`) are present (R1284-1). Fails today: the module does not exist.
- [x] 2.2 GREEN — create `ui/lib/inflight-model.mjs`: `buildInflight(sections, {nowMs})` returning `{ok:true, value:{rows, unknown, stale, missingSources}}`; candidates from `changes` (non-archived), `localWorktrees.entries`, `remoteChanges.branches`, `prs`; state via `hierarchyOf` (D96); one row per issue (D97).
- [x] 2.3 RED — same file: `state unknown` for a `null`-state issue and kept (R1284-3); author named from a branch tip and `on this machine` for worktrees with no invented name (R1284-2, D97); hostile author string stays a literal in the row data.
- [x] 2.4 GREEN — `state:'unknown'` rows, `authors` via `authorLine` (`remote-model.mjs:17`), `onThisMachine`.
- [x] 2.5 RED — same file, activity and order (R1284-4, R1284-5, D98, D103): latest of `touchedAt`/`tipAt` wins (2026-10-03 over 2026-10-01); a change-dir-only row uses `lastCommit.at`; a missing-dir worktree row uses its head commit time (`activityFrom: worktree head commit`); a failed read gives `activity unknown`, after every dated row, never stale; newest first with ties by issue ascending; pinned `nowMs`; exactly 7 days is stale and 6.99 is not; `stale.length` equals the group count; `STALE_DAYS === 7` is exported.
- [x] 2.6 GREEN — `activityAt`/`activityFrom`, `unknown` bucket, ordering, stale split; `nowMs` is a parameter.
- [x] 2.7 RED — same file, honesty (R1284-6, R1284-7, D95, D96): `missingSources` lists each of the five data sections with `ok !== true`, `pending === true` giving `state:'pending'` and otherwise `failed` with its reason; while `hierarchy` is not ok no row is drawn and the value carries `candidates: N` with the hierarchy reason; the model never returns `ok:false`; with every source ready and nothing in flight `missingSources` is empty and rows are empty.
- [x] 2.8 GREEN — `missingSources`, `candidates`, the hierarchy-pending branch.
- [x] 2.9 RED — R1284-13: a source scan of `ui/lib/inflight-model.mjs` finds no import of `node:fs`, `node:child_process` or a network module, and no `Date.now` (`source-guard.test.mjs:79`). It should pass on the GREEN code; if it fails the bound was broken and is fixed here.
- [x] 2.10 REFACTOR — the join helpers stay small and pure; the whole `ui/lib` suite is green.

## Phase 3 — Header model and banners (R1284-10, R1284-11, D99, D101)

- [x] 3.1 RED — `ui/lib/header-model.test.mjs`: `buildHeaderModel().value.epic` is `{ok:false, short:'epic: not resolved', reason: EPIC_JOIN_PENDING}` when the join is pending, and every other field it yields today is unchanged. `static/degradation-banner.test.mjs`: `degradationBands` given `epic.ok === false` adds `{id:'epic', text: epic.reason}` after the sections band, and adds nothing when the epic is ok. Fails: no `short`, no `epic` input.
- [x] 3.2 GREEN — `ui/lib/header-model.mjs` (`short`), `ui/lib/banners.mjs` (`epic` input, band `epic`).
- [x] 3.3 REFACTOR — header and banners keep one wording table; the existing header and banner tests stay green.

## Phase 4 — Card absence (R1284-12, D102)

- [x] 4.1 RED — `ui/lib/sdd-model.test.mjs`: `sddForIssue` adds `absent: true` for an issue with no change dir and no local-only reason, reason text unchanged; `quietAbsence(found, localSection, remoteSection, issue)` is true only when `found.absent`, both sections are ok and no worktree (any `dirState`) or `remoteChanges` branch has the issue; false when either section is unread; false for a local-only or remote-only issue. Fails: no `absent`, no `quietAbsence`.
- [x] 4.2 GREEN — `ui/lib/sdd-model.mjs` (`absent` at `:273`, `quietAbsence` export).
- [x] 4.3 REFACTOR — none expected; suite green.

## Phase 5 — Render: app.js and CSS (R1284-8..12, R-H, D99, D100, D101, D102)

- [x] 5.1 RED — create `static/inflight-render.test.mjs` (fake DOM, `test-support/dom.mjs`, `load-app.mjs`): the section is the first child of `mounts.canvas` before the first lane, the `?` holding lane after it (R1284-9); the first paint with `changes` and `localWorktrees` ready and the three forge sections pending shows rows and names the three pending sources (R1284-8); a late `hierarchy` marking a row's issue closed removes that row and stops naming `hierarchy`; the collapsed group header reads `stale (N)` with N the row count; `state unknown` and `activity unknown` text present; the text never contains `nothing in flight` while a source is missing and shows `no open issue is in flight` only when all are ready and empty (R1284-7); pending is worded distinctly from failed with the reason; a row click opens the same drawer as the card (R1284-9); a hostile author `<img src=x onerror=alert(1)>` yields the literal in `textContent` and no `img` (use `Array.from` over the NodeList). Fails: no `renderInflight`.
- [x] 5.2 GREEN — `ui/static/app.js`: `renderInflight()` through `el()` only, called as the first child of `mounts.canvas` in `renderLanes`, passing `nowMs()`; progressive re-render as each forge section arrives; row click reuses the card's drawer opener. `ui/static/app.css`: in-flight section and `stale` group styles.
- [x] 5.3 RED — create `static/header-render.test.mjs`: no `status-epic-reason` element; the epic span shows `epic: not resolved` with `title === EPIC_JOIN_PENDING` and no `EPIC_JOIN_PENDING` text visible; `#banners` contains it; every fact D99 lists (wordmark, served branch with stamp, live, poll text, countdown, epic short, counts, theme, three controls) is in the DOM; the long spans carry their full text in `title`; a failed source's name and reason appear in `#banners`; a CSS scan finds `.status-bar` with `nowrap` and no `.status-epic-reason` rule. Fails: the long sentence and `wrap` are still there.
- [x] 5.4 GREEN — `renderStatus` (`app.js:522-523`) draws `short` with `title = reason`, deletes the `status-epic-reason` span; `renderBands` (`app.js:469`) passes `buildHeaderModel(...).value.epic`; `app.css`: `.status-bar` `nowrap` + `overflow:hidden`, long spans `min-width:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis`, controls and `.title` `flex:none`, remove `.status-epic-reason` (`:225`).
- [x] 5.5 RED — modify `static/views-owned.test.mjs` and `static/local-render.test.mjs`: a card with no work has no `.node-sdd` and its text lacks `no change directory names issue`; its drawer still says `no change dir`; a remote-only card keeps its line. Fails: the card still renders the absence strip.
- [x] 5.6 GREEN — `renderNodeSdd` returns `null` when `quietAbsence` is true; `renderNodeCard` (`app.js:898`) appends the strip only when not null. The drawer is untouched.
- [x] 5.7 REFACTOR — `static/app-source-guard.test.mjs` stays green (join logic is in the lib model, `app.js` only places elements); no `innerHTML`.

## Phase 6 — Measurement (D94 risk)

- [x] 6.1 Measure on this repo: run the exact `git log --no-renames --format=%x1e%cI%x1f%an --name-only -- <all non-archived change dirs>` command D94 issues, over the 57 dirs; record the output byte count and wall time in `apply-progress.md` against the 1 MiB `maxBuffer` of `run`. If it is near or over the limit, raise a note for the maintainer; an overflow must already degrade to `activity unknown` (covered by test 1.1's throwing run).

## Phase 7 — Closing and verification

- [x] 7.1 `npm test` green (full suite).
- [x] 7.2 `npm run brain:repo:check` green.
- [x] 7.3 `npm run brain:nav` green.
- [x] 7.4 Verify the gated diff size with the repo's own measure (`governance.ignoreList` applied; `*.test.mjs`, `.memory/**` and `openspec/changes/**` excluded), not raw `git diff`; record it in `apply-progress.md` against the `lite` budget of 1000 and the ~350 estimate.

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~350 gated (`*.test.mjs`, `openspec/changes/**` and `.memory/**` excluded); design estimate ~330, proposal range 350-500 |
| Governance tier budget (`lite`) | 1000 |
| 400-line budget risk | Low (the 400 line is the `standard` budget; the `lite` budget of 1000 is far above the upper estimate) |
| Chained PRs recommended | No |
| Suggested split | None |
| Delivery strategy | ask-on-risk |
| Chain strategy | Not applicable |

Decision needed before apply: No (D96 and D103 ruled)
Chained PRs recommended: No
Chain strategy: not applicable

## Micro-decisions in flight

None yet. Agreements made during apply are recorded here and promoted to `brain/` through the MR (see `brain/core/methodology/consolidation-protocol.md`).
