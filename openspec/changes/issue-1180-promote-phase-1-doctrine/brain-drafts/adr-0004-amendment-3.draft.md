# ADR-0004 Amendment 3 — draft (issue #1165, promoted under #1180)

> **Tier 3 target. Not promoted, and an agent may not promote it.**
>
> ```
> npm run brain:promote -- openspec/changes/issue-1180-promote-phase-1-doctrine/brain-drafts/adr-0004-amendment-3.draft.md
> ```
>
> Promote this BEFORE `adr-0024-amendment-4.draft.md` (that one cites this by number). **Your commit is the signature** (ADR-0028).

```brain-amendment/1
target: brain/project/decisions/adr-0004-adapter-memoria-memory-backend.md
amendment: 3
issue: 1165
home-summary: the selector moves to tracked config (`memory.backend` in `brain.config.json`) with NO default — `.env` and the process env remain per-machine overrides, backend-consulting ops refuse when it is undeclared and `save` stays record-first, #1165
body: ## Amendment 3 — the selector lives in tracked config and has no default (issue #1165)
body-end: ### Notes for the promoter
```

```amend-find
Team memory needs a concrete implementation for semantic search (engram, by default), but
```

```amend-replace
Team memory needs a concrete implementation for semantic search (engram, by default **[amended by Amendment 3 (#1165): there is no default backend any more; the sentence is what this ADR decided on 2026-06-26, kept as the record]**), but
```

```amend-find
- **Selector**: `MEMORY_BACKEND` in `.env`. Default: `engram`.
```

```amend-replace
- **Selector**: `MEMORY_BACKEND` in `.env`. Default: `engram`. **[Amended by Amendment 3 (#1165) — the current rule: the team declares the backend as `memory.backend` in the tracked `brain.config.json`, and there is NO default. `MEMORY_BACKEND` in the process env or `.env` remains a per-run / per-machine override that wins over the config. The sentence above is what this ADR decided on 2026-06-26, kept as the record.]**
```

```amend-find
Reads `MEMORY_BACKEND` and delegates to the corresponding implementation.
```

```amend-replace
Resolves the backend (**[amended by Amendment 3 (#1165)]** process env `MEMORY_BACKEND`, then `.env`, then `brain.config.json` `memory.backend`; refuses when none declares one) and delegates to the corresponding implementation.
```

```amend-find
- **Positive**: switching memory backend = changing `MEMORY_BACKEND` in `.env` + `npm run env:init`.
```

```amend-replace
- **Positive**: switching memory backend = changing `MEMORY_BACKEND` in `.env` + `npm run env:init`. **[Amended by Amendment 3 (#1165) — the team's switch is `npm run brain:config -- set memory.backend engram|plainfiles` (tracked, so every clone and worktree sees it); `.env` only overrides it on one machine.]**
```

## Amendment 3 — the selector lives in tracked config and has no default (issue #1165)

**Signed**: DD/MM/YYYY — <Name>

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

### Notes for the promoter

Four in-place annotations under ruling R6 on #961 as amended (option A): the Context clause
"engram, by default", the `Selector` line, the dispatcher's "Reads `MEMORY_BACKEND`" clause, and
the Positive consequence. Old text stays readable inside each annotation. Promote BEFORE the
ADR-0024 Amendment 4 draft.
