# ADR-0005 — Harness Adapter: SDD_HARNESS Selector + Verb Contract

**Status**: Accepted  
**Date**: 2026-06-26

## Context

The SDD harness (the tool that runs the spec-driven flow) is a per-developer choice, not a per-repository one. Different developers on the same team may prefer different tools.

Without an indirection point, the repo would become coupled to a specific tool (gentle-ai, Cursor, a custom script), and switching harnesses would require editing multiple files.

## Decision

The harness follows the adapter pattern:

- **Verb contract**: `brain/core/methodology/harness-contract.md`. Defines the abstract verbs of the SDD flow that any harness must implement (`sdd-new`, `sdd-apply`, `sdd-verify`, `sdd-archive`, etc.). The repo does not know or care how the chosen harness implements them.

- **Selector**: `SDD_HARNESS` in `.env`. Default: `gentle-ai`.

- **Binding point**: `scripts/bootstrap.sh` §6. Contains the `case "$SDD_HARNESS"` that initializes the chosen implementation. For gentle-ai: `gentle-ai install` configures skills, engram, and gga. For a custom harness: the `case` must implement its init or run `warn "no known init routine"`.

- **Per-dev skills**: each developer configures their harness skills in their local environment (not in the repo). The repo only defines the verb contract.

## Consequences

- **Positive**: the repo is harness-agnostic. SDD artifacts in `openspec/` are readable by any tool.
- **Positive**: a developer can use a different harness from the rest of the team without breaking the repo flow.
- **Negative**: `bootstrap.sh` §6 requires a `case` entry per known harness — not extensible without editing the file.
- **Negative**: the quality of the SDD artifacts produced depends on the chosen harness; the verb contract does not guarantee output quality.
