# ADR-0021 Amendment 1 — draft (issue #1141)

> **Tier 3 target. Not promoted, and an agent may not promote it.**
>
> ```
> npm run brain:promote -- openspec/changes/issue-1141-axes-one-directory-per-axis/brain-drafts/adr-0021-amendment-1.draft.md
> ```
>
> Run it on THIS branch so the citation is right in the same pull request that moves the file.
> The verb renders the plan, waits for the typed word, performs §1c's acts, writes the
> `brain/HOME.md` marker and a regenerated `AGENTS.md`, stages them, and stops. **Your commit
> is the signature** (ADR-0028).

```brain-amendment/1
target: brain/project/decisions/adr-0021-reviewer-port-head-and-rollup.md
amendment: 1
issue: 1141
home-summary: the GitHub adapter this ADR cites for `prView`'s current shape moved from `vcs/providers/` to `axes/vcs/adapters/`; the citation is annotated in place and the port widening is unchanged, #1141
body: ## Amendment 1 — the GitHub adapter moved to `axes/vcs/adapters/` (issue #1141)
body-end: ### Notes for the promoter
```

```amend-find
(`brain/scripts/vcs/providers/github.mjs:157-159`, `gitlab.mjs:110`)
```

```amend-replace
(`brain/scripts/axes/vcs/adapters/github.mjs:157-159` (under `brain/scripts/vcs/providers/` until #1141; see Amendment 1), `gitlab.mjs:110`)
```

## Amendment 1 — the GitHub adapter moved to `axes/vcs/adapters/` (issue #1141)

**Signed**: DD/MM/YYYY — <Name>

#1141 moved every provider adapter into one directory per axis, with `git mv`, so `git log
--follow` still reaches its history. The GitHub adapter left `brain/scripts/vcs/providers/`
for `brain/scripts/axes/vcs/adapters/`; the line numbers are the ones this ADR measured on its
own date, not today's.

The citation above is annotated in place under ruling R6 on #961 as amended (option A) — the
maintainer applied the same ruling to #1141's path moves on 2026-09-28. The `headRefOid`
widening and the `prStatusRollup` verb are unchanged.

### Notes for the promoter

Path annotation only. Promote on the #1141 branch.
