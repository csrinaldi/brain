---
status: proposed
issue: 906
---

# Design — #906 two callers, one verb: a launcher that detaches and a sweep that reports

Parent: #864 task 3.1b/3.1c, ADR-0034 L5. Inputs: `proposal.md`, `spec.md`, `explore.md`, ruling
engram `sdd/issue-906-lane-triggers/ruling` (D1–D7 as recommended). Sibling shape:
`issue-889-lane-governance/design.md`.

## Approach in one paragraph

ADR-0034 L5's two triggers become **two thin callers of one verb, side by side** in
`brain/scripts/memory/`: `session-end-ship.mjs` (invoked by the compiled `SessionEnd` hook,
detaches and returns in milliseconds) and `day-start-sweep.mjs` (invoked synchronously by
`day-start.mjs` step 5, waits and reports). Both read the same flag through the same reader, both
spawn the same `memory/cli.mjs ship`, neither touches `collect`/`plan`/`ship`/`credential-env`. The
compiler gains one constant and one block; both settings files are regenerated in the same commit.
Two facts measured during this design change the plan the proposal wrote: the npm script key does
**not** reach adopters unless it is added to `MANAGED_SCRIPT_KEYS` (A5), and a migration versioned
past `package.json` is **never applied** (A6).

## Module map

```
brain/scripts/memory/session-end-ship.mjs      NEW  guard + detaching spawn      (~85)
brain/scripts/memory/day-start-sweep.mjs       NEW  guard + sync spawn + parse   (~55)
brain/scripts/harness/backends/settings-hooks.mjs  MOD  SESSION_END_COMMAND + block
.claude/settings.json / .gemini/settings.json  MOD  regenerated, same commit
brain/core/managed-paths.mjs                   MOD  a 10th MANAGED_SCRIPT_KEYS entry
brain/core/config-migrations.mjs               MOD  one 1.6.0 entry
brain/scripts/day-start.mjs                    MOD  sub-step inside step 5
brain/scripts/i18n/{en,es}.mjs, package.json   MOD  3 keys ×2, 1 script
```

## Architecture decisions

### A1 — The launcher spawns `cli.mjs` by module-resolved path, not by `npm run` and not relatively

`argv = [process.execPath, fileURLToPath(new URL('./cli.mjs', import.meta.url)), 'ship', '--json']`,
`cwd` = the module-derived repo root. Rejected: `npm run memory:ship` (an npm wrapper is a second
process that may not survive `unref` cleanly, and `memory:ship` is not in `MANAGED_SCRIPT_KEYS` — see
A5, so it does not exist on an adopter at all); rejected a repo-relative `'brain/scripts/memory/cli.mjs'`
(the launcher's own cwd is whatever npm resolved, and `cli.mjs` is a **sibling** — the URL form
cannot miss). Note the asymmetry with D1's settings string: `npm run` in the *settings file* is
right precisely because it normalizes cwd to the package root; inside the launcher that work is
already done.

`--json` because the log is the only record a detached run leaves, and `t()` would translate that
record into the operator's `docs.language` (`i18n/t.mjs:17-19`) — a locale-dependent log is a
locale-dependent postmortem. `ship` prints its stderr evidence regardless of `--json`
(`memory/cli.mjs:504-516`), so the log keeps both.

Order, seams, and exits:

