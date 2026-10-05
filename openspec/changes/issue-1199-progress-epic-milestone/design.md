---
status: draft
issue: 1199
---

# Design — progress-epic-milestone (issue 1199)

## Technical approach

This design continues the D-numbering of #1201 (D30–D43) and #1243 (D44–D49) from D50. Line numbers refer to `cef42973`. The requirements it implements are R1199-1 to R1199-8 in `spec.md`.

**Re-scope 2026-10-02.** The maintainer split this change. These decisions **moved to #1257** and keep their numbers there:

| Decision | Subject |
|---|---|
| D53 | `state`, `body` and `updatedSince` mapped inside each adapter (now under ruling R12 for `null` versus `''`) |
| D54 | Contract tests, derived fixtures, the pagination correction, the `vcs-contract.md` row draft |
| D55 | The closed read is the full closed list, carrying bodies |
| D56 | The closed list is its own background lane, full then incremental |
| D57 | The forge cache keys `issueList` by state |
| D58 | Open nodes take `state` and `body` from the list row; `issueView` only as a null-body fallback |
| D63 | Forge calls run in worker threads, one per lane |
| D64 | `forgeLoad: {open, closed}` in `meta.poller` and the snapshot |
| D65 | A loading section is pending, not failed; the loading band |
| D66 | The open list's first landing recomputes at once |
| D67 | The CLI stays synchronous and gains `--no-closed` |

#1257 also adds D68: the closed data reaches the snapshot as its own `closedIssues` section, `{nodes, declarationDivergences, unresolved}`. That section is the seam this change consumes. The cold-start evidence moved with D63 and is in #1257's design.

This change **keeps** D50–D52 (the grammar, `progress`, the drawer at HEAD) and D59–D62 (the adapter, the `hierarchy` section, `childrenOf`, the UI). D59 and D60 are adjusted to read `closedIssues`.

```
lib/tasks-list.mjs     CHECKBOX_RE ─▶ taskItems ─▶ countTasks / parseTasksList   (moved from ui/lib, D50)
status/derive.mjs      deriveTasks ─▶ taskItems
status/snapshot.mjs    readOneChange: exists? ─▶ read ─▶ countTasks ─▶ row.progress (D51)
                       graph + closedIssues (#1257) ─▶ hierarchy section (D60)
status/hierarchy-adapter.mjs  open nodes + closedIssues.value ─▶ {issues: Map, divergences} (D59)
ui/change-route.mjs    tasks tab + progress at HEAD (D52)
ui/lib/progress-view.mjs   wording + source labels      ui/lib/rollup-model.mjs  hierarchyOf, epicRollup, rollupLabel
ui/lib/lane-model.mjs  childrenOf reads children (D61)  ui/static/app.js  card, SDD line, cluster heading, drawer (D62)
```

## Dependency on #1257

This change reads four things #1257 provides, by requirement number:

| From #1257 | Read here by |
|---|---|
| `issueList` rows with `state` (R1257-1), so graph nodes carry the port's tri-state (R1257-6) | D59: `Entry.state` |
| The `closedIssues` section (R1257-7, D68) | D59: closed entries; D60: `closedUnresolved` |
| The `forgeLoad` section and lane entry shapes (R1257-8) | D62: the rollup wording |
| `pending(reason)` sections (R1257-9, D65) | D60: `hierarchy` is pending when `graph` is |

#1257 merged as `b08f7569`; this change is applied on top of it. See "Reconciliation with merged #1257" below.

## Reconciliation with merged #1257 (2026-10-02)

The spec and design were written against #1257's designed shapes. Read against the merged code (`b08f7569`), the differences are these. The merged code is the truth.

| # | Assumed here | Merged code | Fix |
|---|---|---|---|
| 1 | `forgeLoad` read as a bare `{open, closed}` | The snapshot's top-level `forgeLoad` is a section, `field({open, closed})`, so `{ok:true, value:{open, closed}}` (`snapshot.mjs:468`); only `meta.poller.forgeLoad` and `buildSnapshot`'s `forgeLoad` option are bare. | `epicRollup`'s second argument is the section and it reads `.value.closed`; a section that is not `ok` yields `{ok:false}`. Spec R1199-7 and the wording table now say `forgeLoad.value.closed`. |
| 2 | `closed` nodes shaped like open ones | Closed nodes come straight from `buildGraph` and carry no `ok` key (`snapshot.mjs:333`); open nodes get `ok:true/false` (`:397-399`). | D59: a node is unreadable only when `ok === false`. |
| 3 | The server needs no change | When `forgeUnavailable`, `server.mjs:200-201` overrides `graph`, `prs`, `reviews` and `closedIssues` with the real reason. | D60: the same override gains `hierarchy`, so it never keeps a reason derived from a stand-in graph. |
| 4 | `pending`/`failed`/`disabled` entry shapes | Confirmed identical (`poller.mjs:125-136`): `pending {state,at,reason?}` (reason is "polling is paused"), `failed {state,at,reason,lastCompleteAt}`, `disabled {state,at:null,reason}`, `complete {state,at}`. | None. |
| 5 | `closedIssues`, `unresolved` reason | Confirmed: `{nodes, declarationDivergences, unresolved}`, reason "the forge list carried no body". It is `pending` while loading, `uncomputable` when disabled or failed with no data. | None. |

