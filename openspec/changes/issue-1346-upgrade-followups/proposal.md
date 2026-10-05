# Proposal — #1346 follow-ups to the #1344 upgrade fix

## Problem
1. `test/upgrade/in-container.sh` step 4b reports a memory resolve failure (rc=3) as info, which can mask a real memory regression even when `memory.backend` was declared.
2. Since #1344 an `undefined` axisContext makes the ADR-0038 migration read the machine's env and `.env`. Test calls to `migrateConfig`/`.migrate` that pass none silently depend on the host.
3. `brain:promote` writes `brain/core/.brain-promote-proof-<pid>-<ts>.mjs`. A killed run can leave it, and `brain/core` ships whole in the npm package.

## Approach
- 4b: record whether the declaration succeeded; a memory resolve error is FAIL when declared, info only when the declaration itself failed.
- Tests: pass `null` (env-blind) everywhere; add a static drift test that fails on any `migrateConfig(` with fewer than 4 args or `.migrate(` without axisContext/buildAxisContext (allowlist: the old-upgrader suite, which tests self-build in a sandboxed consumer).
- Promote: `.gitignore` entry (repo-only, not a managed path), negated `files` entry in package.json, sweep of stale proof files at start of the migration arm.

## Non-goals
No change to the migration itself or to the published shape beyond the exclusion.
