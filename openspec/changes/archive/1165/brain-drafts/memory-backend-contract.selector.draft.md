# Amendment draft — `memory-backend-contract.md` says where the selector lives (issue #1165)

> **Tier 3 draft. Not promoted, and an agent may not promote it.** Run it on THIS branch:
>
> ```
> npm run brain:promote -- openspec/changes/issue-1165-memory-backend-declared-in-tracked-config/brain-drafts/memory-backend-contract.selector.draft.md
> ```
>
> Selector location only; no rule, verb or agnosticism test in this contract changes.

```brain-amendment/1
target: brain/core/methodology/memory-backend-contract.md
issue: 1165
```

```amend-find
The active backend is chosen via `MEMORY_BACKEND` in `.env` (default `engram`; `plainfiles`
is the second inhabitant, #246). The dispatcher `brain/scripts/memory/cli.mjs` reads that key
```

```amend-replace
The active backend is the team's declaration in `brain.config.json` `memory.backend`, overridable
per machine by `.env` and per run by the process env, both `MEMORY_BACKEND` (`engram` and
`plainfiles`, the second inhabitant #246, are the closed set). There is NO default: with nothing
declared a reader refuses and names the fix (#1165). The ONE resolver is
`brain/scripts/memory/lib/backend-resolve.mjs`. The dispatcher `brain/scripts/memory/cli.mjs` reads that key
```