| step | code | why |
|---|---|---|
| 1 | `_loadConfig()` → `config.memory?.lane?.enabled === true` | `loadBrainConfig` (`lib/brain-config.mjs:29-45`) parses raw JSON — **no migration** — so an absent key reads as `undefined` ⇒ false. Guard-first is what makes emit-always safe |
| 2 | `ensurePrivateDir(${tmpdir()}/brain-lane-<uid>/, uid)`, then `openSync(log, O_WRONLY\|O_CREAT\|O_APPEND\|O_NOFOLLOW, 0o600)` → one fd, then `fstatSync(fd)` re-verified | `tmpdir()` is predictable and world-writable; a local user can pre-create *anything* at a predictable path in it before this ever runs. The directory is confined to an owner-only (`0o700`) subdirectory scoped by uid, verified (not a symlink, a real directory, owned by `uid`, no group/other bits) whether `ensurePrivateDir` created it or found it pre-existing. `O_NOFOLLOW` refuses a pre-existing symlink at the log path (cold review C2), but `open`'s `mode` argument only applies when the call *creates* the file — a pre-created ordinary file at that path keeps its own mode, so `fstatSync` re-checks the opened fd the same way (regular file, owned by `uid`, no group/other bits, one hard link) before anything is written to it (**measured, cold review C7**, see the risk row below) |
| 3 | `_spawn(execPath, argv, { detached: true, stdio: ['ignore', fd, fd], cwd, env: process.env })` then `.unref()`, `closeSync(fd)` | stdin `'ignore'`: the hook's payload is never read, so Claude's and Gemini's differing `reason` vocabularies are irrelevant by construction |
| 4 | `return`/exit 0, always | the child's code is never read — `ship` exits 1 on `pushFailed`/`diverged` (`memory/cli.mjs:518-532`) and a session must not end red because a push raced |
| 5 | `catch` ⇒ one stderr line, still exit 0 | Claude shows `SessionEnd` stderr to the user |

Seams `_spawn`, `_loadConfig`, `_tmpdir`, `_now`, `_uid`; main-module guard as in
`lib/brain-config.mjs:240` and `config/cli.mjs:71`, so the file is both importable (tests) and
executable (hook).

### A2 — `env: process.env`, inherited unchanged — `withoutCredentials()` is the trap

`credentialEnvNames()` includes `FORGE_TOKEN_ENV` (`credential-env.mjs:125-132`, `:147`), so the
reflexive scrub drops `GH_TOKEN`/`GITLAB_TOKEN` and the ambient `lite` identity ADR-0034 L5 permits
dies **invisibly, inside a detached child**. The automatic path must be credential-identical to the
manual verb. A comment naming this must sit on the line, or a future reader "hardens" it.

### A3 — `${tmpdir()}/brain-lane-<uid>/brain-lane-ship-<host>-<date>.log`, append, no rotation

Not a repo-tree path: `.gitignore` is not a managed path and #414 is the open ticket for that hole.
One file per host per day, inside a private (`0o700`) directory scoped by uid (A1 step 2, cold
review C7); nothing rotates it and nothing reads it programmatically — the OS owns tmp cleanup.
Stated, not mitigated.

### A4 — The compiler gains a constant and a block; purity and drift both stay green

`export const SESSION_END_COMMAND = 'npm run brain:memory:session-end'` beside
`SESSION_START_COMMAND` (`settings-hooks.mjs:34`), plus a `SessionEnd` block shaped exactly like
`SessionStart` (`:56-65`): no `matcher`, no `timeout`, no `async`. The purity pin
(`settings-hooks.test.mjs:174`) forbids `spawn(`/`child_process`/fs strings *in the compiler* — a
command string that says `npm run` contains none of them, which is precisely why the spawning lives
in a launcher. `antigravity.drift.test.mjs:111-124` reads `git show HEAD:.gemini/settings.json`, so
both regenerated files must be **committed in the same commit**; red before that is the intended
signal. No compiler-map extension is needed: both backends write the whole blob
(`claude.mjs:64-66`, `antigravity.mjs:217-251`).

### A5 — **Measured gap**: the script key does not reach adopters unless listed (the proposal's risk row was wrong)

`brain:upgrade` copies `brain/scripts/**` (`core/managed-paths.mjs:41`) so the launcher *file*
travels, but consumer `package.json` scripts are injected **only** for keys in
`MANAGED_SCRIPT_KEYS` (`managed-paths.mjs:19-29`, consumed by `mergePackageJson`,
`lib/installer.mjs:1379-1402`). `memory:ship` is not in that list and never was. Therefore:
`brain:memory:session-end` MUST be appended to `MANAGED_SCRIPT_KEYS` (it satisfies the `brain:`
prefix pin), and `lib/managed-paths.test.mjs:134-142` — which asserts `length === 9` — must move to
`10` in the same commit. Without this, every adopter's session end prints an npm "missing script"
error to a surface Claude shows the user. Rejected: leaving it unlisted and accepting the stderr
noise; the whole point of an inert hook is that it is invisible.

