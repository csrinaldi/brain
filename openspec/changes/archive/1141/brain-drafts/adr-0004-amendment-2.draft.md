# ADR-0004 Amendment 2 — draft (issue #1141)

> **Tier 3 target. Not promoted, and an agent may not promote it.**
>
> ```
> npm run brain:promote -- openspec/changes/issue-1141-axes-one-directory-per-axis/brain-drafts/adr-0004-amendment-2.draft.md
> ```
>
> Run it on THIS branch so the citation is right in the same pull request that moves the file.
> The verb renders the plan, waits for the typed word, performs §1c's acts, writes the
> `brain/HOME.md` marker and a regenerated `AGENTS.md`, stages them, and stops. **Your commit
> is the signature** (ADR-0028).

```brain-amendment/1
target: brain/project/decisions/adr-0004-adapter-memoria-memory-backend.md
amendment: 2
issue: 1141
home-summary: the engram backend and the "add a new backend" how-to moved from `memory/backends/` to `axes/memory/adapters/`; the citations are annotated in place and the selector decision is unchanged, #1141
body: ## Amendment 2 — the memory backends moved to `axes/memory/adapters/` (issue #1141)
body-end: ### Notes for the promoter
```

```amend-find
`scripts/memory/backends/engram.mjs`.
```

```amend-replace
`brain/scripts/axes/memory/adapters/engram.mjs` (under `scripts/memory/backends/engram.mjs` until #1141; see Amendment 2).
```

```amend-find
create `scripts/memory/backends/<name>.mjs`
```

```amend-replace
create `brain/scripts/axes/memory/adapters/<name>.mjs` (under `scripts/memory/backends/<name>.mjs` until #1141; see Amendment 2)
```

## Amendment 2 — the memory backends moved to `axes/memory/adapters/` (issue #1141)

**Signed**: DD/MM/YYYY — <Name>

#1141 moved every backend adapter into one directory per axis, with `git mv`, so `git log
--follow` still reaches its history:

| as written above | the path today |
|---|---|
| `scripts/memory/backends/engram.mjs` | `brain/scripts/axes/memory/adapters/engram.mjs` |
| `scripts/memory/backends/<name>.mjs` (how-to) | `brain/scripts/axes/memory/adapters/<name>.mjs` |

Both citations above are annotated in place under ruling R6 on #961 as amended (option A) — the
maintainer applied the same ruling to #1141's path moves on 2026-09-28. The `MEMORY_BACKEND`
selector, the dispatcher and the canonical `.memory/` directory are unchanged.

### Notes for the promoter

Path annotation only. Promote on the #1141 branch.
