# memory-format.md — memory script names move to `brain:memory:*` (issue #961)

> **Tier 2 draft. Not yet promoted.** Promote only after the Tier-1 PR has merged (ruling R1).
>
> ```
> npm run brain:promote -- openspec/changes/managed-script-brain-prefix/brain-drafts/memory-format.draft.md
> ```
>
> The target names the scripts on lines 43, 45, 220, 234, 247, 248, 256, 260 and 340. Each anchor is
> distinct among those lines, occurs exactly once, and does not occur inside its own replacement (k = 0).
> `memory:import` on line 340 is not an npm script and is out of scope.
>
> Older drafts on this target (`issue-330…/memory-format-index-merge.md`, `issue-635…/memory-format-churn.draft.md`,
> `issue-677…/memory-format.draft.md`) are already promoted; after this draft lands their replacement text no
> longer occurs, so a re-run is refused rather than re-applied. `issue-701…/memory-format.note.draft.md` is NOT
> promoted and is pasted by hand — see `README.md` in this folder.

```brain-amendment/1
target: brain/core/methodology/memory-format.md
issue: 961
```

## Edit 1 — line 43

```amend-find
by running `memory:split-records`, and one that does not
```

```amend-replace
by running `brain:memory:split-records`, and one that does not
```

## Edit 2 — line 45

```amend-find
regenerable via a future `memory:reindex`.
```

```amend-replace
regenerable via a future `brain:memory:reindex`.
```

## Edit 3 — line 220

```amend-find
the index is rebuilt from them by `memory:reindex`.
```

```amend-replace
the index is rebuilt from them by `brain:memory:reindex`.
```

## Edit 4 — line 234

```amend-find
That helper is **`npm run memory:resolve-index`** (issue #330)
```

```amend-replace
That helper is **`npm run brain:memory:resolve-index`** (issue #330)
```

## Edit 5 — line 247

```amend-find
`npm run memory:resolve-index` is that resolution as one command
```

```amend-replace
`npm run brain:memory:resolve-index` is that resolution as one command
```

## Edit 6 — line 248

```amend-find
the same `rebuildIndex()` that `memory:reindex` runs
```

```amend-replace
the same `rebuildIndex()` that `brain:memory:reindex` runs
```

## Edit 7 — line 256

```amend-find
**Low-churn** — `memory:reindex` / `memory:share` **MUST NOT produce whole-file churn
```

```amend-replace
**Low-churn** — `brain:memory:reindex` / `brain:memory:share` **MUST NOT produce whole-file churn
```

## Edit 8 — line 260

```amend-find
rewrote the full file each `memory:share` and blocked a raw
```

```amend-replace
rewrote the full file each `brain:memory:share` and blocked a raw
```

## Edit 9 — line 340

```amend-find
layer only. `memory:share` materializes durable knowledge into `records/`
```

```amend-replace
layer only. `brain:memory:share` materializes durable knowledge into `records/`
```
