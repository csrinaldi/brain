---
status: approved
issue: 247
---

# Specification — fixmemory complete the c4 chunkrecords m (issue 247)

## Requirements

### REQ-1: Migrate readers from chunks to records
- `brain-audit.mjs` must:
  - Import `readRecordObservations` from `./memory/lib/store.mjs`.
  - Load all observations using `readRecordObservations({ recordsDir: join(cwd, '.memory', 'records') })`.
  - Drop the import and usage of `readChunkObservations` from `./lib/chunk-reader.mjs`.
- `brain-check.mjs` must:
  - Import `readRecordObservations` from `./memory/lib/store.mjs` (in CLI entry-point).
  - Load all observations using `readRecordObservations({ recordsDir: join(cwd, '.memory', 'records') })`.
  - Drop the import and usage of `readChunkObservations` from `./lib/chunk-reader.mjs`.

### REQ-2: Delete chunk-reader utility
- Delete `brain/scripts/lib/chunk-reader.mjs`.
- Delete `brain/scripts/lib/chunk-reader.test.mjs`.

### REQ-3: Test Parity
- `brain-audit.test.mjs` must be updated to commit mock record files (e.g., `.memory/records/2026-07.jsonl`) instead of `.memory/chunks/session.jsonl.gz`.
