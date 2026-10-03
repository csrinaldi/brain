# ADR-0020 Amendment 3 — draft (issue #1141)

> **Tier 3 target. Not promoted, and an agent may not promote it.**
>
> ```
> npm run brain:promote -- openspec/changes/issue-1141-axes-one-directory-per-axis/brain-drafts/adr-0020-amendment-3.draft.md
> ```
>
> Run it on THIS branch so the citation is right in the same pull request that moves the file.
> Until it is promoted, `brain:nav` reports this ADR's citation as dead. The verb renders the
> plan, waits for the typed word, performs §1c's acts, writes the `brain/HOME.md` marker and a
> regenerated `AGENTS.md`, stages them, and stops. **Your commit is the signature** (ADR-0028).

```brain-amendment/1
target: brain/project/decisions/adr-0020-reviewer-port-verbs-and-two-key-split.md
amendment: 3
issue: 1141
home-summary: the VCS adapters and their contract suite moved to `axes/vcs/` (`adapters/github.mjs`, `adapters/gitlab.mjs`, `contract.test.mjs`); the citations are annotated in place and the verbs, locks and key split are unchanged, #1141
body: ## Amendment 3 — the VCS adapters and their contract suite moved to `axes/vcs/` (issue #1141)
body-end: ### Notes for the promoter
```

```amend-find
Both providers (`brain/scripts/vcs/providers/github.mjs`, `.../gitlab.mjs`) implement them or the
```

```amend-replace
Both providers (`brain/scripts/axes/vcs/adapters/github.mjs`, `.../gitlab.mjs`; under brain/scripts/vcs/providers/ until #1141, see Amendment 3) implement them or the
```

```amend-find
`brain/scripts/vcs/providers/{github,gitlab}.mjs`, `brain/scripts/vcs/actor-check.mjs`,
```

```amend-replace
`brain/scripts/axes/vcs/adapters/{github,gitlab}.mjs` (then under brain/scripts/vcs/providers/; see Amendment 3), `brain/scripts/vcs/actor-check.mjs`,
```

```amend-find
- `brain/scripts/vcs/providers/{github,gitlab}.mjs`, `brain/scripts/review/poster.mjs`,
```

```amend-replace
- `brain/scripts/axes/vcs/adapters/{github,gitlab}.mjs` (then under brain/scripts/vcs/providers/; see Amendment 3), `brain/scripts/review/poster.mjs`,
```

```amend-find
- `brain/scripts/vcs/providers/vcs.contract.test.mjs` forces parity **including the
```

```amend-replace
- `brain/scripts/axes/vcs/contract.test.mjs` (then brain/scripts/vcs/providers/vcs.contract.test.mjs; see Amendment 3) forces parity **including the
```

## Amendment 3 — the VCS adapters and their contract suite moved to `axes/vcs/` (issue #1141)

**Signed**: DD/MM/YYYY — <Name>

#1141 moved every adapter into one directory per axis, with `git mv`, so `git log --follow`
still reaches their history:

| as written above | the path today |
|---|---|
| brain/scripts/vcs/providers/github.mjs | `brain/scripts/axes/vcs/adapters/github.mjs` |
| brain/scripts/vcs/providers/gitlab.mjs | `brain/scripts/axes/vcs/adapters/gitlab.mjs` |
| brain/scripts/vcs/providers/vcs.contract.test.mjs | `brain/scripts/axes/vcs/contract.test.mjs` |

Each citation above is annotated in place with its new path. The four COMMENT-only verbs, the
three locks and the reviewActors/approvalActors split are unchanged.

### Notes for the promoter

Path annotation only. Promote on the #1141 branch.
