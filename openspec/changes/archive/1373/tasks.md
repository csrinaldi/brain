---
status: complete
issue: 1373
---

# Tasks — memory-followups (issue 1373)

## #1300
- [x] 1.1 `b354737e` -> `bea6a853` (#1265) in issue-1199 design and issue-1267 proposal (none archived)
- [x] 1.2 Render test: complete lane + `closedRead.ok` keeps the note; mutation on `rollupNote`

## #1377
- [x] 2.1 RED/GREEN: table rows read as cells in `record-summary.mjs`; table-led record test
- [x] 2.2 RED/GREEN: `lib/record-hold.mjs` (`staleIds`, `unheldIds`)
- [x] 2.3 RED/GREEN: each render evicts open ids no longer visible; fake-DOM test pushes an open row out of the window

## #1373
- [x] 3.1 RED/GREEN: the records row carries `summary` (route) and `record` (drawer model); `summaryOf` exported
- [x] 3.2 RED/GREEN: drawer renders title, excerpt, `title` attributes; opens inline through the shared mechanism
- [x] 3.3 Shared-cache tests: open in both surfaces, ledger window loss, one-sided collapse, drawer close
- [x] 3.4 Real-browser proof (shots v1373-records-tab, v1373-records-expanded)

## Review Workload Forecast
- Single PR; gated diff measured at close and recorded in apply-progress.

## Micro-decisions
- Eviction rule for shared maps: D173.
