# Apply Progress: real-root write hygiene for the test suite (#1020)

**Change**: issue-1020-test-real-root-writes
**Mode**: Strict TDD
**Worktree**: `/home/gandalf/IA/brain-issue-1020`
**Branch**: `fix/issue-1020-fixtest-archivetestmjs-writes-scratch-un`

## Status

All units complete. 5595/5595 full suite pass. `scratch/` and `.engram`
both absent from the real repo root after the full run.

## TDD Cycle Evidence

| Unit | RED | GREEN | Mutation | Commit |
|------|-----|-------|----------|--------|
| 1 — Measure first | N/A (measurement, not a test unit) | `ls -d scratch` absent before, present after a full `archive.test.mjs` run in a fresh worktree | N/A | (not committed — measurement only) |
| 2 — R1020-1 archive.test.mjs 4.1 | Before/after root-entry snapshot assertion added around the pre-existing `join(process.cwd(), 'scratch/test-archive-sandbox')` sandbox → failed with `+scratch` in the after-snapshot | Sandbox moved to `testTmp('archive-e2e-')`; `scriptPath` resolved via `import.meta.url`; manual `rmSync` dropped (testTmp's exit hook owns cleanup) → 19/19 `archive.test.mjs` tests pass, `ls -d scratch` finds nothing | Reverted the sandbox to `join(process.cwd(), 'scratch/test-archive-sandbox')` → reproduced the original failure; reverted back to green | `265de02` `fix(test): archive.test.mjs 4.1 sandboxes under test-tmp, never the real repo root (#1020)` |
| 3 — R1020-2 guard | Organic: the guard's own first-draft comment spelled `` `mkdirSync(` `` (write-call name immediately followed by `(`) in a code span; the scanner — which scans its own file too — flagged itself, failing `assert.deepEqual(found, [])` | Comment rephrased so no write-call name is immediately followed by `(` outside the regex/constant definitions → both `test-hygiene.test.mjs` tests pass (zero real-repo violations; fixture-based detection proof passes) | Dropped `'mkdirSync'` from `WRITE_FNS` → the detection-proof test failed (scanner blind to its own planted violation); restored → green | `4f29ff08` `test(hygiene): a source-level guard keeps process.cwd()-into-a-write-call closed (#1020)` |

## Files Changed

| File | Action | What Was Done |
|------|--------|---------------|
| `brain/scripts/archive.test.mjs` | Modified | Test 4.1's sandbox moved from a `process.cwd()`-relative path to `testTmp()`; `scriptPath` resolved via `import.meta.url`; added a before/after real-root entry-list snapshot assertion; removed the now-redundant manual `rmSync` cleanup. |
| `brain/scripts/test-hygiene.test.mjs` | Created | New self-contained guard scanning `*.test.mjs` under `brain/scripts/**` and `test/**` for a direct `process.cwd()`/`resolve('.')` reference inside a write call's own argument list; fixture-based detection-proof test; scan root is a parameter. |

## Deviations from Design

- Task instructions suggested a raw `mkdtempSync(join(tmpdir(), 'brain-archive-'))`
  with manual `finally { rmSync }` cleanup for unit 2. Used the repo's
  existing `testTmp()` helper (`brain/scripts/lib/test-tmp.mjs`, #842)
  instead — it is the established convention across ~10 other test files
  in this repo, provides the same per-run-root isolation, and adds
  process-exit-hook cleanup that survives a killed run (a manual `finally`
  does not). No behavioral gap versus the suggested approach; this matches
  existing project conventions more closely.
- Unit 3's guard does NOT trace same-file variables built from
  `process.cwd()` and later passed to a write call by name (the shape the
  original archive.test.mjs bug actually had). A whole-file, unscoped
  variable-tracking design was prototyped and found to false-positive on
  `brain/scripts/lib/installed-version.test.mjs` (four separate
  `const root = ...` bindings across different `test()` closures, only one
  `process.cwd()`-derived, conflated by an unscoped scan with the OTHER
  `root`s' unrelated `writeFileSync` calls). Direct-inline-only is the
  precise, zero-false-positive floor; documented as an explicit non-goal
  in spec.md and as a code comment in `test-hygiene.test.mjs`.
- No allowlist rows were needed in `test-hygiene.test.mjs`'s `ALLOWLIST`
  today — the precise (direct-only) scanner does not flag any of the six
  files found to reference `process.cwd()` in `*.test.mjs` scope
  (`agent-runtime.test.mjs`, `installed-version.test.mjs`,
  `engram.branch.test.mjs`, `ui/server.test.mjs`,
  `release-postmerge-workflows.test.mjs`, and the now-fixed
  `archive.test.mjs`), so the allowlist stays empty rather than carrying
  placeholder rows.

## Issues Found

None.

## Workload / PR Boundary

- Mode: single PR (counted diff excludes `.test.mjs` files entirely — 0
  counted lines).
- Current work unit: both units together — small, cohesive, same issue.
- Boundary: two commits (`265de02`, `4f29ff08`), both on
  `fix/issue-1020-fixtest-archivetestmjs-writes-scratch-un`, no push.
- Estimated review budget impact: negligible — all changed content is test
  code (159 lines across two `.test.mjs` files), 0 lines against the
  400-line production-code budget.

## Remaining Tasks

None — all tasks in tasks.md are `[x]`.

## Cold review of PR #1022 (round 1, head 69f679c3): REVISE → fixed

- blocker: `CWD_REF_RE` matched only a bare `resolve('.')`; `writeFileSync(resolve('.', 'x.txt'), …)` — the multi-segment form, the same defect class as `join(process.cwd(), 'x.txt')` — passed the guard silently, and no test planted that form. Fix: the match ends at the first `,` or `)` after the dot; a second detection-proof test plants `resolve('.', 'x.txt')` and `resolve(".", "sub", "y.txt")` in a fixture root under `test/`. RED 2/3 → GREEN 3/3; mutation (the old regex back) → 2/3, reverted. R1020-2 wording amended to say "bare or with further segments".
