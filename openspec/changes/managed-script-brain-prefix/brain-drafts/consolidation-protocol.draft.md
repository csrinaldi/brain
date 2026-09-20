# consolidation-protocol.md §5 — memory script names move to `brain:memory:*` (issue #961)

> **Tier 2 draft. Not yet promoted.** Promote only after the Tier-1 PR has merged (ruling R1).
>
> ```
> npm run brain:promote -- openspec/changes/managed-script-brain-prefix/brain-drafts/consolidation-protocol.draft.md
> ```
>
> The target names the scripts on lines 190, 191, 192, 194, 197, 200 and 202 only. Each anchor below is
> distinct among those lines, so it occurs exactly once, and none occurs inside its own replacement (k = 0).
> Edit 5 sits inside the target's ```` ```bash ```` fence; the anchor is the command line alone.

```brain-amendment/1
target: brain/core/methodology/consolidation-protocol.md
issue: 961
```

## Edit 1 — line 190

```amend-find
(`memory:pull` — `git pull`, then `cli.mjs import`)
```

```amend-replace
(`brain:memory:pull` — `git pull`, then `cli.mjs import`)
```

## Edit 2 — line 191

```amend-find
**index** (`memory:index`)
```

```amend-replace
**index** (`brain:memory:index`)
```

## Edit 3 — line 192

```amend-find
**materialize** (`memory:share`)
```

```amend-replace
**materialize** (`brain:memory:share`)
```

## Edit 4 — line 194

```amend-find
(`npm run memory:save --issue N`, rule 2)
```

```amend-replace
(`npm run brain:memory:save --issue N`, rule 2)
```

## Edit 5 — line 197

```amend-find
npm run memory:share && git add .memory/ && git status
```

```amend-replace
npm run brain:memory:share && git add .memory/ && git status
```

## Edit 6 — line 200

```amend-find
runs `memory:share` and **warns, never blocks**
```

```amend-replace
runs `brain:memory:share` and **warns, never blocks**
```

## Edit 7 — line 202

```amend-find
with `npm run memory:pull` or on the next `brain:day:start`
```

```amend-replace
with `npm run brain:memory:pull` or on the next `brain:day:start`
```
