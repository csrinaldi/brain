---
status: draft
issue: 1125
---

# Design — `claude` becomes the default platform

## Every place that picks a platform, on `origin/main` at `826cbbf0`

Found with `rg -n "antigravity" brain/scripts`, `rg -n "AGENT_PLATFORM|resolvePlatform|SDD_HARNESS"
brain/scripts`, and a search of `README.md`, `docs/**`, `CHANGELOG.md` and the config
migrations. Each hit was read.

### Default sites: the code picks a platform when none is stated

| # | Site | Before | After |
|---|---|---|---|
| D1 | `brain/scripts/harness/platform.mjs:59-69` `resolvePlatform` | `return 'antigravity'`, with an inline legacy allow-list `['antigravity','claude','plain']` | `return DEFAULT_PLATFORM` (`'claude'`); the allow-list is the exported `AGENT_PLATFORMS` |
| D2 | `brain/scripts/bootstrap.sh:327-329` (§6) | `[ -n "$AGENT_PLATFORM" ] \|\| AGENT_PLATFORM="antigravity"`; reads `.env` only | Same precedence as D1: process env > `.env` > legacy `SDD_HARNESS` (platform members only) > `claude` |

### Readers of D1: they inherit the new default

| Site | How it resolves |
|---|---|
| `harness/cli.mjs:222` (entry point that `bootstrap.sh` runs) | `resolvePlatform({ env, envVars })`, re-exported from `platform.mjs` |
| `harness/backends/agent-runtime.mjs:348` (`day-start` §4b and the runtime report) | `resolvePlatform({ env, envVars, config })` |
| `day-start.mjs:~313` | through `agentRuntimeReport` |

### Not default sites: each names `antigravity` explicitly, and each was left alone

| Site | Why it is not a default |
|---|---|
| `brain-upgrade.mjs:673-703` | Always regenerates `AGENTS.md` with the antigravity compiler, whatever the platform is. This is an explicit choice of generator, not a platform default. Its hint `AGENT_PLATFORM=antigravity npm run brain:env:init` now runs antigravity **for that invocation only** (see D2 and REQ-1125-6) |
| `harness/backends/antigravity.mjs:63` `REGENERATE_HINT` | Explicit: `AGENT_PLATFORM=antigravity` |
| `brain-promote.mjs:49`, `__fixtures__/promote-repo.mjs:19` | Import the AGENTS.md compiler directly |
| `roles/first-party/project-role.mjs:24` `PROJECTION_PLATFORMS` | Projection targets, both platforms |
| `lib/init.mjs:133` `--help` | Lists `claude\|antigravity\|plain` and names no default; `claude` already comes first |
| `hooks/commit-msg:70`, `hooks/pre-receive:88` | Example AI-agent vocabulary |
| `harness/backends/gemini.mjs:22`, `producer-forge-reach.mjs:19,28`, `vcs/diff-size-count.mjs:26`, `harness/cli.mjs:261`, `settings-hooks.mjs:5`, `claude.mjs:39` | Comments or paths |
| `README.md`, `docs/adoption.md`, `docs/KNOWN-LIMITATIONS.md`, `lib/config-migrations.mjs` | None of them states a platform default. `README.md` has no axis table today. #1126 rewrites the adoption docs |

## Decisions

### 1. One declaration of the default in JS, and a shell mirror held to it by a test

`platform.mjs` exports `DEFAULT_PLATFORM` and `AGENT_PLATFORMS`, following the `SDD_ENGINES`
pattern that already lives there. `bootstrap.sh` cannot import them, so it keeps its own `case`
and default. `bootstrap.default-platform.test.mjs` lifts §6 verbatim and runs it over a 90-case
table of every combination of process-env `AGENT_PLATFORM`, process-env `SDD_HARNESS`, `.env`
`AGENT_PLATFORM` and `.env` `SDD_HARNESS`. It fails on any case where the shell and
`resolvePlatform` disagree.

