# ADR-0012 Amendment 1 — draft (issue #1141)

> **Tier 3 target. Not promoted, and an agent may not promote it.**
>
> ```
> npm run brain:promote -- openspec/changes/issue-1141-axes-one-directory-per-axis/brain-drafts/adr-0012-amendment-1.draft.md
> ```
>
> Run it on THIS branch so the citation is right in the same pull request that moves the file.
> The verb renders the plan, waits for the typed word, performs §1c's acts, writes the
> `brain/HOME.md` marker and a regenerated `AGENTS.md`, stages them, and stops. **Your commit
> is the signature** (ADR-0028).

```brain-amendment/1
target: brain/project/decisions/adr-0012-harness-init-adapter.md
amendment: 1
issue: 1141
home-summary: the harness dispatch target, the backend-contract directory and the "add a new harness" how-to moved from `harness/backends/` to `axes/sdd-engine/adapters/`; the citations are annotated in place and the init adapter decision is unchanged, #1141
body: ## Amendment 1 — the harness backends moved to `axes/sdd-engine/adapters/` (issue #1141)
body-end: ### Notes for the promoter
```

```amend-find
dispatches to `scripts/harness/backends/<SDD_HARNESS>.mjs`
```

```amend-replace
dispatches to `brain/scripts/axes/sdd-engine/adapters/<SDD_HARNESS>.mjs` (under `scripts/harness/backends/<SDD_HARNESS>.mjs` until #1141; see Amendment 1)
```

```amend-find
each module in `scripts/harness/backends/`
```

```amend-replace
each module in `brain/scripts/axes/sdd-engine/adapters/` (under `scripts/harness/backends/` until #1141; see Amendment 1)
```

```amend-find
create `scripts/harness/backends/<name>.mjs`
```

```amend-replace
create `brain/scripts/axes/sdd-engine/adapters/<name>.mjs` (under `scripts/harness/backends/<name>.mjs` until #1141; see Amendment 1)
```

## Amendment 1 — the harness backends moved to `axes/sdd-engine/adapters/` (issue #1141)

**Signed**: DD/MM/YYYY — <Name>

#1141 moved every backend adapter into one directory per axis, with `git mv`, so `git log
--follow` still reaches its history:

| as written above | the path today |
|---|---|
| `scripts/harness/backends/<SDD_HARNESS>.mjs` | `brain/scripts/axes/sdd-engine/adapters/<SDD_HARNESS>.mjs` |
| `scripts/harness/backends/` (directory) | `brain/scripts/axes/sdd-engine/adapters/` |
| `scripts/harness/backends/<name>.mjs` (how-to) | `brain/scripts/axes/sdd-engine/adapters/<name>.mjs` |

All three citations above are annotated in place under ruling R6 on #961 as amended (option A)
— the maintainer applied the same ruling to #1141's path moves on 2026-09-28. The `SDD_HARNESS`
dispatcher, the `init()` backend contract and the binding point are unchanged.

### Notes for the promoter

Path annotation only. Promote on the #1141 branch.
