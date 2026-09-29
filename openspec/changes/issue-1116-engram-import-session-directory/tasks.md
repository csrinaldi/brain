---
status: draft
issue: 1116
---

# Tasks — #1116

- [x] **T1** RED: add `buildImportPayload` unit test asserting every session carries `directory
      === root` (`engram.batch-import.test.mjs`); confirm it fails against the unmodified code.
- [x] **T2** RED: add `importMemory` unit test asserting the payload `_engramImport` receives
      carries `sessions[].directory === root` (`engram.import.test.mjs`); confirm it fails.
- [x] **T3** Fix: `buildImportPayload()` gains a `root` param, sets `directory: root` on every
      session row; `importMemory()`'s one call site forwards its own `root`.
- [x] **T4** GREEN: re-run both new tests and the full existing suites for both files — pass, no
      regressions.
- [x] **T5** Fix collateral: `test-hygiene.test.mjs`'s `ROOT_ALLOWLIST` hardcodes line numbers for
      pre-existing `importMemory()` calls in `engram.import.test.mjs` that omit `root` on purpose
      (#1026 guard) — update the 7 shifted line numbers (all +28, from the two new tests inserted
      earlier in the file).
- [x] **T6** Full `npm test` green (no new failures, same 3 pre-existing skips — engram version-
      gated integration tests, unrelated to this change).
- [x] **T7** `npm run brain:repo:check` green.
- [x] **T8** Isolated end-to-end reproduction against a real, throwaway `ENGRAM_DATA_DIR`
      (engram 2.0.0): before the fix, `importMemory()` throws with the exact issue-quoted error;
      after the fix, it succeeds and the record is retrievable via `engram search` against the
      same isolated store; the real `~/.engram` store is confirmed untouched.
- [x] **T9** engram 1.x compatibility measured directly: pinned build of engram 1.20.0
      (`TESTED_ENGRAM`) via `go install .../engram/cmd/engram@v1.20.0` into an isolated `GOBIN`;
      confirmed it accepts the same `directory` field as harmless extra metadata (not inferred).
- [x] **T10** SDD artifacts for this change (`proposal.md`, `spec.md`, `design.md`, `tasks.md`).
- [x] **T11** Root cause saved to engram (`engram save`), single call, user's real store.
