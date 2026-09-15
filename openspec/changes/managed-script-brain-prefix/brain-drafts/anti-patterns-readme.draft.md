# anti-patterns/README.md — memory script names move to `brain:memory:*` (issue #961)

> **Tier 2 draft. Not yet promoted.** Promote only after the Tier-1 PR has merged (ruling R1).
>
> ```
> npm run brain:promote -- openspec/changes/managed-script-brain-prefix/brain-drafts/anti-patterns-readme.draft.md
> ```
>
> The target names a script on line 22 only. The anchor occurs exactly once and does not occur inside its
> replacement (k = 0).

```brain-amendment/1
target: brain/core/anti-patterns/README.md
issue: 961
```

## Edit 1 — line 22

```amend-find
**Indexed** with `npm run memory:index` whenever
```

```amend-replace
**Indexed** with `npm run brain:memory:index` whenever
```
