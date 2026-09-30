# ADR-0023 Amendment 1 — draft (issue #1141)

> **Tier 3 target. Not promoted, and an agent may not promote it.**
>
> ```
> npm run brain:promote -- openspec/changes/issue-1141-axes-one-directory-per-axis/brain-drafts/adr-0023-amendment-1.draft.md
> ```
>
> Run it on THIS branch so the citation is right in the same pull request that moves the file.
> The verb renders the plan, waits for the typed word, performs §1c's acts, writes the
> `brain/HOME.md` marker and a regenerated `AGENTS.md`, stages them, and stops. **Your commit
> is the signature** (ADR-0028).

```brain-amendment/1
target: brain/project/decisions/adr-0023-sdd-role-port.md
amendment: 1
issue: 1141
home-summary: the role port this ADR cites moved from `roles/` to `axes/sdd-engine/role-port.mjs`; the citation is annotated in place and the role port contract is unchanged, #1141
body: ## Amendment 1 — the role port moved to `axes/sdd-engine/role-port.mjs` (issue #1141)
body-end: ### Notes for the promoter
```

```amend-find
`roles/role-port.mjs` — the contract
```

```amend-replace
`brain/scripts/axes/sdd-engine/role-port.mjs` (relative path was `roles/role-port.mjs` under `brain/scripts/` until #1141; see Amendment 1) — the contract
```

## Amendment 1 — the role port moved to `axes/sdd-engine/role-port.mjs` (issue #1141)

**Signed**: DD/MM/YYYY — <Name>

#1141 moved every adapter into one directory per axis, and the role port with it: it left
`brain/scripts/roles/role-port.mjs` for `brain/scripts/axes/sdd-engine/role-port.mjs`, with
`git mv`, so `git log --follow` still reaches its history.

The citation above is annotated in place under ruling R6 on #961 as amended (option A) — the
maintainer applied the same ruling to #1141's path moves on 2026-09-28. The `declareRoles`
contract and the engines-declare/platforms-receive split are unchanged.

### Notes for the promoter

Path annotation only. Promote on the #1141 branch.
