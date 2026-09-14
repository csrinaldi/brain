# ADR-0014 Amendment 1 — draft (issue #961)

> **Tier 3 draft. Not yet promoted.** ADR-0014 is signed and carries no amendment yet.
>
> ```
> npm run brain:promote -- openspec/changes/managed-script-brain-prefix/brain-drafts/adr-0014-amendment-1.draft.md
> ```
>
> **As written, the verb REFUSES this draft** (`amendment-draft.mjs:171-177`). Resolve the ruling gap in
> `README.md` first (option A: convert the `text` blocks below into an edit pair; option B: acts 1, 3, 4 by hand).

```brain-amendment/1
target: brain/project/decisions/adr-0014-workflow-governance.md
amendment: 1
issue: 961
home-summary: the memory-dump proxy's script is now `brain:memory:share`; the bare name stays as a repo-only alias and the invariants are unchanged, #961
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

The load-bearing invariants, and what invariant (3)'s proxy proves and does not prove. The verb keeps its
behaviour and arguments; brain's own `package.json` keeps the bare name as a byte-identical alias, never
installed into a consumer.

### Notes for the promoter

Option A only if ruled. The anchor names the only occurrence of `memory:share` in the target (line 65);
it is a prefix of its replacement (k = 1).

```text
the PR (⇒ `memory:share` ran).
```

```text
the PR (⇒ `memory:share` ran). **[Amended by Amendment 1 (#961) — now `brain:memory:share`]**
```
