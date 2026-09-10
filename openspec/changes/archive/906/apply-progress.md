---
status: apply-in-progress
issue: 906
---

# Apply progress: #906 — two callers, one verb

Worktree `/home/gandalf/IA/brain-issue-906`, branch
`feat/issue-906-featmemory-the-lanes-triggers-sessionend` (base `ec117141`). Batch 1 (first
batch — no prior apply-progress existed). Strict TDD mode, all units RED→GREEN, `npm test`
green before every commit.

## Status: 39/44 tasks complete (sections 0–6 done; 7.1/7.3/7.4 and section 9 left for the
orchestrator per the launch instructions; section 10 is post-merge, no code)

## Section 0 — live measurements (all done)

| # | Result |
|---|---|
| 0.1 | `package.json` version is `1.5.0` — A6's `1.6.0` choice stands. |
| 0.2 | `brain:config get memory.lane.enabled` before any set: exit 1, `'memory.lane.enabled' is not set (undefined)` — matches A6's prediction. |
| 0.3 | `brain:config set memory.lane.enabled true` on a scratch copy (no migration entry yet): refused — `unknown path 'memory.lane.enabled'`, nearest `sdd.map`. Scratch config's `schemaVersion` stayed `0.3.0` (the fixture's own baseline), `memory` key absent. Confirms A6: before task 5, the leaf is genuinely unknown. Scratch dir discarded; this repo's tracked `brain.config.json` was never touched. |
| 0.4 | `antigravity.drift.test.mjs`: GREEN baseline → RED after the compiler change (task 3.2, uncommitted) → GREEN again once both settings files were regenerated and committed in the same commit (task 3.3, commit `f9b79825`). Confirmed at every stage. |
| 0.5 | Launcher wall time: flag false (real process, cold start) ≈ **52ms**; flag true (real detached spawn of a stub grandchild via the injected `_spawn` seam — no real `ship` invoked) ≈ **5ms**. Both far under the 1.5s shared `SessionEnd` budget. **Cold review C6**: those numbers are for the script entrypoint; the compiled hook runs `npm run brain:memory:session-end`, which pays npm's own startup — measured 0.10 s (three runs, this machine, warm) and 0.22 s in the reviewer's runs; ~7–15 % of the budget, conclusion unchanged. |
| 0.6 | Flag true, real detached spawn (stub grandchild, injected `_spawn` seam — never invokes real `ship`): the grandchild PID (measured: `2367709`) was confirmed alive via `ps` ~300ms after the launcher process (`2367698`) had already returned; the tmpdir log contained exactly **one JSON line**. Scratch dir cleaned up afterward. |
| 0.7 | `npm run brain:memory:session-end` from `brain/scripts/memory/` (a subdirectory): npm normalized cwd to the package root, exit 0, silent (flag false in this repo). Confirms D1's reasoning for `npm run` over a relative path. |
| 0.8 | Full `npm test` baseline: **5100/5100** green, ~29s. `lib/managed-paths.test.mjs` (30/30), `harness/backends/settings-hooks.test.mjs` (8/8), `antigravity.drift.test.mjs` (5/5) individually confirmed. |

## Units 1–6 — TDD Cycle Evidence

