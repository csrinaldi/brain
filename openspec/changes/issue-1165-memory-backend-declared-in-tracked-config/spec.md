---
status: draft
issue: 1165
---

# Spec

## REQ-1165-1 — the tracked config declares the team's backend

`brain.config.json` `memory.backend` MUST be a settable path (`brain:config set memory.backend`),
declared by migration 1.9.1 with default `''`. The migration MUST be additive: it MUST NOT
overwrite a declared value and MUST NOT introduce a non-empty default.

**Falsifiable by:** `lib/config-migrations.test.mjs` (#1165 e) — a 1.9.0 config migrates cleanly.

## REQ-1165-2 — one precedence, one resolver

The backend MUST resolve as: process env `MEMORY_BACKEND` → `.env` → `brain.config.json`
`memory.backend` → undeclared. An empty value is undeclared at every level and MUST NOT hide a
lower one. `memory/cli.mjs` and `bootstrap.sh` MUST both obtain it from
`memory/lib/backend-resolve.mjs`; no other module resolves it.

**Falsifiable by:** `memory/lib/backend-resolve.test.mjs`; `cli.backend-declaration.test.mjs` (a, b, d).

## REQ-1165-3 — a fresh clone runs the team's backend

A fresh clone of a plainfiles consumer, with no `.env`, MUST run `brain:memory:pull` and
`search` on plainfiles.

**Falsifiable by:** `cli.backend-declaration.test.mjs` (a) — a real origin and a real clone.

## REQ-1165-4 — undeclared is refused, never guessed

When nothing declares a backend, every op that consults a backend (`pull`, `import`, `index`,
`share`, `setup`, `search`, `feature-*`, `heal-duplicates`) MUST exit 1 with a message naming
`brain:config -- set memory.backend`. An unknown declared value MUST be refused as a typo, never
coerced. Ops that never consult a backend (`reindex`, `audit`, `resolve-index`, `split-records`,
`collect`, `ship`, `migrate-v1`, `save`) MUST be unaffected.

**Falsifiable by:** `cli.backend-declaration.test.mjs` (c).

## REQ-1165-5 — existing consumers are unchanged

A consumer whose backend is only in `.env` MUST keep working, and `env:init` MUST tell it the
value is invisible to other checkouts and print the one-line move. `env:init` MUST NOT edit
tracked config for such a consumer without being asked.

**Falsifiable by:** `cli.backend-declaration.test.mjs` (d); `bootstrap.e2e.test.mjs` (`.env`-only).

## REQ-1165-6 — env:init declares, and guesses nothing

On a TTY with nothing declared, `env:init` MUST prompt and write the answer to
`brain.config.json`, and MUST NOT write it to `.env`. Without a TTY and with nothing declared it
MUST NOT guess: it skips memory setup, exits 0, and prints the fix.

**Falsifiable by:** `bootstrap.e2e.test.mjs` (#1165 group).
