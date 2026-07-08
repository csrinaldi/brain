# Tasks — records-as-write-truth machinery (C2b-1, #221)

> Fixture-tested machinery. NO real-store mutation (that is C2b-2). Strict TDD.

## Review Workload Forecast
| Field | Value |
|-------|-------|
| Estimated changed lines | ~250–320 (import lib + scrub reader + share dual-write) |
| 400-line budget risk | Medium — keep tight; split if it exceeds (never size:exception) |
| Delivery | Standalone PR-as-review into feature/v2.0.0, Part of #221 |

## Phase 1: Import — record → engram observation (RED → GREEN)
- [x] 1.1 Test (RED): `importRecord(record)` renders provenance to §4 prose via `renderProvenance`, undoes the R2 title fold, maps fields back; a record → engram → record round-trip preserves `computeRecordId` (id-equality — incl. an `issue`-without-`source` fixture).
- [x] 1.2 `importRecord()` (GREEN) — the designed inverse of `exportObservation`, sharing the C2a grammar.

## Phase 2: Scrub re-point to records/ (RED → GREEN)
- [x] 2.1 Test (RED): a records-file reader feeds `scanTextForSecrets` (JSONL lines, no gunzip); a planted secret in a `records/*.jsonl` line fails closed naming pattern + file:line.
- [x] 2.2 The reader (GREEN) — reuses `scanTextForSecrets` verbatim; fail-closed, no bypass.

## Phase 3: Dual-write in share — scan-then-write over the records log (RED → GREEN)
- [x] 3.1 Test (RED): `share` scans CANDIDATE record lines BEFORE the records append; a planted secret aborts with `records/` UNTOUCHED (append-only log clean — victim-file style); a clean run appends records + reindexes. Chunks retain C1b's post-materialization scan (backstop, design Decision 1).
- [x] 3.2 `share` dual-write (GREEN) — order `export → read observations → transform → scan(candidate records) → [clean] append(records) → reindex`; the chunk scan (C1b) stays as the backstop; deps injected (seams), fixtures only.

## Phase 4: Baseline + budget
- [x] 4.1 `npm test` green · `brain:repo:check` · `brain:nav`.
- [x] 4.2 Counted diff ≤400 (excl. `*.test.mjs`, `openspec/changes/**`).
- [x] 4.3 `.memory/` (real store) never mutated by code or tests (temp dirs only).

## Phase 5: Fix pass — adversarial review (BLOCKER + MAJOR + 2 MINOR)
- [x] 5.1 Test (RED) + fix (GREEN), BLOCKER: `dualWriteRecords` dedups by content-addressed `id`.
  Added `readRecordIds({ recordsDir })` (store.mjs) as the authoritative existing-id source (reads
  `records/`, not the derived index). A candidate whose `id` is already present — from a prior
  `share`, or duplicated within the same batch — is never re-appended.
- [x] 5.2 Test (RED) + fix (GREEN), MAJOR: `dualWriteRecords` accounts for every observation, never
  silently drops one. `_defaultReadObservations` now returns `{observations, unparseable,
  emptyObservations}` (mirrors `collectChunkObservations`). `dualWriteRecords` returns `{written,
  deduped, errored, rejected, skippedPersonal, unparseableChunks, emptyObservationsChunks}` —
  mirrors `buildMigrationReport`'s honest-accounting contract; zero fields stay present.
- [x] 5.3 Test (RED) + fix (GREEN), MINOR: `share` reordered to `export → scrubMaterializedChunks
  (chunk backstop) → dualWriteRecords (records)` — the chunk backstop now runs BEFORE the records
  append so a chunk-only secret can never abort AFTER `records/` was already mutated.
- [x] 5.4 MINOR: corrected `spec.md` REQ-C2B1-2 + `design.md` Decision 3 — `scrubRecordsFile` is
  the TESTED CUTOVER SEAM for C2b-2, not wired into the live `share` path this slice; the live
  records-protection is `dualWriteRecords`'s pre-write candidate scan. Added a residual-risk design
  note under Decision 1 (accepted, narrowed by 5.3 + 5.1).
- [x] 5.5 `npm test` green (1034/1034) · `brain:repo:check` · `brain:nav`.
- [x] 5.6 Counted diff within budget (excl. `*.test.mjs`, `openspec/changes/**`).
- [x] 5.7 `.memory/` (real store) never mutated by code or tests (temp dirs only).

## Out of scope
- THE CUTOVER (real execution) → C2b-2 (#222). Round-trip contract test + pull→records-only → C4.
