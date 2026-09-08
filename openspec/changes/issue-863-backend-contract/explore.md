---
status: applying
issue: 863
---

# Explore: #863 — what exists today, measured

Parent: #864 (memory 2.0), task 1.2, Wave 1. Measured on `main` @ `ccfaf9b1` (after Wave 0).

## 1. The doctrine already says it — and admits it has no interface

- ADR-0002: `.memory/` is *"the recoverable source of truth"*; the backend is chosen by
  `MEMORY_BACKEND`. Its note **requires `.memory/manifest.json` to stay committed** because
  engram's chunk import reads it — true of the chunk transport, which memory-format.md has
  since demoted to *"engram's private transport, no longer the durable truth"*.
- ADR-0004 (Consequences, verbatim): *"there is no formal interface today, only convention"*
  and *"the manifest remains required for all backends that use the durable git layer"*.
  Both sentences are what this ticket exists to amend.
- ADR-0017:13: *"the live layer is a derived index"*.

## 2. The two backends, measured

| op | engram | plainfiles |
|---|---|---|
| `setup` | symlink `.engram → .memory` + merge-driver registration | no-op shape |
| `share` | `engram sync --export` → chunks → read back (`engram.mjs:260`) → records | reindex |
| `pull` / `cli.mjs import` | manifest restore, `git pull`, records → `engram import` (INSERT; delta under #820's guard) | `git pull` + reindex |
| `index` | `brain-to-engram.mjs` | `unsupportedOp` by design (obs #578) |
| `save` | **unsupported** — `memory:save` is pinned to plainfiles (`package.json:65`, #641/#530) | `appendRecord` + reindex |
| `search` | unsupported | over `index.jsonl` |
| `featureCheckpoint` / `featureResume` | engram namespace `brain-feature-*` | `unsupportedOp` |

The two do not implement the same verbs and nothing states which verbs are required. That is
ADR-0004's "only convention", observed.

## 3. The capture door

Agents capture through the engram MCP plugin's `mem_save` — configured in the user's Claude
Code plugins, not in this repo (no `.mcp.json`). The doctrine routes them there:
`agent-authorities.md:22` (Tier 1: *"Create/modify files in `.engram/**` (live memory)"*),
`AGENTS.md` and `consolidation-protocol.md §5` (*"in-session `mem_save` calls"*). The
agnostic write path — `memory:save` → `plainfiles.save` → a record — exists and is what the
memory 2.0 slices themselves used (`--issue 864/870/820`); no doctrine tells an agent to.

Consequence measured in the audit (#870 baseline): captures live in the backend first,
`share` exports the whole machine's project scope later, and a capture overwritten in the
live index by `topic_key` upsert before `share` never becomes a record.

## 4. The adapter's artifacts, and who still reads them

| artifact | state on `main` | readers (non-test) |
|---|---|---|
| `.memory/manifest.json` | tracked, `merge=engram-manifest` (`.gitattributes:5`) | `session-start.mjs` (step 1 `git restore`), `day-start.mjs`, `lib/memory-manifest.mjs`, `engram.mjs`, `backend-selection.mjs`, `merge-engram-manifest.mjs` |
| `.memory/chunks/*.jsonl.gz` | gitignored; written by every `share` | `engram.mjs#_defaultReadObservations` (read-back), `migrate-v1`, `cli.mjs migrate-v1` — #247 owns retirement |
| `.memory/legacy/*.jsonl.gz` | **48 files tracked** | none found outside migration |
| `.engram` symlink | gitignored; created by `setup` and by `share` (#657) | `engram.mjs`; `.gitignore:66-68` |
| merge driver | `merge-engram-manifest.mjs` + `.gitattributes` + `bootstrap.sh` registration | git only |

A docs-only PR went red on manifest churn (#803). `session-start` performs a destructive
`git restore` on a file the durable layer does not need.

## 5. Doctrine written in the implementation's vocabulary

- `harness-contract.md:32-34`: *"Exports local engram → `.memory/`"*, *"Imports `.memory/` →
  local engram"*, *"Reprojects `brain/` → local engram"*; `:27` "hydrates local engram";
  `:89-93` calls the symlink *"an implementation-agnostic detail"*.
- `agent-authorities.md:22`: Tier 1 authority over `.engram/**`.
- `consolidation-protocol.md §3` zone map: row `.engram/**` — *"Merge driver content-addressed"*.
- `.gitignore:60-68`: "MEMORIA ENGRAM … `.memory/` (chunks + manifest) SÍ se commitea".

## 6. Concurrency, after Wave 0

`import` is serialized by #820's guard and the delta is computed under it, so on this
machine hydration no longer duplicates. The three rows minted before the guard are still
there (`memory:audit`: 2369 rows / 2366 keys). `engram import` has no upsert mode
(v1.17.0; 1.20.0 not checked). Nothing heals a duplicated live row today.

## 7. What plainfiles proves

Under `MEMORY_BACKEND=plainfiles` there is no manifest, no chunk, no symlink, no driver, no
capture door — and every memory 2.0 scenario has a real or vacuity answer. The second
backend is the existence proof that the artifacts in §4 are the adapter's, not the layer's.
