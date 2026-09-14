# ADR-0002 Amendment 3 — draft (issue #961)

> **Tier 3 draft. Not yet promoted.** ADR-0002 is signed and stands at Amendments 1-2.
>
> ```
> npm run brain:promote -- openspec/changes/managed-script-brain-prefix/brain-drafts/adr-0002-amendment-3.draft.md
> ```
>
> **Ruling gap resolved 2026-09-14 — R6 amended (option A).** Every ADR line naming a bare `memory:*`
> script is annotated in place, one `amend-find`/`amend-replace` pair per line, per
> `consolidation-protocol.md` §1c act 2; the appended signed amendment below still carries the full
> rename table. See `README.md` and the maintainer ruling (issue #961 comment, 2026-09-14; engram
> `sdd/managed-script-brain-prefix/ruling-r6-amendment`).

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

Every line of the Decision, the Note and Amendment 2 above that names a bare `memory:*` script gets one
`amend-find`/`amend-replace` pair — seven anchors, three scripts (`pull`, `index`, `share`; `memory:import`
is not a script and is left alone). Each anchor was verified against this ADR on this branch with
`assessEdit`: it occurs exactly once (`free = 1`), and none collides with `brain:memory:ship`, already
correctly prefixed at line 86 — left untouched, since annotating it would double-prefix it.

```amend-find
- `memory:pull` → churn-resilient sync:
```

```amend-replace
- `memory:pull` (renamed `brain:memory:pull`; see Amendment 3) → churn-resilient sync:
```

```amend-find
- `memory:index` → reprojects the durable `brain/` into the active backend.
```

```amend-replace
- `memory:index` (renamed `brain:memory:index`; see Amendment 3) → reprojects the durable `brain/` into the active backend.
```

```amend-find
- `memory:share` → materializes the active backend to `.memory/` before push.
```

```amend-replace
- `memory:share` (renamed `brain:memory:share`; see Amendment 3) → materializes the active backend to `.memory/` before push.
```

```amend-find
The `pre-push` hook runs `memory:share`;
```

```amend-replace
The `pre-push` hook runs `memory:share` (renamed `brain:memory:share`; see Amendment 3);
```

```amend-find
rewrites the manifest on every `memory:share`, which blocks a raw `git pull`
```

```amend-replace
rewrites the manifest on every `memory:share` (renamed `brain:memory:share`; see Amendment 3), which blocks a raw `git pull`
```

```amend-find
the churn-resilient `memory:pull` (restore → pull → import)
```

```amend-replace
the churn-resilient `memory:pull` (renamed `brain:memory:pull`; see Amendment 3) (restore → pull → import)
```

```amend-find
The canonical flow's `memory:share` and `pre-push` bullets
```

```amend-replace
The canonical flow's `memory:share` (renamed `brain:memory:share`; see Amendment 3) and `pre-push` bullets
```

Promote after the seven `brain/core` drafts in this folder; see `README.md` for the order.
