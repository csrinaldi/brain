# Tasks: issue-921-923-observability

## #921 — collectLane() reports unreadable worktrees

- [x] 1.1 `collect.mjs`: record `{path, reason}` in a new `skippedWorktrees` array instead of `continue`-ing silently on a failed per-worktree `status`.
- [x] 1.2 `collect.mjs`: return `skippedWorktrees` on both return paths (no-op tree, real commit).
- [x] 1.3 `ship.mjs`: forward `skippedWorktrees` into `shipLane()`'s outcome shape (dry-run and full run), defaulted to `[]`.
- [x] 1.4 `cli.mjs`: `collect` op prints `memory.collect.worktreeSkipped` on stderr when non-empty.
- [x] 1.5 `cli.mjs`: `ship` op prints the same line, unconditionally (not gated by `--dry-run`).
- [x] 1.6 i18n: add `memory.collect.worktreeSkipped` to `en.mjs` and `es.mjs`.
- [x] 1.7 Tests: integration test in `collect.integration.test.mjs` proving a failing worktree is reported and does not silence a sibling worktree's real candidates.
- [x] 1.8 Tests: unit tests in `ship.test.mjs` proving forwarding (dry-run + full run).
- [x] 1.9 Tests: CLI-level test in `cli.collect.test.mjs` proving the stderr line and `--json` presence.

## #923 — session-start.mjs

- [x] 2.1 `step2HydrateEngram()`: return `{ok:false, reason}` on a non-zero exit (stderr, or `exited <status>` when stderr is empty) and on a thrown exception (`err.message`). Success path unchanged.
- [x] 2.2 `renderContextBlock()`: surface `engram.reason` when present, additive over the existing generic skip line.
- [x] 2.3 i18n: add `session.memory.skip.reason` to `en.mjs` and `es.mjs`.
- [x] 2.4 Record the step-5 wiring open question as a code comment on `runSessionStart`, linked to #267. Do NOT wire `step5SynthesizeContext` in.
- [x] 2.5 Tests: update/extend `session-start.test.mjs` for the new `step2HydrateEngram` shape and the new render line; RED confirmed by reverting, GREEN confirmed after.

## Housekeeping

- [x] 3.1 Fix the pinned-line allowlist row in `chunk-boundary.test.mjs` (`cli.mjs` grew above the pinned import, line shifted 624→644).
- [x] 3.2 Tick 4.7 and 4.9 in `openspec/changes/issue-864-memory-2-0/tasks.md`.
- [x] 3.3 Full `npm test` green under `GIT_CONFIG_GLOBAL=/dev/null`.
