# ADR-0002 Amendment 3 — draft (issue #961)

> **Tier 3 draft. Not yet promoted.** ADR-0002 is signed and stands at Amendments 1-2.
>
> ```
> npm run brain:promote -- openspec/changes/managed-script-brain-prefix/brain-drafts/adr-0002-amendment-3.draft.md
> ```
>
> **As written, the verb REFUSES this draft** (`amendment-draft.mjs:171-177`: an ADR amendment must declare
> at least one `amend-find`/`amend-replace` pair). Ruling R6 says the ADR body stays untouched. Resolve the
> ruling gap in `README.md` first: option A converts the two `text` blocks under "Notes for the promoter" into
> an edit pair; option B applies acts 1, 3 and 4 by hand from this draft.

```brain-amendment/1
target: brain/project/decisions/adr-0002-memoria-git-based-dos-capas.md
amendment: 3
issue: 961
home-summary: the canonical flow's scripts are now `brain:memory:pull`, `brain:memory:index` and `brain:memory:share`; the bare names stay as repo-only aliases and the two-layer decision is unchanged, #961
body: ## Amendment 3 — the memory script names move to the `brain:memory:` namespace (issue #961)
body-end: ### Notes for the promoter
```

## Amendment 3 — the memory script names move to the `brain:memory:` namespace (issue #961)

**Signed**: DD/MM/YYYY — <Name>

### What this changes

The npm scripts this ADR names were renamed into the `brain:` namespace that brain's verbs use in a
consumer's `package.json` — the namespace `brain:memory:session-end` already followed. Read the
canonical flow above through this table:

| as written above | the script today |
|---|---|
| `memory:pull` | `brain:memory:pull` |
| `memory:index` | `brain:memory:index` |
| `memory:share` | `brain:memory:share` |

`brain:memory:ship`, which the flow and Amendment 2 already cite, is now the real name of that script
rather than a name ahead of it. `memory:import` is not an npm script and is not renamed.

The body above is not rewritten (ruling R6 on #961): no line of this ADR runs a script with a literal
`npm run`, so the decision reads the same and this table is the whole mapping.

### What this does NOT change

The two-layer decision, and everything Amendments 1 and 2 settled. Every verb keeps its behaviour, its
CLI (`brain/scripts/memory/cli.mjs <verb>`) and its arguments. brain's own `package.json` keeps each
bare name as a byte-identical alias, so a command quoted from a record or an older document still runs;
those aliases are never installed into a consumer.

### Notes for the promoter

Option A (only if the maintainer rules it — it adds one §1c act-2 annotation, which R6 as ratified does
not). Change the first fence tag below to `amend-find` and the second to `amend-replace`. The anchor is
the only line of the target naming `memory:index` (line 30), so it occurs exactly once; it is a prefix
of its replacement (k = 1), which `assessEdit` accounts for.

```text
- `memory:index` → reprojects the durable `brain/` into the active backend.
```

```text
- `memory:index` → reprojects the durable `brain/` into the active backend. **[Amended by Amendment 3 (#961) — the memory scripts this flow names are now `brain:memory:*`]**
```

Promote after the seven `brain/core` drafts in this folder; see `README.md` for the order.
