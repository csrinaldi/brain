---
status: draft
issue: 1199
---

# Spec — progress-epic-milestone (issue 1199)

Capabilities: `change-progress` (new) and `epic-rollup` (new). These are delta requirements: each states what MUST be true after this change. The proposal's rulings R1–R3, R5 and R6, and its defaults R7–R9, are binding and are cited by number. Requirement keywords follow RFC 2119.

**Re-scope 2026-10-02.** The maintainer split this change. The `issueList` widening, `forgeLoad`, the closed-issue lane, the worker threads, the pending sections and `--no-closed` moved to #1257, with their requirements (the former R1199-5 to R1199-13). This change depends on #1257 and consumes, without implementing:

- `issueList` entries carrying `state` and `body` (R1257-1);
- the snapshot's `forgeLoad` section and its lane entry shapes (R1257-8);
- the snapshot's `closedIssues` section, `{nodes, declarationDivergences, unresolved}` (R1257-7);
- `pending(reason)` sections, `{ok:false, pending:true, reason}` (R1257-9).

The requirements below are renumbered R1199-1 to R1199-8. The traceability table at the end maps each one to its former number.

Scenario grammar: each scenario has exactly one `WHEN` line and exactly one `THEN` line, plus an optional `GIVEN`. The UI's spec cards (`ui/lib/spec-cards.mjs`) keep only the last `THEN`, so a scenario with several outcomes states them all in its single `THEN`.

## Requirements this change modifies

