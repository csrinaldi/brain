# Apply Progress: engram.pull.test.mjs and the missing-root guard (#1026)

**Change**: issue-1026-memory-index-leak
**Mode**: Strict TDD
**Worktree**: `/home/gandalf/IA/brain-issue-1026`
**Branch**: `fix/issue-1026-fixtest-engrampulltestmjs-reindexes-the`

## Status

All units complete. Full suite: 6052/6052 pass, 0 fail.
`git status --short .memory/index.jsonl` empty after the full run.

## TDD Cycle Evidence

| Unit | RED | GREEN | Mutation | Commit |
|------|-----|-------|----------|--------|
| 1 — Measure first | N/A (measurement, not a test unit) | Isolated `--test-name-pattern` runs: (a) and (e) change the real `.memory/index.jsonl` mtime (content stays byte-identical — deterministic regen against an already-synced store); (c) does not, despite also omitting `root`, because `_gitPull` throws before `_rebuildIndex` runs | N/A | (not committed — measurement only) |
| 2 — R1026-1 engram.pull.test.mjs | `before`/`after` content+mtime snapshot guard added around the whole file, before fixing (a)/(c)/(e) → `after` hook fails: mtime assertion red (`+actual 1789774387682... -expected 1789774330364...`), content assertion silently green | Injected `root: '/fake/root'` + no-op `_rebuildIndex` into (a), (c), (e) → 6/6 pass, `.memory/index.jsonl` mtime/content both unchanged | Reverted (a)'s injection → `after` hook's mtime assertion failed again (content assertion again silently green, confirming mtime is the load-bearing check, not content); restored → green | `80f375e6` `fix(test): engram.pull.test.mjs never reaches the real repoRoot default (#1026)` |
| 3 — R1026-2 guard | Fixture tests (5 of them, planted source under `testTmp()`) call the not-yet-built `findMissingRootViolations` — stubbed to `throw new Error('not implemented yet')` → 5 tests fail with that message | Implemented `stripComments`/`blankStrings`/`engramRootFnAliases`/`findMissingRootViolations` → all 4 detection-shape fixtures pass; real-codebase test needed one more fix (`blankStrings`, to kill string-literal prose false positives) and a 10-entry annotated allowlist for genuinely-safe indirect call sites → 10/10 pass | Dropped `root` from a real, currently-compliant call site (`engram.pull.test.mjs`'s first test, post-Unit-2) → the real-codebase guard test failed with a fresh `pullMemory` violation; reverted → green, file diffs clean against the Unit 2 commit | `7801c488` `test(hygiene): flag a test that calls a root-defaulting engram.mjs export without root (#1026)` |

## Files Changed

| File | Action | What Was Done |
|------|--------|---------------|
| `brain/scripts/memory/backends/engram.pull.test.mjs` | Modified | Tests (a)/(c)/(e) inject `root`+`_rebuildIndex`; added a file-level `before`/`after` hook asserting the real `.memory/index.jsonl`'s content AND mtime are unchanged; rewrote the header comment to record the verified (not assumed) per-test reach findings. |
| `brain/scripts/test-hygiene.test.mjs` | Modified | Added a second guard rule (`findMissingRootViolations` + helpers `stripComments`, `blankStrings`, `engramRootFnAliases`) alongside the existing #1020 `findRealRootWriteViolations`; 5 new fixture tests; 1 new real-codebase test; `ROOT_ALLOWLIST` (10 annotated entries). |
| `openspec/changes/issue-1026-memory-index-leak/{proposal,spec,tasks,apply-progress}.md` | Created | SDD artifacts for #1026. |

## Deviations from Design / Discoveries Mid-Flight

- **Content-only comparison is insufficient on this repo today.** The task
  brief suggested "content hash (or full content)" for the R1026-1 guard.
  Measured: `rebuildIndex()` regenerates `.memory/index.jsonl`
  deterministically from `.memory/records/`, and on this checkout the index
  is already fully in sync, so a stray write reproduces byte-identical
  content — `git status`/`git diff`/a content-hash-only guard would all stay
  silent even though a real `fs.writeFileSync` against the real repo root
  ran (confirmed via `stat -c '%Y'`/`sha256sum` before/after isolated runs).
  Added an `mtimeMs` check alongside content; the Unit 2 mutation test
  proves content alone would have missed the regression (content assertion
  stayed green on the mutated run; only the mtime assertion caught it).
- **Chose a source-level static guard over the issue's suite-level snapshot
  fallback for R1026-2** — but only after two rounds of measured
  correction, not on the first attempt:
  - A bare-identifier regex would have silently produced false NEGATIVES:
    `reindex-parity.test.mjs` and `no-artifact.parity.test.mjs` import
    `share`/`pullMemory` exclusively under aliases (`engramShare`,
    `engramPullMemory`); `save-parity.test.mjs` imports `save as
    engramSave`. Fixed by resolving each file's own import bindings first
    (`engramRootFnAliases`), then scanning calls under the LOCAL name.
  - An import-aware scan without comment/string handling produced false
    POSITIVES: `engram.mjs`'s export names read naturally in prose. The
    real-codebase test caught this scanner flagging its own sibling
    commit's assert message in `engram.pull.test.mjs` ("...reached
    pullMemory()'s production repoRoot default") and several test-name
    strings in `engram.save.test.mjs`/`engram.share.test.mjs`/
    `engram.feature.test.mjs` (e.g. `test('T-E1 — ... makes save() reject
    ...')`). Fixed with `blankStrings` (blanks string/template literal
    content, keeping delimiters and line positions) layered on top of the
    existing comment-stripping — validated with a dedicated fixture test
    reproducing the exact false positive.
  - Ten remaining findings, after both fixes, are real (call sites that do
    omit `root`) but genuinely safe: `engram.import.test.mjs`'s
    `importMemory()` calls (7) always mock `_readRecords`, the only seam
    that dereferences `root` inside `importMemory` (verified by reading
    `engram.mjs:399`); `save-parity.test.mjs`'s `save()` calls (3) pass
    `root` through a local `pinnedSeams(root)` helper, the same
    same-file-indirection shape #1020's own guard already declines to
    trace. Allowlisted with per-entry reasoning rather than either
    silently ignored or chased with call-graph analysis (out of scope,
    documented in spec.md).
- No production code (`engram.mjs`, `store.mjs`) was changed — the defect
  is entirely in test code reaching a legitimate, documented production
  default; fixing it means the tests stop omitting `root`, not that the
  default should go away (other real callers, e.g. `cli.mjs`, rely on it).

## Issues Found

None beyond what's recorded above as deviations (all were caught and fixed
within this same change, not deferred).

## Workload / PR Boundary

- Mode: single PR (counted diff excludes `.test.mjs`/`openspec/`/`.memory/`
  paths per the task's own numstat filter).
- Two work-unit commits (`80f375e6`, `7801c488`) plus one record-first
  memory commit, all on
  `fix/issue-1026-fixtest-engrampulltestmjs-reindexes-the`, no push.
- Estimated review budget impact: all changed content outside the final
  memory commit is `.test.mjs` test code — 0 lines against the 400-line
  production-code budget (confirmed via the task's own numstat filter, see
  Finish section of the task brief).

## Remaining Tasks

None — all tasks in tasks.md are `[x]`.