One residual: the `complete` entry and a `closedIssues` section that failed to read the cache can coexist (`snapshot.mjs:455-456`). The rollup cannot see that from `hierarchy` alone, so it would count open children only under a `complete` wording. Recorded under Risks.

## Decisions

| # | Decision | Rejected | Why |
|---|---|---|---|
| D50 | **`countTasks` lives in `brain/scripts/lib/tasks-list.mjs`, and `ui/lib/tasks-list.mjs` moves there with `git mv`.** The module declares `CHECKBOX_RE` once (today at `ui/lib/tasks-list.mjs:13`) and exports `taskItems(text)` → `[{line,text,done}]`, `countTasks(text)` and `parseTasksList`, which becomes `taskItems` plus attribution and source. `deriveTasks` (`derive.mjs:81-84`) drops its two regexes, takes `checked` and `open` from `taskItems`, and takes `next` from the first open item's `text`. The old regexes are prefixes of the unified one, so their counts are unchanged; the split on `\r\n\|\n` is the stricter of the two. `change-route.mjs:28` imports `../lib/tasks-list.mjs`. | (a) `countTasks` in `ui/lib`, with `derive.mjs` importing `../ui/lib/…`. (b) A new `lib/task-count.mjs`, with `tasks-list` staying in `ui/lib`. (c) A source-guard exemption. | (a) creates a status→ui import, which no production module makes today (the only ones are tests: `snapshot-cli.test.mjs:10-12`, `remote-changes.test.mjs:10-16`). (b) fails because `ui/lib/**` may import only `./` siblings (`ui/lib/source-guard.test.mjs:47-60`), so `tasks-list` could not import it and two grammars would remain. (c) fails because the browser resolves `/lib/x.mjs` to `ui/lib` (`server.mjs:66`), the wrong module. The move costs nothing on the page: `app.js:15-68` never imports `tasks-list`, and its only production consumer is the server (`change-route.mjs:28`). `lib/git-tree.mjs` sets the precedent (#1243 D49). |
| D51 | **The snapshot field is `progress: {ok:true, value:{done,total}} \| {ok:false, code, reason}`,** where `code` is `missing`, `unreadable` or `no-items`. `readOneChange` (`snapshot.mjs:234-249`) checks `exists(dir/tasks.md)` first, which is `missing`. A throwing read is `unreadable`, and its reason names the path and the error. Otherwise the field is `countTasks(text)`. `tasks:{checked,open,next}` **stays and comes from the same read**, and a test pins `tasks.checked.value === progress.value.done`. `deriveTasks` receives the reason that matches the code, so it no longer says "could not be read" for a file that is absent (`:237`). | Derive `tasks` from `progress`; drop `tasks`. | `next` needs items, not counts. `tasks` has four readers: `sdd-model.mjs:93,134`, `app.js:1077`, `status/cli.mjs:141` and `renderSnapshotText`. One read and one grammar feed both fields. `code` makes the three reasons distinct by value, not only by prose. |
| D52 | **The drawer counts its own HEAD text.** `buildTasksTab` (`change-route.mjs:96-121`) returns `{ok:true, value, progress, note?}`. `progress` is `countTasks(doc.text)` when the document is `present`, and `{ok:false, code:'truncated', reason}` when it is `truncated` (`:66-67`, `:233-236`): a count over the read part is not a total. `drawer-model.mjs:326` adds `header: progressLabel(tasks.progress, SOURCE.head)`, and `renderTab` (`app.js:1770`) renders `tab.header` before `tab.note`. | Reuse the snapshot's working-tree `progress` in the drawer. | R2 forbids it: the drawer reads HEAD (`:105-107`), and showing a working-tree count under HEAD items mixes two sources without saying so. |
| D59 | **`status/hierarchy-adapter.mjs` builds the contract** (see Interfaces). It takes the open graph's `nodes` and `declarationDivergences`, and `closed`, which is #1257's `closedIssues.value` (`buildGraph` already run over the closed rows that carry a body, D68 there) or `null` when that section is not a value. That keeps closed issues off the board and reuses `declaredParent` and `parseGraphBlock` unchanged. `children` is computed once, from all entries. `levelSource` is `'block'` when `kind === 'epic'`, because `kind` exists only in a block (`epic-graph.mjs:492`), and `'default'` otherwise. For an unreadable node (`snapshot.mjs:349`), `level` and `levelSource` are `null`, which the contract permits (the ticket-hierarchy resolver contract (#1251; ADR-0039 in draft), §3). Divergences are mapped from epic-graph and never derived: see R1199-5. A closed node has no `ok` key, so a node is unreadable only when `ok === false`. A closed row in `closed.unresolved` gets no entry, because the contract has no "parent unknown" value and `parent: null` would claim "none". | (a) Merge closed issues into the open `buildGraph`. (b) Read the closed rows from the port here. | (a) would draw about 456 closed cards, change the tracks, and move every `blockedBy`. (b) The closed read is #1257's, with its load state; a second read here would duplicate the costliest call. |
| D60 | **The snapshot section is `hierarchy: field({issues: [[n, Entry], …], divergences, closedUnresolved})`.** `issues` is the Map's entries in ascending order. `closedUnresolved` is `closedIssues.value.unresolved` when that section is a value, otherwise `[]`; the rollup states the closed lane's load from `forgeLoad`, so an empty list there never reads as "all resolved". `ui/lib/rollup-model.mjs#hierarchyOf` returns `new Map(issues)`. The section is `uncomputable` when the graph is, and `pending` when the graph is. `server.mjs`'s `forgeUnavailable` override gains `hierarchy: unreachable` beside the four it already replaces. `renderSnapshotText` gains a `hierarchy` line. | An object keyed by number; computing the adapter in the browser. | JSON drops a Map (the `tracks` precedent, `snapshot.mjs:351-359`), and object keys come back as strings. `status/` cannot be served to the page, and #1251's resolver will run in node. |
| D61 | **`childrenOf` migrates to the contract** (Interfaces). The new signature is `childrenOf(graphSection, hierarchySection, issue)`, and the call site at `app.js:1741` passes `sectionOf(state, 'hierarchy')`. The list keeps the children that are graph nodes. A closed child is counted by the rollup and not listed, and the block says so. `buildEpicGrouping` (`lane-model.mjs:327-339`) keeps its own inversion until #1251, a named residual: it carries `parent-not-in-graph` and `nested-epic-not-supported` reasons that the contract has no field for. | Migrate `buildEpicGrouping` too. | That rewrites R1032-1/-2 under a ticket that did not ask for it. |
| D62 | **UI.** `progress-view.mjs` exports `SOURCE = {workingTree:'working tree', head:'at HEAD'}`, `PROGRESS_WORDS` and `progressLabel(progress, source, {prefix})`. `rollup-model.mjs` exports `NO_CHILDREN`, `CLOSED_LOAD_WORDS`, `epicRollup(hierarchySection, forgeLoadSection, epic)` and `rollupLabel`, and the wording table is in the spec. `epicRollup` keys "counting closed children…" off `forgeLoad.closed.state === 'pending'` (#1257's R1257-8). The call sites are: `app.js:805-807`, which renders `progressLabel(change.progress, …)` and no longer adds `checked + open`; `:1077`, the same label plus `next`; `:687`, `rollupLabel`; `:716`, unchanged; and `:1746-1748`, which gains the rollup label and the counted-not-listed note when `level === 'epic'`. `sdd-model.mjs#buildChangeRow` passes `progress` through. Every string goes through `el()`, which uses `textContent` (`app.js:144-148`). No new code walks `childNodes`, and any future walk uses `for…of` (`dom.test.mjs:193-235`). | | |

## Interfaces

```js
// lib/tasks-list.mjs
taskItems(text: string) -> Array<{line, text, done}>
countTasks(text) -> {ok:true, value:{done,total}} | {ok:false, code:'no-items', reason}
parseTasksList({text, path, attribution}) -> unchanged

// status/snapshot.mjs (this change's additions)
buildSnapshot(...) -> {..., changes[].progress, hierarchy}
// consumed from #1257: graph (state from the port), closedIssues, forgeLoad, pending sections

// status/hierarchy-adapter.mjs
hierarchyFromGraph({nodes, declarationDivergences, closed: {nodes, declarationDivergences, unresolved}|null})
  -> {issues: Map<number, {level, levelSource, parent, children, tracker, milestone:null, state, divergences}>,
      divergences: Array<{issues:number[], field, source, expected, found}>}

// ui/lib/rollup-model.mjs
hierarchyOf(section) -> {ok:true, value:{issues: Map, divergences, closedUnresolved}} | {ok:false, pending?, reason}
epicRollup(hierarchySection, forgeLoadSection, epic)
  -> {ok:true, value:{closed:number|null, open, unknown, total:number|null, unresolved, load}} | {ok:false, pending?, reason}

// lane-model.mjs#childrenOf, after D61
const h = hierarchyOf(hierarchySection);
if (!h.ok) return { ok: false, reason: h.reason };
const byNumber = new Map((graphSection.value?.nodes ?? []).map((n) => [n.number, n]));
const value = (h.value.issues.get(issue)?.children ?? [])
  .filter((n) => byNumber.has(n))          // open nodes; closed ones are counted by the rollup
  .map((n) => row(byNumber.get(n)));       // the existing stateAndMarks row, unchanged
```

## Testing strategy (strict TDD, node:test)

- No test touches the network. Forge reads come from `readOnlyPort` fakes keyed on `state` (`snapshot.test.mjs:290-333`), whose rows carry `state` and `body` as #1257 defines them. Rollup tests build `forgeLoad` sections by hand in #1257's shapes.
- No timing constants.

**First RED** goes in `lib/tasks-list.test.mjs`. `countTasks('- [x] a\n- [ ] b\n  - [X] c\n- [ ] d\n- [x] e')` must deep-equal `{ok:true, value:{done:3,total:5}}`, and `countTasks('# Tasks\nprose')` must return `code:'no-items'`. It fails on the missing export. It comes first because every surface depends on this grammar.

| File | New tests |
|---|---|
| `lib/tasks-list.test.mjs` (moved) | The first RED; CRLF; `taskItems` parity with `deriveTasks`; a scan of `status/**` and `ui/**` finds no checkbox regex outside the module (R1199-1). |
| `status/snapshot.test.mjs` | `progress` for missing, unreadable (`_read` throws `EACCES`), no-items and 3/5; `tasks.checked === progress.done`. Hierarchy: closed children from `closedIssues`; a closed failure leaves it open-only; pending when the graph is pending. **One-shape extension:** `JSON.parse(JSON.stringify(s))` deep-equals `s`, and `hierarchyOf(parsed.hierarchy)` deep-equals `hierarchyFromGraph(...)`. |
| `status/snapshot-cli.test.mjs` | Byte-identical `--json` for a fixed `--now`, now including `hierarchy`. |
| `status/hierarchy-adapter.test.mjs` | Exact keys; `children` including closed and nested; `levelSource` (block, default, null); divergence mapping, top-level `parent-not-epic`; `closed: null` yields no closed entry; no `track`/`files` read. |
| `ui/change-route.test.mjs` | The 2/5 HEAD versus 3/5 working-tree fixture; truncated. |
| `ui/lib/rollup-model.test.mjs`, `progress-view.test.mjs` | Every row of both wording tables; never `0 /` while pending, failed without data or disabled. |
| `ui/lib/lane-model.test.mjs` | `childrenOf` follows `children` even when a node's `parent` field disagrees, which is the detector. |
| `ui/static/*render*.test.mjs` (via `installDom`) | Heading text, complete and counting; drawer rollup; markup inert. |

Existing tests that change: `tasks-list.test.mjs` and `provenance.test.mjs:13` (the import path); `lane-model.test.mjs` (`childrenOf` calls gain a hierarchy section); `sdd-model.test.mjs:122-169` (`progress` is passed through).

## Size (gated; `*.test.mjs` excluded)

| File | Added | Removed |
|---|---|---|
| `lib/tasks-list.mjs` (rename plus delta) | 30 | 0 |
| `status/derive.mjs` | 6 | 6 |
| `status/snapshot.mjs` | 25 | 0 |
| `status/hierarchy-adapter.mjs` (new) | 80 | 0 |
| `ui/change-route.mjs` | 10 | 0 |
| `ui/lib/progress-view.mjs`, `ui/lib/rollup-model.mjs` (new) | 40, 75 | 0 |
| `ui/lib/lane-model.mjs`, `drawer-model.mjs`, `sdd-model.mjs` | 15, 6, 3 | 15, 0, 0 |
| `ui/static/app.js`, `app.css` | 35, 4 | 0 |

About **330 added and 20 removed**, about 350 changed lines, against the `lite` budget of 1000. One PR. Before the split, the whole change was forecast at about 700 added and 120 removed; #1257 now carries about 420 added and 100 removed of it, including D68's new `closedIssues` section.

## Migration / rollout

None. `progress` and `hierarchy` are additive. Revert the PR to roll back; #1257 can stay.

## Risks

- **A `complete` closed entry with an unreadable closed section.** `readForge` can find the entry `complete` yet fail to read the cached list (`snapshot.mjs:455-456`). The page then shows open counts under the `complete` wording. Not closed here; a follow-up should expose a flag from the snapshot.
- **A cross-set `parent-not-epic` is missed.** When a closed child names an open non-epic, nothing reports it, because the closed set runs through its own `buildGraph` (in #1257).
- **The cluster cards and the rollup can differ for nested epics.** The cluster omits the child epic (R1032-2), while the rollup counts it (R9). This is by ruling.
- **A just-closed child briefly disappears from an epic's total**, for about one interval of #1257's closed lane. It is never shown as open or closed wrongly.
