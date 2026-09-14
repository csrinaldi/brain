# feature-working-memory-contract.md — memory script names move to `brain:memory:*` (issue #961)

> **Tier 2 draft. Not yet promoted.** Promote only after the Tier-1 PR has merged (ruling R1).
>
> ```
> npm run brain:promote -- openspec/changes/managed-script-brain-prefix/brain-drafts/feature-working-memory-contract.draft.md
> ```
>
> The target names a script on line 145 only. The anchor occurs exactly once and does not occur inside its
> replacement (k = 0).

```brain-amendment/1
target: brain/core/methodology/feature-working-memory-contract.md
issue: 961
```

## Edit 1 — line 145

```amend-find
the export that `memory:share` writes to `.memory/`
```

```amend-replace
the export that `brain:memory:share` writes to `.memory/`
```
