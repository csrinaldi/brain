---
status: complete
issue: 1373
---

# Design — memory-followups (issue 1373)

## Decisions

### D172 — The drawer reads the ledger's summary, validated by the ledger's function (#1373)

The snapshot row already carries `summary` (`projectRecord`, #1313). `buildRecordsTab` passes `r.summary ?? null` through untouched; `recordsEntries` in `drawer-model.mjs` attaches `record: {id, type, summary}` where `summary` is `summaryOf(...)` from `memory-model.mjs`, now exported. The malformed-or-absent case is the ledger's one stated gap (`SUMMARY_MISSING`). No excerpt is computed in the drawer, so a wording cannot drift from the ledger's.

### D173 — Two open sets, one shared read, eviction by "held by nobody" (#1373, #1377)

`expandedRecords` (ledger) and `expandedDrawerRecords` (drawer) are separate sets: opening id X in one surface must not open it in the other. `recordLoads` and `recordTrees` stay shared per id, so one read and one worker serve both. The rule lives in `lib/record-hold.mjs` (pure): `staleIds(open, visible)` and `unheldIds(held, ...openSets)`.

- A surface render calls `pruneRecords(openSet, visibleIds)`: open ids not visible are dropped from that set, then every read in no set is evicted (`evictUnheldRecords`).
- The ledger's visible ids are the window's rows; the drawer's are its issue's records, whichever tab is up (a tab switch is not a reason to re-read). An id open in the drawer is therefore not evicted because it left the ledger window, and a collapse on one surface keeps a read the other still has open.
- A closed drawer, a changed issue (`changeView === null`) and an unreadable model all draw no rows, so they prune with an empty set. The ledger prunes the same way when its model is not ok.
- A read evicted while in flight shows nothing: the `then` checks `recordLoads.get(id) === entry`, so it cannot start a render nobody holds.

Known and accepted: a collapse that must retry a failed read on a surface whose id is also open on the other surface reuses the other's failed read until that one closes too.

### D174 — A table row is its cells (#1377)

`plainLine` treats a line that starts with `|` as a row: split on unescaped pipes, strip inline markers per cell, drop empty cells, join with ` · ` (`CELL_SEPARATOR`). Separator rows still vanish. A line that merely contains a pipe is prose. The title takes the same path when a record has no bold lead.

### D175 — The drawer row reuses the ledger's building blocks (#1373)

`renderRecordStack` (title toggle, excerpt, id) and `wireRecordToggle` (now host-parametrised: `ledgerHost` puts the body in a detail row, `drawerHost` appends it to the card) serve both surfaces. `app.js` only renders; the rule is in `lib/`.

### D176 — Citations follow main (#1300)

`closedRead` shipped in the squash `bea6a853` (#1265). The three citations of `b354737e` in `issue-1199-progress-epic-milestone/design.md` and `issue-1267-epic-drawer-closed-count-claim/proposal.md` (both active) are corrected in place. No archived dir cites it.

## Contract / API impact

`/api/change/{issue}` records rows gain `summary` (additive, `null` when the snapshot row has none). No other contract changes.

## Alternatives rejected

- A drawer-side excerpt derivation: a second wording to keep true.
- One shared open set: opening in the ledger would open the drawer row, and the ledger's eviction would close the drawer's.
- Evicting by ledger window alone: it would drop a read the drawer is showing.
