# ADR-0002 — Two-Layer Git-Based Team Memory

**Status**: Accepted  
**Date**: 2026-06-26

## Context

Team memory needs two seemingly contradictory properties:

- **Live**: accessible in real time by AI agents during a session.
- **Durable**: recoverable without the implementation (without engram, without engram CLI, without internet), using only `git clone`.

A single mechanism cannot satisfy both. Engram (the default implementation) is fast for semantic search but writes to a local directory that is not a standard git artifact.

## Decision

Memory operates in two layers:

1. **`.memory/` (durable)**: directory versioned in git. Contains content-addressed chunks (`.memory/chunks/`) and a manifest (`.memory/manifest.json`). This is the recoverable source of truth. The merge driver (`scripts/merge-engram-manifest.mjs`) resolves conflicts in the manifest.

2. **Memory backend (live)**: implementation chosen by `MEMORY_BACKEND`. Engram indexes `.memory/` into its local store for semantic search. The symlink `.engram → .memory` (created by `scripts/memory/backends/engram.mjs setup`) is required because the engram CLI has no configurable directory flag.

The canonical flow:
- `memory:pull` → imports `.memory/` into the active backend.
- `memory:index` → reprojects the durable `brain/` into the active backend.
- `memory:share` → materializes the active backend to `.memory/` before push.
- The `pre-push` hook runs `memory:share` automatically.

## Consequences

- **Positive**: team knowledge survives any tool rotation.
- **Positive**: `git log .memory/` shows the memory history.
- **Negative**: the manifest is a conflict point in concurrent merges — the merge driver is mandatory.
- **Negative**: the symlink `.engram → .memory` is a workaround for the engram CLI's limitation; if engram implements `--dir`, the symlink can be removed.
