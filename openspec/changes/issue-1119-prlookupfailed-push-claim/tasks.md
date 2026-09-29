# Tasks

- [x] Reproduce the defect: confirm `decidePr()` (ship.mjs:400ish) runs strictly before
      the push (ship.mjs:412ish), matching evidence 51/52 from #1081 F7.
- [x] STRICT TDD: extend existing `ship.test.mjs` `prLookupFailed` assertions with
      `err.pushed === false`; add a new test for `createPr()`'s re-scan path asserting
      `err.pushed === true`. Confirm RED against pre-fix code (stash), then GREEN.
- [x] STRICT TDD: add `cli.ship.test.mjs` source-guard + catalog-content test for the
      `err.pushed` fork and both new/corrected catalog strings. Confirm RED, then GREEN.
- [x] STRICT TDD: add `cli.ship.test.mjs` CLI-level reproduction of evidence 51/52
      (missing `BRAIN_VCS_TEST_SCRIPT` file, asserts stderr text + empty origin
      `memory/*` refs). Confirm RED, then GREEN.
- [x] Fix `ship.mjs`: tag `err.pushed` at all three `prLookupFailed` throw sites; thread
      `pushed` into `createPr()`.
- [x] Fix `cli.mjs`: fork the `prLookupFailed` → key mapping on `err.pushed`.
- [x] Fix `en.mjs`/`es.mjs`: correct `prLookupFailed` text, add
      `prLookupFailedAfterPush` in both locales.
- [x] Sweep the class: audit every other `memory.ship.*` (and `memory.ship.sweep.*`)
      message for the same false-claim defect. None found needing a fix — recorded in
      design.md.
- [x] Fix collateral: `chunk-boundary.test.mjs`'s pinned-line allowlist entry for
      `cli.mjs` shifted from line 732 to 738 (comment insertion) — updated.
- [x] Verify: `npm test` (6479 pass / 0 fail / 3 pre-existing skip), `npm run
      brain:repo:check` (exit 0), `npm run brain:nav` (exit 0).
