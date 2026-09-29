# Amendment draft — `memory-backend-contract.md` names the memory adapters' new home (issue #1141)

> **Tier 2 draft. Not promoted, and an agent may not promote it.** Run it on THIS branch, so the
> citations are right in the same pull request that moves the files. Until it is promoted,
> `brain:nav` reports two dead citations here and `lib/home-scaffold-nav-integrity.test.mjs`
> is red:
>
> ```
> npm run brain:promote -- openspec/changes/issue-1141-axes-one-directory-per-axis/brain-drafts/memory-backend-contract.paths.draft.md
> ```
>
> Path edits only. #1141 moved `brain/scripts/memory/backends/` to
> `brain/scripts/axes/memory/adapters/`; no rule, verb or behaviour in this contract changed.

```brain-amendment/1
target: brain/core/methodology/memory-backend-contract.md
issue: 1141
```

```amend-find
and delegates to `brain/scripts/memory/backends/<backend>.mjs`. Verbs that are
```

```amend-replace
and delegates to `brain/scripts/axes/memory/adapters/<backend>.mjs`. Verbs that are
```

```amend-find
1. Create `brain/scripts/memory/backends/<name>.mjs` exporting the four required verbs and
```

```amend-replace
1. Create `brain/scripts/axes/memory/adapters/<name>.mjs` exporting the four required verbs and
```

```amend-find
- `engram.save()` (`brain/scripts/memory/backends/engram.mjs`) is no longer
```

```amend-replace
- `engram.save()` (`brain/scripts/axes/memory/adapters/engram.mjs`) is no longer
```

```amend-find
- `engram.share()` (`brain/scripts/memory/backends/engram.mjs`) is now the
```

```amend-replace
- `engram.share()` (`brain/scripts/axes/memory/adapters/engram.mjs`) is now the
```
