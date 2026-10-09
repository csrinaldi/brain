# memory-format.md — the projection into the live layer is `hydrate` (issue #1115)

> **Tier 2 target. Not promoted, and an agent may not promote it.** It is outside ruling 6's list
> of files, but it is the same wording class: `memory-format.md:340` names `memory:import`, a
> script `package.json` no longer has. Skip it if you prefer to keep the promote set to the five
> files the ruling names.
>
> ```
> npm run brain:promote -- openspec/changes/issue-1115-memory-lifecycle-verb/brain-drafts/memory-format-hydrate.draft.md
> ```
>
> **Your commit is the signature** (ADR-0028).

```brain-amendment/1
target: brain/core/methodology/memory-format.md
issue: 1115
body: ## Projection verb wording (issue #1115)
body-end: ### Notes for the promoter
```

```amend-find
`memory:import`
projects `records/` into the active backend.
```

```amend-replace
`cli.mjs hydrate`
**[amended, #1115: was `memory:import`, a script that no longer exists]** projects `records/` into the active backend.
```

## Projection verb wording (issue #1115)

**Signed**: DD/MM/YYYY — <Name>

### What changed

*Relationship to the live layer* named `memory:import` as the projection of `records/` into the
backend. No such script exists in `package.json`. The projection is the required `hydrate` verb
(`memory-backend-contract.md` Amendment 3), dispatched as `cli.mjs hydrate` on every backend.

### Notes for the promoter

One in-place annotation. The format itself is unchanged.
