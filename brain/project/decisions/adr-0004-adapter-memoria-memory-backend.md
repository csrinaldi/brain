# ADR-0004 — Memory Adapter: MEMORY_BACKEND Selector + Dispatch

**Status**: Accepted · **amended 30/09/2026** (Amendments 1-3 — see below)  
**Date**: 2026-06-26

## Context

Team memory needs a concrete implementation for semantic search (engram, by default **[amended by Amendment 3 (#1165): there is no default backend any more; the sentence is what this ADR decided on 2026-06-26, kept as the record]**), but directly coupling all scripts to engram prevents switching backends without touching multiple files.

The replaceable harness pattern (ADR-0001) must be applied symmetrically to memory.

## Decision

Memory follows the same adapter pattern as the harness:

- **Selector**: `MEMORY_BACKEND` in `.env`. Default: `engram`. **[Amended by Amendment 3 (#1165) — the current rule: the team declares the backend as `memory.backend` in the tracked `brain.config.json`, and there is NO default. `MEMORY_BACKEND` in the process env or `.env` remains a per-run / per-machine override that wins over the config. The sentence above is what this ADR decided on 2026-06-26, kept as the record.]**
- **Dispatcher**: `scripts/memory/cli.mjs`. Single entry point. Resolves the backend (**[amended by Amendment 3 (#1165)]** process env `MEMORY_BACKEND`, then `.env`, then `brain.config.json` `memory.backend`; refuses when none declares one) and delegates to the corresponding implementation. The verbs, which are required, their normalized returns and the failure discipline are defined by `brain/core/methodology/memory-backend-contract.md` (Amendment 1, #863): required `setup`, `share`, `hydrate` (today `pull` / `cli.mjs import`), `save`; optional `index`, `search`, `featureCheckpoint`, `featureResume`. Backend-agnostic verbs (`reindex`, `resolve-index`, `audit`) are dispatched directly and never reach a backend.
- **Backend**: `brain/scripts/axes/memory/adapters/engram.mjs` (under `scripts/memory/backends/engram.mjs` until #1141; see Amendment 2). Encapsulates everything specific to engram: the binary CLI invocation, the creation of the symlink `.engram → .memory` (required because engram has no `--dir` flag), and the merge driver registration.
- **Canonical**: `.memory/` is the real git directory. The symlink `.engram → .memory` is an implementation detail of the engram backend, not of the system.

To add a new backend: create `brain/scripts/axes/memory/adapters/<name>.mjs` (under `scripts/memory/backends/<name>.mjs` until #1141; see Amendment 2) and add a `case` in `scripts/memory/cli.mjs`.

## Consequences

- **Positive**: switching memory backend = changing `MEMORY_BACKEND` in `.env` + `npm run env:init`. **[Amended by Amendment 3 (#1165) — the team's switch is `npm run brain:config -- set memory.backend engram|plainfiles` (tracked, so every clone and worktree sees it); `.env` only overrides it on one machine.]**
- **Positive**: the symlink `.engram → .memory` is encapsulated in the backend — if engram adds `--dir` support, it is removed only there.
- **Negative (closed by Amendment 1, #863)**: adding a new backend requires implementing all verbs — there is no formal interface today, only convention. *Closed: `memory-backend-contract.md` is the interface — four required verbs, three rules (idempotent hydration by record id; never the first home of a capture; no artifact the durable layer needs), the agnosticism test, and a conformance row per backend.*
- **Negative (withdrawn by Amendment 1, #863)**: the `.memory/manifest.json` manifest remains required for all backends that use the durable git layer. *Withdrawn: `plainfiles` (#246) uses the durable layer with no manifest, no chunks, no symlink and no driver, and every memory 2.0 scenario has an answer under it. Those four are the engram adapter's private artifacts (ADR-0002 Amendment 1) and leave the tree under #864 task 2.4.*

## Amendment 1 — the interface exists, and the manifest was never the layer's (issue #863)

**Signed**: 08/09/2026 — Cristian Rinaldi

### What this changes

Consequences admitted two things in 2026-06: that there was no formal interface, only
convention, and that the manifest was required for every backend. Both were true and both
are closed. `brain/core/methodology/memory-backend-contract.md` is the interface: four
required verbs (`setup`, `share`, `hydrate`, `save`), four optional ones, normalized
returns, the failure discipline, three rules — hydration idempotent by record id; the backend
is never the first home of a capture; the backend owns no artifact the durable layer needs —
the agnosticism test (*does it hold under `MEMORY_BACKEND=plainfiles`?*), an open, enumerated
set of producers, and a conformance row per backend. The manifest requirement is withdrawn:
`plainfiles` (#246) is the proof, and ADR-0002 Amendment 1 (same ruling) reassigns manifest,
symlink and driver to the engram adapter.

### What this does NOT change

The selector, the dispatcher and the backend directory are as decided. Adding a backend is
still a file plus a `case`; what is new is that the contract says what the file must export
and how it is proved.

## Amendment 2 — the memory backends moved to `axes/memory/adapters/` (issue #1141)

**Signed**: 28/09/2026 — Cristian Rinaldi

#1141 moved every backend adapter into one directory per axis, with `git mv`, so `git log
--follow` still reaches its history:

| as written above | the path today |
|---|---|
| `scripts/memory/backends/engram.mjs` | `brain/scripts/axes/memory/adapters/engram.mjs` |
| `scripts/memory/backends/<name>.mjs` (how-to) | `brain/scripts/axes/memory/adapters/<name>.mjs` |

Both citations above are annotated in place under ruling R6 on #961 as amended (option A) — the
maintainer applied the same ruling to #1141's path moves on 2026-09-28. The `MEMORY_BACKEND`
selector, the dispatcher and the canonical `.memory/` directory are unchanged.

## Amendment 3 — the selector lives in tracked config and has no default (issue #1165)

**Signed**: 30/09/2026 — Cristian Rinaldi

### What this changes

The `Selector` line above decided `MEMORY_BACKEND` in `.env`, defaulting to `engram`. Both halves
were wrong for a team. `.env` is untracked, so a second checkout or a per-issue worktree with no
`.env` silently ran a different backend than the team's; and a default made that silent switch the
normal outcome instead of a refusal. #1165 (merged) moves the decision:

- **Where it lives.** `memory.backend` in the tracked `brain.config.json` is the team's declaration.
  `MEMORY_BACKEND` in the process env or in `.env` stays as a per-run or per-machine override.
  Precedence: process env, then `.env`, then config, then undeclared.
- **No default.** Undeclared is a result the resolver reports, never a guess. An op that consults a
  backend (`share`, `pull`, `import`, `index`, `setup`, `search`, `feature-*`, `heal-duplicates`)
  refuses with exit 3 (undeclared) or 4 (invalid value, refused as a typo, never coerced) and names
  `npm run brain:config -- set memory.backend engram|plainfiles`. `save` is the exception: it is
  record-first (`memory-backend-contract.md` rule 2), so it writes the record through `plainfiles`
  and says hydration is deferred. Ops that never consult a backend (`reindex`, `audit`,
  `resolve-index`, `split-records`, `collect`, `ship`) are unaffected.
- **A config-declared backend whose binary is absent.** `pull` is also record-first in that one
  case: it runs records-only and says hydration into the declared backend is deferred. A backend
  named by the process env or `.env` is an operator's statement and is never overridden.
- **One resolver.** `brain/scripts/memory/lib/backend-resolve.mjs`, built on
  `brain/scripts/lib/axis-selector.mjs`. The dispatcher's `DEFAULT_BACKEND` survives only as
  "the backend that needs the engram binary" for the #641 probe.
- **Adoption.** New consumers declare it at `env:init` (a prompt on a TTY; with no TTY it skips
  memory setup and records the missing declaration). Existing consumers are unchanged until they
  declare: the 1.9.1 migration adds an empty `memory.backend` (undeclared) and `brain:upgrade`
  prints one line naming the fix.

### What this does NOT change

The dispatcher (`scripts/memory/cli.mjs`), the backend directory, the verbs and the canonical
`.memory/` directory. ADR-0024 Amendment 3 records the resolver's consolidation; its sentence that
this ADR's selector decision was otherwise unchanged was wrong and is corrected by ADR-0024
Amendment 4.
