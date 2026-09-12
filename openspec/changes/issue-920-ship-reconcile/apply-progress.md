# Apply progress — #920 lane reconciliation (push-succeeded/PR-missing retry)

Batch: 1 (first and only batch — all 5 phases completed in this run).
Mode: **Strict TDD** (test runner: `node --test <file>`; full suite `npm test`).
Worktree: `/home/gandalf/IA/brain-issue-920`, branch `feat/issue-920-ship-reconcile`.

## Status

30/30 tasks complete (1.1–1.10, 2.1–2.7, 3.1–3.3, 4.1–4.6, 5.1–5.6). `npm test`
green: **5252/5252** (full repo suite, including one collateral fix — see
Deviations). Epic task `openspec/changes/issue-864-memory-2-0/tasks.md` item
4.6 ticked `[x]`.

## TDD Cycle Evidence

| Task(s) | RED | GREEN | REFACTOR |
|---|---|---|---|
| 1.1–1.10 (ship.test.mjs split + new cases) | 9 tests failed for the right reason (missing `surveyDelivery`/fields) — confirmed via `node --test ship.test.mjs` before any production edit | N/A (test-only commit) | n/a |
| 2.1–2.7 (`surveyRef` tip, `surveyDelivery`, split predicate, outcome fields) | (inherits 1.1–1.10's red) | all 36 `ship.test.mjs` tests green | comment cleanup folded into 5.1 |
| 3.1–3.3 (integration: M1 repro, squash repro) | written directly against the already-green Phase 2 code (unit-level RED already proved the same logic); both new integration tests passed on first run — no fixture/logic mismatch found | 7/7 `ship.integration.test.mjs` green | none needed |
| 4.1–4.6 (day-start-sweep + cli shipOutcomeKey + i18n) | `day-start-sweep.test.mjs`: 1 new test failed (reconciled key missing); `cli.ship.test.mjs`: 1 new test failed (`shipOutcomeKey` returned `done`, printed "shipped ... armed" instead of a reconciled message) | `laneSweepLine()` + `shipOutcomeKey()` + both i18n catalogs → 87/87 (day-start-sweep + cli.ship + i18n coverage) green | none needed |
| 5.1 (traceability comment) | n/a (docs only) | re-ran `ship.test.mjs`+`ship.integration.test.mjs` (43/43) after the comment edit to confirm no behavior drift | tightened comment wording naming #936 and #930 explicitly |
| 5.3–5.6 (record-first close) | n/a | `memory:save` succeeded with positional args (avoided #928's `canonicalJson` trap); index delta verified as exactly one net new id | n/a |

## Completed Tasks

All of Phase 1 (1.1–1.10), Phase 2 (2.1–2.7), Phase 3 (3.1–3.3), Phase 4
(4.1–4.6), Phase 5 (5.1–5.6) per `tasks.md` — file has every item marked `[x]`.

## Files Changed

| File | Action | What Was Done |
|------|--------|---------------|
| `brain/scripts/memory/lane/ship.mjs` | Modified | `surveyRef()` also returns `tip`; new `surveyDelivery({git,root,ref,baseFetched})` (content-containment read, R3/R4/R5); `tip===null` replaces `commit===null&&ahead===0` as the structural cold-1 no-op; split predicate `pendingPush`; `delivered===true` early no-op (R6/R7); push gated on `pendingPush`; reconcile tail (`findOrCreatePr`+`mrAutoMerge`) always attempted when not delivered; `delivered`/`deliveredReason`/`reconciled` added to every return path; traceability comment naming #936 (R10 follow-up) and #930 (VCS port limitation) beside the split predicate |
| `brain/scripts/memory/lane/ship.test.mjs` | Modified | Split the `:93-117` no-op test into (a) delivered no-op (verbatim assertions + 3 new fields) and (b) the M1 regression pin; added row-7, reconcile-only-mrList-fatal, argv-collision, baseFetched-false, and diffFailed tests; updated `surveyOkRules()` with the ordered `--`/three-dot diff pair; added `delivered`/`deliveredReason`/`reconciled` assertions to the cold-1 and `--dry-run` tests; fixed the `behind>0` test's diff fixture (was empty, which would have wrongly resolved `delivered:true` and short-circuited before the divergence check) |
| `brain/scripts/memory/lane/ship.integration.test.mjs` | Modified | Added the M1 repro (`recordingVcsThrowOnce()`, push OK → `mrList` throws → zero-new-record retry reconciles) and the real-squash no-op repro (tree-sha-identical squash commit via `commit-tree`, second run is a true no-op) |
| `brain/scripts/memory/day-start-sweep.mjs` | Modified | `laneSweepLine()` gains a `reconciled` branch (after `pushed`, before `nothing`) rendering `day.memory.laneSweep.reconciled` with `ref`/`number` params |
| `brain/scripts/memory/day-start-sweep.test.mjs` | Modified | Added reconciled-without-push, pushed-wins-over-reconciled, and both-false-still-nothing tests |
| `brain/scripts/memory/cli.mjs` | Modified | `shipOutcomeKey()` gains `pushed===false && reconciled===true → "reconciled"`, inserted after `autoMergeRefused` and before the final `done` |
| `brain/scripts/memory/cli.ship.test.mjs` | Modified | Added a two-run CLI-level test proving `pushed:false && reconciled:true` renders `"reconciled"` in both `--json` and text output, never "nothing new to ship" |
| `brain/scripts/i18n/en.mjs` | Modified | Added `memory.ship.reconciled` and `day.memory.laneSweep.reconciled` |
| `brain/scripts/i18n/es.mjs` | Modified | Same two keys, neutral/professional Spanish |
| `brain/scripts/memory/chunk-boundary.test.mjs` | Modified | Collateral fix — `cli.mjs`'s dynamic `migrate-v1.mjs` import shifted from line 615 to 620 after this change added lines earlier in the file; updated the D4-guard's hardcoded line annotation and header comment |
| `openspec/changes/issue-864-memory-2-0/tasks.md` | Modified | Ticked item 4.6 (`#920`) |
| `.memory/index.jsonl`, `.memory/records/2026-09-rec-8401b733c9cdeba4.jsonl` | Added | Record-first closing entry documenting the decision (`memory:save`, positional args, `--issue 920 --type decision`) |

## Commits (work-unit, chronological)

| Commit | Subject | Work unit |
|---|---|---|
| `403e7bd0` | `test(memory): pin ship.mjs reconciliation cases before the fix (#920)` | Phase 1 (RED) |
| `9dcad4c7` | `feat(memory): shipLane splits pendingPush from pendingReconcile (#920)` | Phase 2 (GREEN) |
| `62b7efc3` | `test(memory): integration-pin the M1 retry and a real squash-merge no-op (#920)` | Phase 3 |
| `b5536dfb` | `feat(memory): day-start sweep and ship CLI report reconciliation as work (#920)` | Phase 4 |
| `7c3d21d7` | `docs(memory): comment the R10/#930 follow-ups on the split predicate (#920)` | Phase 5.1 |
| `3e69f84e` | `test(memory): re-pin chunk-boundary's cli.mjs line number after #920 (#920)` | Collateral fix (see Deviations) |
| `922f4e84` | `chore(memory): record #920's reconciliation fix and tick epic 4.6 (#920)` | Phase 5.3–5.5, closing |

Branch diff vs `origin/main`: **13 files changed, 502 insertions(+), 37
deletions(-)** (`git diff --stat origin/main...HEAD`). Well inside the
400-line budget forecast (Low risk, single PR, no chaining) — the extra
volume over the ~70-line counted estimate is test/doc/record lines, which
`brain.config.json` excludes from the counted-line budget per the tasks
artifact's own forecast.

## Deviations from Design

- **Collateral fix, not in the original task list**: `chunk-boundary.test.mjs`
  hardcodes the exact source line of `cli.mjs`'s dynamic `migrate-v1.mjs`
  import (a D4 guard, epic #864 task 2.3) to prove a regex-based import
  scanner sees a multi-line dynamic import a naive line-filtered scanner
  would miss. Adding 5 lines to `shipOutcomeKey()` (Phase 4.4) shifted that
  import from line 615 to line 620, breaking the guard's assertion. Fixed by
  re-pinning the line number in the test and its header comment — a pure
  line-number chore, no behavior or scope change. Caught by the mandatory
  full-suite `npm test` run before the closing commit, exactly as Strict TDD
  requires.
- Everything else matches `design.md`/`spec.md`/`proposal.md` exactly — no
  other deviations. `surveyDelivery`'s first call remains byte-identical to
  `buildTitleAndBody`'s diff (not folded together, per the settled note).
  `ship.test.mjs:93-117`'s original assertions all survive verbatim in test
  (a); test (b) is wholly new (R13).

## Issues Found

None blocking. The pre-existing `.memory/records/` duplicate-id warning
printed by `memory:save` (2 divergent ids from unrelated prior branches) is
informational only, per that command's own documented behavior (ADR-0017,
`merge=union`) — not caused by this change and not actionable here.

## Task 5.2 (orchestrator-owned, not mine)

The R10 follow-up issue was filed as **#936** by the orchestrator before this
batch started, per the launch prompt. Referenced (along with #930) in the
traceability comment beside `ship.mjs`'s split predicate (commit `7c3d21d7`).
I did not file any issue.

## Workload / PR Boundary

- Mode: single PR (delivery_strategy `ask-on-risk`, forecast was Low risk,
  no chaining recommended).
- Current work unit: N/A — this batch completed the whole change.
- Boundary: this batch starts from a clean worktree at `origin/main` tip
  `755fe4c6` and ends with the closing record commit `922f4e84`. All 7
  commits are independently revertible per the tasks artifact's own
  rollback notes.
- Estimated review budget impact: 502(+)/37(-) across 13 files, well under
  the 400 counted-line budget once tests/records/openspec are excluded per
  `brain.config.json`'s own counting rule.

## Remaining Tasks

None. Ready for `sdd-verify`.
