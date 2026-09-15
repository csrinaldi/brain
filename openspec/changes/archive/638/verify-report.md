# Verify report — issue-638-714-hygiene (#949, closes #714, #638)

**Verdict: PASS**

## Evidence (HEAD 7335552d)

- #714: shared `withoutEnv` fixture — `memory/__fixtures__/env.mjs:18` — used by the affected
  integration tests to neutralise `BRAIN_MEMORY_UPSTREAM_REF`; no production code changed
  (test-only fix, confirmed by proposal/apply-progress).
- #638: `formatDuplicateReport`'s strings promoted to `memory.duplicates.*` keys —
  `i18n/en.mjs:330-334` (and `es.mjs` mirror per apply-progress' Spanish-rendering proof).
- Focused tests: `memory/lib/duplicates.test.mjs` + `duplicates.i18n.test.mjs` +
  `lib/upstream-records.integration.test.mjs` + `lib/supersedes.integration.test.mjs` +
  `staged-records-check.integration.test.mjs` + `cli.save-search.test.mjs` +
  `cli.split-records-duplicates.test.mjs` + `cli.collect.test.mjs` +
  `cli.reindex-duplicates.test.mjs` → **74/74 pass**.

## Deliberately left undone / noted

- Closing record names only `#714` — the record format's `issue` field is a single finite
  integer with no array/list form (`format.mjs` W2), so it cannot carry both #714 and #638;
  documented as a format limitation in apply-progress (F3), not a defect in this record.
- Broader ambient-env-variable audit findings (`brain-check.mjs`, `vcs/cli.mjs`,
  `harness/**`, etc.) — reported, not fixed; candidate follow-up ticket.
- `:224` `resolve-index`'s unawaited-report race — left unguarded (no test seam exists without a
  production behavior change to a doctrine-fixed path); documented, not silently claimed fixed.

No CRITICAL / WARNING. Cold review (F1-F3) already answered in apply-progress.
