---
status: draft
issue: 1309
---

# Design — epic-state-follows-children (issue 1309)

Extends #1308 (D123–D129) and #1199/#1267 (D59–D62, D108–D110). Numbering continues at D130.
It contradicts none of them.

## Current derivation (measured)

- `ui/lib/state-vocab.mjs:64-78` `stateOf(node, work)`. An open, unblocked, approved node reads
  `In flight` only if its roadmap says so or `work.byIssue.has(node.number)` (`:75`). Otherwise
  it reads `Not computed` (a work source is missing, `:76`) or `Planned` (`:77`). It never looks
  at children, so an epic whose work happens in its children reaches `:77`.
- `ui/lib/rollup-model.mjs:35-58` `epicRollup` gives `{closed|null, open, unknown, total|null,
  unresolved, load}` over the hierarchy's direct children. `closed` is `null` unless the closed
  lane has data AND `closedRead.ok` (`:45`). `unresolved` is the repo-wide
  `closedUnresolved.length` (`:54`).
- Callers of `stateOf`: `lane-model.mjs:87-106` `stateAndMarks`, which serves cards, holding
  rows, epic rows (`:380`), `nodeSummaryFor` (`:137`) and `childrenOf` (`:175`); and
  `roadmap-model.mjs:29-35` `safeStateOf`, which serves epic rows (`:144`). `colour.mjs:31`
  calls it without `work` (the legacy path).
- Epic detection differs by caller. Lanes and Roadmap use the graph's `node.kind === 'epic'`
  (`lane-model.mjs:352`, `roadmap-model.mjs:117`). The drawer's rollup sentence uses the
  hierarchy's `level === 'epic'` (`app.js:1940`). Today the two agree:
  `hierarchy-adapter.mjs:38` derives `level` from `kind`.
- `app.js:784` (cluster heading) and `:1941` (drawer) call `epicRollup` only for the sentence.
  `app.js:1425` draws a Roadmap chip with no tooltip, so a `Not computed` reason is invisible
  there today.

## Decisions

| # | Choice | Rejected | Why |
|---|---|---|---|
| D130 | **`stateOf(node, work, rollup)`.** The third argument is an `epicRollup` result. It is consulted only when `work` is given and `node.kind === 'epic'`. | A separate `epicStateOf`. Folding a rollup into `workIndex`. | #1308 made `stateOf` the one authority (R1308-6). A second function is the drift #1308 removed. `workIndex` is work evidence, and the rollup is a different section with its own readiness. |
| D131 | **Epic = graph `node.kind === 'epic'`.** | Hierarchy `level` (with `levelSource !== 'default'`, D104). | The graph node is what carries the chip. The lane and Roadmap pick their epic rows by `kind`, so the chip and the row cannot disagree. `kind` is known whenever the node is, while the hierarchy can be pending. A pending hierarchy must yield `Not computed` for a known epic, and it cannot if detection needs the hierarchy. |
| D132 | **Mapping, inserted after the node's own in-flight check (`:75`) and before the missing-source check (`:76`):** (0) `closed === total > 0` → `Ready to close` (D137, before the own in-flight check). (1) rollup not ok → `Not computed`, reason `children: <rollupLabel>`. (2) `closed > 0` → `In flight`, reason `rollupLabel`. (3) any `openChildren` in `work.byIssue` → `In flight`, reason `child #n in flight` (rulings b, c). (4) `closed === null` → `Not computed`, reason `rollupLabel`. (5) `unknown > 0` or `unresolved > 0` → `Not computed`, reason `rollupLabel` (ruling d). (6) Otherwise, fall through to #1308's `:76`/`:77`. | Mapping `closed:null` to `Planned`. A fraction-based state. | Steps 2–3 are positive evidence, and positive evidence never waits (#1308 S6). Steps 1, 4 and 5 are the "unmeasured is never measured" rule. Step 6 keeps `Planned` behind #1308's own completeness check. |
| D133 | **`epicRollup` gains `openChildren: number[]`** (children whose hierarchy state is `open`, sorted). Nothing else in it changes. | Passing the graph's children. Calling `stateOf` recursively on children. | The rollup is already the measured children list, and step 3 needs their numbers. Recursion would make nested epics walk the hierarchy (out of scope) and would let a child's Blocked hide its work. "In flight child" means "an open child that work names", the same test `:75` applies to the node itself. |
| D134 | **Plumbing: an `epics: {hierarchy, forgeLoad}` option** on `buildLaneModel`, `nodeSummaryFor`, `childrenOf` and `buildRoadmapModel`. `stateAndMarks` and `safeStateOf` compute `epicRollup(...)` for an epic node only. `app.js` passes `currentEpics()` next to `currentWork()` at the five call sites (`:673`, `:1411`, `:1788`, `:1934`, `:2344`). | `app.js` computing state. A precomputed `Map`. | The pure models own state (D127), and `epicRollup` stays the single counter. The cost is one `hierarchyOf` per epic per render, which is a few dozen epics. |
| D135 | **No rollup argument means the legacy path.** An epic with `rollup === undefined` keeps #1308's behaviour. | Treating a missing argument as "not read". | Same contract as D125's omitted `work`. Existing pure tests keep passing. A render test pins that `app.js` always passes `epics`, so the omission cannot ship silently. |
| D137 | **`Ready to close` sits after `Awaiting review [label renamed to Awaiting approval by #1379]` and before `In flight`**, and ahead of the epic's own in-flight check. Full order: `Unreadable > Done > Blocked > Awaiting review > Ready to close > In flight > Not computed > Planned`. | Before Blocked. After In flight. | A closed-out epic that is blocked or awaiting approval must still show those, the same reason In flight yields to them. But the all-children-closed fact is more specific than a generic In flight, so it wins over In flight (including the epic's own work evidence). |
| D138 | **`ready-to-close` vocabulary:** mark `◉`, word `Ready to close`, class `state-ready-to-close`, tokens `--state-ready-to-close-fg/-bg` in the three theme blocks (WCAG AA checked by `tokens.test.mjs`). The legend iterates `STATES`, so its row is automatic. | Reusing Done's colour. | Done's green would say "closed". |
| D136 | **The Roadmap chip shows `row.state.reason` as `title`** (`app.js:1425`). | No change. | Without it, S3's reason is invisible on the Roadmap. That reproduces the defect: a state with no visible basis. |

