# issue-638-714-hygiene

Two small, independently-specified hygiene fixes tracked under epic
`issue-864-memory-2-0` tasks 4.4 and 4.5. Each GitHub issue is the
specification; this proposal only records scope and acceptance.

## #714 — `npm test`'s verdict must not depend on `BRAIN_MEMORY_UPSTREAM_REF`

**Problem**: `npm test` is green on a clean shell and RED for anyone with
`BRAIN_MEMORY_UPSTREAM_REF` exported — the exact variable an operator
debugging `memory:share` or the #701 gate would set. Production behaviour is
correct (the env level is the deliberate escape hatch); the defect is that
several tests drive the REAL upstream predicate (deliberately unstubbed, to
pin the exporter's real call shape) without neutralising the ambient
variable, or spawn a real CLI subprocess that inherits it.

**Fix**: no production code changes. Each affected test either:
- neutralises the variable for the duration of the test (`withoutEnv`,
  promoted from `engram.upstream-scope.test.mjs` into a shared fixture), or
- passes an explicit `env: {}` seam where the function under test already
  supports one, or
- strips the variable from the env object built for a spawned child process.

**Acceptance**: `npm test` reports the same pass/fail count whether
`BRAIN_MEMORY_UPSTREAM_REF` is unset or exported to an arbitrary value.

## #638 — duplicate-report strings promoted to the i18n catalogs

**Problem**: `duplicates.mjs#formatDuplicateReport`'s operator-facing lines
were literals, not `memory.*` catalog keys — so `docs.language: "es"` answers
in English for this one surface, invisible to `coverage.test.mjs`'s parity
check because a literal that never became a key can't be seen by it.

**Fix**: promote every line to a `memory.duplicates.*` key in `en.mjs`, with
`es` translations. `formatDuplicateReport` becomes `async` (`t()` is async);
its one caller (`cli.mjs#reportDuplicates`) and all 7 call sites are updated
to `await`.

**Acceptance**:
- With `docs.language: "es"`, the duplicate report renders in Spanish.
- English output is unchanged, byte-for-byte.
- `i18n/coverage.test.mjs` (en/es parity) stays green.
- The inline-vs-rest-of-tree rule is deliberately NOT decided here — noted in
  `duplicates.mjs`'s header as a follow-up, per the issue's own scope.

## Out of scope

- The broader ambient-env-variable pattern found while auditing #714 (see
  `apply-progress.md` §"Other ambient variables found") — reported, not
  fixed.
- Deciding whether `engram.mjs`'s notices or `cli.mjs`'s dispatch errors
  should also move to the catalogs (#638's own "Scope" section defers this).
