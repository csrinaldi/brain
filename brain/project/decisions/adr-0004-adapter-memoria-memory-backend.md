# ADR-0004 — Memory Adapter: MEMORY_BACKEND Selector + Dispatch

**Status**: Accepted  
**Date**: 2026-06-26

## Context

Team memory needs a concrete implementation for semantic search (engram, by default), but directly coupling all scripts to engram prevents switching backends without touching multiple files.

The replaceable harness pattern (ADR-0001) must be applied symmetrically to memory.

## Decision

Memory follows the same adapter pattern as the harness:

- **Selector**: `MEMORY_BACKEND` in `.env`. Default: `engram`.
- **Dispatcher**: `scripts/memory/cli.mjs`. Single entry point. Reads `MEMORY_BACKEND` and delegates to the corresponding implementation. Verbs: `index`, `share`, `pull`, `setup`.
- **Backend**: `scripts/memory/backends/engram.mjs`. Encapsulates everything specific to engram: the binary CLI invocation, the creation of the symlink `.engram → .memory` (required because engram has no `--dir` flag), and the merge driver registration.
- **Canonical**: `.memory/` is the real git directory. The symlink `.engram → .memory` is an implementation detail of the engram backend, not of the system.

To add a new backend: create `scripts/memory/backends/<name>.mjs` and add a `case` in `scripts/memory/cli.mjs`.

## Consequences

- **Positive**: switching memory backend = changing `MEMORY_BACKEND` in `.env` + `npm run env:init`.
- **Positive**: the symlink `.engram → .memory` is encapsulated in the backend — if engram adds `--dir` support, it is removed only there.
- **Negative**: adding a new backend requires implementing all verbs (`index`, `share`, `pull`, `setup`) — there is no formal interface today, only convention.
- **Negative**: the `.memory/manifest.json` manifest remains required for all backends that use the durable git layer.
