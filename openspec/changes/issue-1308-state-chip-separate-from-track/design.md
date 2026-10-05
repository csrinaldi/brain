---
status: draft
issue: 1308
---

# Design — state-chip-separate-from-track (issue 1308)

## Current derivation (measured)

- `ui/lib/state-vocab.mjs:45-55` `stateOf`: unreadable > roadmap not ok (`not-computed`) > open
  `blockedBy` > `status === 'awaiting-human'` > **`status === 'unclassified'` → `? Undeclared`
  (`:50`)** > roadmap state. `unclassified` is set at `status/epic-graph.mjs:762` when a node has
  no declared block AND no native relation — it short-circuits before any lifecycle is read.
- `In flight` exists only via `roadmapState` (`status/snapshot.mjs:87-99`, attached at `:595`): an
  open PR whose head branch names the issue. Worktree, branch and change dir are ignored.
- `ui/lib/lane-model.mjs:87-106` `stateAndMarks` is the one caller for cards, holding rows, epic
  rows, `nodeSummaryFor` (drawer) and `childrenOf`; it also pushes a `? track` mark (`:90`).
  `roadmap-model.mjs:29-35` calls `stateOf` separately.
- `ui/lib/inflight-model.mjs:39-50` `collect` + `:25-34` `missingSources` already join the four
  work sources per issue for the home section. `prs[].issue` is `issueOfBranch(headBranch)`
  (`snapshot.mjs:494`), the same test `roadmapState` uses, so PR evidence is already shared.
- Render: `app.js:940-951` card chip, `:1747-1752` drawer chip + `track X` text, `:844-851`
  legend iterates all `STATES`, `:695-703` lane-header counts.

## Decisions

### D123 — Lifecycle is one pure function over node + a work index

