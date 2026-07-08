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

## Out of scope
- THE CUTOVER (real execution) → C2b-2 (#222). Round-trip contract test + pull→records-only → C4.
