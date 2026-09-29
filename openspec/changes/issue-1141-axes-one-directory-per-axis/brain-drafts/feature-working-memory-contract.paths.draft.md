# Amendment draft — `feature-working-memory-contract.md` names the engram adapter's new home (issue #1141)

> **Tier 2 draft. Not promoted, and an agent may not promote it.** Run it on THIS branch:
>
> ```
> npm run brain:promote -- openspec/changes/issue-1141-axes-one-directory-per-axis/brain-drafts/feature-working-memory-contract.paths.draft.md
> ```
>
> Path edit only. #1141 moved `scripts/memory/backends/` to `scripts/axes/memory/adapters/`.

```brain-amendment/1
target: brain/core/methodology/feature-working-memory-contract.md
issue: 1141
```

```amend-find
- `scripts/memory/backends/engram.mjs` — engram implementation of the verbs (Slice 2).
```

```amend-replace
- `scripts/axes/memory/adapters/engram.mjs` — engram implementation of the verbs (Slice 2).
```