**Choice**: `stateOf(node, work)` in `state-vocab.mjs` drops the `unclassified` branch and reads
work evidence. `work` is `{ missing: [{name,state,reason}], byIssue: Map<issue, {changes,
worktrees, branches, prs}> }` produced by a new export `workIndex(sections)` in
`inflight-model.mjs`, built from its existing `collect` and `missingSources` (minus `hierarchy`).
`buildInflight` calls `workIndex` too, so the section and the chips share one join (R1308-6).
**Alternatives**: recompute evidence in `lane-model` (two joins that drift); move it into the
snapshot server-side (breaks "first render never waits": local sources arrive before forge ones,
and the snapshot's graph field is forge-bound).
**Rationale**: single source, pure, testable without DOM.

### D124 — Precedence

`unreadable > done (issue not open) > blocked > awaiting-review > in-flight > not-computed >
planned`. Only change vs today besides D123: `done` moves above `blocked` (a closed issue is
terminal). See Rulings.

### D125 — Not computed is decided by missing sources, not by `roadmap.ok`

No evidence + any work source not ready → `not-computed` with a reason naming them (R1308-5).
`roadmap` is no longer read for lifecycle when `work` is given. When `work` is omitted (legacy
callers/tests), `stateOf` keeps today's roadmap reading minus the `unclassified` branch; `app.js`
always passes `work`.

### D126 — Track chip: a second table in `state-vocab.mjs`

`TRACK_MARKS` = `declared` (`Track <id>`), `no-track` (`? No track`, block without track),
`undeclared` (`⚠ Configuration missing`, `node.declared === false` — a warning, see D128; supersedes ruling 5's `Undeclared` word for the chip). New pure
`trackMarkOf(node)` returns `null` for `status === 'unreadable'`. `STATES.unclassified` is
removed; its CSS variables are reused by the track chip's `undeclared` class. The `? track` mark in
`stateAndMarks` is removed (the chip says it).
**Alternative**: keep "Undeclared" as a state with a secondary in-flight badge — keeps two facts in
one slot, the defect itself.

### D127 — Plumbing

`buildLaneModel`, `nodeSummaryFor`, `childrenOf`, `buildRoadmapModel` take optional `work`;
`stateAndMarks(node, work)` adds `trackMark` to every row shape. `app.js` computes
`workIndex(...)` once per render and passes it everywhere; `renderNodeCard`, drawer head, epic and
child chips draw both chips; legend renders two groups.

## Data flow

    sections(changes, localWorktrees, remoteChanges, prs)
          └─ workIndex() ──┬─> buildInflight()  (home section)
                           └─> stateOf(node, work) ─> lane/holding/epic/drawer/children/roadmap
    node(track, declared, status) ─> trackMarkOf(node) ─> track chip

## File changes (gated estimate)

| File | Change | ~lines |
|---|---|---|
| `ui/lib/state-vocab.mjs` | lifecycle precedence, `TRACK_MARKS`, `trackMarkOf` | 50 |
| `ui/lib/inflight-model.mjs` | export `workIndex`, reuse in `buildInflight` | 20 |
| `ui/lib/lane-model.mjs` | `work` option, `trackMark` on rows, drop `? track` mark | 35 |
| `ui/lib/roadmap-model.mjs` | `work` option | 10 |
| `ui/static/app.js` | track chip (card, drawer, epic, child), legend groups, pass `work` | 50 |
| `ui/static/app.css` | track chip classes | 15 |

Gated total ≈ 180 of the 1000 `lite` budget (tests are on the ignore list). Tests ≈ 300 more.

## Test plan

- Pure (`state-vocab.test.mjs`, `inflight-model.test.mjs`, `lane-model.test.mjs`): S1–S8 as
  table cases; precedence matrix; `workIndex` and `buildInflight` agree on every issue (property:
  issue in `rows∪unknown∪stale` ⇒ `stateOf` is `in-flight` unless a higher state wins); counts per
  lane sum to node count (S9).
- Render (`static/state-chip-render.test.mjs`, `test-support/dom.mjs` + `load-app.mjs`, the
  `inflight-render.test.mjs` boot shape): two chips on card and drawer; `#1263` shape; pending
  `prs` → `Not computed` then a frame makes it `Planned`; legend groups.

## Rulings

RULED 2026-10-05: Precedence is `unreadable > done > blocked > awaiting-review > in-flight > not-computed > planned` (D124 as recommended). Blocked and Awaiting review stay above In flight; the card still shows its worktree/PR lines.
RULED 2026-10-05: Lifecycle is computed for EVERY node. For a node nobody declares (`status === 'unclassified'`, which `epic-graph.mjs:762` never lets reach `awaiting-human`) the UI reads `status:approved` from `node.labels`, so Awaiting review works for it by the same rule as for every other node. An issue MISSING its `brain-graph/1` configuration is shown as a WARNING, not as a neutral "Undeclared" tag (D126, D128).
RULED 2026-10-05: An issue whose only work evidence is stale (>= 7 days, the section's collapsed `stale` group) still reads In flight; staleness stays the section's grouping, not a state.

### D128 — The missing-configuration warning and the paste block

The `undeclared` track mark is a warning chip: mark `⚠`, word `Configuration missing`, class `track-undeclared` drawn in the existing warning colours (`--state-unclassified-*`, the amber the unreadable/warning visual language already uses). It replaces the old `? Undeclared` chip. The drawer of such a node shows, in the body, a copyable text block: `DECLARE_SNIPPET` (exported from `lane-model.mjs`) with `parent: 878` replaced by the node's own `parent` when it is known, plus the example-not-form note `DECLARE_NOTE`. Pure model: `nodeSummaryFor` returns `declare: {snippet, note, declareCommand}` for an undeclared node and `declare: null` otherwise. `declareCommand` is `null` today: the provider-agnostic `brain:ticket:declare` is #1335 and does not exist, and a command that does not exist is never shown. #1335 fills this one field; a test pins it `null` so the day it is filled the test names the renderer work owed.
