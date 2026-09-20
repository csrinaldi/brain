---
status: tasked
issue: 906
---

# Tasks: #906 — two callers, one verb: a launcher that detaches and a sweep that reports

Implements `spec.md` under the ratified ruling `sdd/issue-906-lane-triggers/ruling` (D1–D7,
2026-09-10) and `design.md`'s A1–A8. Parent: #864 task 3.1b/3.1c, ADR-0034 L5. Branch:
`feat/issue-906-lane-triggers`. Delivery: `ask-on-risk`, single PR pre-agreed (design forecast
~209 counted / ~560 reviewer-visible — well under the 400-line counted budget).

STRICT TDD MODE IS ACTIVE. Every implementation task below is preceded by its failing test task.
Test runner: `npm test` (node:test). Run the focused `node --test` command after each RED/GREEN
pair; run the full `npm test` before each commit.

## 0. Live measurements (apply must perform first — no Bash was used to write design.md)

- [x] 0.1 `node -p "require('./package.json').version"` — confirm still `1.5.0`. If cut past
      it, revisit A6's `1.6.0` choice before writing the migration entry (task 5).
- [x] 0.2 `node brain/scripts/config/cli.mjs get memory.lane.enabled` **before any set** —
      record exit code + message (A6 predicts exit 1, "not set").
- [x] 0.3 `node brain/scripts/config/cli.mjs set memory.lane.enabled true` on a **scratch copy
      of the config only** — record the "migrations applied first: …" list and resulting
      `schemaVersion` (A6 predicts `1.6.0` absent, `schemaVersion` stays `1.5.0`), then revert
      / discard the scratch copy. Never touch this repo's tracked `brain.config.json`.
- [x] 0.4 Confirm `antigravity.drift.test.mjs` is RED before both settings files are
      regenerated, GREEN after they are regenerated **and committed** in the same commit as
      the compiler change (task 3).
- [x] 0.5 `time node brain/scripts/memory/session-end-ship.mjs` with the flag false and true —
      record both numbers against the 1.5 s shared `SessionEnd` budget; log in apply-progress.
- [x] 0.6 With the flag true, confirm the grandchild outlives the launcher (`ps` for the
      `cli.mjs ship` pid after the launcher returns) and that the tmpdir log exists with one
      JSON line — **ONLY on a scratch clone or with the ship's remote pointed at a local bare
      repo. NEVER a real push from this apply run.**
- [x] 0.7 `npm run brain:memory:session-end` from a subdirectory — confirm npm normalizes cwd
      to the package root (why D1 chose `npm run` for the settings string, not a relative path).
- [x] 0.8 Full `npm test` baseline before starting — name `lib/managed-paths.test.mjs`,
      `harness/backends/settings-hooks.test.mjs`, and `antigravity.drift.test.mjs`
      individually in the recorded evidence.

## 1. Unit — the launcher `memory/session-end-ship.mjs` (A1–A3)

- [x] 1.1 RED: `brain/scripts/memory/session-end-ship.test.mjs` (NEW) — flag false or
      `memory` key absent ⇒ `_spawn` seam never called, exit 0, zero stdout/stderr; flag true
      ⇒ one `_spawn` call with `detached:true`, `stdio[1]===stdio[2]===`tmp-log fd,
      `.unref()` invoked, `env` carries `GH_TOKEN` **and** `BRAIN_MEMORY_TOKEN` unchanged with
      neither value ever printed; `_spawn` throws ⇒ exactly one stderr line, exit 0, child
      code never read; one real-process run against this repo's own config (flag false) exits
      0, prints nothing, writes no file. Focused: `node --test
      brain/scripts/memory/session-end-ship.test.mjs` — RED (module absent).
- [x] 1.2 GREEN: `brain/scripts/memory/session-end-ship.mjs` — `shipOnSessionEnd({_loadConfig,
      _spawn, _tmpdir, _now})` implementing A1's five-step order (guard → open log fd → spawn
      detached+unref → exit 0 always → catch prints one line, still 0), seams named exactly as
      in design, main-module guard per `lib/brain-config.mjs:240`. Focused: same command —
      GREEN. `npm test` green.

Commit: `feat(memory): add the session-end-ship launcher (#906)`.

## 2. Unit — `MANAGED_SCRIPT_KEYS` + `package.json` script (A5, same commit)

- [x] 2.1 RED: extend `brain/core/managed-paths.test.mjs` — `MANAGED_SCRIPT_KEYS.length === 10`
      (was 9), includes `brain:memory:session-end`, every entry still `brain:`-prefixed;
      `mergePackageJson` delivers the new key into an empty consumer `package.json`. Focused:
      `node --test brain/core/managed-paths.test.mjs` — RED (length mismatch, key absent).
