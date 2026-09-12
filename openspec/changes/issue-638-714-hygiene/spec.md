# Spec — issue-638-714-hygiene

Both requirements are fully specified by their GitHub issues; this file
records only the checkable deltas.

## Requirement 1 (#714): suite verdict independent of `BRAIN_MEMORY_UPSTREAM_REF`

- **Given** `BRAIN_MEMORY_UPSTREAM_REF` is unset, **when** `npm test` runs,
  **then** the result is 5277/5277 (this repo's current baseline).
- **Given** `BRAIN_MEMORY_UPSTREAM_REF` is exported to an arbitrary,
  non-resolving ref (e.g. `origin/leaked`), **when** `npm test` runs,
  **then** the result is unchanged: 5277/5277.
- **Given** any test that deliberately drives the real, unstubbed upstream
  predicate (documented as such in its own comments), **then** that test
  neutralises the variable itself (`withoutEnv`, `env: {}`, or a stripped
  spawn env) rather than relying on the ambient shell.
- No production code changes — the env level winning is correct behaviour.

## Requirement 2 (#638): duplicate-report strings live in the i18n catalogs

- **Given** `docs.language: "es"`, **when** `formatDuplicateReport` produces
  a report, **then** every line renders in Spanish via `memory.duplicates.*`
  keys in `es.mjs`.
- **Given** `docs.language: "en"` (or unset), **then** the rendered lines are
  byte-for-byte identical to the pre-change literals.
- **Given** `i18n/coverage.test.mjs`'s en/es parity check, **then** it stays
  green — no Spanish key may be dropped to satisfy the dedup.
- `duplicates.test.mjs`'s existing English-literal assertions stay valid
  (the default `en` locale resolves through the en fallback catalog, so the
  bytes are unchanged); Spanish rendering is verified separately via
  `translate()` against both catalogs (see apply-progress.md).
