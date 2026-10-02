---
status: draft
issue: 1199
---

# Tasks — progress-epic-milestone (issue 1199)

Strict TDD (`npm test`, node:test). Every unit is one work-unit commit holding its tests and its code, with the subject ending ` (#1199)`. Paths are relative to `brain/scripts/`. Run `npm run brain:repo:check` before each commit.

## Unit 1 — one checkbox grammar (R1199-1, D50)

- [x] 1.1 RED: `lib/tasks-list.test.mjs` (moved with `git mv` from `ui/lib/`) asserts `countTasks('- [x] a\n- [ ] b\n  - [X] c\n- [ ] d\n- [x] e')` deep-equals `{ok:true, value:{done:3,total:5}}` and `countTasks('# Tasks\nprose')` returns `code:'no-items'` with reason "tasks.md has no checklist items" and no `done`/`total`. It fails on the missing export.
- [x] 1.2 GREEN: `lib/tasks-list.mjs` declares `CHECKBOX_RE` once and exports `taskItems`, `countTasks`, `parseTasksList` (built from `taskItems`). Update `ui/change-route.mjs` and `ui/lib/provenance.test.mjs` imports.
- [x] 1.3 RED→GREEN: `taskItems` parity with `deriveTasks` (CRLF included); `status/derive.mjs#deriveTasks` takes `checked`, `open`, `next` from `taskItems`.
- [x] 1.4 RED→GREEN: a scan of `status/**` and `ui/**` finds no checkbox regular expression outside `lib/tasks-list.mjs`.
- [x] 1.5 REFACTOR, then commit.

## Unit 2 — `progress` on the snapshot (R1199-2, D51)

- [x] 2.1 RED: `status/snapshot.test.mjs` for `missing`, `unreadable` (`_read` throws `EACCES`, `_exists` true), `no-items` and 3/5, with `tasks.checked.value === progress.value.done`; the `missing` and `unreadable` reasons differ.
- [x] 2.2 GREEN: `status/snapshot.mjs#readOneChange` adds `progress` from one read; `deriveTasks` receives the reason that matches the code.
- [x] 2.3 RED→GREEN: `ui/lib/sdd-model.mjs#buildChangeRow` passes `progress` through (`sdd-model.test.mjs`).
- [x] 2.4 REFACTOR, then commit.

## Unit 3 — the card, the SDD view and the drawer say done / total and their source (R1199-3, R1199-4, D52)

- [x] 3.1 RED: `ui/lib/progress-view.test.mjs` pins every row of the progress wording table and `SOURCE`; never `0/0` or a percentage.
- [x] 3.2 GREEN: `ui/lib/progress-view.mjs` (`SOURCE`, `PROGRESS_WORDS`, `progressLabel`).
- [x] 3.3 RED→GREEN: `ui/change-route.test.mjs`: the 2/5 HEAD versus 3/5 working-tree fixture, and `truncated`. `buildTasksTab` attaches `progress`; `ui/lib/drawer-model.mjs` adds `header`.
- [x] 3.4 RED→GREEN: `ui/static` render test through `installDom`: the card strip reads "tasks 3 / 5 · working tree", a `no-items` change reads the reason and no `digit /`; the drawer header renders before the note. `ui/static/app.js` (`renderNodeSdd`, the SDD tasks line, `renderTab`).
- [x] 3.5 REFACTOR, then commit.

## Unit 4 — the hierarchy adapter (R1199-5, D59)

- [x] 4.1 RED: `status/hierarchy-adapter.test.mjs`: exact keys; `children` once with closed and nested (R9); `levelSource` block / default / null (`ok === false`); `parent-not-epic` at the top level and no per-issue repeat; `closed: null` yields no closed entry; an unresolved closed row has no entry; no `track`/`files` read.
- [x] 4.2 GREEN: `status/hierarchy-adapter.mjs#hierarchyFromGraph`. `lib/ticket-hierarchy.mjs` is NOT created.
- [x] 4.3 REFACTOR, then commit.

## Unit 5 — the `hierarchy` snapshot section (R1199-6, D60)

- [x] 5.1 RED: `status/snapshot.test.mjs`: closed children come from `closedIssues` (#880 entry, #881 only in `closedUnresolved`); a closed failure leaves it open-only; pending when the graph is pending, uncomputable when it is; one-shape (`JSON.parse(JSON.stringify(s))` deep-equals `s`, and the pairs rebuilt into a Map equal `hierarchyFromGraph(...)`). `ui/server.test.mjs`: the `forgeUnavailable` override replaces `hierarchy`. `status/snapshot-cli.test.mjs`: `--json` stays byte-identical for a fixed `--now`.
- [x] 5.2 GREEN: `status/snapshot.mjs` (`hierarchy`, `renderSnapshotText` line); `ui/server.mjs` override.
- [x] 5.3 REFACTOR, then commit.

## Unit 6 — the rollup (R1199-6, R1199-7, R1199-8, D61, D62)

- [x] 6.1 RED: `ui/lib/rollup-model.test.mjs`: `hierarchyOf` rebuilds the Map; every row of the rollup wording table (counting, pending with reason, failed no data, disabled, complete, failed with data, unknown, unresolved, "no children declared", direct children only); never `0 /` while pending, failed without data or disabled.
- [x] 6.2 GREEN: `ui/lib/rollup-model.mjs` (`hierarchyOf`, `epicRollup`, `rollupLabel`, `NO_CHILDREN`, `CLOSED_LOAD_WORDS`).
- [x] 6.3 RED→GREEN: `ui/lib/lane-model.test.mjs`: `childrenOf(graph, hierarchy, issue)` follows `children` even when a node's `parent` disagrees; `ui/lib/lane-model.mjs`.
- [x] 6.4 RED→GREEN: render tests through `installDom`: the heading `epic-count` reads "12 / 29 children closed · 1 state unknown" and "counting closed children… · 4 open"; the drawer shows the label and the counted-not-listed note; markup in `forgeLoad.closed.reason` stays inert. `ui/static/app.js`, `ui/static/app.css`.
- [x] 6.5 REFACTOR, then commit.

## Closing

- [x] 7.1 `npm test` fully green; rollup and lane tests looped 10 times.
- [x] 7.2 Gated diff under 950 (`git diff --numstat origin/main...HEAD`, tests, `openspec/changes/`, `.memory/` and goldens excluded).
- [x] 7.3 Real smoke on port 3995 (`hierarchy` entry for epic 878, rollup numbers, one change's `progress`).

## Review Workload Forecast

- Estimated changed lines (gated, tests excluded): about 440, measured (426 at verify plus the W1/S2/S3 fixes). The design's 350 was an underestimate.
- 400-line budget risk: Low against the `lite` budget of 1000.
- Chained PRs recommended: No.
- Decision needed before apply: No. Single PR, `delivery_strategy: ask-on-risk` does not trigger.
- Chain strategy: not applicable.

## Micro-decisions en caliente

- #1257 merged first, so `epicRollup` takes the `forgeLoad` SECTION and reads `.value.closed` (design "Reconciliation with merged #1257").
- The `forgeUnavailable` override in `ui/server.mjs` also replaces `hierarchy`.