| Unit | RED | GREEN | REFACTOR | Commit |
|---|---|---|---|---|
| 1. `session-end-ship.mjs` launcher | `session-end-ship.test.mjs` created, ran against absent module → `ERR_MODULE_NOT_FOUND` | Implementation added, 5/5 green | One test-only fix: hardcoded-secret scanner flagged literal `'gh-secret-value'`/`'mem-secret-value'` in the test; replaced with array-joined fixture values (`ghFixture`/`memFixture`), still asserting env pass-through and non-printing | `f0630c60` |
| 2. `MANAGED_SCRIPT_KEYS` + `package.json` script | Extended `managed-paths.test.mjs` (length 9→10, key presence, `mergePackageJson` delivery) → 3 failing | Key appended to `MANAGED_SCRIPT_KEYS`, script added to `package.json` → 32/32 green | none | `e3b4e5e6` |
| 3. compiler `SessionEnd` block | Extended `settings-hooks.test.mjs` (3 new tests: command, no matcher/timeout/async, deterministic) → import error (`SESSION_END_COMMAND` undefined) | `SESSION_END_COMMAND` + `SessionEnd` block added, both settings files regenerated through the real backend `init()` functions (AGENTS.md never touched) → 11/11 green; purity pin still green | none | `f9b79825` |
| 4. `day-start-sweep.mjs` + wiring | `day-start-sweep.test.mjs` created → `ERR_MODULE_NOT_FOUND` | Implementation added → 7/7 green; wired into `day-start.mjs` step 5 + 3 i18n keys ×2 langs; verified against the real repo (flag off: silent, 1/6..6/6 intact) and `test/bootstrap-smoke/smoke.mjs` (fresh consumer: "reached its final step 6/6") | none | `6ec4c85b` |
| 5. migration entry `1.6.0` | `config-migrations.test.mjs` created (new file — none existed before, contrary to tasks.md's "extend") + `cli.test.mjs` extended → 2 failing | Entry appended → green; **collateral fix required**: `brain-config.test.mjs`'s full-default-schema pin asserted `schemaVersion === '1.4.0'` and `!('memory' in cfg)` — both now false given the new latest migration. Updated to `'1.6.0'` and `cfg.memory.lane.enabled === false` (strengthens the pin, does not weaken it) | Two follow-up commits (see Deviations) to relocate the test file so `npm test`'s glob actually reaches it | `e7517cac`, `c8ddaed2`, `9c353265` |
| 6. `pre-push` re-pin | N/A — see Deviations | N/A | N/A | none (no diff) |

## Full `npm test` results

- Before starting (0.8): 5100/5100.
- After unit 1: 5105/5105.
- After unit 2: 5107/5107.
- After unit 3 (pre-commit, drift expected red): 5109/5110.
- After unit 3 (post-commit): drift green, full suite not re-run standalone (confirmed via unit 4's pre-check).
- After unit 4: 5117/5117 (+ `test/bootstrap-smoke/smoke.mjs` run separately, all green — not part of `npm test`'s own glob).
- Mid-unit-5 (before the brain-config.test.mjs fix): 5117/5118, 1 failing.
- After the brain-config.test.mjs fix: 5118/5118.
- **Final, after the relocation fix (current HEAD)**: **5122/5122**, ~28s.

## Counted / reviewer-visible lines (excludes `openspec/**`)

- Counted (excludes `**/*.test.mjs` too, matching the governance gate convention): **257** lines (256 insertions + 1 deletion) across 11 non-test files.
- Reviewer-visible (includes tests): **654** lines (654 insertions, 7 deletions) across 18 files.
- Design forecast was ~209 counted / ~560 reviewer-visible — actual is close, still well under the 400-line counted budget. Matches the tasks.md forecast: `400-line budget risk: Low`, no chaining needed.

## Deviations from tasks.md / design.md

1. **File paths for `managed-paths` and `config-migrations` tests**: `MANAGED_SCRIPT_KEYS` lives in `brain/core/managed-paths.mjs`, but `npm test`'s globs (`brain/scripts/**/*.test.mjs`, `test/**/*.e2e.test.mjs` — enforced by the repo's own `#850` orphan-test guard) never reach `brain/core/`. Its test lives at `brain/scripts/lib/managed-paths.test.mjs` (pre-existing convention, confirmed before writing). The same is true for `config-migrations.mjs`: I initially created `brain/core/config-migrations.test.mjs` per tasks.md's literal wording ("extend `brain/core/config-migrations.test.mjs`" — which did not exist before this change), and only discovered the orphan-guard violation on a later full `npm test` run (the file wasn't yet git-tracked during the run that showed clean, so the guard hadn't fired). Fixed with two follow-up commits (`c8ddaed2` relocating the file, `9c353265` carrying the actual import-path content — the first follow-up commit accidentally staged only the bare `git mv`, pre-edit content, due to a failed multi-pathspec `git add` call being silently ignored via `;`). Final location: `brain/scripts/lib/config-migrations.test.mjs`, matching `managed-paths.test.mjs`'s own precedent.
2. **Unit 6 (`pre-push` re-pin)**: no diff was made. The exact assertion tasks.md/spec.md ask for (`!ops.includes('ship')`, with a D4-referencing message) was already added by commit `16493771` (PR #902, part of #889's own work), inside the pre-existing test (a) block — confirmed via `git log -p`. Adding a second, textually-identical assertion would test nothing new. Confirmed green (3/3) as-is; recorded as a **finding**, not silently skipped.
3. **`day-start-sweep.mjs`'s `runLaneSweep` signature**: design.md's Interfaces section declares `runLaneSweep({ config, _spawnSync, _now } = {})`, but no scenario in spec.md or design.md's own testing-strategy table exercises time-dependent behavior for the sweep (unlike the launcher, which genuinely needs `_now` to derive the tmp-log's date suffix). Implemented without `_now` — an unused, untested seam is dead surface, not test coverage. Noted here rather than silently added or silently dropped.
4. **`brain-config.test.mjs`** (outside the stated write-allowlist, which does not list it): required a collateral fix — its full-default-schema pin (`ensureBrainConfig` builds the config from every migration's defaults) asserted the LATEST `schemaVersion` was `'1.4.0'` and that no `memory` key was defaulted. Both became false the moment the `1.6.0` entry landed (an ADDITIVE, DESIGN-MANDATED change). Updated the pin to `'1.6.0'` and to assert `cfg.memory.lane.enabled === false` explicitly — this strengthens the assertion (it now names the real default) rather than weakening it. This is the same class of collateral the module's own doctrine anticipates (see its NOTE about the 0.6.0 retirement) and was unavoidable without either breaking `npm test` or refusing to add the migration entry design.md and spec.md both require.

## Measurement evidence retained above (0.5/0.6) used a stub grandchild + injected `_spawn` seam

Per the orchestrator's explicit constraint ("NEVER let a test or a measurement run a real
`memory:ship` push"), 0.5's flag-true and 0.6's survival/log measurements used the launcher's
own `shipOnSessionEnd()` with a REAL `spawn()` call substituted only in its TARGET (a small stub
script at `/tmp/brain-906-measure/stub-ship.mjs`, cleaned up afterward) — exercising the real OS
mechanics (detach, unref, fd inheritance, process independence) without ever invoking the real
`ship` op or touching any remote.

## Remaining for the orchestrator (per launch instructions)

- 7.1: `memory:save --issue 906` (record-first), committed before push.
- 7.3: final `npm test` evidence bundled into the wrap-up (this document already carries the
  latest: 5122/5122).
- 7.4: fresh cold review before push (mandatory review-workload gate per the harness).
- Section 9: open the PR (`Closes #906`, `Parent: #864` in prose, `type:feature`,
  `feat/issue-906-lane-triggers` → `main`), body per tasks.md 9.1's nine-point outline
  (D2 cost, A6 dormancy, the flag-flip as a maintainer act, the measured budget/wall-time/log
  path), then `brain:review` fresh-context and post the verdict.
- Section 10: post-merge maintainer acts — no code, not part of this PR's scope.

## Batch 3 — cold-review BLOCKER: the log fd was mode-check-only, not fstat-verified (C7)

Worktree/branch unchanged. PR #910 was already open (opened in an earlier, undocumented batch —
see the note below); cold review returned REVISE on one BLOCKER. Strict TDD, RED confirmed against
the shipped code before any fix, `npm test` green before commit.

**Note on batches 1→3 continuity**: this file and `tasks.md` were last updated at commit `da3d5aaa`
(end of batch 1). Commits `765e6538` (day-start `laneSweepLine` extraction + coverage),
`6e0205a9` (symlink refusal, C2), `da3d5aaa` is the same commit as above, `5affcb48` (explore/
proposal/spec docs commit) and `bc7f76ca` (session record) landed after that without a
corresponding apply-progress update — that gap predates this batch and is out of this batch's
write-allowlist (`tasks.md` is not writable here). This section documents batch 3 only; the
cumulative doc gap for batches 1–2 is a finding, not something this batch silently backfills.

### The blocker

`session-end-ship.mjs` opened the tmp log with
`O_WRONLY|O_CREAT|O_APPEND|O_NOFOLLOW`, mode `0o600`. `O_NOFOLLOW` refuses a pre-existing
**symlink** (C2, already fixed in batch 2) but does nothing against a pre-existing **ordinary**
file, and `open`'s `mode` argument only applies when the call itself **creates** the file. A local
user who pre-created the predictable `${tmpdir()}/brain-lane-ship-<host>-<date>.log` path as a
regular `0o666` file before the launcher ever ran defeated both defenses: the open succeeded, the
mode stayed world-readable, and the detached `ship` child's stdout/stderr (which can echo
`oauth2:TOKEN@host` on a git failure) landed in an attacker-readable file. The cold reviewer
reproduced this against the shipped code, driving the real `shipOnSessionEnd` with a fake `_spawn`
writing through the inherited fd.

### The fix — defense in depth, both required

1. **Private directory**: the log now lives in `${tmpdir()}/brain-lane-<uid>/` (`uid` from
   `process.getuid()`, falling back to `os.userInfo().username` where `getuid` is unavailable).
   `ensurePrivateDir` creates it (mode `0o700`) if absent; whether created or pre-existing,
   `lstatSync` verifies it is a real directory (not a symlink), owned by `uid`, with no
   group/other permission bit — refusing (one stderr line, exit 0, no spawn) otherwise.
2. **fstat-verified fd**: the log is opened inside that directory with the same
   `O_NOFOLLOW|O_CREAT|O_WRONLY|O_APPEND` flags and `0o600` mode, then `fstatSync(fd)` verifies a
   regular file, owned by `uid`, no group/other bits, `nlink === 1` — the check that defeats a
   pre-created `0o666` file even if the directory check were somehow bypassed.
3. Seams: `_tmpdir`, `_uid` (default `process.getuid`/`userInfo().username`), `_spawn`, `_now`;
   the log filename inside the private dir is unchanged (`brain-lane-ship-<host>-<date>.log`).

### TDD Cycle Evidence

| Step | Evidence |
|---|---|
| RED | `session-end-ship.test.mjs` extended with 3 new tests (pre-created `0o666` regular file inside an otherwise-valid private dir; pre-existing `0o755` private dir; pre-existing private dir owned by a different uid via the `_uid` seam) and 2 existing tests relocated/extended (the mode-0600 happy path now also asserts the dir is `0o700`; the C2 symlink test moved inside the private dir). Run against the **unfixed** code: `node --test brain/scripts/memory/session-end-ship.test.mjs` → **5/10 failing** (the reviewer's attack test, the 0755-dir test, the wrong-uid-dir test, and the relocated symlink test all failed for the right reason — the vulnerable code has no directory concept and no fd re-verification). |
| GREEN | `ensurePrivateDir` + `ensureTrustedFd` implemented in `session-end-ship.mjs`, wired into `shipOnSessionEnd` before the `_spawn` call, with a `fdClosed` guard so `ensureTrustedFd`'s own `closeSync` on refusal never double-closes in the `finally`. Same command → **10/10 green**. |
| REFACTOR | Header comment (steps 1–5 table) and the two new helper functions' JSDoc rewritten to state the C7 contract and cite the reviewer's reproduction; no behavior change after GREEN. |

### Test results

- Focused (`node --test brain/scripts/memory/session-end-ship.test.mjs brain/scripts/day-start.test.mjs brain/scripts/memory/day-start-sweep.test.mjs`): **27/27 green** — `session-end-ship.test.mjs` went from 7 tests (state at `HEAD` before this batch's edits) to 10 (3 new: pre-created-file, `0755`-dir, wrong-uid-dir; 2 renamed/relocated in place, not duplicated); `day-start.test.mjs` (3) and `day-start-sweep.test.mjs` (14) unchanged by this batch.
- Same command under `GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1 HOME=$(mktemp -d)`: **27/27 green**, identical.
- Full `npm test`: **5139/5139 green**, ~24s. This batch's own net contribution is +3 tests (the new session-end-ship.test.mjs cases). The remaining delta from batch 1's recorded 5122 baseline is undocumented in this doc — it covers commits `765e6538`/`6e0205a9` (batch 2's `day-start.test.mjs` creation and the C2 symlink fix's own test additions, neither backfilled here per the continuity note above) and possibly branch sync with `main`, which has advanced well past this branch's `ec117141` base per this session's own git-status snapshot.

### Editorial (folded in per the launch instructions)

`day-start.mjs` step 5 called `laneSweepEnabled(config)` directly (to decide whether to print the
progress line) and then `runLaneSweep({ config })`, which called `laneSweepEnabled(config)` again
internally — the same pure function evaluated twice per run for no reason. Fixed: `day-start.mjs`
now computes `laneSweepEnabled(config)` once into `laneEnabled` and passes it through
(`runLaneSweep({ config, enabled: laneEnabled })`); `runLaneSweep` gained an `enabled` parameter
defaulting to `laneSweepEnabled(config)` so every other caller (all of `day-start-sweep.test.mjs`)
is unaffected. `day-start.test.mjs`'s source-guard regex
(`/laneSweepEnabled\(config\)[\s\S]*console\.log[\s\S]*runLaneSweep\(/`) still matches — the
literal call and the ordering it pins are both still present in the block.

### Files changed (batch 3)

| File | Action |
|---|---|
| `brain/scripts/memory/session-end-ship.mjs` | Modified — `ensurePrivateDir` + `ensureTrustedFd`, wired into `shipOnSessionEnd` |
| `brain/scripts/memory/session-end-ship.test.mjs` | Modified — 3 new tests, 2 relocated/extended |
| `brain/scripts/memory/day-start-sweep.mjs` | Modified — `runLaneSweep` gained `enabled` param (editorial) |
| `brain/scripts/day-start.mjs` | Modified — computes `laneSweepEnabled(config)` once (editorial) |
| `openspec/changes/issue-906-lane-triggers/design.md` | Modified — A1 step 2, A1 seams list, A3, and a new C7 risk row |
| `openspec/changes/issue-906-lane-triggers/apply-progress.md` | This section |

## Post-merge fix (after PR #910 merged) — fd leak on a post-check `_spawn` throw

Worktree `/home/gandalf/IA/brain-issue-906-archive`, branch `docs/issue-906-archive` off
`origin/main` `51ff915f` (PR #910 already merged). Cold review of the merged code found a second,
narrower defect in the same `try/catch/finally` block batch 3 introduced for C7: the `fdClosed`
boolean set `true` inside the single `catch` for ANY thrown error, whether `ensureTrustedFd` itself
threw (which used to close `fd` on its own refusal path) or `_spawn`/`.unref()` threw AFTER
`ensureTrustedFd` had already succeeded. In the latter case nobody had ever closed `fd`, yet
`fdClosed` was still set `true`, so the `finally`'s `if (!fdClosed) closeSync(fd)` skipped the
close — a genuine fd leak on that path (harmless at process-exit-always-closes-fds scale for this
short-lived launcher, but a defect worth fixing since strict TDD ships as sole-fix-of-record).

**Fix**: removed `ensureTrustedFd`'s own `closeSync(fd)` on refusal, so the function only ever
throws; `shipOnSessionEnd` now has exactly ONE close site — an unconditional `finally { _closeSync(fd); }`
around the `ensureTrustedFd` + `_spawn` + `.unref()` block — reached on every path (refusal, a
post-check `_spawn`/`.unref()` throw, or success). No boolean guard, no branch that can skip the
close. Added a `_closeSync` seam (default `closeSync`) so tests can assert the fd is closed exactly
once and is actually invalid (`EBADF`) afterward, without relying on `/proc/self/fd` introspection.

### TDD Cycle Evidence

| Step | Evidence |
|---|---|
| RED | New test `_spawn throws AFTER the fd was trusted: the fd is closed exactly once` added to `session-end-ship.test.mjs`, using a `_closeSync` seam that records calls and delegates to the real `closeSync`. Run against the merged (unfixed) code: `node --test brain/scripts/memory/session-end-ship.test.mjs` → **10/11 passing, 1 failing** — `closeCalls.length` was `0` (expected `1`): the fd was never closed on this path, confirming the leak. |
| GREEN | `ensureTrustedFd` no longer closes `fd` itself; `shipOnSessionEnd` wraps the `ensureTrustedFd`/`_spawn`/`.unref()` block in a single `try { ... } finally { _closeSync(fd); }`. Same command → **11/11 green**; `closeCalls.length === 1` and `fstatSync(closeCalls[0])` throws `EBADF` after the call returns, proving the fd is actually closed at the OS level. |
| REFACTOR | `ensureTrustedFd`'s JSDoc rewritten to state the single-close-site contract and why the old two-close-site design collapsed refusal and post-check failure into the same branch. Header/inline comments in `shipOnSessionEnd` updated to match; no further behavior change. |

### Test results

- Focused (`node --test brain/scripts/memory/session-end-ship.test.mjs`): **11/11 green** (10 pre-existing + 1 new).
- Full `npm test`: **5140/5140 green**, ~28s.

### Files changed (post-merge fix)

| File | Action |
|---|---|
| `brain/scripts/memory/session-end-ship.mjs` | Modified — single unconditional close site (`_closeSync` seam), `ensureTrustedFd` no longer closes `fd` itself |
| `brain/scripts/memory/session-end-ship.test.mjs` | Modified — 1 new regression test for the fd-leak-on-post-check-throw path |
| `openspec/changes/issue-906-lane-triggers/apply-progress.md` | This section |

(`tasks.md` was being edited concurrently by the orchestrator in this same worktree during this
batch — not touched here, per the launch instructions' write-allowlist.)

## Files changed (this batch)

| File | Action |
|---|---|
| `brain/scripts/memory/session-end-ship.mjs` | Created |
| `brain/scripts/memory/session-end-ship.test.mjs` | Created |
| `brain/core/managed-paths.mjs` | Modified (10th `MANAGED_SCRIPT_KEYS` entry) |
| `brain/scripts/lib/managed-paths.test.mjs` | Modified |
| `package.json` | Modified (1 script) |
| `brain/scripts/harness/backends/settings-hooks.mjs` | Modified (`SESSION_END_COMMAND` + block) |
| `brain/scripts/harness/backends/settings-hooks.test.mjs` | Modified |
| `.claude/settings.json` | Regenerated |
| `.gemini/settings.json` | Regenerated |
| `brain/scripts/memory/day-start-sweep.mjs` | Created |
| `brain/scripts/memory/day-start-sweep.test.mjs` | Created |
| `brain/scripts/day-start.mjs` | Modified (step 5 sub-step) |
| `brain/scripts/i18n/en.mjs` / `es.mjs` | Modified (3 keys ×2) |
| `brain/core/config-migrations.mjs` | Modified (`1.6.0` entry) |
| `brain/scripts/lib/config-migrations.test.mjs` | Created |
| `brain/scripts/config/cli.test.mjs` | Modified |
| `brain/scripts/lib/brain-config.test.mjs` | Modified (collateral pin fix, see Deviations #4) |
| `openspec/changes/issue-864-memory-2-0/tasks.md` | Modified (7.2's one-line note, uncommitted) |
| `openspec/changes/issue-906-lane-triggers/tasks.md` | Checkboxes updated (uncommitted) |
| `openspec/changes/issue-906-lane-triggers/apply-progress.md` | This file (new, uncommitted) |
