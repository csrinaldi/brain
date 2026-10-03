# ADR-0026 Amendment 9 — draft (issue #1141)

> **Tier 3 target. Not promoted, and an agent may not promote it.**
>
> ```
> npm run brain:promote -- openspec/changes/issue-1141-axes-one-directory-per-axis/brain-drafts/adr-0026-amendment-9.draft.md
> ```
>
> Run it on THIS branch so the citation is right in the same pull request that moves the file.
> Until it is promoted, `brain:nav` reports this ADR's citation as dead. The verb renders the
> plan, waits for the typed word, performs §1c's acts, writes the `brain/HOME.md` marker and a
> regenerated `AGENTS.md`, stages them, and stops. **Your commit is the signature** (ADR-0028).

```brain-amendment/1
target: brain/project/decisions/adr-0026-governance-doctrine-tiers.md
amendment: 9
issue: 1141
home-summary: the GitHub adapter cited for `branchProtect` moved from `vcs/providers/` to `axes/vcs/adapters/`; the citation is annotated in place and the tier table is unchanged, #1141
body: ## Amendment 9 — the GitHub adapter moved to `axes/vcs/adapters/` (issue #1141)
body-end: ### Notes for the promoter
```

```amend-find
  `brain/scripts/vcs/providers/github.mjs` `branchProtect`
```

```amend-replace
  `brain/scripts/axes/vcs/adapters/github.mjs` `branchProtect` (under brain/scripts/vcs/providers/ until #1141; see Amendment 9)
```

## Amendment 9 — the GitHub adapter moved to `axes/vcs/adapters/` (issue #1141)

**Signed**: DD/MM/YYYY — <Name>

#1141 moved every adapter into one directory per axis. The GitHub adapter that implements
`branchProtect` left brain/scripts/vcs/providers/ for `brain/scripts/axes/vcs/adapters/`, with
`git mv`, so `git log --follow` still reaches its history. The one citation Amendment 6 made is
annotated in place. No tier parameter changed.

### Notes for the promoter

Path annotation only. Promote on the #1141 branch.
