# ADR-0012 — Harness Init Adapter: scripts/harness/ Dispatcher + Backend Contract

**Status**: Accepted  
**Date**: 2026-06-27

## Context

ADR-0005 introduced the `SDD_HARNESS` selector and documented a known negative:

> `bootstrap.sh` §6 requires a `case` entry per known harness — **not extensible without editing the file**.

The inline `case "$SDD_HARNESS"` block in §6 contained ~20 lines of gentle-ai–specific logic (doctor check, TTY-guarded install, skill-registry refresh) that could not be extended without touching the file. Adding a second harness (e.g. a custom Claude Code plugin) required an editor to open `bootstrap.sh`.

ADR-0004 (memory adapter) and ADR-0008 (VCS adapter) solved the same extensibility problem for their domains using the same pattern: a dispatcher script + per-backend modules. Applying this pattern to the harness closes the documented gap.

## Decision

The harness init binding moves out of `bootstrap.sh` and into a dedicated adapter:

- **Dispatcher**: `scripts/harness/cli.mjs`.
  - Reads `SDD_HARNESS` from `process.env` → `.env` file → default `'gentle-ai'` (same precedence as `MEMORY_BACKEND`).
  - Validates the op (`init`) and dispatches to `scripts/harness/backends/<SDD_HARNESS>.mjs`.
  - Guards the dynamic import path (only `[a-z][a-z0-9-]*` names allowed) to prevent path traversal.
  - Exports `resolveHarness()` and `dispatch()` as pure / injectable functions for unit tests.

- **Backend contract** (verb: `init`): each module in `scripts/harness/backends/` MUST export `async function init()`. For gentle-ai, `init()` performs the ecosystem step (doctor / install / skill-registry refresh) **and** the SDD project-context check (engram search for `sdd-init/<project>`).

- **Binding point** (replaces ADR-0005 §6 `case`): `bootstrap.sh §6` becomes:
  ```sh
  node scripts/harness/cli.mjs init || warn "$I18N_BOOTSTRAP_SDD_INITFAILED"
  ```
  The harness-selector prompt and `env_set SDD_HARNESS` remain in the shell (they are shell-level UX, not harness logic).

- **Adding a new harness**: create `scripts/harness/backends/<name>.mjs` that exports `init()`. No edit to `bootstrap.sh` or `cli.mjs` required.

- **SDD context check (gentle-ai backend)**: `init()` resolves the project slug via `brain.config.json project.slug` (or git origin fallback), then searches engram for `sdd-init/<project>`. If absent, it prints a clear notice: the agent Init Guard will create the context on the first `/sdd-*` command (or the user can run `/sdd-init` explicitly). The check is best-effort and never fatal.

## Supersedes

This ADR supersedes the **"Binding point"** detail in ADR-0005 (the §6 `case` block). The rest of ADR-0005 (verb contract, SDD_HARNESS selector, per-dev skills) remains in force.

## Never do

- Add harness-specific logic back to `bootstrap.sh`. All harness init goes in the backend module.
- Make `init()` fatal: if gentle-ai or engram are absent, `init()` must warn and return. Bootstrap must always complete.
- Skip the injectable seam pattern: all external subprocess calls in a backend MUST be injectable for unit tests (mirrors `featureCheckpoint` / `featureResume` in the memory backend).

## Consequences

- **Positive**: resolves ADR-0005's documented negative — adding a new harness is one file, not an edit to bootstrap.sh.
- **Positive**: mirrors the memory (ADR-0004) and VCS (ADR-0008) adapters — consistent mental model across all three axes.
- **Positive**: the gentle-ai backend is fully unit-tested via injectable seams; bootstrap.sh §6 is now a four-line block.
- **Positive**: the SDD project-context check (previously absent) is now emitted on every `env:init`, making the missing-context situation visible early.
- **Negative**: adding a new harness requires implementing the `init()` verb — there is no formal interface today, only convention (same limitation as the memory adapter).
- **Negative**: bootstrap.sh now requires Node.js at §6 (previously only needed at §7). Node is already a required dependency (§1).
