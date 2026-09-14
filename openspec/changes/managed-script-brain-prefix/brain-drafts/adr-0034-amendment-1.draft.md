# ADR-0034 Amendment 1 — draft (issue #961)

> **Tier 3 draft. Not yet promoted.** ADR-0034 is signed and carries no amendment yet.
>
> ```
> npm run brain:promote -- openspec/changes/managed-script-brain-prefix/brain-drafts/adr-0034-amendment-1.draft.md
> ```
>
> **As written, the verb REFUSES this draft** (`amendment-draft.mjs:171-177`). Resolve the ruling gap in
> `README.md` first (option A: convert the `text` blocks below into an edit pair; option B: acts 1, 3, 4 by hand).

```brain-amendment/1
target: brain/project/decisions/adr-0034-memory-travels-on-its-own-lane.md
amendment: 1
issue: 961
home-summary: `brain:memory:ship` is now the real script name, and the scripts the ADR cites as `memory:save`/`memory:share`/`memory:audit` are `brain:memory:*`; the bare names stay as repo-only aliases and the lane decision is unchanged, #961
body: ## Amendment 1 — the memory script names move to the `brain:memory:` namespace (issue #961)
body-end: ### Notes for the promoter
```

## Amendment 1 — the memory script names move to the `brain:memory:` namespace (issue #961)

**Signed**: DD/MM/YYYY — <Name>

### What this changes

L5 named the lane's trigger `brain:memory:ship` while the script was still `memory:ship`. The eleven
memory scripts now live in the `brain:` namespace that brain's verbs use in a consumer's `package.json`,
so that name is real, and the other scripts this ADR cites read through this table:

| as written above | the script today |
|---|---|
| `memory:save` | `brain:memory:save` |
| `memory:share` | `brain:memory:share` |
| `memory:audit` | `brain:memory:audit` |
| `brain:memory:ship` | unchanged — now the real script |

The body above is not rewritten (ruling R6 on #961): no line of this ADR runs a script with a literal
`npm run`, so the decision reads the same and this table is the whole mapping.

### What this does NOT change

L1-L9, C1 and C2, the targets and the dependency order. Every verb keeps its behaviour and arguments;
brain's own `package.json` keeps each bare name as a byte-identical alias, never installed into a consumer.

### Notes for the promoter

Option A only if ruled. The anchor (line 13) occurs exactly once in the target — the baseline figures
reappear on line 185 in a different form — and it is a prefix of its replacement (k = 1).

```text
2026-08-01): **p50 21.6 h, p90 399.7 h** learn→main.
```

```text
2026-08-01): **p50 21.6 h, p90 399.7 h** learn→main. **[Amended by Amendment 1 (#961) — the memory scripts this ADR names are now `brain:memory:*`]**
```
