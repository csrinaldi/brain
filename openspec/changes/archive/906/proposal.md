---
status: proposed
issue: 906
epic: 864
---

# Proposal — #906 the lane gets its triggers: a `SessionEnd` hook that detaches, a `day:start` sweep that reports

Parent: #864 (memory 2.0), task 3.1b/3.1c. Owns ADR-0034 **L5**'s first two callers — "the verb
`brain:memory:ship`, invoked by (1) the session-end hook, (2) `day:start`'s sweep for sessions that
ended badly" (`adr-0034-memory-travels-on-its-own-lane.md:134-139`) — and nothing else. Twice
deferred: **#888 D4** (a lane PR was un-mergeable), **#889 D6** (blast radius: one shared settings
compiler, two platforms, a byte-equality drift guard).

## What is wrong today

`npm run memory:ship` works and nothing calls it. Records sit in each worktree's `.memory/records/`
until a human remembers the verb, so the latency ADR-0034 L9 ratifies — **p50 ≤ 1 h, p90 ≤ 24 h**
against the measured baseline **21.6 h / 399.7 h** — is unreachable by construction: an automatic
trigger is the only thing that makes the p50 target a property of the system rather than of the
maintainer's memory.

**Both deferral reasons are now answered by measurement, not by argument** (docs read 2026-09-10):

| unknown that caused the deferral | measured |
|---|---|
| Does Claude Code have a `SessionEnd` event? | Yes. `{session_id, transcript_path, cwd, hook_event_name, reason}` on stdin; cannot block; stderr shown to the user; `reason ∈ clear\|resume\|logout\|prompt_input_exit\|other` |
| Can a hook outlive the session? | Only detached. `async: true` hooks are **killed at teardown** in headless mode; the docs say verbatim: "start a fully detached process from it" |
| What is the time budget? | **1.5 s shared across all `SessionEnd` hooks**, raisable per hook via `timeout` (≤ 60 s) |
| Does Gemini CLI have the same event? | Yes — same name, `{…, timestamp, reason ∈ exit\|clear\|logout\|prompt_input_exit\|other}`, no decision control, and "the CLI will not wait for this hook to complete" |

So **two-platform parity is achievable with one command string** — #889 D6's "unmeasured
two-platform claim" is now a measured one, which is the whole reason this slice exists separately.

## Decisions

### D1 — What the settings file invokes, and what that thing does

| option | what it means | cost |
|---|---|---|
| **(a) an npm script → a launcher entrypoint `brain/scripts/memory/session-end-ship.mjs`** | the settings string is `npm run brain:memory:session-end`, exactly the shape `SESSION_START_COMMAND` already ships to adopters on both platforms (`settings-hooks.mjs:34`) | one indirection; npm's own boot (~0.3 s) inside a 1.5 s shared budget |
| (b) `node ./brain/scripts/memory/session-end-ship.mjs` | ~0.3 s faster | a repo-root-relative path in a compiled settings file, on hosts where the hook's `cwd` is a linked worktree or a consumer repo. The one precedent deliberately avoids this |
| (c) an inline `node -e "…"`, like the `--no-verify` guard | no new file | the guard is inline because it is 1 statement and must not be importable. A detaching spawner is neither, and `settings-hooks.test.mjs:174` **forbids** `spawn(`/`child_process` from ever appearing in the compiler |

**Recommendation: (a).** The launcher is a thin entrypoint beside `memory/cli.mjs` — **not** under
`brain/scripts/hooks/`, which is the *git*-hook directory with its own shell contract
(`hooks.stream-discipline.test.mjs:158` scans it and skips `.mjs` precisely because nothing there is
one).

What the launcher does, in order, and the reason for each:

1. **Reads `memory.lane.enabled`** via `loadBrainConfig()`. False (the default) ⇒ **exit 0, silent,
   no spawn.** This is what makes emit-always safe (D2).
2. **Spawns fully detached**: `spawn(process.execPath, ['brain/scripts/memory/cli.mjs','ship'],
   { detached: true, stdio: ['ignore', fd, fd], cwd: repoRoot }).unref()`. Detached, not
   `async: true` — the docs say an async hook is killed at teardown and that surviving teardown
   requires a fully detached process. The launcher then **exits 0 in milliseconds**, always.
