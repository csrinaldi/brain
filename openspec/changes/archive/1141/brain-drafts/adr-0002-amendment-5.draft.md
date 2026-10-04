# ADR-0002 Amendment 5 — draft (issue #1141)

> **Tier 3 target. Not promoted, and an agent may not promote it.**
>
> ```
> npm run brain:promote -- openspec/changes/issue-1141-axes-one-directory-per-axis/brain-drafts/adr-0002-amendment-5.draft.md
> ```
>
> Run it on THIS branch so the citation is right in the same pull request that moves the file.
> The verb renders the plan, waits for the typed word, performs §1c's acts, writes the
> `brain/HOME.md` marker and a regenerated `AGENTS.md`, stages them, and stops. **Your commit
> is the signature** (ADR-0028).

```brain-amendment/1
target: brain/project/decisions/adr-0002-memoria-git-based-dos-capas.md
amendment: 5
issue: 1141
home-summary: the engram backend this ADR cites moved from `memory/backends/` to `axes/memory/adapters/`; the citation is annotated in place and the two-layer decision is unchanged, #1141
body: ## Amendment 5 — the engram backend moved to `axes/memory/adapters/` (issue #1141)
body-end: ### Notes for the promoter
```

```amend-find
`scripts/memory/backends/engram.mjs setup`
```

```amend-replace
`brain/scripts/axes/memory/adapters/engram.mjs setup` (under `scripts/memory/backends/engram.mjs setup` until #1141; see Amendment 5)
```

## Amendment 5 — the engram backend moved to `axes/memory/adapters/` (issue #1141)

**Signed**: DD/MM/YYYY — <Name>

#1141 moved every backend adapter into one directory per axis. The engram memory backend left
`brain/scripts/memory/backends/` for `brain/scripts/axes/memory/adapters/`, with `git mv`, so
`git log --follow` still reaches its history:

| as written above | the path today |
|---|---|
| `scripts/memory/backends/engram.mjs` | `brain/scripts/axes/memory/adapters/engram.mjs` |

The citation above is annotated in place under ruling R6 on #961 as amended (option A) — the
maintainer applied the same ruling to #1141's path moves on 2026-09-28: the historical path
stays visible next to its `axes/memory/adapters/` rename. Nothing in the two-layer memory
decision changed.

### Notes for the promoter

Path annotation only. Promote on the #1141 branch.
