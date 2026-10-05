# ADR-0004 — Memory Adapter: MEMORY_BACKEND Selector + Dispatch

**Status**: Accepted · **amended 04/10/2026** (Amendments 1-4 — see below)  
**Date**: 2026-06-26

## Context

Team memory needs a concrete implementation for semantic search (engram, by default **[amended by Amendment 3 (#1165): there is no default backend any more; the sentence is what this ADR decided on 2026-06-26, kept as the record]**), but directly coupling all scripts to engram prevents switching backends without touching multiple files.

The replaceable harness pattern (ADR-0001) must be applied symmetrically to memory.

## Decision

Memory follows the same adapter pattern as the harness:

- **Selector**: `MEMORY_BACKEND` in `.env`. Default: `engram`. **[Amended by Amendment 3 (#1165) — the current rule: the team declares the backend as `memory.backend` in the tracked `brain.config.json`, and there is NO default. `MEMORY_BACKEND` in the process env or `.env` remains a per-run / per-machine override that wins over the config. The sentence above is what this ADR decided on 2026-06-26, kept as the record.]** **[Amended by Amendment 4 (#1114, #1263): the key is now `memory.default` plus `memory.providers` (ADR-0038), and `memory.backend` is read as a read-only alias for one minor version. A per-run or per-machine override wins only while `memory.locked` is not `true` (ADR-0040). See Amendment 4.]**
- **Dispatcher**: `scripts/memory/cli.mjs`. Single entry point. Resolves the backend (**[amended by Amendment 3 (#1165)]** process env `MEMORY_BACKEND`, then `.env`, then `brain.config.json` `memory.backend`; refuses when none declares one. **[Amended by Amendment 4 (#1114, #1263): today the one resolver is `resolveAxis` (`brain/scripts/lib/axis-config.mjs`), and the levels are the process env, `.env`, the user layer `<BRAIN_HOME>/config.json`, then `memory.default` (alias `memory.backend`); a locked axis refuses a differing value at every level above the team's.]**) and delegates to the corresponding implementation. The verbs, which are required, their normalized returns and the failure discipline are defined by `brain/core/methodology/memory-backend-contract.md` (Amendment 1, #863): required `setup`, `share`, `hydrate` (today `pull` / `cli.mjs import`), `save`; optional `index`, `search`, `featureCheckpoint`, `featureResume`. Backend-agnostic verbs (`reindex`, `resolve-index`, `audit`) are dispatched directly and never reach a backend.
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

- **Where it lives.** `memory.backend` in the tracked `brain.config.json` is the team's declaration. **[Amended by Amendment 4 (#1114, #1263): the declaration is `memory.default`, with the backend listed under `memory.providers`; `memory.backend` stays a read-only alias for one minor version.]**
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
  named by the process env or `.env` is an operator's statement and is never overridden. **[Amended by Amendment 4 (#1263, ADR-0040): this holds only while `memory` is not locked. With `memory.locked: true` and a declared team default, a process-env, `.env` or user-layer value that differs from it is refused, naming the fix.]**
- **One resolver.** `brain/scripts/memory/lib/backend-resolve.mjs`, built on
  `brain/scripts/lib/axis-selector.mjs`. The dispatcher's `DEFAULT_BACKEND` survives only as
  "the backend that needs the engram binary" for the #641 probe.
- **Adoption.** New consumers declare it at `env:init` (a prompt on a TTY; with no TTY it skips
  memory setup and records the missing declaration). **[Amended by Amendment 4 (#1263, ADR-0040):
  the prompt runs only in the FOUNDING run, the one that created `brain.config.json`. A no-TTY
  foundation leaves `memory.default` as `""`, never guessed, and `diagnoseAxes` reports it as an
  ERROR until someone chooses. In an existing repository `env:init` neither prompts nor writes the
  team config: an undeclared backend is refused with the named fix.]** Existing consumers are unchanged until they
  declare: the 1.9.1 migration adds an empty `memory.backend` (undeclared) and `brain:upgrade`
  prints one line naming the fix.

### What this does NOT change

The dispatcher (`scripts/memory/cli.mjs`), the backend directory, the verbs and the canonical
`.memory/` directory. ADR-0024 Amendment 3 records the resolver's consolidation; its sentence that
this ADR's selector decision was otherwise unchanged was wrong and is corrected by ADR-0024
Amendment 4.

## Amendment 4 — the memory axis takes the ADR-0038 shape, a lock refuses every override, and only a foundation declares it (issue #1263)

**Signed**: 04/10/2026 — Cristian Rinaldi

### What changed

ADR-0038 and ADR-0040 each name this ADR in "Amendments this requires". What is on the
`feature/issue-1114-axis-ports` tracker now:

- **The shape.** The team declares the backend as `memory.default`, a key of `memory.providers`
  (ADR-0038 §1). The 1.11.1 migration (`brain/core/config-migrations.mjs`, `migrateToAxisShape`)
  moves an existing `memory.backend` into it. An empty `memory.backend` stays undeclared
  (`"default": ""`). `brain:config -- set memory.default <name>` also creates
  `memory.providers.<name>` as `{}`.
- **The alias.** `memory.backend` is still read when the shape has no default
  (`readAxis`, `brain/scripts/lib/axis-config.mjs`). During the alias window
  `brain:config -- set memory.default` writes it as well, for the readers not yet moved.
- **One resolver.** `memory/lib/backend-resolve.mjs` is now a thin caller of `resolveAxis`. The
  precedence is the process env `MEMORY_BACKEND`, then `.env`, then the user layer
  (`<BRAIN_HOME>/config.json`, else `~/.brain/config.json`, read by `lib/user-config.mjs`), then
  `memory.default`, then undeclared. A value that is not a key of the union of the team's and the
  user's `memory.providers` is refused, never coerced.
- **`locked`.** When the team config declares `memory.locked: true` and a non-empty default, a
  value from the user layer, `.env` or the process env that differs from that default is refused
  (`AxisRefusal` code `locked`), and the fix names `governance.owners` and
  `brain:config -- set memory.default <name>` in a PR. A new adoption is written with
  `memory.locked: true` (`NEW_CONSUMER_DEFAULTS`). The 1.11.1 migration writes `memory.locked: false`
  on an existing consumer, so nothing it runs changes.
- **Adoption.** `bootstrap.sh` decides once whether the run is a foundation (`ensure --founding-file`).
  Only a founding run prompts for the backend, on a TTY, and writes `memory.default`. With no TTY the
  foundation leaves it `""`, and `diagnoseAxes` reports `axis-undeclared` with ERROR severity. An
  existing repository with no declared backend is refused with the named fix, with no prompt and no
  write.

### Why

ADR-0038 gives every axis one shape and one resolver. ADR-0040 ruled that a different memory backend,
even for one run, splits the team's shared index, so a lock must refuse the process env too
(Ratified point 5). It also ruled that daily `env:init` writes no team config (section 4). Amendment 3's
rule that an env value "is an operator's statement" was written before either existed.

### What this does NOT change

The dispatcher, the backend directory, the verbs, the canonical `.memory/` directory, and Amendment 3's
"no default" rule.

### What the code does not do yet, said plainly

- **The alias window is not closed.** Nothing yet refuses `memory.backend` after one minor version.
  The refusals in `backend-resolve.mjs` (`DECLARE_FIX`) and in `bootstrap.sh` still name
  `brain:config -- set memory.backend …`, the alias, not `memory.default`.
- **A lock on an undeclared axis refuses nothing.** `resolveAxis` applies `locked` only when the team
  default is non-empty. A no-TTY foundation is therefore locked and undeclared: a per-machine value
  still runs there, and the gap is reported only by the `axis-undeclared` finding.
- **An override equal to the team's value is not refused.** It is not an override, and `bootstrap.sh`
  exports the resolved value into the process env.