| Existing requirement | What changes |
|---|---|
| R881-8, the drawer's Tasks tab (`archive/881/spec.md:180`) | The tab gains a progress header that names its source (R1199-4). |
| R1032-1 and the epic cluster heading (`app.js:687`) | The heading's `N slice(s)` count becomes the rollup (R1199-8). |
| R1059-7 and `childrenOf` (#1059 phase 10, `lane-model.mjs:146`) | `childrenOf` reads `children` from the hierarchy and no longer inverts `parent` (R1199-6). |

Every other requirement of #881, #1032, #1059 and #1201 is unchanged. That includes R1032-2: an epic's cluster still does not nest a child epic.

## Fixed values

- Checkbox grammar: `^\s*- \[([ xX])\]\s*(.*)$`, applied to every line after splitting on `\r\n|\n`. A space means open, and `x` or `X` means done. This is `sdd-layout.md`'s "Checked-task pattern".
- Progress codes: `missing`, `unreadable` and `no-items` in the snapshot. The drawer adds `truncated`.
- Progress wording:

  | Case | Wording |
  |---|---|
  | `missing` | "no tasks.md" |
  | `unreadable` | "tasks.md could not be read" |
  | `no-items` (R7) | "tasks.md has no checklist items" |
  | `truncated` | "tasks.md is truncated; no total is shown" |
  | no progress value at all (`progressLabel(null)`) | "no progress was read" |

- Source labels (R2): "working tree" on the card and in the SDD view, "at HEAD" in the drawer.
- Rollup wording. `<open>` is the count of open children; the suffix " · `<open>` open" is omitted when that count is 0. The `forgeLoad` section is `field({open, closed})` (R1257-8), and `forgeLoad.closed` below means the entry at `forgeLoad.value.closed`.

  | `forgeLoad.closed` | Wording |
  |---|---|
  | `pending`, no `reason` | "counting closed children…" plus the open suffix |
  | `pending` with `reason` | "closed children not counted yet (`<reason>`)" plus the open suffix |
  | `failed`, `lastCompleteAt` null | "closed children unknown (`<reason>`)" plus the open suffix |
  | `disabled` | "closed children not read (`<reason>`)" plus the open suffix |
  | `complete` | "`<closed>` / `<total>` children closed" |
  | `failed`, `lastCompleteAt` set | the `complete` wording plus " · closed list as of `<lastCompleteAt>`; refresh failed (`<reason>`)" |
  | Any wording with numbers, unknown states | plus " · `<n>` state unknown" |
  | Any wording with numbers, unresolved closed issues | plus " · `<n>` closed issue(s) unresolved, so more children may exist" |
  | `complete` and no children (R8) | "no children declared" |
  | `complete`, no children, `<n>` unresolved closed issues | "no children declared; `<n>` closed issue(s) could not be read" (singular "issue" when `<n>` is 1) |
  | `complete` with `closedRead.ok` false | "closed children unknown (`<closedRead.reason>`)" plus the open suffix |

## Per-change progress

### R1199-1: One pure `countTasks(text)` owns the checkbox grammar

`brain/scripts/lib/tasks-list.mjs` MUST export:

- `countTasks(text)`;
- `taskItems(text)`, which returns `[{line, text, done}]`;
- `parseTasksList`.

All three MUST use one checkbox regular expression, declared once in that module.

`countTasks` MUST return `{ok:true, value:{done,total}}` when `total > 0`. When there are no checkbox lines it MUST return `{ok:false, code:'no-items', reason:'tasks.md has no checklist items'}` (R7).

Other callers:

- `deriveTasks` (`status/derive.mjs`) MUST compute `checked`, `open` and `next` from `taskItems`.
- `parseTasksList` MUST build its items from `taskItems`.
- No other module in `status/` or `ui/` MAY declare a checkbox regular expression.

The governance counters in `vcs/phase-order-check.mjs:355` and `review/evaluators/checkpoint.mjs:409` are out of scope (see Out of scope).

#### Scenario: Three of five (success criterion 1)
- **GIVEN** the text `- [x] a\n- [ ] b\n  - [X] c\n- [ ] d\n- [x] e`
- **WHEN** `countTasks` runs
- **THEN** it returns `{ok:true, value:{done:3,total:5}}`

#### Scenario: Zero checkboxes is a reason, never `0/0` (R7)
- **GIVEN** a `tasks.md` holding only headings and prose
- **WHEN** `countTasks` runs
- **THEN** it returns `ok:false`, code `no-items` and the reason "tasks.md has no checklist items", and carries no `done` and no `total`

#### Scenario: The two readers agree
- **GIVEN** any text, CRLF line endings included
- **WHEN** `deriveTasks` and `countTasks` read it
- **THEN** `checked` equals `done` and `checked + open` equals `total`

#### Scenario: One grammar in the tree
- **WHEN** `brain/scripts/status/**` and `brain/scripts/ui/**` are scanned for a checkbox regular expression
- **THEN** none is found outside `lib/tasks-list.mjs`

### R1199-2: Every snapshot `changes` row carries `progress`, with three distinct reasons

`readOneChange` (`status/snapshot.mjs:234`) MUST add a `progress` field to every row, active and archived. The field MUST be one of:

- `{ok:true, value:{done,total}}`;
- `{ok:false, code:'missing', reason}`, when `tasks.md` does not exist, decided by `exists` before any read;
- `{ok:false, code:'unreadable', reason}`, when it exists but the read threw. The reason names the path and the error;
- `{ok:false, code:'no-items', reason}`, from `countTasks`.

The existing `tasks:{checked,open,next}` field stays, and it MUST be computed from the same read. When `progress.ok` is true, `tasks.checked.value` MUST equal `progress.value.done`. The `missing` and `unreadable` reasons MUST NOT share a sentence.

#### Scenario: Missing
- **GIVEN** a change dir with no `tasks.md`
- **WHEN** the snapshot is built
- **THEN** the row's `progress.code` is `missing`

#### Scenario: Unreadable
- **GIVEN** a `_read` that throws `EACCES` for `tasks.md`, and an `_exists` that reports the file present
- **WHEN** the snapshot is built
- **THEN** `progress.code` is `unreadable`, its reason contains the path and `EACCES`, and that reason differs from the `missing` one

#### Scenario: One count, two fields
- **GIVEN** a `tasks.md` with 3 of 5 checked
- **WHEN** the snapshot is built
- **THEN** `progress.value` is `{done:3,total:5}`, `tasks.checked.value` is 3 and `tasks.open.value` is 2

### R1199-3: The card and the SDD view show `done / total` from `progress` and say "working tree"

The lane card's SDD strip (`renderNodeSdd`, `app.js:794`) and the SDD view's tasks line (`app.js:1077`) MUST render from `change.progress` through one wording function in `ui/lib/progress-view.mjs`:

- when `progress.ok` is true, `tasks <done> / <total> · working tree`;
- otherwise, `tasks: <wording for the code> · working tree`.

They MUST NOT compute a total from `tasks.checked + tasks.open`. They MUST NOT render a percentage or `0/0`.

#### Scenario: The card (success criterion 1)
- **GIVEN** a change whose working-tree `tasks.md` has 3 of 5 checked
- **WHEN** its card renders
- **THEN** the strip reads "tasks 3 / 5 · working tree"

#### Scenario: A reason on the card
- **GIVEN** a change whose `progress.code` is `no-items`
- **WHEN** its card renders
- **THEN** the strip reads "tasks: tasks.md has no checklist items · working tree" and contains no digit followed by "/"

### R1199-4: The drawer's Tasks tab states its own count "at HEAD"

`buildTasksTab` (`ui/change-route.mjs:96`) MUST attach `progress` to its successful result:

- when the document is `present`, `countTasks(doc.text)`;
- when it is `truncated`, `{ok:false, code:'truncated', reason}`. A count over a truncated text MUST NOT be shown as a total.

The drawer model MUST give the tab a header from the same wording function with the source "at HEAD": "`<done>` / `<total>` tasks done · at HEAD". The snapshot MUST NOT be re-sourced to HEAD (R2).

#### Scenario: Working tree and HEAD differ, and each says so (R2)
- **GIVEN** a change whose committed `tasks.md` has 2 of 5 checked and whose working tree has 3 of 5
- **WHEN** the card and the drawer render
- **THEN** the card reads "tasks 3 / 5 · working tree" and the drawer header reads "2 / 5 tasks done · at HEAD"

#### Scenario: Truncated at HEAD
- **GIVEN** a committed `tasks.md` larger than `DOCUMENT_CAP`
- **WHEN** the Tasks tab is built
- **THEN** the header reads "tasks.md is truncated; no total is shown · at HEAD", and the items still render

## The hierarchy contract

### R1199-5: `status/hierarchy-adapter.mjs` returns exactly the shape of the ticket-hierarchy resolver contract (#1251; ADR-0039 in draft) over today's `kind` and `parent`

`hierarchyFromGraph({nodes, declarationDivergences, closed})` MUST return `{issues: Map<number, Entry>, divergences}`. `nodes` and `declarationDivergences` come from the open `graph` section. `closed` is #1257's `closedIssues.value` (`{nodes, declarationDivergences, unresolved}`), or `null` when that section is not a value. `Entry` MUST have exactly these keys: `level`, `levelSource`, `parent`, `children`, `tracker`, `milestone`, `state` and `divergences`. The keys are defined as follows:

- `level` is `'epic'` when `kind === 'epic'`, otherwise `'ticket'`. It is `null` for a node whose body was unreadable.
- `levelSource` is `'block'` when the `brain-graph/1` block declared `kind: epic`, and `'default'` otherwise. It is `null` for an unreadable node.
- `parent` and `tracker` are copied from the node.
- `milestone` is `null`, because milestones are out of scope (#1253).
- `state` is the port's tri-state, as #1257 carries it.
- `children` is computed once, as the ascending numbers of every entry whose `parent` is this issue. That includes nested epics (R9) and closed children.

Divergences come from epic-graph's `declarationDivergences`, open and closed, and are never re-derived:

- A per-issue entry `{number, key, value, reason}` becomes `{source, field:key, expected:reason, found:value}` on that issue's entry. `source` is `'prose'` for `parent-ambiguous`, and `'block'` otherwise.
- `parent-not-epic` is cross-issue, so it goes to the top level as `{issues:[child, parent], field:'parent', source:'graph', expected:'parent-not-epic', found:parent}`.

A closed row listed in `closed.unresolved` gets no entry. A node is unreadable only when `ok === false`; closed nodes carry no `ok` key. The module MUST NOT read `track`, `blocks`, `needs` or `files`. The module name MUST differ from `ticket-hierarchy`, and `brain/scripts/lib/ticket-hierarchy.mjs` MUST NOT be created (R5).

#### Scenario: Exact keys
- **GIVEN** any graph
- **WHEN** the adapter runs
- **THEN** every entry's sorted keys equal `['children','divergences','level','levelSource','milestone','parent','state','tracker']`

#### Scenario: Children once, closed and nested included (R9)
- **GIVEN** open epic #878, an open slice #900 (`parent: 878`), closed slices #880 and #881 (`parent: 878`) in `closed.nodes`, and open epic #884 (`parent: 878`)
- **WHEN** the adapter runs
- **THEN** #878's `children` is `[880, 881, 884, 900]`, and no consumer filters `parent` to produce it

#### Scenario: Level source
- **GIVEN** an epic declared by a block, a slice with a prose parent only, and an unreadable node
- **WHEN** the adapter runs
- **THEN** their `levelSource` values are `'block'`, `'default'` and `null`

#### Scenario: Divergences carried, not invented
- **GIVEN** a slice whose parent #12 does not declare `kind: epic`
- **WHEN** the adapter runs
- **THEN** the top-level `divergences` holds one entry naming issues `[slice, 12]` with `expected: 'parent-not-epic'`, and no per-issue entry repeats it

#### Scenario: No closed data, no closed entries
- **GIVEN** `closed` is `null`
- **WHEN** the adapter runs
- **THEN** no entry has `state: 'closed'`, and every `children` list holds open graph nodes only

### R1199-6: The snapshot and the page read one hierarchy shape

`buildSnapshot` MUST add a top-level `hierarchy` section. It is `field({issues, divergences, closedUnresolved, closedRead})`, where `issues` is the adapter's Map as an ascending array of `[number, Entry]` pairs, and `closedUnresolved` is `closedIssues.value.unresolved` when `closedIssues` is a value, otherwise `[]`. `closedRead` is `{ok:true}` when `closedIssues` is a value, otherwise `{ok:false, reason}` with `closedIssues`'s reason: it says whether the closed list was actually read, whatever state the poller gave the lane. When the graph is uncomputable, the section is `uncomputable` with the graph's reason. When the graph is pending, the section is `pending` with the graph's reason. The server's `forgeUnavailable` override MUST replace `hierarchy` with the same reason it gives `graph`.

`ui/lib/rollup-model.mjs#hierarchyOf(section)` MUST rebuild `{issues: new Map(section.value.issues), divergences, closedUnresolved, closedRead}`. A section without `closedRead` is read as `{ok:false}`.

Two consumers MUST read only that contract:

- `lane-model.mjs#childrenOf` MUST take the hierarchy section and read `children`. It MUST NOT filter nodes by `parent`. Its list holds the children that are graph nodes, which are open. Closed children are counted by the rollup (R1199-7).
- The epic cluster heading and the epic drawer MUST show the rollup.

`buildEpicGrouping`'s own inversion stays until #1251. That is a named residual, recorded in the design.

#### Scenario: One shape (success criterion 4)
- **GIVEN** a fake port with open and closed issues
- **WHEN** the snapshot is built, serialized and parsed
- **THEN** the parsed object deep-equals the built one, and `hierarchyOf(parsed.hierarchy)` deep-equals `hierarchyFromGraph(...)` called on the same inputs

#### Scenario: Closed children come from `closedIssues`
- **GIVEN** a fake port whose closed list holds #880 with `body:'Part of #878'` and #881 with `body:null`, and an open epic #878
- **WHEN** the snapshot is built
- **THEN** the hierarchy entry #880 has `parent: 878` and `state: 'closed'`, #881 has no entry, and `hierarchy.value.closedUnresolved` is `[{number:881, reason:'the forge list carried no body'}]`

#### Scenario: A closed failure leaves the hierarchy open-only
- **GIVEN** a fake port whose `issueList` throws "rate limited" only for `state:'closed'`
- **WHEN** the snapshot is built
- **THEN** `hierarchy.ok` is true, no entry has `state: 'closed'`, and `closedUnresolved` is `[]`

#### Scenario: A complete lane over an unreadable closed list
- **GIVEN** `forgeLoad.closed` is `complete` and the closed list read throws "cache unreadable"
- **WHEN** the snapshot is built and the rollup renders
- **THEN** `hierarchy.value.closedRead` is `{ok:false, reason}` and the rollup reads "closed children unknown (`<reason>`)", never "0 / n children closed"

#### Scenario: A pending graph makes the hierarchy pending
- **GIVEN** a server snapshot whose `graph` is pending
- **WHEN** the snapshot is built
- **THEN** `hierarchy.pending` is true and `hierarchy.reason` equals `graph.reason`

#### Scenario: The verb prints the module
- **GIVEN** the snapshot CLI on a fixture tree
- **WHEN** `--json` runs twice with the same `--now`
- **THEN** both outputs are byte-identical, and they equal the in-process snapshot

## Epic rollup

### R1199-7: The rollup counts direct children closed over total, with unknown counted apart and loading stated

`epicRollup(hierarchySection, forgeLoadSection, epic)` (`ui/lib/rollup-model.mjs`) takes the `forgeLoad` SECTION and reads `.value.closed`; a section that is not `ok` yields `{ok:false}`. It MUST compute over the epic's direct `children` only (R9):

- `closed` is the number of children whose `state` is `'closed'`;
- `open` is the number whose `state` is `'open'`;
- `unknown` is the number whose `state` is `null`;
- `total` is the number of children;
- `unresolved` is the length of `closedUnresolved`.

When `forgeLoad.closed` is `pending`, `failed` with `lastCompleteAt: null`, or `disabled`, `closed` and `total` MUST be `null`, never 0, and the wording is the matching row of the rollup table. When it is `complete`, or `failed` with a `lastCompleteAt`, `closed` and `total` are numbers only if `hierarchy.value.closedRead.ok` is true; a lane state is a claim about the poller, `closedRead` is the fact about the data, so with `closedRead.ok` false the numbers are `null` and the wording is the `failed`, `lastCompleteAt` null row with `closedRead.reason`. An unknown child MUST NOT count as open or as closed (R3). An epic with no children reads "no children declared" only when `forgeLoad.closed` is `complete` (R8).

#### Scenario: Counting closed children
- **GIVEN** `forgeLoad.closed` `{state:'pending', at:null}` and an epic with 4 open children
- **WHEN** the rollup renders
- **THEN** it reads "counting closed children… · 4 open" and contains no "0 /"

#### Scenario: Unknown apart (success criterion 3)
- **GIVEN** `forgeLoad.closed` complete, and an epic with 12 closed, 16 open and 1 null-state children
- **WHEN** the rollup renders
- **THEN** it reads "12 / 29 children closed · 1 state unknown"

#### Scenario: A failed closed list with no data is never an empty rollup
- **GIVEN** `forgeLoad.closed` failed with reason "rate limited" and `lastCompleteAt: null`, and an epic with 4 open children
- **WHEN** the rollup renders
- **THEN** it reads "closed children unknown (rate limited) · 4 open" and contains no "0 /"

#### Scenario: A failed refresh keeps the last complete count
- **GIVEN** `forgeLoad.closed` failed with reason "rate limited" and `lastCompleteAt` "2026-10-02T10:00:00.000Z", and an epic with 2 closed and 3 open children
- **WHEN** the rollup renders
- **THEN** it reads "2 / 5 children closed · closed list as of 2026-10-02T10:00:00.000Z; refresh failed (rate limited)"

#### Scenario: Disabled
- **GIVEN** `forgeLoad.closed` `{state:'disabled', at:null, reason:'--no-closed was given'}` and an epic with 4 open children
- **WHEN** the rollup renders
- **THEN** it reads "closed children not read (--no-closed was given) · 4 open"

#### Scenario: Unresolved closed issues
- **GIVEN** `forgeLoad.closed` complete, 3 rows in `closedUnresolved`, and an epic with 2 closed and 3 open children
- **WHEN** the rollup renders
- **THEN** it reads "2 / 5 children closed · 3 closed issue(s) unresolved, so more children may exist"

#### Scenario: No children (R8)
- **GIVEN** `forgeLoad.closed` complete and an epic with no children
- **WHEN** the rollup renders
- **THEN** it reads "no children declared" and shows no number

#### Scenario: No children while counting is not "no children"
- **GIVEN** `forgeLoad.closed` pending and an epic with no open children
- **WHEN** the rollup renders
- **THEN** it reads "counting closed children…" and does not read "no children declared"

#### Scenario: Direct children only (R9)
- **GIVEN** `forgeLoad.closed` complete, and epic #878 with child epic #884, which has 5 closed children, while #884 itself is open
- **WHEN** #878's rollup renders
- **THEN** #884 counts once, as open, and its own children are not counted

### R1199-8: The rollup is shown on the epic's cluster heading and in its drawer, as text only

The epic cluster heading's `epic-count` span (`app.js:687`) MUST render `rollupLabel(epicRollup(...))` instead of `N slice(s)`. The drawer's children block (`renderChildren`, `app.js:1739`) MUST render the same label above the list when the selected issue's entry has `level === 'epic'`. The block MUST also state "the list shows open children; closed children are counted above".

Every new string MUST reach the DOM through `el()` and `textContent`, never `innerHTML`. Any walk over `childNodes` MUST use `for...of`, `forEach` or index access, never an Array method (#1218).

#### Scenario: The heading
- **GIVEN** the "Unknown apart" fixture
- **WHEN** the epic clusters render through `installDom`
- **THEN** the heading's `epic-count` text is "12 / 29 children closed · 1 state unknown"

#### Scenario: The heading while counting
- **GIVEN** the "Counting closed children" fixture
- **WHEN** the epic clusters render through `installDom`
- **THEN** the heading's `epic-count` text is "counting closed children… · 4 open"

#### Scenario: Markup is inert
- **GIVEN** a `forgeLoad.closed.reason` of `<img src=x onerror=alert(1)>`
- **WHEN** the rollup renders
- **THEN** the text appears literally, and no element is created from it

## Out of scope

- Everything that moved to #1257: the `issueList` widening and its contract test, `updatedSince`, the `vcs-contract.md` row draft, the closed-issue lane and the per-state cache, `forgeLoad`, the worker threads, pending sections and the loading band, `--no-closed`, and the removal of per-issue `issueView` body reads.
- Milestone and project progress (#1253). `Entry.milestone` is always `null` here.
- `vcs.hierarchy` config keys, `level:*` labels, `brain:ticket:move` and the drift check (#1251). The same goes for creating `lib/ticket-hierarchy.mjs` and migrating `buildEpicGrouping`'s inversion.
- Comparing tickets against code, and a weighted rollup.
- The gate counters `phase-order-check.mjs:355` and `checkpoint.mjs:409`. Their grammar is `^- \[x\]` with no indent, and changing what a gate counts is a governance change.
- Listing closed children in the drawer. They are counted, not listed.
- Persisting the forge cache across server restarts (#1256).

## Traceability

| Ruling | Requirements |
|---|---|
| R1 | R1199-1, R1199-2, R1199-3 |
| R2 | R1199-3, R1199-4 |
| R3 | R1199-7, R1199-8 |
| R4 | Moved to #1257 (R1257-1 to R1257-4, R1257-7) |
| R5 | R1199-5, R1199-6 |
| R6 | Out of scope |
| R7 | R1199-1 |
| R8 | R1199-7 |
| R9 | R1199-5, R1199-7 |
| R10 | Moved to #1257; consumed by R1199-5 and R1199-6 |
| R11 | Moved to #1257; honored by R1199-6 (pending hierarchy) and R1199-7 (loading wording) |

| Current | Former | Note |
|---|---|---|
| R1199-1 | R1199-1 | Unchanged |
| R1199-2 | R1199-2 | Unchanged |
| R1199-3 | R1199-3 | Unchanged |
| R1199-4 | R1199-4 | Unchanged |
| — | R1199-5 to R1199-9 | Moved to #1257 as R1257-1 to R1257-5 |
| — | R1199-10 | Moved to #1257 as R1257-6 and R1257-7; its hierarchy outcomes are now R1199-6's "Closed children come from `closedIssues`" and "A closed failure leaves the hierarchy open-only" |
| — | R1199-11 | Moved to #1257 as R1257-8 |
| — | R1199-12 | Moved to #1257 as R1257-9; its "hierarchy is pending with the graph" clause is now R1199-6 |
| — | R1199-13 | Moved to #1257 as R1257-10 and R1257-11 |
| R1199-5 | R1199-14 | `closed` is now #1257's `closedIssues.value`; one scenario added |
| R1199-6 | R1199-15 | `closedUnresolved` copied from `closedIssues`; three scenarios added |
| R1199-7 | R1199-16 | Unchanged; `forgeLoad` is #1257's |
| R1199-8 | R1199-17 | Unchanged |

| Success criterion | Requirements |
|---|---|
| 3 / 5 everywhere | R1199-1 to R1199-4 |
| Distinct reasons | R1199-1, R1199-2 |
| Closed / total, unknown apart | R1199-7 |
| One shape | R1199-6 |
| "counting closed children…" while pending, never 0 | R1199-7, R1199-8 |
| No `ticket-hierarchy.mjs` | R1199-5 |
