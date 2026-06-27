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
- `memory:pull` → churn-resilient sync: restores the regenerated `.memory/manifest.json`, runs `git pull`, then imports. Use this instead of a raw `git pull` (see the note below).
- `memory:import` → imports `.memory/` into the active backend (no `git pull`).
- `memory:index` → reprojects the durable `brain/` into the active backend.
- `memory:share` → materializes the active backend to `.memory/` before push.
- The `pre-push` hook runs `memory:share`; the `post-merge` hook runs `memory:import` after any pull/merge.

## Consequences

- **Positive**: team knowledge survives any tool rotation.
- **Positive**: `git log .memory/` shows the memory history.
- **Negative**: the manifest is a conflict point in concurrent merges — the merge driver is mandatory.
- **Negative**: the symlink `.engram → .memory` is a workaround for the engram CLI's limitation; if engram implements `--dir`, the symlink can be removed.

## Note — the manifest MUST stay committed (do not gitignore it)

`.memory/manifest.json` is **engram's authoritative chunk index for sync**, not a derived convenience. Verified empirically (spike, 2026-06-27): a fresh engram (isolated via `ENGRAM_DATA_DIR`) pointed at `.memory/` **with** the manifest reports `Remote chunks: 6, Pending import: 6`; **without** the manifest it reports `Remote chunks: 0` and imports nothing — even though the `*.jsonl.gz` chunk files are physically present. So gitignoring the manifest would **silently lose all memory on every fresh machine**.

Therefore: the manifest stays committed; the merge driver (`merge-engram-manifest.mjs`) resolves concurrent merges; and the export churn (engram rewrites the manifest on every `memory:share`, which blocks a raw `git pull` against the dirty file) is **managed, not eliminated**, by the churn-resilient `memory:pull` (restore → pull → import) and the `post-merge` hook. The only root-cause fix lives upstream in engram (have `engram sync --import` fall back to globbing `.memory/chunks/` when no manifest is present) — a feature request, outside brain's control.
