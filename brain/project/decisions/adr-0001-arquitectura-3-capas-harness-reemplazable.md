# ADR-0001 — 3-Layer Architecture with Replaceable Harness

**Status**: Accepted  
**Date**: 2026-06-26

## Context

An AI-assisted development system needs three well-separated concerns:

1. **SDD Artifacts** (proposals, specs, designs, tasks): the planned knowledge for each change.
2. **SDD Harness**: the tool that executes the workflow (proposes, verifies, archives).
3. **Team Memory**: accumulated knowledge that persists across sessions.

Coupling these three elements creates a dual problem: the team becomes locked into a particular tool, and the system cannot evolve each layer independently.

## Decision

The system is divided into three independent layers:

- **SDD Artifacts (OpenSpec)**: files under `openspec/` — open format, versionable with git, readable by any tool. These are the durable contract.
- **Harness**: chosen by the developer via `SDD_HARNESS` in `.env`. The harness executes the contract verbs (`sdd-new`, `sdd-apply`, `sdd-verify`, etc.) defined in `brain/core/methodology/harness-contract.md`. Default: `gentle-ai`.
- **Memory**: chosen via `MEMORY_BACKEND` in `.env`. Default: `engram`.

The binding between layers happens at ONE single point (`scripts/bootstrap.sh` §6 for the harness, `scripts/memory/cli.mjs` for memory). Switching tools means changing the environment variable and re-running `env:init`.

## Consequences

- **Positive**: the team can adopt a better harness without losing SDD artifacts or memory history.
- **Positive**: artifacts in `openspec/` are always readable, even without the tools installed.
- **Negative**: the verbs contract (`harness-contract.md`) must be kept up to date when new capabilities are added to the SDD workflow.
- **Negative**: each new harness requires a `case` in `bootstrap.sh` §6 and manual validation.
