---
status: complete
issue: 1373
---

# Apply progress — memory-followups (issue 1373)

Mode: Strict TDD. Single PR. 10 of 10 tasks done.

## TDD cycle evidence

| Task | RED (failure recorded) | GREEN | Refactor |
|---|---|---|---|
| 1.1 citations (#1300) | `rg b354737e openspec/` listed 3 hits | 0 hits | none |
| 1.2 counted-case render test (#1300) | regression lock on shipped code; proved by mutation: `rollupNote` returning `null` fails the new test plus two older ones | 12/12 in rollup-render | none |
| 2.1 table rows (#1377) | 3 failing in record-summary.test (pipes kept) | 23/23 | title path goes through `plainLine` |
| 2.2 record-hold (#1377) | module absent | 2/2 | none |
| 2.3 eviction (#1377) | `#1377 ... pushed out of the window` failed: row came back open | 11/11 in record-drawer-render | `wireRecordToggle` host-parametrised, collapse path shares `evictUnheldRecords` |
| 3.1 route + drawer model (#1373) | 3 failing (`summary`, `record` absent) | 119/119 | `summaryOf` exported, not copied |
| 3.2 render (#1373) | 10 of 11 new render tests failed (TypeError, no `memory-id` in drawer) | 11/11 | `renderRecordStack` shared by both surfaces |
| 3.3 shared cache (#1373, #1377) | covered by 2.3 and 3.2 runs | 11/11 | none |
| 3.4 real browser | n/a | shots below | none |

## Mutations (each reverted, suite green after)

- #1300: `rollupNote` returns `null` -> 3 tests fail incl. the new one.
- #1377 table: skip `tableRowText` in `plainLine` -> 3 tests fail.
- #1377 eviction: remove the ledger prune -> "pushed out of the window" fails.
- #1373/#1377 sharing: `unheldIds` over the ledger set only -> 3 shared-cache tests fail.
- #1373: `summaryOf(null)` in the drawer model -> 4 tests fail.

## Close

- `npm test`: 8476 tests, 8473 pass, 0 fail, 3 skipped.
- Gated diff vs origin/main (tests, `.memory`, `openspec/changes` excluded): +141 / -36 = 177 lines.
- Tarball: 4.006 MiB unpacked, 364 files, against the 4.4 canary. Not raised.
- Proof: `shots/v1373-records-tab.png` and `shots/v1373-records-expanded.png` (epic #864 drawer, Records tab).

## Deviations

- The capture script named in the brief did not exist; a minimal CDP script was written in the scratchpad.
- #1373 and the eviction half of #1377 share one commit: the host refactor of `wireRecordToggle` serves both.
