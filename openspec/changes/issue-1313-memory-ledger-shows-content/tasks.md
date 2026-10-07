---
status: draft
issue: 1313
---

# Tasks — memory-ledger-shows-content (issue 1313)

Strict TDD: each task is RED (test written first, run, failure recorded), GREEN, REFACTOR.
Single PR, ask-on-risk; budget 1000 gated lines, forecast about 340.

## Review Workload Forecast

- Estimated gated lines: about 340 (tests, `openspec/` and `.memory` are outside the budget)
- Chained PRs recommended: No
- 400-line budget risk: Low (tier budget is 1000)
- Decision needed before apply: No

## Phase 1: Pure summarizer (memory domain)

- [x] 1.1 RED/GREEN `brain/scripts/memory/lib/record-summary.test.mjs` + `record-summary.mjs`: bold lead title, first-line fallback, marker strip, whitespace collapse (R1313-1, R1313-2, S1-S3)
- [x] 1.2 RED/GREEN bounds: `EXCERPT_MAX = 120` cut on a code point ending in `…` with `truncated`, `TITLE_MAX = 200`, `SCAN_MAX = 2000` window (S2, S7)
- [x] 1.3 RED/GREEN absence: `NO_TEXT` for absent or non-string content, `EMPTY_TEXT` for blank content, neither says "unreadable" (R1313-3, S4, S5)

## Phase 2: Snapshot and model

- [x] 2.1 RED/GREEN `snapshot.test.mjs`: `projectRecord` carries `summary`, never `content` (R1313-4)
- [x] 2.2 RED/GREEN `memory-model.test.mjs`: `recentRow` passes `summary` through; `RECORD_LOADING` and `recordFailure` wording helpers (R1313-5, R1313-11)

## Phase 3: The record route

- [x] 3.1 RED/GREEN `brain/scripts/ui/record-route.test.mjs` + `record-route.mjs`: ok, unknown id 404, bad id, cap with `truncated`, empty and absent content (R1313-8, S14-S16)
- [x] 3.2 RED/GREEN `server.test.mjs`: `/api/record/{id}` wired, `KNOWN_ROUTES`, GET/HEAD only, traversal ids 404 (R1313-8, S14)

## Phase 4: The page

- [x] 4.1 RED/GREEN fake-DOM test: ledger row shows title, excerpt, id; title attributes equal the shown text; reason rows; no element from content (R1313-5, R1313-6, S1, S4, S6)
- [x] 4.2 RED/GREEN fake-DOM test: toggle opens inline, loading then rendered markdown through the worker, collapse removes (R1313-9, R1313-10, S9, S11)
- [x] 4.3 RED/GREEN failure and pending states, no-worker, many open, re-render keeps open (R1313-11, S10, S12, S13)
- [x] 4.4 CSS for the record stack and detail row; table-cells and app-source guards pass

## Phase 5: Close

- [x] 5.1 Full `npm test`, `brain:repo:check`, `brain:nav`, publish allowlist canary
- [x] 5.2 Mutations (each fails a test, then reverted)
- [x] 5.3 Measure the records payload before and after; real-browser proof; `apply-progress.md`

## Micro-decisions

- Many rows open at once (D160); state is a page-only set of ids.
- The detail row is pre-created hidden per ledger row, because the fake DOM and the in-place toggle need no `insertBefore`.
- The route finds the file by listing `.memory/records/` for a name ending `-<id>.jsonl`; the id is never part of a path (D159).
