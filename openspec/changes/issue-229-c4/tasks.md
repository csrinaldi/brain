# Tasks — CLOSE THE WINDOW (C4, #229)

> Records-only cutover of the read+write path. Strict TDD (RED → GREEN) for every code task.
> Implementation order = artifacts already written, then code; and D4 BEFORE D1 (the memory-gate
> unions both readers until D4 lands — see design.md sequencing coupling).
> Acceptance = CP-C4 (hard stop, PR-as-review, Part of #229).

## Review Workload Forecast
| Field | Value |
|-------|-------|
| Estimated changed lines | ~180–320 (gate delete + finding-7 fix + pull records-only wiring + round-trip test); config edits small |
| 400-line budget risk | Medium (D2 greenfield wiring is the driver) |
| Delivery | Standalone PR-as-review into feature/v2.0.0, Part of #229 |

## Phase 1: D4 memory-gate records-only + finding 7 (id:388) — FIRST (RED → GREEN)
- [ ] 1.1 Test (RED): a `git status --porcelain` deletion of a `.jsonl.gz` chunk (path ends in `.jsonl.gz`) must NOT reach `scrubChunkFile` / must not throw ENOENT in `scrubMaterializedChunks()`.
- [ ] 1.2 `engram.mjs` `_defaultChangedChunkFiles` (352-372) GREEN: filter out porcelain deletions (and/or guard existence before read in `secret-scrub.mjs:104-115`).
- [ ] 1.3 Test (RED): the memory-gate computes its observation set from `records/` ALONE (no chunk reader).
- [ ] 1.4 `run-check.mjs` GREEN: drop `readChunkObservations` from the union → records-only (the #227 transitional OR retired).

## Phase 2: D3 retire memory.dualWrite — the three moves (RED → GREEN)
- [ ] 2.1 Test (RED): `share()` writes records with NO `memory.dualWrite` key present (unconditional record-write, no gate).
- [ ] 2.2 Move 1 (GREEN): delete the gate at `engram.mjs:176`; record-write runs unconditionally.
- [ ] 2.3 Move 2: remove `memory.dualWrite` from this repo's root `brain.config.json`.
- [ ] 2.4 Move 3: remove the 0.6.0 migration entry (`config-migrations.mjs:86-99`) — CONDITIONED on the never-shipped verification (`git tag --contains 654e86c` = NONE; only on feature/v2.0.0, not ancestor of v0.6.0). Capture that verification output as CP-C4 evidence in the PR body. Fallback if any tag shipped it: leave inert key + "RETIRED at C4" marker (documented, not taken).
- [ ] 2.5 Confirm no runtime code reads `memory.dualWrite` after this phase.

## Phase 3: D2 pull/import records-only + idempotency (RED → GREEN)
- [ ] 3.1 Test (RED): records-only `pull` hydrates engram from `.memory/records/*.jsonl` via `importRecord()` + per-record `engram save`, with progress reporting; no chunk path read.
- [ ] 3.2 Test (RED — MANDATORY): re-running `pull` over an already-populated engram creates NO duplicates (dedup by id/content).
- [ ] 3.3 `engram.mjs` `pullMemory`/`importMemory` GREEN: read via `readRecordObservations`, transform via `importRecord()`, write per-record via `engram save`; drop `engram sync --import` (chunks).
- [ ] 3.4 i18n (en + es) for every changed/added CLI string.

## Phase 4: D1 round-trip contract on the REAL store (RED → GREEN)
- [ ] 4.1 Test (RED): for every record in the REAL `.memory/records/2026-06.jsonl` (135 `@legacy`) + `2026-07.jsonl`, `computeRecordId(exportObservation(importRecord(r)).record) === r.id` (read via `readRecordObservations`/`parseRecordLine`).
- [ ] 4.2 Keep the existing synthetic issue-without-source pin (`engram-import.test.mjs:46-60`) — source hash-excluded, re-materialized `source` must not shift the id.
- [ ] 4.3 GREEN: any format/provenance adjustment needed for real-data equality (expected: none — the contract should already hold; the test PINS it).

## Phase 5: D5 END the embargo + baseline
- [ ] 5.1 Declare the embargo ENDED in the PR body with the precise wording: the chunk path no longer exists, so there is nothing left to go stale (NOT "chunk-based pull is safe again"). Cite cutover finding by id (id:388) — never "#7" (GitHub auto-links `#N`).
- [ ] 5.2 `npm test` green · `brain:repo:check` · `brain:nav`.
- [ ] 5.3 `memory:share` run before push. No `decision` label unless a new promoted decision arises.
- [ ] 5.4 STOP at CP-C4 (hard stop, PR-as-review, Part of #229).

## Open question (carry to review, do NOT decide silently)
- This repo's `brain.config.json` is stale at `schemaVersion 0.3.0` (three versions behind). Whether to reconcile/bump it is NOT decidable from the ruling — flag it at CP-C4; default is leave it and note the drift.

## Out of scope
- C3 plainfiles second consumer (own slice) · post-release tolerate-and-ignore mechanism (future) · schemaVersion bump (open question).