**Rejected: have `bootstrap.sh` call `node … platform.mjs` to resolve.** That would be one
resolver, but building it is #1114's job. Doing it half here would add a CLI surface to a leaf
module whose whole purpose is to import nothing that closes a cycle (#682). It would also still
leave config unread, because `harness/cli.mjs` does not load config either.

**Rejected: flip only the literal in `bootstrap.sh`.** The old shell ignored the process env and
the legacy key, and agreed with the resolver only because both defaulted to `antigravity`. With
the default flipped, each of those coincidences becomes a wrong answer:

- `AGENT_PLATFORM=antigravity npm run brain:env:init` would produce `claude`.
- A legacy `.env` `SDD_HARNESS=antigravity` would be overwritten by `claude`.

A stated `antigravity` must still resolve (REQ-1125-3), so the precedence had to move with the
default.

### 2. The process env is per-invocation; `.env` is what the repo states

`resolvePlatform` lets the process env beat `.env` without writing anything. `bootstrap.sh`
now does the same:

- It writes `.env` only when `.env` states no `AGENT_PLATFORM`.
- It writes the repo's own answer: the `.env` legacy value or `claude`.
- It never writes a process-env `AGENT_PLATFORM`.

This matters because of a message a fresh consumer is shown. `brain:upgrade` prints
`AGENT_PLATFORM=antigravity npm run brain:env:init`, measured on the packed-tarball consumer
below. If bootstrap persisted that value, anyone who followed the message would be moved off
the `claude` default for good.

A side effect: a second `env:init` no longer rewrites the `AGENT_PLATFORM` line. That line was
the key `test/bootstrap-smoke/README.md` recorded as moving from line 1 to line 3. The smoke
still compares `.env` as a set, so nothing depends on that.

### 3. Tests that pinned the old default are updated, not deleted

| Test | Change | Reason |
|---|---|---|
| `cli.test.mjs` "defaults to antigravity when absent" | Now "defaults to claude…" | The ruling |
| `cli.test.mjs` "falls back to legacy SDD_HARNESS" | Stated value `claude` → `antigravity` | With `claude` as the default, a resolver that ignored `SDD_HARNESS` would still pass |
| `agent-runtime.test.mjs` `platformEnvVars` and `platformConfig` | Stated value `claude` → `antigravity` | Same vacuity |
| `test/bootstrap-smoke/smoke.mjs` post-condition `AGENTS.md (harness init ran)` | Now `.claude/settings.json`, which is deleted from the fixture first, plus `.env` stating `AGENT_PLATFORM=claude` | `AGENTS.md` is antigravity's emit. The fixture copies a tracked `.claude/settings.json`, so it has to be deleted first, or the check passes without the init ever running (the F2 shape) |
| `test-spawn-hygiene.test.mjs` | Two allowlist rows for the new test's `bash` spawns | `no-vcs-capability`: scratch dirs, no git |

## ADR-0036 evidence: a fresh consumer built from the packed tarball

Script: `scratchpad/packcheck.sh` (not committed). It ran against this tree's working copy, and
the results were reproduced on the final commit (see tasks.md T11).

1. `npm pack` this tree → `logikas-brain-1.7.0.tgz`.
2. For each consumer: `git init`, `npm init -y`, then `npm install <tgz>`.
3. Adopt with `node node_modules/@logikas/brain/brain/scripts/brain-upgrade.mjs --no-install`.
   This deliberately does **not** use `npx brain init`. That command re-installs from
   `git+https://github.com/csrinaldi/brain.git#v1.7.0`: `resolveInstallSpec` sends `file`
   provenance down the git route. That replaces the packed tarball with the published tag.
   The first run measured exactly that, and reported `antigravity` from the tag's code.
4. `npm run brain:env:init`, with `HOME` redirected and `AGENT_PLATFORM`, `SDD_HARNESS`,
   `SDD_ENGINE` and the forge tokens unset, and no TTY.

| Consumer | `.env` after `env:init` | harness line | installed `resolvePlatform` (empty `.env`) |
|---|---|---|---|
| A, nothing stated | `AGENT_PLATFORM=claude` | `gentle-ai (claude)` | `claude` |
| B, `.env` states `antigravity` | `AGENT_PLATFORM=antigravity` (unchanged) | `gentle-ai (antigravity)` | `claude` (reads B's `.env`: `antigravity`) |
| C, own `.claude/settings.json` | `AGENT_PLATFORM=claude` | `gentle-ai (claude)` | `claude` |

The source-tree smoke (`node test/bootstrap-smoke/smoke.mjs`) also passes: env:init →
session:start → day:start, cold and idempotent. Its new `.claude/settings.json` and `.env`
post-conditions are green.

## Known gaps: measured and left to their owners

1. **`env:init` clobbers `.claude/settings.json` (consumer C).** After `brain:upgrade`, C's own
   `permissions.allow: ["Bash(npm test)"]` was still there: it was merged, and the adopt commit
   has it. After `brain:env:init` it was gone. `claude.mjs#init` writes
   `compileSettingsHooksJson()` over the file without merging, and `antigravity.mjs#init` does
   the same to `.gemini/settings.json`. This predates #1125, but the new default puts every
   fresh consumer on this path. **It needs its own ticket and a ruling before this ships.** It
   is out of this change's scope.
2. **The `env:init` path ignores `brain.config.json`'s `harness` section.** `harness/cli.mjs`
   calls `resolvePlatform({ env, envVars })` with no config, and `bootstrap.sh` never reads the
   file. A `.env` value outranks config wherever config is read. So a platform stated only in
   config is shadowed by the `.env` value `env:init` writes. This was true before this change
   for `claude`, and it is now true for `antigravity`. It is #1114's gap (selectors declared in
   the schema).
3. **`npx brain init` cannot adopt a packed tarball.** See step 3 above. The #1136 publish
   gate has to account for this, or it will test the previous tag and not the candidate.
4. **Empty-string edge.** `resolvePlatform` treats `AGENT_PLATFORM=''` in the process env as
   "stated, empty" (`??` does not skip `''`) and then falls through to the legacy key, skipping
   `.env`. The shell's `${AGENT_PLATFORM:-…}` treats it as unset and reads `.env`. The parity
   table does not include empty strings. `bootstrap.sh` always exports a non-empty value.
   Recorded for #1114.
