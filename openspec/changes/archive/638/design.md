# Design — issue-638-714-hygiene

Small, mechanical changes; no new architecture. Notable decisions only.

## #714

- **No production signature widened.** `dualWriteRecords`/`save`/
  `runStagedRecordsCheck` already deliberately omit `env`/`config` in the
  calls the affected tests exercise, per #701's own precedent (a `= {}`
  default anywhere in that chain is the defect class #701 fixed). The fix
  stays entirely on the test side.
- **Three neutralisation shapes, chosen per call site:**
  1. `withoutEnv(t, name)` — mutates `process.env` for one test, restored in
     `t.after`. Used where the real predicate runs in-process (no subprocess).
  2. `env: {}` — passed to a function that already accepts an `env` seam.
     Used in `staged-records-check.integration.test.mjs`, consistent with the
     file's own later tests.
  3. Stripped at the spawn-env construction site — used in
     `cli.save-search.test.mjs`, which spawns a real child process; mutating
     the parent's `process.env` would not reach a child env object already
     built from a module-load-time snapshot.
- `withoutEnv` is promoted to `scripts/memory/__fixtures__/env.mjs` (shared
  fixture location already used by `tmp-tree.mjs` and `fake-vcs-port.mjs`),
  not duplicated per file.

## #638

- `formatDuplicateReport` becomes `async` because `t()` is async. The
  alternative (a sync-only i18n path) was rejected — it would fork the i18n
  resolver into two implementations for one module.
- The optional index-count suffix on the summary line became two full keys
  (`summary` / `summaryWithIndex`) rather than one key with a conditionally-
  empty param, mirroring the existing `memory.share.upstreamConfigUnreadable`
  / `...NoRef` pair — the established pattern in this catalog for "same
  sentence, with or without an optional clause."
- The per-group line similarly split into `group` / `groupDivergent` (the
  `[divergent]` marker is inline, not itself a separate translatable
  fragment — treated as a status tag, like `×{count}`).
- `, +{count} more` (per-group overflow) and `… +{count} more duplicated
  id(s).` (overall group overflow) are separate keys, since they are
  distinct sentences appearing in different places.
- `cli.mjs#reportDuplicates` and its 7 call sites move to `async`/`await`;
  all call sites already sit in top-level-await-capable script scope (the
  file already does `await t(...)` at the same nesting level), so no
  wrapping function was needed.