3. **Never propagates the ship's exit code.** `ship` exits 1 on `diverged`/`raced`/`badHost`/
   `pushFailed`/`prLookupFailed`/`prCreateFailed` (`memory/cli.mjs:518-532`) — a session must not
   end on a red line because a push raced. The launcher cannot see that code anyway; that is the
   point, and the log below is the compensating control.
4. **Logs where the repo is not.** The detached child's streams are redirected (append) to
   `${os.tmpdir()}/brain-lane-ship-<host>-<date>.log`. **Not `.brain/…` in the tree**: `.gitignore`
   is not a managed path, brain has no channel to deliver ignore rules to consumers, and #414 is
   the open ticket for that hole (`.gitignore:110-135`). A repo-tree log would be untracked noise in
   every consumer and one `git add -A` from being committed. `tmpdir()` costs nothing and owes
   nobody an ignore rule.
5. **Prints at most one stderr line, and only when enabled** ("lane: shipping in the background,
   log: <path>"). Claude shows `SessionEnd` stderr to the user; a disabled hook must be invisible.

**Environment — inherit unchanged.**

| option | cost |
|---|---|
| **(a) inherit the parent env as-is** | the automatic path is **credential-identical to the manual one**: `npm run memory:ship` typed by hand inherits the shell, and a trigger with a different credential surface creates the "works by hand, fails in the hook" class no test can reach. #888 already did the scoping that matters — `MEMORY_TOKEN_ENV` is a **default** member of `credentialEnvNames()` (`credential-env.mjs:147`), so every *other* spawn scrubs it; `ship` is the one process that keeps it |
| (b) `withoutCredentials()` + re-add `BRAIN_MEMORY_TOKEN` | **breaks the lite path**: that set also drops `FORGE_TOKEN_ENV` (`credential-env.mjs:125-132`), so a host whose ambient identity is an exported `GH_TOKEN` would fail auth — invisibly, in a detached child. ADR-0034 L5 explicitly permits ambient at `lite` |
| (c) scrub only `BRAIN_REVIEWER_TOKEN` + `tokenEnvVar()` | least privilege for ~2 lines and one test; the reviewer token is genuinely not ship's business | a second, hand-maintained notion of "what ship needs" |

**Recommendation: (a)**, with (c) named as the cheap upgrade if a reviewer wants it. Either way the
launcher must not use the default scrub set — that is the measured trap.

**No `timeout` field, and correctness does not depend on one.** Emitting `timeout: 5` would put a
Claude-documented field into Gemini's byte-identical settings on an unverified schema claim — the
exact class #889 D6 deferred this slice for. The launcher's whole job fits well inside 1.5 s
(node boot + one config read + one spawn), and if a cold host ever exceeds it the launcher is killed
**after** the grandchild is already detached in its own process group, or before it spawned at all —
in which case D4's sweep ships the same records the next morning. A benign, self-healing failure is
better than an unmeasured field.

### D2 — Emit always, guard at runtime

| option | what it means | cost |
|---|---|---|
| **(a) emit always; the launcher exits 0 when the flag is false** | `compileSettingsHooksJson()` stays argument-free and fs-free — its own stated constraint (`settings-hooks.mjs:11-19`). Toggling the flag never touches a settings file, so the drift guard is byte-stable in both flag states | the string reaches every adopter's `.claude/` **and** `.gemini/` settings on the next `brain:upgrade` (`brain-upgrade.mjs:257-265`), armed or not; one fast process spawn per session end while disabled |
| (b) emit only when the flag is true | narrower radius until opted in | the compiler must read config ⇒ impure, repo-relative, and **arming the flag becomes a regenerate-and-commit** — two acts where the ticket promises one |

**Recommendation: (a).** The ticket's own words are "inert until the maintainer turns it on", and
(a) is the only option where "inert" and "one switch" are both true.

### D3 — The flag: `memory.lane.enabled`, default `false`, and who may flip it

One append-only migration entry, versioned **`1.6.0`** (past the current `package.json` `1.5.0`,
which `config/cli.mjs:54` reads rather than a literal), in the shape the last four entries use
(`config-migrations.mjs:137-163`): `defaults: { memory: { lane: { enabled: false } } }`. This repo
has no `memory` key today, so the entry is purely additive and overwrites no consumer value.
`brain:config` is already the migration-aware reader and the **only** writer (#823), so
`npm run brain:config -- get memory.lane.enabled` is the report surface for free — **no new
reporting code is owed.**

**Precondition on flipping it, stated as a maintainer act rather than as code**: #889 D7.2 — a real
lane PR opened by `memory:ship`, green on every required context, merged, and `brain:audit` printing
`[LANE]` for it. `issue-889-lane-governance/apply-progress.md:139` still shows the D7 exit sequence
open. **Landing this change does not require that evidence; arming the flag does.**

### D4 — `day:start`'s sweep: a sub-step of step 5, synchronous, loud, never fatal

**"Sessions that ended badly" needs no detector, and saying so plainly is the decision.** `collect`
already materializes one commit from **every worktree's** uncommitted `.memory/records/` candidates
(`memory/cli.mjs:306-317`). A session whose hook never ran leaves its records exactly where a
session that ended cleanly leaves them — so the sweep *is* a ship run, and any marker file, age scan
or session-start sentinel would be inventing a signal to detect a state that is already visible.

| option | cost |
|---|---|
| **(a) synchronous `node brain/scripts/memory/cli.mjs ship`, plain output, inside step 5 ("Team memory")** | a few seconds of push + PR call in a command that already does `git fetch`/merge and a tracker board; `run()` (`day-start.mjs:62-68`) already **warns** on non-zero and never exits, so "never fails the day start" is inherited, not written |
| (b) detached, like the hook | the sweep's whole value is that it is the **visible** trigger; a silent day:start sweep is a second invisible path |
| (c) `--json` + parse + render | `ship` already prints one translated outcome line and its evidence on stderr (`memory/cli.mjs:494-516`). `--json` is for machine callers; parsing it here would re-render what exists |

**Recommendation: (a)** — plain, no `--json`, gated on the same `memory.lane.enabled` flag, printed
as a sub-step inside step 5. **No seventh `sep()`**: `TOTAL = 6` is asserted literally by
`test/bootstrap-smoke/smoke.mjs`, and `day-start.mjs:304-333` documents that a seventh step turned
it red on PR #594.

### D5 — Two-platform parity: one string, no `matcher`, both files regenerated in the same commit

Both backends write the **whole compiled blob** (`claude.mjs:58-70`, `antigravity.mjs:217-251`), so
a new `SessionEnd` key reaches `.gemini/settings.json` with **no compiler-map extension** — the
shared compiler is the map. Nothing platform-specific is needed, and nothing platform-specific is
allowed: a branch inside the compiler is the duplication #315 exists to prevent.

**No `matcher`.** The two `reason` vocabularies diverge (`resume` on Claude, `exit` on Gemini), so
any matcher string would mean different things in two byte-identical files. Omitting it also removes
the temptation to exclude `clear`: a mid-work `/clear` that ships is harmless, because `ship` pushes
to the same `memory/<host>-<date>` ref and **reuses the day's existing PR** (`memory/cli.mjs:507-509`
reports the existing number) — more ships per day is the L9 target, not a cost.

`.claude/settings.json` and `.gemini/settings.json` MUST be regenerated and committed **in the same
commit** as the compiler change: `antigravity.drift.test.mjs:111-124` asserts byte-equality against
`git show HEAD:…`, and that red is the intended signal, not a surprise.

### D6 — Safety, and what this slice refuses to touch

- **Never from `pre-push`.** `hooks/pre-push:70` calls `share`, not `ship`, and ADR-0034 L5's
  "**Never** by a feature branch's `pre-push`" stays true by construction — pinned by a regression
  test, not by grep.
- **Never `--force`**, never a new VCS verb, **no change to `collect`/`plan`/`ship`/`mrCreate`/
  `mrAutoMerge`**, no change to `credential-env.mjs` (#888 already scoped the token), no record
  format change, no `memory-gate` change, no #890 retirement.
- **Never enabled by default**, on any tier, for any adopter.
- **No ADR is amended**: L5 already ratifies both triggers; this is its implementation.
- **Acceptance is the first *automatic* lane PR**, and it is a maintainer act with the flag on, not
  a test. `memory:audit`'s p50/p90 after enabling is #864 task 6.1's number, not this slice's claim.

### D7 — STRICT TDD, forecast, delivery

| # | file | what it pins |
|---|---|---|
| 1 | `harness/backends/settings-hooks.test.mjs` (extend) | `hooks.SessionEnd[0].hooks[0].command` is the launcher string; **no `matcher`, no `timeout`, no `async`**; determinism + trailing newline still hold; the existing "cannot run anything" assertion (`:174`) still passes |
| 2 | `harness/backends/antigravity.drift.test.mjs` (unchanged, must go green) | both committed settings files equal the compiler byte-for-byte after regeneration |
| 3 | `memory/session-end-ship.test.mjs` (new) | with an injected config `{enabled:false}` ⇒ **spawn seam never called**, exit 0, no output; `{enabled:true}` ⇒ seam called once with `detached:true`, `unref()` invoked, `stdio` redirected to the tmpdir log, `env` **containing** `GH_TOKEN` and `BRAIN_MEMORY_TOKEN` (the D1(b) trap, asserted); a throwing seam still exits 0; missing/absent `memory.lane` key ⇒ treated as false |
| 4 | `memory/session-end-ship.test.mjs` — executed once for real | the entrypoint spawned as a process against this repo's real config (flag `false`) exits 0, prints nothing, and writes no file |
| 5 | `core/config-migrations.test.mjs` + `brain-config.test.mjs` (extend) | the `1.6.0` entry is additive, never overwrites a set value, and `get memory.lane.enabled` reports it |
| 6 | `day-start` test coverage (new file — `day-start.mjs` has none) over an extracted pure step | flag off ⇒ no ship invocation; flag on ⇒ one invocation, and a non-zero exit warns without failing; `TOTAL` stays 6 |
| 7 | `hooks/pre-push.test.mjs` (extend) | `pre-push` still never invokes `ship` — behavioural, not a grep |

**Forecast** (counted diff excludes `**/*.test.mjs` and `openspec/changes/**`; the two settings
files are **not** in `governance.ignoreList` and therefore count):

| file | counted |
|---|---|
| `harness/backends/settings-hooks.mjs` | ~24 |
| `.claude/settings.json` + `.gemini/settings.json` (regenerated) | ~24 |
| `memory/session-end-ship.mjs` (new) | ~85 |
| `core/config-migrations.mjs` | ~12 |
| `day-start.mjs` + extracted step | ~24 |
| `i18n` strings (en + es) | ~10 |
| `package.json` script | ~1 |
| **total** | **~180** |

**One PR.** ~180 counted against the 400 budget, ~520 reviewer-visible with tests; the surface is
one compiler key, one launcher, one migration and one day:start sub-step — splitting it would
produce a settings file whose hook points at a script that does not exist yet. `delivery_strategy:
ask-on-risk`; the guard lines belong to `sdd-tasks`' forecast, and this is its input.

## Capabilities (contract with `sdd-spec`)

**New: none. Modified: none.** `openspec/specs/**` is empty in this repo by convention; the
normative surface is ADR-0034 L5/L9, which this slice implements without amending.

## Affected areas

| path | impact | what changes |
|---|---|---|
| `brain/scripts/harness/backends/settings-hooks.mjs` | Modified | `SESSION_END_COMMAND` + the `SessionEnd` block |
| `.claude/settings.json`, `.gemini/settings.json` | Modified | regenerated, same commit (drift guard) |
| `brain/scripts/memory/session-end-ship.mjs` | New | the flag guard + the detaching launcher |
| `brain/core/config-migrations.mjs` | Modified | one `1.6.0` entry, `memory.lane.enabled: false` |
| `brain/scripts/day-start.mjs` | Modified | the sweep sub-step inside step 5 |
| `brain/scripts/i18n/**`, `package.json` | Modified | one message pair, one script name |
| `brain.config.json` (this repo) + every adopter's | Maintainer act | flipping the flag — **not** in the diff |

## Risks

| risk | likelihood | mitigation |
|---|---|---|
| The hook string reaches every adopter's two settings files on upgrade, before anyone opts in | **High (certain)** | D2: the launcher's first act is the flag read; disabled ⇒ exit 0, silent, no spawn. Test 3 pins "seam never called" |
| `npm run brain:memory:session-end` is missing on an adopter host ⇒ npm prints to stderr, which Claude shows the user | Med | the identical exposure already exists for `SESSION_START_COMMAND`; the launcher is delivered by the same `brain:upgrade` path. `sdd-design` must confirm the script name reaches consumer `package.json` |
| The 1.5 s shared budget is exceeded on a cold host | Med | the grandchild is already detached, or was never spawned — either way exit 0, and D4's sweep ships the same records next morning. No `timeout` field is emitted to buy this |
| `CLAUDE_CODE_SUBPROCESS_ENV_SCRUB=1` strips `BRAIN_MEMORY_TOKEN` from the hook's env | Low | `ship` falls through to the ambient identity (`memory/cli.mjs:477-482`) — the `lite` path L5 permits. A set-but-blank token is still refused loudly |
| A detached failure (`diverged`/`pushFailed`) is invisible | Med | the tmpdir log (D1.4) plus D4's **synchronous** sweep, which reports the same outcome to a human the next morning |
| Gemini's `SessionEnd` payload/semantics differ in a way the launcher depends on | Low | it depends on none of it: stdin is never read, `reason` is never matched, and the CLI does not wait for the hook by its own documentation |
| `brain:config set` walks pending migrations and rewrites this repo's `schemaVersion` `0.3.0` → `1.6.0` in one flip | Med | additive-only by construction; `sdd-design` verifies the walk on this repo's real config before the maintainer flips the flag |
| A repo-tree log file becomes untracked noise in every consumer | Low | avoided by construction: the log lives in `tmpdir()` (#414's hole is not widened) |

## Rollback

Revert the PR. The compiler and both regenerated settings files revert **together**, so the drift
guard stays green in both directions; adopters lose the hook at their next `brain:upgrade`. The
migration entry is append-only: a reverted entry leaves `memory.lane.enabled` present in configs that
already ran it, which is inert — nothing reads it once the launcher is gone. If the flag was already
armed, disarm **first** (`npm run brain:config -- set memory.lane.enabled false`), because that stops
the trigger in one act without waiting for anyone to upgrade. No data migration; no merged lane
commit needs undoing.

## Success criteria

- [ ] `npm test` green, including the drift guard against both regenerated settings files.
- [ ] `compileSettingsHooksJson()` emits three events, takes no arguments, is deterministic, and
      still contains no execution API.
- [ ] With `memory.lane.enabled: false` the launcher exits 0, spawns nothing and prints nothing —
      asserted both with an injected seam and by executing the real entrypoint.
- [ ] With the flag true, the spawn is `detached`, `unref()`ed, logged to `tmpdir()`, and its env
      still carries the ambient forge credential.
- [ ] `npm run brain:config -- get memory.lane.enabled` reports the flag; the migration overwrites
      no existing value.
- [ ] `day:start` still prints `6/6`; the sweep reports one outcome line and a failing ship warns
      without failing the day start.
- [ ] `pre-push` still never invokes `ship`.
- [ ] **After** #889 D7.2's manual lane PR has merged: the maintainer flips the flag once, and the
      first **automatic** lane PR is recorded with its number, its green contexts and its merge SHA.

## Proposal question round

Each has a working recommendation above; none blocks `sdd-spec` / `sdd-design`.

1. **D1 chooses inherit-the-env over the reflex `withoutCredentials()`.** The scrub set drops
   `GH_TOKEN` too, so scrubbing would break the ambient `lite` identity ADR-0034 L5 permits —
   invisibly, in a detached child. Inherit unchanged (identical to the manual verb), or spend two
   lines on option (c) and scrub only the reviewer token?
2. **D1 emits no `timeout`,** trading a possible skipped ship on a cold host for a smaller
   two-platform claim. Is that the right side of the trade, or is `timeout: 5` worth the unverified
   Gemini schema field?
3. **D2 puts the string in every adopter's settings on the next upgrade, armed or not.** That is the
   blast radius #889 D6 deferred this slice for, now paid deliberately in exchange for one switch
   instead of a regenerate-and-commit. Accept, or emit only when enabled?
4. **D4 declines to build a "session ended badly" detector,** because the collector already sweeps
   every worktree and a marker would detect a state that is already visible. Is "the sweep is simply
   a ship run" the right reading, or is a real end-of-session marker wanted for its own sake?
5. **D3 makes flipping the flag a maintainer act gated on #889 D7.2,** which `apply-progress.md:139`
   still shows open. Land the code now and arm later, or hold the whole slice until the manual lane
   PR is recorded?
