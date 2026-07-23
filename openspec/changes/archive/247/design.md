---
status: approved
issue: 247
---

# Design — fixmemory complete the c4 chunkrecords m (issue 247)

## Technical Decisions

### 1. Unified Record Reading in Consumers
Both `brain-audit.mjs` and `brain-check.mjs` will import `readRecordObservations` from `./memory/lib/store.mjs` (relative to their execution context) and pass the resulting observations array to `memoryPresence()`.
The import and dependency on `lib/chunk-reader.mjs` is completely removed.

- **`brain-audit.mjs`**:
  ```javascript
  import { readRecordObservations } from './memory/lib/store.mjs';
  // ...
  const allObservations = readRecordObservations({ recordsDir: join(cwd, '.memory', 'records') });
  ```

- **`brain-check.mjs`**:
  ```javascript
  import { readRecordObservations } from './memory/lib/store.mjs';
  // ...
  const observations = readRecordObservations({ recordsDir: join(cwd, '.memory', 'records') });
  ```

### 2. Deletion of chunk-reader.mjs
Since all consumers (`run-check.mjs`, `brain-audit.mjs`, and `brain-check.mjs`) will now read from records, the legacy `lib/chunk-reader.mjs` and its tests are completely unused. They will be deleted to avoid dead code.

### 3. Test Fixtures and Mocks
- **`brain-audit.test.mjs`**: Instead of creating `.memory/chunks/session.jsonl.gz` gzip fixtures, the test helpers will write a plaintext mock record file under `.memory/records/2026-07.jsonl`.
- **`brain-check.test.mjs`**: Does not hit the filesystem in its unit tests, but passes an array of observations to `runCheck()`. This remains fully compatible with `readRecordObservations` returning a parsed observations array.

## Alternativas descartadas
- **Modifying engram.mjs's share()**: Discarded. Although chunk materialization on disk is temporary/redundant, retiring it from the engram backend belongs to a separate change slice and is explicitly out of scope for this change.
