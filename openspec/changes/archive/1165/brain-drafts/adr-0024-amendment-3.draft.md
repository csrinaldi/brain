# ADR-0024 Amendment 3 — draft (issue #1165)

> **Tier 3 target. Not promoted, and an agent may not promote it.**
>
> ```
> npm run brain:promote -- openspec/changes/issue-1165-memory-backend-declared-in-tracked-config/brain-drafts/adr-0024-amendment-3.draft.md
> ```
>
> Run it on THIS branch. **Your commit is the signature** (ADR-0028).

```brain-amendment/1
target: brain/project/decisions/adr-0024-three-axis-decoupling.md
amendment: 3
issue: 1165
home-summary: the `resolveMemory` this ADR cites was dead and wrongly shaped and is deleted; the memory backend has ONE resolver, `memory/lib/backend-resolve.mjs`, and the selector lives in tracked config, #1165
body: ## Amendment 3 — `resolveMemory` is gone; the memory selector has one resolver and a tracked home (issue #1165)
body-end: ### Notes for the promoter
```

```amend-find
- `brain/scripts/harness/cli.mjs` — `resolvePlatform`/`resolveEngine`/`resolveMemory`.
```

```amend-replace
- `brain/scripts/harness/cli.mjs` — `resolvePlatform`/`resolveEngine` (`resolveMemory` was removed by #1165; see Amendment 3).
```

## Amendment 3 — `resolveMemory` is gone; the memory selector has one resolver and a tracked home (issue #1165)

**Signed**: DD/MM/YYYY — <Name>

`resolveMemory` was exported, called by nothing (`memory/cli.mjs` re-read the env on its own), and
read `config.memory` as a string when that key is an object. It is deleted. The memory backend now
resolves in ONE place, `brain/scripts/memory/lib/backend-resolve.mjs`, built on the generic
`brain/scripts/lib/axis-selector.mjs` — the shape #1114 can adopt for the other two axes.

Precedence: process env `MEMORY_BACKEND`, then `.env`, then `brain.config.json` `memory.backend`
(the team's choice, tracked, so a fresh clone sees it), then undeclared — a refusal that names the
fix, never a default. The `MEMORY_BACKEND` selector decision of ADR-0004 is otherwise unchanged.

### Notes for the promoter

Citation correction plus the new resolver's location. Promote on the #1165 branch.
