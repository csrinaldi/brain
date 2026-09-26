---
status: draft
issue: 1139
---

# Tasks — #1139

- [x] **T1** Write new tests covering REQ-1139-1..4/6/7/8 in `installer.test.mjs` (new
      `mergeSettings` pure-core tests) and `claude.test.mjs` (merge-preserves-consumer-keys,
      idempotent, malformed-refuses).
- [x] **T2** RED: run the new suites — confirm they fail because `mergeSettings` does not exist
      yet and `claude.mjs init()` still overwrites unconditionally.
- [x] **T3** Add `mergeSettings(existingSettings, brainSettings)` to `installer.mjs`; refactor
      `mergeClaudeSettings` into a thin wrapper calling it. Confirm existing S1 tests
      (REQ-1139-7) still pass unmodified.
- [x] **T4** Update `claude.mjs`'s `init()`: add a read seam, parse-or-refuse the existing file,
      call `mergeSettings`, write the merged result. Malformed file → `{ok:false, reason}`, no
      write.
- [x] **T5** GREEN: re-run the new suites — all pass. Confirm the pre-existing
      claude.test.mjs "no existing file" test still passes unmodified (REQ-1139-3).
- [x] **T6** Write new tests covering REQ-1139-5 in `antigravity.test.mjs` (merge, idempotent,
      malformed → `geminiSettingsError` set, `geminiWritten: false`, no `ok` property).
- [x] **T7** RED then GREEN: update `antigravity.mjs`'s `init()` the same way as T4, using the
      same `mergeSettings` core; confirm the pinned "no ok property" test (1.5) still passes.
- [x] **T8** Add a compose test (REQ-1139-8): `mergeClaudeSettings` → `claude.mjs init()` →
      `mergeClaudeSettings` on the same fixture file, consumer key survives, file stable after
      step 3.
- [x] **T9** Full `npm test` green, no regressions.
- [x] **T10** `npm run brain:repo:check` green.
- [x] **T11** ADR-0036 fresh-consumer check: `npm pack`, install into a temp consumer with its
      own `.claude/settings.json` entry, `node node_modules/@logikas/brain/brain/scripts/brain-upgrade.mjs --no-install`,
      then `AGENT_PLATFORM=claude npm run brain:env:init` — the consumer's entry survives. Report
      the exact commands and output.
- [x] **T12** SDD artifacts for this change (`proposal.md`, `spec.md`, `design.md`, `tasks.md`).
