# Release notes / adoption guide text — issue #1165

Guide text for the next release. `docs/adoption.md` is Tier 2 and is not edited in this change.

## Declare your memory backend in `brain.config.json`

The memory backend used to live only in your untracked `.env`. A teammate, a CI job or a fresh
clone has no `.env`, so it silently ran `engram` even when your team uses `plainfiles`.

It is now a team setting in tracked config:

```
npm run brain:config -- set memory.backend plainfiles   # or engram
git add brain.config.json && git commit
```

`env:init` asks once and writes it for you. Precedence, first wins: process env
`MEMORY_BACKEND` (one run) → `.env` (this machine) → `brain.config.json` (the team).

**If nothing declares a backend, memory commands refuse** and name this fix instead of guessing
`engram`. Backend-free commands (`reindex`, `audit`, `resolve-index`, `split-records`, `collect`, `ship`) are unaffected, and `save` still writes the record (hydration is deferred until a backend is declared). Refusals exit 3 (undeclared) or 4 (invalid).

**Upgrading:** `brain:upgrade` adds `memory.backend: ""` (undeclared). Nothing changes on its own:
if your backend is in `.env`, it keeps working, and `env:init` prints the one command to share it.
If you have neither, run the command above once.