### A6 — **Measured gap**: a `1.6.0` migration is inert until the release is cut, and that is acceptable

`migrateConfig` applies `m.version > schemaVersion && m.version <= targetVersion`
(`lib/installer.mjs:1477-1487`), and `targetVersion` is the installed `package.json` version
(`config/cli.mjs:52-54`), today `1.5.0`. So a `1.6.0` entry is skipped by every caller until the
next minor cut. Keeping `1.6.0` anyway:

| option | consequence |
|---|---|
| **`1.6.0` (kept)** | default not planted until the release cut; `brain:config get memory.lane.enabled` exits 1 "not set" until then (`config/cli.mjs:44`). Applies exactly once, to **every** consumer, when cut |
| `1.5.0` | applies immediately here — but `migrateConfig` stamps `schemaVersion = targetVersion` (`:1488-1490`), so every consumer already stamped `1.5.0` would **silently skip it forever**. Rejected |

Correctness does not depend on the entry: the launcher treats absent as false (A1 step 1), and
arming works the day the entry lands because `deriveKnownPaths` walks every migration's `defaults`
**without a version filter** (`config-verb.mjs:45`), so `set memory.lane.enabled true` is accepted
and written immediately. The migration is a discoverability affordance, not a dependency. Flipping
the flag edits a **tracked** file (`brain.config.json`) — the maintainer act produces a diff, and is
per-worktree until committed.

### A7 — The sweep is its own module, synchronous, with the timeout `day-start`'s `run()` cannot give it

