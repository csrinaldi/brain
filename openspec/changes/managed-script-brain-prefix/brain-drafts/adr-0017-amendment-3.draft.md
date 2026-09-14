# ADR-0017 Amendment 3 — draft (issue #961)

> **Tier 3 draft. Not yet promoted.** ADR-0017 is signed and stands at Amendments 1-2.
>
> ```
> npm run brain:promote -- openspec/changes/managed-script-brain-prefix/brain-drafts/adr-0017-amendment-3.draft.md
> ```
>
> **As written, the verb REFUSES this draft** (`amendment-draft.mjs:171-177`). Resolve the ruling gap in
> `README.md` first (option A: convert the `text` blocks below into an edit pair; option B: acts 1, 3, 4 by hand).
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

Option A only if ruled. The anchor is the only line of the target ending the index-conflict rule (line 182);
it occurs exactly once and is a prefix of its replacement (k = 1).

```text
running `memory:reindex`**, never by hand- or union-merging it.
```

```text
running `memory:reindex`**, never by hand- or union-merging it. **[Amended by Amendment 3 (#961) — the memory scripts this ADR names are now `brain:memory:*`]**
```
