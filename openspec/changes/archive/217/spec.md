# Spec Delta — Engram ↔ Brain Record Migration (slice C2a)

> Realizes [issue-201-memory-format/spec.md](../issue-201-memory-format/spec.md) REQ-MF-6 against
> the C1a/C1b format library. This delta covers ONLY the C2a scope (parser/renderer + export +
> dry-run migration); the import direction, real (persisting) run, and pipeline wiring are C2b
> (see [design.md](design.md) Decisions 4–5).

## REQ-MIG-1: The §4 Provenance Parser/Renderer Pair

`provenance.mjs` MUST export `parseProvenance(content)` and `renderProvenance(record)` built from
ONE shared set of marker constants (`ACTOR_MARKER`, `FUENTE_MARKER`, `SUPERSEDE_MARKER`), never
two independently-typed literal copies of the grammar.

#### Scenario: A canonical human Actor line is parsed

- GIVEN `content` begins with `**Actor:** @crinaldi (humano)`
- WHEN parsed
- THEN `actor` is `"@crinaldi"` and `actorKind` is `"human"`

#### Scenario: A canonical agent Actor line is parsed

- GIVEN `content` begins with `**Actor:** claude-sonnet-4-6 (agente)`
- WHEN parsed
- THEN `actor` is `"claude-sonnet-4-6"` and `actorKind` is `"agent"`

#### Scenario: parse(render(record)) recovers exact fields (property test, mandatory)

- GIVEN a record fixture anchored to the consolidation-protocol.md §4 canonical examples (never a
  real chunk — 0/278 carry this prose)
- WHEN the record is rendered to prose and immediately re-parsed
- THEN every structured field (`actor`, `actorKind`, `issue`, `supersedes`, `source`) and the
  cleaned `content` match the original record exactly

## REQ-MIG-2: Export — Engram Observation → Brain Record

`engram-export.mjs#exportObservation(observation)` MUST implement the REQ-MF-6 contract:

1. `scope: "personal"` → skipped, never exported (REQ-MF-5).
2. A non-enum `type` → REJECTED with `{id, title, type, reason}`, never coerced.
3. §4 prose recovered via `parseProvenance` → structured `actor`/`actorKind`/`issue?`/
   `supersedes?`/`source?` used, content is the CLEANED prose-stripped body.
4. Otherwise → the fallback convention: `actor: "@legacy"`, `actorKind: "human"`,
   `source: "provenance unknown — migrated from engram chunk <id>"`.
5. `title` folds into `content` via the shared `buildRecord()` (R2); `id` is the shared
   `computeRecordId()`; naive engram `ts` → UTC seconds; the resulting record MUST pass
   `validateRecord()` or itself be rejected with the validator's errors as the reason.

#### Scenario: The current real store takes the fallback path

- GIVEN any of the 278 real observations in `.memory/chunks/`
- WHEN exported
- THEN `recovered` is `false`, `actor` is `"@legacy"`, `actorKind` is `"human"`

#### Scenario: A non-enum type is rejected, not coerced

- GIVEN an observation with `type: "manual"` (the one observed real instance)
- WHEN exported
- THEN no record is produced; a `{id, title, type: "manual", reason}` rejection is returned

#### Scenario: scope:personal is filtered

- GIVEN an observation with `scope: "personal"`
- WHEN exported
- THEN `{skipped: "scope:personal"}` is returned; no record and no rejection

## REQ-MIG-3: `memory:migrate-v1 --dry-run` Report

`migrate-v1.mjs` MUST decompress every `.memory/chunks/*.jsonl.gz` chunk, run
`exportObservation()` over every flattened observation, and produce a report with: `recordCount`,
`skippedPersonal`, `typesHistogram` (over successfully exported records only), `rejected[]`
(id/title/type/reason per entry), and `provenanceHistogram: {recovered, fallback}`. A chunk that
fails to gunzip/parse, or whose `observations` field is not an array, MUST be recorded in
`unparseable` and MUST NOT abort the report for the other chunks. The CLI verb MUST require
`--dry-run` today (the real persisting run is C2b) and MUST NOT mutate `.memory/chunks/`.

#### Scenario: The provenance histogram proves recovery ran

- GIVEN the real `.memory/chunks/` store (278 observations, 0 with §4 prose)
- WHEN `memory:migrate-v1 --dry-run` runs
- THEN the provenance histogram reads `{recovered: 0, fallback: 275}` (3 of 278 are rejected
  non-enum types, contributing to neither side of the histogram)

#### Scenario: A chunk with a non-array `observations` field is flagged, not silently skipped

- GIVEN a chunk whose decompressed JSON has `observations: null` (an observed real shape — 4 of
  47 real chunks)
- WHEN the migration collects observations
- THEN that chunk's filename appears in `unparseable`, and its absence from the observation count
  is visible in the report rather than silently invisible