`day-start.mjs`'s `run()` (`:62-68`) warns on non-zero and never exits — but passes no `timeout`, so
a hung `gh` call would hang the whole day start. `day-start-sweep.mjs` therefore uses its own
`spawnSync(..., { timeout: 60_000, encoding: 'utf8' })`, parses the single `--json` stdout line into
`{ pushed, pr, autoMerge, collected, ref }` (`memory/lane/ship.mjs:201-309`), forwards the child's
stderr evidence, and returns a structured outcome; `day-start.mjs` renders one line through `t()`
and warns on non-zero. This refines D4(a)'s "plain output" per `spec.md:70-84`; the extra ~10 lines
buy a timeout and a testable seam over a file that has no test today. `TOTAL = 6` is untouched — a
sub-step inside step 5, exactly like the AI-runtime block (`day-start.mjs:304-333`, and
`test/bootstrap-smoke/smoke.mjs`'s literal `6/6`).

### A8 — What this slice refuses to touch

`hooks/pre-push` (still `share`, `:70`), `credential-env.mjs`, `collect`/`plan`/`ship`/`mrCreate`/
`mrAutoMerge`, the record format, `memory-gate`, and `harness/backends/plain.mjs` — its
`MANUAL_FLOW_STEPS` list is pinned at nine and an automatic trigger is not a manual step. No ADR
amendment. Never default-on, on any tier.

## Data flow

```
CLI teardown ──SessionEnd──▶ npm run brain:memory:session-end
                                   │  loadBrainConfig() → memory.lane.enabled
                                   │  false ⇒ exit 0, silent, no spawn
                                   ▼ true
                          spawn(detached, stdio→tmp log).unref() ──▶ node cli.mjs ship --json
   launcher exits 0 in ms ◀────────┘                                   (survives teardown)

day:start step 5 ──▶ day-start-sweep.runLaneSweep({ _spawnSync })
                        │ flag false ⇒ { skipped: true }, nothing printed
                        ▼ true (sync, timeout 60 s)
                     node cli.mjs ship --json ──▶ { pushed, pr, autoMerge, collected }
                        └──▶ one t() line; non-zero ⇒ warn, never fatal
```

## Interfaces

```js
// memory/session-end-ship.mjs
export function shipOnSessionEnd({ _loadConfig, _spawn, _tmpdir, _now } = {})
  // → { spawned: boolean, logPath: string|null }; never throws, never non-zero

// memory/day-start-sweep.mjs
export function laneSweepEnabled(config)               // pure
export function runLaneSweep({ config, _spawnSync, _now } = {})
  // → { skipped, status, outcome: {pushed, pr, autoMerge, collected, ref}|null, unparsed }
```

## Testing strategy (STRICT TDD — tests first, in this order)

| # | file | pins |
|---|---|---|
| 1 | `memory/session-end-ship.test.mjs` NEW | flag false / key absent ⇒ `_spawn` never called, exit 0, zero output; flag true ⇒ one call, `detached:true`, `unref()` invoked, `stdio[1]===stdio[2]===fd`, log path shape, `env` still carries `GH_TOKEN` **and** `BRAIN_MEMORY_TOKEN`, neither value printed; `_spawn` throws ⇒ one stderr line, exit 0; child exit code never read |
| 2 | same file, one real run | the entrypoint executed as a process against this repo's real config (false) exits 0, prints nothing, creates no file |
| 3 | `harness/backends/settings-hooks.test.mjs` EXT | `SessionEnd[0].hooks[0].command === SESSION_END_COMMAND`; no `matcher`/`timeout`/`async`; three events; determinism + trailing newline; `:174` purity assertion unchanged and green |
| 4 | `harness/backends/antigravity.drift.test.mjs` | unchanged — green only after both files are regenerated **and committed** |
| 5 | `lib/managed-paths.test.mjs` EXT | `MANAGED_SCRIPT_KEYS.length === 10`, includes `brain:memory:session-end`, all `brain:`-prefixed; `mergePackageJson` delivers it into an empty consumer package.json |
| 6 | `memory/day-start-sweep.test.mjs` NEW | flag off ⇒ no invocation, `skipped:true`; flag on ⇒ one `spawnSync` with `--json` and a timeout; non-zero exit ⇒ reported, not thrown; unparseable stdout ⇒ `unparsed`, still non-fatal |
| 7 | `core/config-migrations.test.mjs` + `config/cli.test.mjs` EXT | the `1.6.0` entry is additive and never overwrites `true`; `memory.lane.enabled` is a known settable leaf **today** (version-independent `deriveKnownPaths`) |
| 8 | `hooks/pre-push.test.mjs` EXT | `ship` never appears in the mock-node call log — behavioural, via the existing synthetic-PATH harness (`:40-60`) |

## Forecast and delivery

Counted diff (excludes `**/*.test.mjs`, `openspec/**`; both settings files count):
settings-hooks ~14 · settings ×2 ~20 · `session-end-ship.mjs` ~85 · `day-start-sweep.mjs` ~55 ·
`day-start.mjs` ~12 · migrations ~12 · managed-paths ~2 · i18n ~8 · package.json ~1 = **~209**.
Reviewer-visible with tests ~560. **One PR** — a settings file whose hook points at a script that
does not exist yet is not a shippable slice. `delivery_strategy: ask-on-risk`; guard lines belong to
`sdd-tasks`.

## Live measurements `sdd-apply` must make (no Bash was used to write this)

1. `node -p "require('./package.json').version"` — if the release has been cut past `1.5.0`, revisit A6's version choice before writing the entry.
2. `node brain/scripts/config/cli.mjs get memory.lane.enabled` **before** any set — record the exit code and message (A6 predicts exit 1, "not set").
3. `node brain/scripts/config/cli.mjs set memory.lane.enabled true` on a scratch copy — record the `migrations applied first: …` list and the resulting `schemaVersion` (A6 predicts `1.6.0` absent from the list, `schemaVersion` → `1.5.0`), then revert.
4. Regenerate both settings files through the real backends and confirm `antigravity.drift.test.mjs` is red pre-commit and green post-commit.
5. `time node brain/scripts/memory/session-end-ship.mjs` with the flag false and true — must be far under the 1.5 s shared budget; record both numbers in `apply-progress`.
6. With the flag true, confirm the grandchild outlives the launcher (`ps` for the `cli.mjs ship` pid after the launcher returned) and that the tmpdir log exists and contains one JSON line.
7. `npm run brain:memory:session-end` from a **subdirectory** — confirm npm normalizes cwd to the package root (the reason D1 chose `npm run` for the settings string).
8. Full `npm test`, with `lib/managed-paths.test.mjs`, `settings-hooks.test.mjs` and the drift guard named individually in the evidence.

## Risks

| risk | mitigation |
|---|---|
| The 1.5 s shared budget on a cold or slow host | the launcher does one config read, one `openSync`, one `spawn`; killed late ⇒ the grandchild is already detached, killed early ⇒ nothing spawned and the morning sweep ships the same records |
| An orphaned grandchild if the machine sleeps mid-push | none; `ship` is idempotent — it pushes the same `memory/<host>-<date>` ref and reuses the day's PR (`memory/cli.mjs:507-509`) |
| Log growth: one file per host per day, no rotation | accepted and stated; `tmpdir()` is OS-cleaned and owes no ignore rule |
| Adopters receive an armed-looking, inert hook on the next `brain:upgrade` | the guard is the launcher's first act; A5 makes the script actually exist so the failure mode is silence, not npm noise |
| The migration lies dormant until the next release cut (A6) | arming still works (`deriveKnownPaths` is version-independent); the PR body must say the default lands with the cut |
| A detached failure is invisible | the tmpdir log plus the **synchronous** morning sweep, which reports the same outcome to a human |
| **Measured, cold review C1**: `buildDefaultConfig()` (`lib/brain-config.mjs:119-137`) is an EXCEPTION to A6's dormancy — it applies every migration unfiltered and stamps `schemaVersion` to the latest entry (`1.6.0`) on a config built FRESH on this codebase, regardless of `package.json` still reading `1.5.0`. Confirmed empirically: `test/bootstrap-smoke/smoke.mjs`'s fresh-consumer fixture reports `schemaVersion=1.6.0` today. Two consequences: (1) `release-debt.mjs` reports `severity: 'migration'` from the moment this entry merges, not from the `1.6.0` cut; (2) a consumer whose config was built on this exact codebase cannot `brain:upgrade` below `1.6.0` without `--allow-downgrade` (its stamped `schemaVersion` already reads ahead of its own `package.json`). | **Not mitigated in this slice — a maintainer act.** The real remedy is cutting `1.6.0` promptly; the entry's own description now names both consequences so the gap is discoverable without re-deriving it. `config-migrations.test.mjs` pins the dormancy claim against a real `migrateConfig()` caller (`targetVersion: '1.5.0'` ⇒ `memory` absent) alongside a test showing the unfiltered-walk shape plants it — the two pins together are the proof the description's EXCEPTION clause is accurate, not just asserted. |
| **Measured, cold review C7**: `O_NOFOLLOW` (C2) only refuses a pre-existing SYMLINK at the log path — it does nothing against a pre-existing ORDINARY file, and `open`'s `mode` argument (`0o600`) only applies when the call itself creates the file. A local user who pre-creates `${tmpdir()}/brain-lane-ship-<host>-<date>.log` as a regular `0o666` file before the launcher ever runs defeated both defenses at once: the open succeeded, the mode stayed world-readable, and the detached `ship` child's stdout/stderr (which can echo `oauth2:TOKEN@host` on a git failure) landed in an attacker-readable file. Reproduced against the shipped code by the cold reviewer, driven through the real `shipOnSessionEnd` with a fake `_spawn` writing through the inherited fd. | **Mitigated**: two independent checks, both required. (1) The log now lives inside `${tmpdir()}/brain-lane-<uid>/`, an owner-only (`0o700`) directory `ensurePrivateDir` creates if absent and — whether created or pre-existing — verifies is a real directory, not a symlink, owned by `uid`, with no group/other permission bit. (2) The opened log fd is `fstatSync`-verified the same way (regular file, owned by `uid`, no group/other bits, `nlink === 1`) before anything is written to it — the check that still catches a pre-created file even if (1) were somehow bypassed. `session-end-ship.test.mjs` pins all five shapes: the reviewer's exact attack (pre-created `0o666` file inside an otherwise-valid private dir, content unchanged after refusal), a `0o755` pre-existing private dir, a private dir owned by a different uid (simulated via the `_uid` seam), the symlink case from C2 (relocated inside the private dir), and the happy path (fresh `0o700` dir, fresh `0o600` log, spawn reached). |

## Open questions

- [ ] None blocking. One judgment for the reviewer: A6 keeps `1.6.0` and accepts dormancy rather than reusing `1.5.0` and silently skipping already-stamped consumers.
