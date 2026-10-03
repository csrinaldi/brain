# ADR-0011 Amendment 3 — draft (issue #1141)

> **Tier 3 target. Not promoted, and an agent may not promote it.**
>
> ```
> npm run brain:promote -- openspec/changes/issue-1141-axes-one-directory-per-axis/brain-drafts/adr-0011-amendment-3.draft.md
> ```
>
> Run it on THIS branch so the citation is right in the same pull request that moves the file.
> The verb renders the plan, waits for the typed word, performs §1c's acts, writes the
> `brain/HOME.md` marker and a regenerated `AGENTS.md`, stages them, and stops. **Your commit
> is the signature** (ADR-0028).

```brain-amendment/1
target: brain/project/decisions/adr-0011-feature-scoped-working-memory.md
amendment: 3
issue: 1141
home-summary: the per-backend adapter dispatch and the "add one" how-to moved from `memory/backends/` to `axes/memory/adapters/`; the citations are annotated in place and the resume.md contract is unchanged, #1141
body: ## Amendment 3 — the memory backends moved to `axes/memory/adapters/` (issue #1141)
body-end: ### Notes for the promoter
```

```amend-find
dispatched to `scripts/memory/backends/<backend>.mjs`
```

```amend-replace
dispatched to `brain/scripts/axes/memory/adapters/<backend>.mjs` (under `scripts/memory/backends/<backend>.mjs` until #1141; see Amendment 3)
```

```amend-find
implementing the two verbs in `scripts/memory/backends/<name>.mjs`
```

```amend-replace
implementing the two verbs in `brain/scripts/axes/memory/adapters/<name>.mjs` (under `scripts/memory/backends/<name>.mjs` until #1141; see Amendment 3)
```

## Amendment 3 — the memory backends moved to `axes/memory/adapters/` (issue #1141)

**Signed**: DD/MM/YYYY — <Name>

#1141 moved every backend adapter into one directory per axis, with `git mv`, so `git log
--follow` still reaches its history:

| as written above | the path today |
|---|---|
| `scripts/memory/backends/<backend>.mjs` | `brain/scripts/axes/memory/adapters/<backend>.mjs` |
| `scripts/memory/backends/<name>.mjs` (how-to) | `brain/scripts/axes/memory/adapters/<name>.mjs` |

Both citations above are annotated in place under ruling R6 on #961 as amended (option A) — the
maintainer applied the same ruling to #1141's path moves on 2026-09-28. The `resume.md`
contract and the feature-checkpoint/feature-resume verbs are unchanged.

### Notes for the promoter

Path annotation only. Promote on the #1141 branch.
