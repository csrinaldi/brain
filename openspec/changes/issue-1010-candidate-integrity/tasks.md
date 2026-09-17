# Tasks: candidate integrity for the cold-review stage (#1010)

- [x] 1. Measure which test writes `.engram` into the real repo root
      (empirical: individual suspect files, full suite + `strace`,
      confirmed in isolation — `cli.backend-fallback.test.mjs`'s `#641
      setup is NOT substituted` test, via `runCli()`'s missing `{root}`
      forwarding into `engram.setup()`).
- [x] 2. `engram.setup({root})` honours `BRAIN_MEMORY_TEST_ROOT`; guard test
      in `cli.backend-fallback.test.mjs` pins the real-root invariant via a
      before/after snapshot. (R1010-1)
- [x] 3. `candidate-snapshot.mjs` hashes a symlink by `readlinkSync`, never
      `readFileSync`; tests for link-to-dir, link-to-file, and a retargeted
      link. (R1010-2)
- [x] 4. `run-cold-review-stage.mjs`'s refusal names the changed paths,
      bounded to 10 plus a count; existing test extended, new test pins the
      bound. (R1010-3)
- [x] 5. `claude.mjs`'s `runStage()` always passes `--settings
      {disableAllHooks:true}`; test asserts the spawned args. (R1010-4)

## Review Workload Forecast

- Decision needed before apply: No
- Chained PRs recommended: No
- 400-line budget risk: Low (counted diff ~94 lines, excluding tests/openspec)
