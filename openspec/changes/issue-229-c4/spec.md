# Spec Delta — CLOSE THE WINDOW (slice C4)

> Makes `records/` the sole read+write truth: retires the `memory.dualWrite` flag and the transitional
> chunks path, switches `pull`/`import` to records-only (idempotent), pins the round-trip contract
> against the real store, and ENDS the embargo. See [design.md](design.md).

## REQ-C4-1: The round-trip contract holds on the REAL store (D1)

For every record in the committed store, re-importing then re-exporting MUST reproduce the same id:
`computeRecordId(exportObservation(importRecord(r)).record) === r.id`. Because `source` is hash-excluded
(C2a pin), a re-materialized `source` value MUST NOT shift the id. The dominant real case is the 135
`@legacy` records (source = "provenance unknown — migrated from engram chunk …").

#### Scenario: id-equality over every real committed record

- GIVEN the real `.memory/records/2026-06.jsonl` (135 `@legacy` records) and `2026-07.jsonl`, read via `readRecordObservations`/`parseRecordLine`
- WHEN each record is imported (`importRecord`) then re-exported (`exportObservation`) and its id recomputed
- THEN every recomputed id equals the record's stored id

#### Scenario: issue-without-source fixture stays inert under re-materialization

- GIVEN the synthetic record whose `source` is undefined (existing `engram-import.test.mjs` pin)
- WHEN it round-trips and the re-exported `source` becomes `'issue #305'`
- THEN the id is unchanged (source is excluded from the hash input)

## REQ-C4-2: `pull`/`import` are records-only and idempotent (D2)

`pull`/`import` MUST hydrate local engram from `.memory/records/*.jsonl` (not `engram sync --import` over
chunks): read records via `readRecordObservations`, transform via `importRecord()`, and write per-record
via `engram save` with progress reporting for the ~275 records. Re-running over an already-populated
engram MUST NOT create duplicates (dedup by id or content, whichever the engine allows).

#### Scenario: records-only pull hydrates engram

- GIVEN a fixture `.memory/records/*.jsonl` and an empty local engram
- WHEN `pull` (records-only) runs
- THEN every record is written to engram via per-record save, with progress reported, and no chunk path is read

#### Scenario: re-running pull does not duplicate (idempotency — MANDATORY)

- GIVEN an engram already populated by a prior records-only pull
- WHEN `pull` runs again over the same records
- THEN no duplicate observations are created (dedup by id/content)

## REQ-C4-3: `memory.dualWrite` is retired; record-write is unconditional (D3)

The `share()` gate at the sole read site MUST be removed so record-write runs unconditionally. The
`memory.dualWrite` key MUST be removed from this repo's `brain.config.json`, and the never-shipped 0.6.0
migration entry MUST be removed from `brain/core/config-migrations.mjs`. No runtime code may read
`memory.dualWrite` after this slice.

#### Scenario: share writes records with no flag present

- GIVEN a `brain.config.json` with NO `memory.dualWrite` key
- WHEN `share()` runs
- THEN records are written unconditionally (no gate, no error about a missing flag)

## REQ-C4-4: The memory-gate reads records only; finding 7 (id:388) is fixed (D4)

`run-check.mjs`'s memory-gate MUST read only `readRecordObservations` (drop the `readChunkObservations`
union — the #227 OR was transitional). Separately, `_defaultChangedChunkFiles` MUST NOT feed deleted
paths to `scrubChunkFile`: a `git status --porcelain` deletion (`D `/` D`) whose path ends in
`.jsonl.gz` currently passes the filter and triggers a `readFileSync` ENOENT. The fix MUST filter out
deletions (or guard file existence before read).

#### Scenario: memory-gate no longer unions the chunk reader

- GIVEN a store with `records/` populated and no chunk reader available
- WHEN the memory-gate runs
- THEN it computes its observation set from `records/` alone and passes

#### Scenario: a deleted chunk file does not crash the scrub (finding 7 regression)

- GIVEN `git status --porcelain` reports a deleted `.jsonl.gz` chunk (as after the cutover moved chunks to `legacy/`)
- WHEN `scrubMaterializedChunks()` collects changed chunk files
- THEN the deleted path is excluded and no ENOENT is thrown

## REQ-C4-5: The embargo is ENDED and declared (D5)

The PR body MUST declare the embargo ended with the precise wording: the chunk path no longer exists, so
there is nothing left to go stale (NOT "chunk-based pull is safe again" — the path is gone, not
re-secured).

#### Scenario: PR body ends the embargo precisely

- GIVEN the C4 PR body
- WHEN read
- THEN it declares the embargo ended because the chunk path no longer exists (nothing left to go stale)