## Maintainer rulings

RULED 2026-10-05: (a) An open epic whose rollup counted ALL direct children closed (`closed === total > 0`) reads a NEW state `Ready to close` (code `ready-to-close`, mark `◉`). It is not `Done`: Done means the issue is closed (D124).
RULED 2026-10-05: (b) An open epic with in-flight open children and zero closed reads `In flight`.
RULED 2026-10-05: (c) With `closed: null`, an in-flight open child makes the epic `In flight`; with no in-flight child it reads `Not computed` with the rollup's own words (`rollupLabel`).
RULED 2026-10-05: (d) Zero closed with `unresolved > 0`, or any child state unknown, reads `Not computed`, never `Planned` (unless an in-flight child or closed child already decided it).

## Data flow

    graph node (kind) ─────────────────────────┐
    hierarchy + forgeLoad ─ epicRollup ─ rollup ┼─> stateOf(node, work, rollup) ─> chip
    changes/worktrees/branches/prs ─ workIndex ─┘     (cluster, drawer, children, roadmap)

## File changes (gated estimate)

| File | Change | ~lines |
|---|---|---|
| `ui/lib/state-vocab.mjs` | 3rd arg, `epicProgress` steps (D132), import `rollupLabel` | 35 |
| `ui/lib/rollup-model.mjs` | `openChildren` | 3 |
| `ui/lib/lane-model.mjs` | `epics` option through 3 entry points + `stateAndMarks` | 15 |
| `ui/lib/roadmap-model.mjs` | `epics` option, `safeStateOf` | 8 |
| `ui/static/app.js` | `currentEpics()`, 5 call sites, Roadmap tooltip | 12 |

Gated total ≈ 75 of the 1000 `lite` budget. Tests ≈ 250 lines, which are on the ignore list. One PR.

## Contract / API impact

The pure-module signatures are extended with optional arguments only. `epicRollup.value` gains
one field. There is no snapshot, server or forge change, and no generation step.

## Test plan

- Pure, `state-vocab.test.mjs`. Rollups are built by calling the REAL `epicRollup` on fixture
  hierarchy/forgeLoad sections, never hand-written. The table covers S1–S10: no started
  children (`Planned`), 17/39 (`In flight` with the reason), lane pending / disabled / failed
  without data (`Not computed`), `closedRead` not ok, in-flight child with `closed:null`,
  all-closed, `unknown > 0`, `unresolved > 0`, blocked epic, closed epic, non-epic with
  children, and legacy (no rollup).
- `rollup-model.test.mjs`: `openChildren` is sorted, open-only, and present when `closed:null`.
- `lane-model.test.mjs` / `roadmap-model.test.mjs`: the epic row, `nodeSummaryFor` and the
  Roadmap epic row give the same code for the same fixture (R1309-1).
- Render, `static/epic-state-render.test.mjs`, with `test-support/dom.mjs` + `load-app.mjs`
  (the `state-chip-render.test.mjs` boot shape): the #878 shape shows `◐ In flight` in the
  cluster heading, the drawer header and the Roadmap row. A frame with the closed lane pending
  shows `— Not computed` with a tooltip, and the next frame shows `In flight`. A guard test
  asserts that every `app.js` model call site passes `epics` (D135).

## Risks

- D131 binds detection to `kind`, while the drawer sentence binds to hierarchy `level`. #1251's
  resolver could make them diverge. A test pins their agreement under today's adapter.
- `unresolved` is repo-wide, not per epic (ruling d): while any closed issue is unreadable, every zero-progress epic reads Not computed.