- [x] 2.2 GREEN: `package.json` — add `"brain:memory:session-end": "node
      ./brain/scripts/memory/session-end-ship.mjs"`; `brain/core/managed-paths.mjs` — append
      the key to `MANAGED_SCRIPT_KEYS`. Focused: same command — GREEN. `npm test` green.

Commit: `feat(config): register brain:memory:session-end as a managed script key (#906)`.

## 3. Unit — compiler `SessionEnd` block + both settings files (A4, same commit)

- [x] 3.1 RED: extend `brain/scripts/harness/backends/settings-hooks.test.mjs` —
      `hooks.SessionEnd[0].hooks[0].command === SESSION_END_COMMAND`, no `matcher`/`timeout`/
      `async` key; deterministic and argument-free across three events; the purity pin `:174`
      (no `spawn(`/`child_process`/fs strings in the compiler) stays green. Focused: `node
      --test brain/scripts/harness/backends/settings-hooks.test.mjs` — RED.
- [x] 3.2 GREEN: `settings-hooks.mjs` — export `SESSION_END_COMMAND = 'npm run
      brain:memory:session-end'` beside `SESSION_START_COMMAND`; add a `SessionEnd` block
      shaped exactly like `SessionStart` (no `matcher`/`timeout`/`async`). Focused: same
      command — GREEN.
- [x] 3.3 Regenerate `.claude/settings.json` and `.gemini/settings.json` through the real
      backends and commit both **in this same commit**. Confirm `antigravity.drift.test.mjs`
      matches measurement 0.4 (red pre-commit, green post-commit). `npm test` green.

Commit: `feat(harness): compile the SessionEnd hook into both platforms' settings (#906)`.

## 4. Unit — `day-start-sweep.mjs` + `day-start.mjs` step-5 sub-step (A7)

- [x] 4.1 RED: `brain/scripts/memory/day-start-sweep.test.mjs` (NEW) — flag off ⇒
      `laneSweepEnabled` false, `runLaneSweep` never calls `_spawnSync`, returns
      `{skipped:true}`; flag on ⇒ one `_spawnSync` call with `--json` and a `timeout`;
      non-zero child exit ⇒ reported in the outcome, never thrown; unparseable stdout ⇒
      `unparsed`, still non-fatal. Focused: `node --test
      brain/scripts/memory/day-start-sweep.test.mjs` — RED (module absent).
- [x] 4.2 GREEN: `day-start-sweep.mjs` — `laneSweepEnabled(config)` (pure) and
      `runLaneSweep({config, _spawnSync, _now})` per A7 (own `spawnSync(..., {timeout:
      60_000})`, parses the single `--json` line into `{pushed, pr, autoMerge, collected,
      ref}`). Focused: same command — GREEN.
- [x] 4.3 RED → GREEN: wire `runLaneSweep` as a sub-step inside `day-start.mjs` step 5 — one
      `t()`-rendered outcome line when it ran, silent skip when the flag is off, warn (never
      fail) on non-zero. Extend/confirm the bootstrap-smoke pin that `TOTAL` stays `6/6` (no
      new `sep()`). Focused: `node --test test/bootstrap-smoke/smoke.mjs` (or the project's
      smoke entry point) — confirm `6/6` unchanged. `npm test` green.

Commit: `feat(day-start): wire the lane sweep into step 5 without adding a step (#906)`.

## 5. Unit — `memory.lane.enabled` migration entry `1.6.0` (A6, dormant by design)

- [x] 5.1 RED: extend `brain/core/config-migrations.test.mjs` — the `1.6.0` entry is additive
      and never overwrites an already-`true` value; extend `config/cli.test.mjs` —
      `memory.lane.enabled` is a known settable leaf **today**, version-independent, via
      `deriveKnownPaths`. Focused: `node --test brain/core/config-migrations.test.mjs
      brain/scripts/config/cli.test.mjs` — RED.
- [x] 5.2 GREEN: `brain/core/config-migrations.mjs` — append one `1.6.0` entry defaulting
      `memory.lane.enabled` to `false`. Note in the commit body: this entry is dormant until
      `package.json` is cut ≥`1.6.0` (A6); correctness does not depend on it, since the
      launcher treats absent as false (task 1) and `set` already accepts the leaf today
      (measurement 0.2/0.3). Focused: same command — GREEN. `npm test` green.

Commit: `feat(config): add memory.lane.enabled migration entry, 1.6.0 (#906)`.

## 6. Re-assert — `pre-push` still never invokes `ship`

- [x] 6.1 Extend `brain/scripts/hooks/pre-push.test.mjs` with one more assertion on the
      existing mock-node call log: `ops` never contains `ship`, still contains `share` and
      `feature-checkpoint`. This is a **pin** (the assertion is true against `pre-push`
      unmodified), same precedent as `archive/888/tasks.md` section 5 — RED is a missing
      assertion, not a failing one. Focused: `node --test
      brain/scripts/hooks/pre-push.test.mjs` — confirm passing without touching `pre-push`.
      `npm test` green.
      **Finding**: the exact assertion (`!ops.includes('ship')`, with the D4-referencing
      message) was already added by #902 (commit 16493771, part of #889's work), inside the
      test (a) block. `git log -p` confirms it predates this change. No diff was made to
      `pre-push.test.mjs` — adding a second, redundant assertion would test nothing new.
      Confirmed green (3/3) as-is.

