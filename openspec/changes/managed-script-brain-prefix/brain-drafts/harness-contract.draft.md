# harness-contract.md — memory script names move to `brain:memory:*` (issue #961)

> **Tier 2 draft. Not yet promoted.** Promote only after the Tier-1 PR has merged (ruling R1), and
> after `agent-authorities.draft.md`.
>
> ```
> npm run brain:promote -- openspec/changes/managed-script-brain-prefix/brain-drafts/harness-contract.draft.md
> ```
>
> `harness-contract.md` is one of the five `SOURCE_DOCS`, so this promotion regenerates `AGENTS.md`
> (its lines 227-231 are this verb table, compiled).
>
> Each anchor names a script that occurs exactly once in the target (lines 32-36), and no anchor occurs
> inside its own replacement (k = 0). The older `issue-863-backend-contract/brain-drafts/harness-contract.draft.md`
> is already promoted and superseded; re-running it is refused (its anchors occur 0 times).

```brain-amendment/1
target: brain/core/methodology/harness-contract.md
issue: 961
```

## Edit 1 — line 32

```amend-find
| `npm run memory:share` |
```

```amend-replace
| `npm run brain:memory:share` |
```

## Edit 2 — line 33

```amend-find
| `npm run memory:pull` |
```

```amend-replace
| `npm run brain:memory:pull` |
```

## Edit 3 — line 34

```amend-find
| `npm run memory:index` |
```

```amend-replace
| `npm run brain:memory:index` |
```

## Edit 4 — line 35

```amend-find
| `npm run memory:save` |
```

```amend-replace
| `npm run brain:memory:save` |
```

## Edit 5 — line 36

```amend-find
| `npm run memory:audit` |
```

```amend-replace
| `npm run brain:memory:audit` |
```
