# ADR-0011 Amendment 1 — draft (issue #961)

> **Tier 3 draft. Not yet promoted.** ADR-0011 is signed and carries no amendment yet.
>
> ```
> npm run brain:promote -- openspec/changes/managed-script-brain-prefix/brain-drafts/adr-0011-amendment-1.draft.md
> ```
>
> **Ruling gap resolved 2026-09-14 — R6 amended (option A).** The one line naming a bare `memory:*`
> script is annotated in place via one `amend-find`/`amend-replace` pair, per `consolidation-protocol.md`
> §1c act 2. See `README.md` and the maintainer ruling (issue #961 comment, 2026-09-14; engram
> `sdd/managed-script-brain-prefix/ruling-r6-amendment`).

```brain-amendment/1
target: brain/project/decisions/adr-0011-feature-scoped-working-memory.md
amendment: 1
issue: 961
home-summary: the export this ADR cites is now `brain:memory:share`; the bare name stays as a repo-only alias and the decision is unchanged, #961
body: ## Amendment 1 — the memory script names move to the `brain:memory:` namespace (issue #961)
body-end: ### Notes for the promoter
```

## Amendment 1 — the memory script names move to the `brain:memory:` namespace (issue #961)

**Signed**: DD/MM/YYYY — <Name>

### What this changes

The npm script this ADR names was renamed into the `brain:` namespace that brain's verbs use in a
consumer's `package.json`:

| as written above | the script today |
|---|---|
| `memory:share` | `brain:memory:share` |

The body above is not rewritten (ruling R6 on #961): no line of this ADR runs a script with a literal
`npm run`, so the decision reads the same and this table is the whole mapping.

### What this does NOT change

Feature-scoped working memory, `resume.md`, and the namespace isolation that keeps feature observations
out of the export. The verb keeps its behaviour and arguments; brain's own `package.json` keeps the bare
name as a byte-identical alias, never installed into a consumer.

### Notes for the promoter

The anchor names the only occurrence of `memory:share` in the target (line 37), verified with `assessEdit`
(`free = 1`).

```amend-find
are not materialized by `memory:share`.
```

```amend-replace
are not materialized by `memory:share` (renamed `brain:memory:share`; see Amendment 1).
```
