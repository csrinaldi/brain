# Tasks: real-root write hygiene for the test suite (#1020)

## Unit 1 — Measure first

- [x] 1.1 Confirm `scratch/` is absent before a full `archive.test.mjs` run
      in a fresh worktree, and present after — establishes the defect is
      real before touching code.

## Unit 2 — R1020-1: archive.test.mjs 4.1 works in a temp root

- [x] 2.1 RED: add a before/after snapshot assertion
      (`readdirSync(process.cwd()).sort()`) around test 4.1 against the
      pre-existing `join(process.cwd(), 'scratch/test-archive-sandbox')`
      sandbox — fails with `+scratch` in the after-snapshot.
- [x] 2.2 GREEN: move the sandbox to `testTmp('archive-e2e-')`
      (`brain/scripts/lib/test-tmp.mjs`); resolve `scriptPath` via
      `fileURLToPath(new URL('./archive.mjs', import.meta.url))` instead of
      `process.cwd()`; drop the now-unneeded manual `rmSync` (testTmp's
      process-exit hook owns cleanup). All 19 `archive.test.mjs` cases pass.
- [x] 2.3 Mutation: revert the sandbox to
      `join(process.cwd(), 'scratch/test-archive-sandbox')` — reproduces
      the original RED failure, confirming the guard is live. Reverted back
      to the fix.

## Unit 3 — R1020-2: the class stays closed

- [x] 3.1 Survey existing `process.cwd()` usage across `*.test.mjs` files
      (recursive, not `brain/scripts/*.test.mjs | head`) to confirm no
      existing guard and to scope what a precise scanner must not
      false-positive on.
- [x] 3.2 Build `brain/scripts/test-hygiene.test.mjs`: a self-contained
      scanner (`findRealRootWriteViolations(cwd, globs)`, `cwd` parameterized)
      matching the `chunk-boundary.test.mjs` allowlist-guard convention,
      detecting the direct inline form only.
- [x] 3.3 RED (organic): the first draft's own comment spelled the write-call
      name immediately followed by `(` in a code span; the guard — which
      scans its own file — flagged itself. Fixed by rephrasing the comment.
- [x] 3.4 GREEN: both guard tests pass — zero violations in the real repo,
      and the fixture-based detection-proof test confirms the scanner
      catches a planted violation.
- [x] 3.5 Mutation: dropping `'mkdirSync'` from `WRITE_FNS` reproduces a
      failure on the detection-proof test; restoring it returns to green.

## Finish

- [x] 4.1 Full suite: `GIT_CONFIG_GLOBAL=/dev/null npm test` — 5595/5595
      pass.
- [x] 4.2 Confirm `scratch/` and `.engram` are both absent from the real
      repo root after the full run.
- [x] 4.3 `npm run brain:repo:check` passes before each commit.
