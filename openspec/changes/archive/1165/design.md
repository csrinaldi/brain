---
status: draft
issue: 1165
---

# Design

## Resolver sites found

| Site | Before | After |
|---|---|---|
| `memory/cli.mjs` | `process.env ?? .env ?? 'engram'`, plus `stated` flag for #641 | `resolveMemoryBackend()`; refusal via `requireDeclaredBackend()` |
| `bootstrap.sh` §7 | `.env` only (ignored process env), default `engram` on any answer | `node memory/lib/backend-resolve.mjs` |
| `harness/cli.mjs` `resolveMemory` | exported, dead (audit: `brain-v2-merge-audit.md`), wrong shape | deleted |

Everything else that mentions `MEMORY_BACKEND` is prose, i18n text, or tests.

## The resolver

`lib/axis-selector.mjs` is generic (key, config path, allowed set) and pure over data;
`memory/lib/backend-resolve.mjs` binds it to memory and owns the closed set
`engram | plainfiles` and the disk reads. Shell env vs `.env` reuses `env-read.mjs#resolveEnv`
(shell wins, ruled in #316). #1114 can adopt `resolveAxisSelector` for the other two axes.

## Decisions

**D1 — undeclared refuses; there is no default.** The contract wants it, and a default is the
defect. Cost: an existing consumer with neither `.env` nor config now sees a refusal where it used
to get engram silently. That consumer was one machine away from this bug; the refusal names the
one-line fix. The #641 substitution is re-scoped, not removed: a backend declared only in tracked config (the team's)
whose binary is absent runs `pull` records-only and says hydration is deferred (D10); an env/.env
selector is still never overridden.

**D2 — `memory.backend` default is `''`, migration 1.9.1.** Keeps `''` = undeclared (the
`vcs.provider` convention) and makes the path settable (`deriveKnownPaths` reads migration
defaults). 1.9.1 is the smallest version above the shipped 1.9.0, so it applies on whichever of
1.9.1 or 1.10.0 is cut. A consumer's stamped `schemaVersion` `1.9.0` migrates cleanly. NOT in
`NEW_CONSUMER_DEFAULTS`: a new consumer's value is a human choice, made in the prompt.

**D3 — `env:init` writes tracked config, and does NOT also write `.env`.** Writing both would
recreate the drift: a stale per-machine line silently beating the team's value. `.env` stays what
it always was, a per-machine override. The write goes through `brain:config set` (the one config
verb, atomic).

**D4 — the prompt is the exception to "refuse".** `env:init` is where the declaration is created,
so on a TTY it asks (Enter accepts the default the prompt itself names — a human's answer, not a
guess). Without a TTY it guesses nothing: skips memory setup, records a `MISSING_OPTIONAL` with
the fix, exits 0 (it is a usable environment; the cause is reported, as #1127 requires).

**D5 — existing `.env`-only consumers are informed, not migrated.** No prompt to move the value:
that is a tracked-file edit the operator should make deliberately, and `env:init` also runs in CI
and agent sessions. It prints `npm run brain:config -- set memory.backend <v>`. If `.env` and
config differ, `.env` wins on that machine and `env:init` says so.

**D6 — invalid values are refused, not coerced** (`plainfile` is a typo, not plainfiles).

**D7 — the refusal has its own exit codes (3 undeclared, 4 invalid).** Hooks, session-start and
ticket-start tell "nothing was tried" from a real failure by code, never by localized text. Each
prints one line naming the cause and fix and stays non-blocking. `save` is the exception to the
refusal: it is record-first, so it degrades to plainfiles and says hydration is deferred.

**D8 — self-hosting.** brain's own `brain.config.json` declares `memory.backend: engram`, so
per-issue worktrees (no `.env`) work. The value was assumed: `.env` is not readable from the agent.

**D9 — `brain:config set memory.backend` validates at write time** (`ALLOWED_VALUES` in
`config-verb.mjs`); `brain:upgrade` prints `undeclaredUpgradeNotice` after migrating.

**D10 — a config-declared backend whose binary is absent (round-2 cold-1).** `pull` is record-first
(`git pull` + reindex need no backend), like `save`. So `stated` is true only for process env/.env; for a
config declaration `selectBackend` substitutes plainfiles for `pull` and the notice says hydration into
the declared backend is deferred. This keeps a fresh clone of THIS repo (which declares engram) working
without engram. The `statedButAbsent` and `substituted` notices name the real source in both locales;
the invalid refusal and the `saveDeferred` reason use catalog text, not resolver tokens or English literals.

**D11 — an unreadable config is not "undeclared" (cold-5).** The resolver CLI exits 5 with the reason;
`bootstrap.sh` neither prompts nor writes, and any other resolver exit is reported as the check failing.
The `engram` value in this repo's own config is still an assumption (`.env` was unreadable): confirm it.

## Files

`lib/axis-selector.mjs`, `memory/lib/backend-resolve.mjs` (new); `memory/cli.mjs`, `bootstrap.sh`
(memory block only), `core/config-migrations.mjs`, `harness/cli.mjs`, i18n en/es.

## Open items (Tier 3, human-promoted)

`brain-drafts/memory-backend-contract.selector.draft.md` (where the selector lives). ADR-0004 needs
an amendment recording the move of the selector to tracked config — not drafted here.
