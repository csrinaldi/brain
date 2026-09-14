# memory-backend-contract.md — memory script names move to `brain:memory:*` (issue #961)

> **Tier 2 draft. Not yet promoted.** Promote only after the Tier-1 PR has merged (ruling R1).
>
> ```
> npm run brain:promote -- openspec/changes/managed-script-brain-prefix/brain-drafts/memory-backend-contract.draft.md
> ```
>
> The target names the scripts on lines 45, 46, 63, 82, 97, 98, 100 and 154. Lines 45-100 are the living
> contract and are renamed below. **Line 154 is deliberately left as written:** it sits inside the signed
> `## Amendment 1` section (#874, signed 11/09/2026) and records what landed under the name the script had
> then — the same "true when written" rule the Tier-1 PR applies to records and history (design D5).
>
> Each anchor is distinct among those lines, occurs exactly once, and does not occur inside its own
> replacement (k = 0). The older `issue-863-backend-contract/brain-drafts/memory-backend-contract.md` is a
> promoted new-file draft; `brain:promote` refuses it because the destination exists.

```brain-amendment/1
target: brain/core/methodology/memory-backend-contract.md
issue: 961
```

## Edit 1 — line 45

```amend-find
`session:start`, `memory:share`,
```

```amend-replace
`session:start`, `brain:memory:share`,
```

## Edit 2 — line 46

```amend-find
`memory:pull` and `cli.mjs import` complete
```

```amend-replace
`brain:memory:pull` and `cli.mjs import` complete
```

## Edit 3 — line 63

```amend-find
`memory:save`'s `package.json` pin is removed
```

```amend-replace
`brain:memory:save`'s `package.json` pin is removed
```

## Edit 4 — line 82

```amend-find
| memory CLI — `memory:save` |
```

```amend-replace
| memory CLI — `brain:memory:save` |
```

## Edit 5 — line 97

```amend-find
(1) `memory:save --supersedes <id>` writes the
```

```amend-replace
(1) `brain:memory:save --supersedes <id>` writes the
```

## Edit 6 — line 98

```amend-find
— `memory:share` or the record-first save path
```

```amend-replace
— `brain:memory:share` or the record-first save path
```

## Edit 7 — line 100

```amend-find
(4) `memory:reindex` regenerates
```

```amend-replace
(4) `brain:memory:reindex` regenerates
```
