---
status: approved
issue: 247
---

# Tasks — fixmemory complete the c4 chunkrecords m (issue 247)

## Phase 1: Test Updates & Red Cycles (TDD)
- [x] 1.1 Update `brain/scripts/brain-audit.test.mjs` to write `.memory/records/*.jsonl` plaintext record fixtures instead of `.memory/chunks/*.jsonl.gz`. Verify the tests fail/error (RED).

## Phase 2: Implementation (GREEN)
- [x] 2.1 Modify `brain/scripts/brain-audit.mjs` to import and call `readRecordObservations` from `./memory/lib/store.mjs` instead of `readChunkObservations` from `./lib/chunk-reader.mjs`.
- [x] 2.2 Modify `brain/scripts/brain-check.mjs` to import and call `readRecordObservations` from `./memory/lib/store.mjs` instead of `readChunkObservations` from `./lib/chunk-reader.mjs`.
- [x] 2.3 Delete `brain/scripts/lib/chunk-reader.mjs` and `brain/scripts/lib/chunk-reader.test.mjs`.

## Phase 3: Verification
- [x] 3.1 Run `npm test` and verify that all unit/integration tests are green (including the updated `brain-audit` tests).
- [x] 3.2 Run `npm run brain:repo:check` to ensure no prohibited references or leftover files remain.

## Phase 4: Commit & PR
- [ ] 4.1 Commit all changes using conventional commits.
- [ ] 4.2 Push branch and open PR.

## Micro-decisions en caliente
<Acuerdos técnicos de la sesión.>
