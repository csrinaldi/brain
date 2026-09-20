# ADR-0017 Amendment 3 — draft (issue #961)

> **Tier 3 draft. Not yet promoted.** ADR-0017 is signed and stands at Amendments 1-2.
>
> ```
> npm run brain:promote -- openspec/changes/managed-script-brain-prefix/brain-drafts/adr-0017-amendment-3.draft.md
> ```
>
> **Ruling gap resolved 2026-09-14 — R6 amended (option A).** Every ADR line naming a bare `memory:*`
> script is annotated in place, one `amend-find`/`amend-replace` pair per line, per
> `consolidation-protocol.md` §1c act 2. See `README.md` and the maintainer ruling (issue #961 comment,
> 2026-09-14; engram `sdd/managed-script-brain-prefix/ruling-r6-amendment`).
>
> The older `issue-635…/adr-0017-amendment-1.draft.md` and `issue-677…/adr-0017-amendment-2.draft.md` are
> promoted; once this lands, re-running either is refused at act 1 (the target stands at Amendment 3).

```brain-amendment/1
target: brain/project/decisions/adr-0017-memory-format-owned-by-brain.md
amendment: 3
issue: 961
home-summary: the scripts this ADR cites are now `brain:memory:*` (`save`, `share`, `reindex`, `resolve-index`, `split-records`); the bare names stay as repo-only aliases and the format decision is unchanged, #961
body: ## Amendment 3 — the memory script names move to the `brain:memory:` namespace (issue #961)
body-end: ### Notes for the promoter
```

## Amendment 3 — the memory script names move to the `brain:memory:` namespace (issue #961)

**Signed**: DD/MM/YYYY — <Name>

### What this changes

The npm scripts this ADR and its amendments name were renamed into the `brain:` namespace that brain's
verbs use in a consumer's `package.json`:

| as written above | the script today |
|---|---|
| `memory:save` | `brain:memory:save` |
| `memory:share` | `brain:memory:share` |
| `memory:reindex` | `brain:memory:reindex` |
| `memory:resolve-index` | `brain:memory:resolve-index` |
| `memory:split-records` | `brain:memory:split-records` |

The body and Amendments 1-2 above are not rewritten (ruling R6 on #961): no line of this ADR runs a
script with a literal `npm run`, so the decision reads the same and this table is the whole mapping.

### What this does NOT change

The record schema, the content-addressed `id`, the append-only rule, the layout Amendment 2 set, and the
low-churn rule. Every verb keeps its behaviour and arguments; brain's own `package.json` keeps each bare
name as a byte-identical alias, never installed into a consumer.

### Notes for the promoter

This ADR names five scripts (`save`, `share`, `reindex`, `resolve-index`, `split-records`) across eleven
lines (two of them — the index-churn-discipline line and the Amendment 1 quote — each name two scripts
side by side, so they share one combined anchor). Every anchor was verified against this ADR on this
branch with `assessEdit`: it occurs exactly once (`free = 1`).

```amend-find
it runs `memory:split-records`, which refuses any line it cannot read
```

```amend-replace
it runs `memory:split-records` (renamed `brain:memory:split-records`; see Amendment 3), which refuses any line it cannot read
```

```amend-find
via a future `memory:reindex`.
```

```amend-replace
via a future `memory:reindex` (renamed `brain:memory:reindex`; see Amendment 3).
```

```amend-find
running `memory:reindex`**, never by hand- or union-merging it.
```

```amend-replace
running `memory:reindex` (renamed `brain:memory:reindex`; see Amendment 3)**, never by hand- or union-merging it.
```

```amend-find
`memory:share` / `memory:reindex` **MUST NOT produce whole-file churn in `index.jsonl`**
```

```amend-replace
`memory:share` / `memory:reindex` **MUST NOT produce whole-file churn in `index.jsonl`** (renamed `brain:memory:share` / `brain:memory:reindex`; see Amendment 3)
```

```amend-find
the entire manifest each `memory:share` and blocked a raw
```

```amend-replace
the entire manifest each `memory:share` (renamed `brain:memory:share`; see Amendment 3) and blocked a raw
```

```amend-find
`memory:resolve-index`, and the answer for `records/` is the layout, not a driver.)
```

```amend-replace
`memory:resolve-index` (renamed `brain:memory:resolve-index`; see Amendment 3), and the answer for `records/` is the layout, not a driver.)
```

```amend-find
has not run `memory:split-records` still carries the month log
```

```amend-replace
has not run `memory:split-records` (renamed `brain:memory:split-records`; see Amendment 3) still carries the month log
```

```amend-find
The record said `memory:share` / `memory:reindex`
```

```amend-replace
The record said `memory:share` / `memory:reindex` (renamed `brain:memory:share` / `brain:memory:reindex`; see Amendment 3)
```

```amend-find
`memory:save` appends one line to `records/<yyyy-mm>.jsonl`;
```

```amend-replace
`memory:save` (renamed `brain:memory:save`; see Amendment 3) appends one line to `records/<yyyy-mm>.jsonl`;
```

```amend-find
`memory:split-records` performs the migration: report-only unless `--apply`,
```

```amend-replace
`memory:split-records` (renamed `brain:memory:split-records`; see Amendment 3) performs the migration: report-only unless `--apply`,
```

```amend-find
loses a pointer that `memory:share` rebuilds, not a durable
```

```amend-replace
loses a pointer that `memory:share` (renamed `brain:memory:share`; see Amendment 3) rebuilds, not a durable
```
