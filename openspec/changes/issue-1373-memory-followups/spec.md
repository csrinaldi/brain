---
status: complete
issue: 1373
---

# Spec — memory-followups (issue 1373)

## Requirements

**R1373-1 — The tab shows what a record says (#1373).** Each Records tab row shows the record's title and excerpt, taken from the `summary` the snapshot row already carries (`status/snapshot.mjs` `projectRecord`, `memory/lib/record-summary.mjs`). No second derivation exists. A record with no title shows the same sentence in the title slot as the ledger (`NO_TEXT`, `EMPTY_TEXT`, `SUMMARY_MISSING`) and no excerpt. Every text element's `title` attribute equals its own text. Who wrote it and the source stamp stay.

**R1373-2 — A row opens inline (#1373).** A native button (the title) opens the record's body in the row's own card through `/api/record/{id}` and the SDD reader's worker path, the ledger's mechanism. Drawing the tab fetches nothing and spawns no worker. A row open when the drawer is drawn again opens again with no new read.

**R1373-3 — One wording per fact (#1373).** The pending, failure, reason and truncation sentences are the ledger's (`RECORD_LOADING`, `recordFailure`, `recordTruncated`, the route's `reason`).

**R1373-4 — Two surfaces, one bounded cache (#1373, #1377).** The ledger and the drawer each keep their own set of open ids and share one read and one render per id. A read is held while any surface has its id open. A collapse on one surface never throws away what the other still shows.

**R1377-1 — No table pipes in an excerpt (#1377).** A line that starts with `|` reads as its cells' text joined by ` · `; empty cells say nothing; an escaped `\|` is a character. A prose line that merely contains `|` is unchanged. A table-led record has a pipe-free title and excerpt.

**R1377-2 — Held is bounded by open and visible (#1377).** Each render of a surface evicts the open ids it can no longer show, and the reads and renders no surface holds. The ledger shows the window (`MEMORY_RECENT_CAP`); the drawer shows its issue's records. Closing the drawer or changing the issue releases the drawer's.

**R1300-1 — The amendment notes cite main (#1300).** No file under `openspec/changes/` cites `b354737e`; the notes cite `bea6a853` (#1265).

**R1300-2 — The counted case is rendered (#1300).** `rollup-render.test.mjs` asserts the epic drawer keeps the closed-children note when the closed lane is complete and `closedRead.ok`.

## Scenarios

- GIVEN a record of issue 1059 whose content starts `**Poller holds one timer**` WHEN the Records tab is up THEN its row reads that title, then the excerpt, and both carry a `title` attribute equal to their text (R1373-1).
- GIVEN a record with no `content` WHEN the tab is up THEN the title slot reads "this record has no content field" and there is no excerpt (R1373-1).
- GIVEN the tab is up WHEN the reader clicks a title THEN "loading record…" shows, then the markdown the worker made; a second click removes it (R1373-2).
- GIVEN the route answers 500 WHEN the row is opened THEN the row says "the record <id> could not be loaded: answered 500" (R1373-3).
- GIVEN id X is open in the drawer and in the ledger WHEN newer records push X out of the 50-row window THEN the drawer still shows X open with no new read (R1373-4).
- GIVEN X is open only in the ledger WHEN it leaves the window and returns THEN it is closed and opening it reads it again (R1377-2).
- GIVEN content `| Field | Value |` / `|---|---|` / `| a | b |` WHEN summarised THEN title "Field · Value", excerpt "a · b" (R1377-1).
- GIVEN a complete closed lane and `closedRead.ok` WHEN the epic drawer is drawn THEN it reads "closed children are counted above" (R1300-2).
