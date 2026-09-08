# ADR-0002 — Two-Layer Git-Based Team Memory

**Status**: Accepted · **amended 08/09/2026** (Amendment 1 — see below)  
**Date**: 2026-06-26

## Context

Team memory needs two seemingly contradictory properties:

- **Live**: accessible in real time by AI agents during a session.
- **Durable**: recoverable without the implementation (without engram, without engram CLI, without internet), using only `git clone`.

A single mechanism cannot satisfy both. Engram (the default implementation) is fast for semantic search but writes to a local directory that is not a standard git artifact.

## Decision

Memory operates in two layers:

1. **`.memory/` (durable)**: directory versioned in git. Contains the record log
   `.memory/records/<yyyy-mm>-<id>.jsonl` — one content-addressed record per file — and the
   derived, regenerable `index.jsonl` (ADR-0017; Amendment 1 to this ADR, #863). This is the
   recoverable source of truth. The chunk directory and the manifest that Amendment 1
   withdraws were the engram transport's private artifacts, never the durable layer's.

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
- **Negative (withdrawn by Amendment 1, #863)**: the manifest is a conflict point in concurrent merges — the merge driver is mandatory. *Withdrawn: the manifest is the adapter's private artifact and leaves the tree (#864 task 2.4).*
- **Negative (narrowed by Amendment 1, #863)**: the symlink `.engram → .memory` is a workaround for the engram CLI's limitation. *It is created and owned by the adapter's `setup` alone (`memory-backend-contract.md` rule 3); no reader of `.memory/records/` depends on it.*

## Note — the manifest MUST stay committed (do not gitignore it) — SUPERSEDED by Amendment 1 (#863)

> **Superseded.** This note was written for the chunk transport, and the measurement below
> is still accurate for it. Hydration is records-only since C4 (#229, #433): a fresh machine
> reads `.memory/records/` and never a chunk, so the manifest is no longer load-bearing for
> anyone but the engram adapter's own export. It is untracked, its merge driver removed and
> the `.engram` symlink confined to the adapter by #864 task 2.4, under
> `memory-backend-contract.md` rule 3. Kept for the record; do not act on it.

`.memory/manifest.json` is **engram's authoritative chunk index for sync**, not a derived convenience. Verified empirically (spike, 2026-06-27): a fresh engram (isolated via `ENGRAM_DATA_DIR`) pointed at `.memory/` **with** the manifest reports `Remote chunks: 6, Pending import: 6`; **without** the manifest it reports `Remote chunks: 0` and imports nothing — even though the `*.jsonl.gz` chunk files are physically present. So gitignoring the manifest would **silently lose all memory on every fresh machine**.

Therefore: the manifest stays committed; the merge driver (`merge-engram-manifest.mjs`) resolves concurrent merges; and the export churn (engram rewrites the manifest on every `memory:share`, which blocks a raw `git pull` against the dirty file) is **managed, not eliminated**, by the churn-resilient `memory:pull` (restore → pull → import) and the `post-merge` hook. The only root-cause fix lives upstream in engram (have `engram sync --import` fall back to globbing `.memory/chunks/` when no manifest is present) — a feature request, outside brain's control.

## Amendment 1 — the manifest was the transport's index, and the transport is gone (issue #863)

**Signed**: 08/09/2026 — Cristian Rinaldi

### What this changes

The Decision's durable layer was described as chunks plus a manifest, and the Note below
made the manifest mandatory on the strength of a measured spike. The spike was right for the
chunk transport. Since C4 (#229) hydration is records-only and batched (#433): a fresh machine
reads `.memory/records/` and never a chunk. The manifest is therefore the engram adapter's
private index of its own export, not a property of the layer — and `plainfiles` (#246) uses
the durable layer with no manifest, no chunks, no symlink and no driver, which is the
existence proof. The durable-layer bullet is corrected to records (ADR-0017), the Note is
marked superseded with its evidence kept, and the two Consequences are withdrawn or narrowed.

### What this does NOT change

The two-layer decision stands: durable in git, live in a backend, the live layer a derived
index. The canonical flow's verbs keep their names until #862 settles the lane. Retiring the
manifest, the driver and the symlink from the tree is #864 task 2.4, under the rule that
governs it — `brain/core/methodology/memory-backend-contract.md` rule 3 (ruling #863).
