# Apply progress: issue-921-923-observability

Strict TDD. Test runner: `node --test <file>` (focused) + `npm test` (full),
always under `GIT_CONFIG_GLOBAL=/dev/null`.

## Commits

| Commit | Summary |
|---|---|
| `24d452d3` | fix(memory): collectLane() reports unreadable worktrees instead of dropping them (#921) |
| `3e7db3d4` | feat(memory): surface skipped worktrees through ship and the CLI (#921) |
| `034b5dee` | fix(session-start): preserve the engram hydration failure cause (#923) |

(Record-first closing commit and openspec-artifact commit follow separately.)

## Tasks — all complete

See `tasks.md` — all 17 items `[x]`.

## TDD Cycle Evidence

| Task | RED | GREEN | REFACTOR |
|---|---|---|---|
| 1.1-1.2 collect.mjs `skippedWorktrees` | 2 new tests in `collect.integration.test.mjs` written first; failed against pre-fix `collect.mjs` (2/11 fail) | Implemented `skippedWorktrees` capture + both return paths; 11/11 pass | None needed |
| 1.3 ship.mjs forwarding | 2 new tests in `ship.test.mjs` (full run + dry-run) written first; failed (2/40 fail) | Destructure + default `[]` + include in `base`; 40/40 pass | None needed |
| 1.4-1.6 cli.mjs stderr + i18n | 2 new tests in `cli.collect.test.mjs` written first; 1 failed (empty-stderr assertion) | Added stderr block in `collect` and `ship` ops + i18n keys (en/es); 10/10 (+80/80 combined with ship CLI) pass | None needed |
| 2.1 step2HydrateEngram reason | Rewrote 2 existing tests + added 1 new one, expecting `{ok:false, reason}`; failed against pre-fix shape (5/68 fail) | Implemented stderr/exit-code/exception-message capture | None needed |
| 2.2 renderContextBlock reason line | New test asserting cause appears, bare line does not, when `reason` present | Additive branch in `renderContextBlock`; old bare-skip test (no `reason`) stays green unmodified | None needed |
| 2.4 step5 decision recorded | N/A — documentation only, no behavior change | N/A | Comment added on `runSessionStart`, linked to #267 |

## Mutation table (revert-one-prove-one)

| Reverted file | Tests that go red | Tests unaffected |
|---|---|---|
| `collect.mjs` (skippedWorktrees) | `collect.integration.test.mjs`: 2/11 (`#921 — a worktree whose git status fails...`, `#921 — no skipped worktrees...`) | 9/11 other collect.integration tests |
| `session-start.mjs` (step2HydrateEngram + renderContextBlock) | `session-start.test.mjs`: 5/68 (3 step2HydrateEngram shape tests + 1 renderContextBlock reason test + 1 resolveSessionStrings catalog-parity test) | 63/68 other session-start tests |

Each guard was proven independently: `git stash push -- <file>` isolated
exactly that production change, the paired test file was re-run (RED
confirmed, only the new/updated tests failed), then `git stash pop` restored
the fix (GREEN reconfirmed). `ship.mjs`'s guard was proven the same way via
its own RED run before implementation (2/40 failed, then 40/40 after).

## Test counts

- Focused suites after fix: `collect.integration.test.mjs` 11/11,
  `ship.test.mjs` 40/40, `ship.integration.test.mjs` + `cli.ship.test.mjs` +
  `day-start-sweep.test.mjs` + `session-end-ship.test.mjs` combined 58/58,
  `cli.collect.test.mjs` 10/10, `session-start.test.mjs` 68/68,
  `i18n/coverage.test.mjs` green (both files combined report 115/115),
  `chunk-boundary.test.mjs` 15/15 (pinned-line fix).
- Full `npm test` under `GIT_CONFIG_GLOBAL=/dev/null`: **5285/5285 green**
  (baseline was 5277/5277; net +8: +2 `collect.integration.test.mjs`, +2
  `ship.test.mjs`, +2 `cli.collect.test.mjs`, +2 `session-start.test.mjs` —
  the latter is 3 new tests replacing 2 rewritten-in-place ones, net +1,
  plus +1 new `renderContextBlock` reason test).
- No `brain/scripts/scratch/` debris was present at any point in this run
  (checked before and after the full suite).
- One transient failure was measured, not assumed pre-existing:
  `chunk-boundary.test.mjs`'s pinned import-line allowlist (`cli.mjs`
  line 624) broke because THIS change's own edits to `cli.mjs` pushed that
  import 20 lines down to 644. Confirmed the cause (not a flake, not
  pre-existing) by reading the diff, then fixed the pinned row in the same
  work unit that grew `cli.mjs` — see the second commit.

## Consumers checked (#921 shape change)

| Consumer | Outcome |
|---|---|
| `memory/cli.mjs` | Updated — prints the new line in both `collect` and `ship` ops. |
| `memory/lane/ship.mjs` | Updated — forwards the field, defaulted for older fakes. |
| `memory/session-end-ship.mjs` | Unchanged — already redirects the `ship` child's stdout+stderr into its private log verbatim; tests re-run, 58/58 green, no regression. |
| `memory/day-start-sweep.mjs` | Unchanged — `laneSweepLine()` treats `sweep.outcome` as an opaque parsed object; the field is available to it without modification. Tests re-run green. |

## Deviations / things not done

- Did not wire `step5SynthesizeContext` into `runSessionStart()` — explicit
  non-goal per the ticket (acceptance B is a product decision, recorded as a
  code comment, not resolved here).
- Did not touch `brain/core/**` or `brain/project/**`.
- Did not run `memory:ship`/`memory:collect`/`memory:share`, did not push,
  did not open a PR, did not hit a real remote.
- Epic tasks 4.7 and 4.9 in `openspec/changes/issue-864-memory-2-0/tasks.md`
  ticked `[x]`, cross-referencing this change.
