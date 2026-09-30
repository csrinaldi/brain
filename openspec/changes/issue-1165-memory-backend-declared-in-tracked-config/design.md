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
one-line fix. The #641 "unstated default falls back to plainfiles" path becomes unreachable from
`cli.mjs` (`stated` is always true) and its tests are rewritten; `selectBackend` stays as is.

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

## Files

`lib/axis-selector.mjs`, `memory/lib/backend-resolve.mjs` (new); `memory/cli.mjs`, `bootstrap.sh`
(memory block only), `core/config-migrations.mjs`, `harness/cli.mjs`, i18n en/es.

## Open items (Tier 3, human-promoted)

`brain-drafts/memory-backend-contract.selector.draft.md` (where the selector lives). ADR-0004 needs
an amendment recording the move of the selector to tracked config — not drafted here.
