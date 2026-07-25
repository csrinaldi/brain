---
status: approved
issue: 247
---

# Proposal — fixmemory complete the c4 chunkrecords m (issue 247)

## What
Complete the consumer-side migration from chunks to records by:
1. Migrating `brain-audit.mjs` and `brain-check.mjs` to read memory observations from `.memory/records/` via `readRecordObservations`.
2. Deleting `brain/scripts/lib/chunk-reader.mjs` and its tests `brain/scripts/lib/chunk-reader.test.mjs`.

## Why
Currently, `brain-audit.mjs` and `brain-check.mjs` still read from legacy chunks via `readChunkObservations`. This is a latent divergence since `run-check.mjs` was already migrated to records-only. Completing the consumer migration resolves this gap.

## Scope
- **Includes**:
  - Updating `brain-audit.mjs` and `brain-check.mjs` to consume `.memory/records/` observations using `readRecordObservations`.
  - Deleting `brain/scripts/lib/chunk-reader.mjs` and `brain/scripts/lib/chunk-reader.test.mjs`.
  - Updating related tests (`brain-audit.test.mjs`, `brain-check.test.mjs`) to use record-based fixtures/mocks instead of gzip chunks.
- **Does Not Include**:
  - Modifying `engram.mjs`'s `share()` or `importMemory()` logic.
  - Adding cleanup of temporary chunks/manifest files on disk.
  - Untracking `.memory/manifest.json` or `.memory/chunks/` from VCS.