Commit: `test(hooks): re-pin that pre-push never invokes memory:ship (#906)`.

## 7. Wrap-up before the push

- [x] 7.1 Record-first: `rec-d8ab89bef71f56e3` (`memory:save --issue 906`), committed as bc7f76ca
      before the first push.
- [x] 7.2 Epic note, not a new tick: append ONE LINE under 3.1b in
      `openspec/changes/issue-864-memory-2-0/tasks.md` (3.1b/3.1c already both reference
      #906 — "triggers deferred to #889" / "triggers #906") pointing at this PR once its
      number is known. Do not flip 3.1c's `[x]`/scope; it already covers governance, not the
      triggers themselves.
      Done — one sub-line added under 3.1b, referencing #906 and this change's own tasks.md
      §9 for the PR number (not yet opened at apply time — no `[x]` flipped, 3.1c untouched).
- [x] 7.3 `npm test`: 5122/5122 after the six units, 5136/5136 before the first push, 5139/5139
      at the merged head 9ea9b6c0.
- [x] 7.4 Fresh cold review before the push: REVISE with six corrections (a symlink-followable
      world-readable tmp log, token-leak assertions on the wrong channel, a leaked test file,
      no coverage of the `day:start` wiring, the hook's real wall time, the migration's
      `buildDefaultConfig` exception), all landed (6e0205a9, 765e6538, da3d5aaa) before the push.

## 8. Non-goals (spec.md + design A8 — restated, no work items)

No change to `ship`/`collect`/`plan`/`mrCreate`/`mrAutoMerge`/`credential-env.mjs`/
`memory-gate`/record format. `memory.lane.enabled` MUST NOT default `true` on any tier, ever.
No ADR amendment (L5 already ratifies both triggers). `hooks/pre-push` stays on `share`.
`harness/backends/plain.mjs`'s `MANUAL_FLOW_STEPS` stays pinned at nine — an automatic trigger
is not a manual step.

## 9. The PR

- [x] 9.1 Shipped as PR #910 (`Closes #906`, `type:feature`, branch
      `feat/issue-906-featmemory-the-lanes-triggers-sessionend`), merged as 51ff915f on
      2026-09-10, with every body section below. Original instructions, for the record:
      1. Summary — three bullets: the detaching `SessionEnd` launcher, the synchronous
         `day:start` sweep, both gated behind `memory.lane.enabled` (default false).
      2. Changes table (design.md's module map).
      3. Test plan — `npm test` output + each focused `node --test` command from sections 1–6.
      4. **The D2 cost, stated plainly**: emit-always means every adopter receives the
         `SessionEnd` command string on their next `brain:upgrade` (inert until they flip the
         flag) — a deliberate cost, not an oversight.
      5. **A6, stated plainly**: the `1.6.0` migration entry is dormant until `package.json`
         is cut ≥`1.6.0`; correctness does not depend on it.
      6. **The flag flip is a maintainer act**, gated on #889 D7.2 (the first manual lane PR
         merging) — explicitly out of this PR's scope.
      7. The measured 1.5 s shared `SessionEnd` budget and the launcher's measured wall time
         (0.5); the tmpdir log path and "no rotation, stated not mitigated" (A3).
      8. Non-goals (section 8).
      9. Contributor checklist per `branch-pr` skill.
- [x] 9.2 `brain:review` on #910, both verdicts posted: round 1 REVISE at bc7f76ca with a
      blocker the fresh review had not caught (a pre-created 0666 regular file defeats
      `O_NOFOLLOW` and the create-only mode; fixed in 1f04e993 with an owner-verified 0700
      per-uid directory and `fstat` on the opened fd); round 2 APPROVE at 9ea9b6c0 with one
      correction (an fd left open when `spawn` throws after the fd was trusted — carried into
      the archive PR with its test).

## 10. Maintainer acts (post-merge — no code, recorded for the record)

- [ ] 10.1 After #889 D7.2's first manual lane PR merges, flip the flag: `npm run
      brain:config -- set memory.lane.enabled true`.
- [ ] 10.2 Record the first **AUTOMATIC** lane PR's number and the `memory:audit` p50/p90
      latency measured after it merges — a maintainer act, not a gate on landing this slice.
- [ ] 10.3 Every adopter receives the (inert) hook automatically on their next `brain:upgrade`;
      no adopter action required to receive it, only to arm it.

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~209 counted / ~560 reviewer-visible |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low
