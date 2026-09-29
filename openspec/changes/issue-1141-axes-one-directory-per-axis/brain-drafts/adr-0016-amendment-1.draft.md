# ADR-0016 Amendment 1 — draft (issue #1141)

> **Tier 3 target. Not promoted, and an agent may not promote it.**
>
> ```
> npm run brain:promote -- openspec/changes/issue-1141-axes-one-directory-per-axis/brain-drafts/adr-0016-amendment-1.draft.md
> ```
>
> Run it on THIS branch so the citation is right in the same pull request that moves the file.
> Until it is promoted, `brain:nav` reports this ADR's citation as dead. The verb renders the
> plan, waits for the typed word, performs §1c's acts, writes the `brain/HOME.md` marker and a
> regenerated `AGENTS.md`, stages them, and stops. **Your commit is the signature** (ADR-0028).

```brain-amendment/1
target: brain/project/decisions/adr-0016-ci-context-normalization.md
amendment: 1
issue: 1141
home-summary: the GitHub adapter this ADR cites moved from `vcs/providers/` to `axes/vcs/adapters/`; the citation is annotated in place and the decision is unchanged, #1141
body: ## Amendment 1 — the VCS adapters moved to `axes/vcs/adapters/` (issue #1141)
body-end: ### Notes for the promoter
```

```amend-find
- `brain/scripts/vcs/providers/github.mjs` — `prView()` (L126–139), the only `gh pr view` reader.
```

```amend-replace
- `brain/scripts/axes/vcs/adapters/github.mjs` (under brain/scripts/vcs/providers/ when this ADR was written; moved by #1141, see Amendment 1) — `prView()` (L126–139), the only `gh pr view` reader.
```

## Amendment 1 — the VCS adapters moved to `axes/vcs/adapters/` (issue #1141)

**Signed**: DD/MM/YYYY — <Name>

#1141 moved every adapter into one directory per axis. The VCS adapters left
brain/scripts/vcs/providers/ for `brain/scripts/axes/vcs/adapters/`, with `git mv`, so
`git log --follow` still reaches their history. The citation above is annotated in place: the
line numbers are the ones this ADR measured on its own date, not today's.

Nothing in this decision changed. `ci-context.mjs` is still the one reader of pipeline context,
and its drift guard now refuses a direct import from the adapters' new path.

### Notes for the promoter

Path annotation only. Promote on the #1141 branch.
