# agent-authorities.md — Tier 1's capture row names `cli.mjs hydrate` (issue #1115)

> **Tier 2 target. Not promoted, and an agent may not promote it.** Changes to this document
> require an MR reviewed by `@crinaldi`. This is a wording fix and no tier changes.
>
> ```
> npm run brain:promote -- openspec/changes/issue-1115-memory-lifecycle-verb/brain-drafts/agent-authorities-hydrate.draft.md
> ```
>
> **Your commit is the signature** (ADR-0028).

```brain-amendment/1
target: brain/core/methodology/agent-authorities.md
issue: 1115
body: ## Hydration verb wording (issue #1115)
body-end: ### Notes for the promoter
```

```amend-find
the active backend picks it up on the next hydration (`session:start`, `cli.mjs import`) until #874 adds direct hydration.
```

```amend-replace
the active backend picks it up on the next hydration (`session:start`, `cli.mjs hydrate` **[amended, #1115: was `cli.mjs import`, now its deprecated alias]**) until #874 adds direct hydration.
```

## Hydration verb wording (issue #1115)

**Signed**: DD/MM/YYYY — <Name>

### What changed

Tier 1's memory-capture row named `cli.mjs import`, engram's op, as the next hydration. The op is
now `hydrate`, implemented by every backend (`memory-backend-contract.md` Amendment 3). No
authority changes: every tier, and what an agent may do, is unchanged.

### Notes for the promoter

One in-place annotation, Tier 1's capture row.
