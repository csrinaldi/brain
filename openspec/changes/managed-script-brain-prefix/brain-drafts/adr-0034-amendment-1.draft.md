# ADR-0034 Amendment 1 — draft (issue #961)

> **Tier 3 draft. Not yet promoted.** ADR-0034 is signed and carries no amendment yet.
>
> ```
> npm run brain:promote -- openspec/changes/managed-script-brain-prefix/brain-drafts/adr-0034-amendment-1.draft.md
> ```
>
> **Ruling gap resolved 2026-09-14 — R6 amended (option A).** Every ADR line naming a bare `memory:*`
> script is annotated in place, one `amend-find`/`amend-replace` pair per line, per
> `consolidation-protocol.md` §1c act 2. See `README.md` and the maintainer ruling (issue #961 comment,
> 2026-09-14; engram `sdd/managed-script-brain-prefix/ruling-r6-amendment`).

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

This ADR names three scripts (`save`, `share`, `audit`) across nine lines. `brain:memory:ship` at
lines 136 and 143 already carries the correct prefix (L5's trigger) and is left untouched — annotating
it would double-prefix it. Every anchor below was verified against this ADR on this branch with
`assessEdit`: it occurs exactly once (`free = 1`).

```amend-find
(`memory:save`),
```

```amend-replace
(`memory:save` (renamed `brain:memory:save`; see Amendment 1)),
```

```amend-find
`memory:share` materializes it into `.memory/records/` before
```

```amend-replace
`memory:share` (renamed `brain:memory:share`; see Amendment 1) materializes it into `.memory/records/` before
```

```amend-find
`memory:audit`'s baseline on `main @ 96cd30c8`
```

```amend-replace
`memory:audit` (renamed `brain:memory:audit`; see Amendment 1)'s baseline on `main @ 96cd30c8`
```

```amend-find
and the next `memory:share`
on whatever PR touches memory refreshes the committed copy.
```

```amend-replace
and the next `memory:share` (renamed `brain:memory:share`; see Amendment 1)
on whatever PR touches memory refreshes the committed copy.
```

```amend-find
captured with `memory:share`
```

```amend-replace
captured with `memory:share` (renamed `brain:memory:share`; see Amendment 1)
```

```amend-find
captured as a record (`memory:save
--issue N`)
```

```amend-replace
captured as a record (`memory:save
--issue N`) (renamed `brain:memory:save`; see Amendment 1)
```

```amend-find
(record-first: `memory:save` writes a record before any backend, under
```

```amend-replace
(record-first: `memory:save` (renamed `brain:memory:save`; see Amendment 1) writes a record before any backend, under
```

```amend-find
`memory:audit` MUST report, at `lite`,
```

```amend-replace
`memory:audit` (renamed `brain:memory:audit`; see Amendment 1) MUST report, at `lite`,
```

```amend-find
records between a lane merge and the next `memory:share`.
```

```amend-replace
records between a lane merge and the next `memory:share` (renamed `brain:memory:share`; see Amendment 1).
```
