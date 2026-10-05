# harness-contract.md — the next hydration is `cli.mjs hydrate` (issue #1115)

> **Tier 2 target. Not promoted, and an agent may not promote it.**
>
> ```
> npm run brain:promote -- openspec/changes/issue-1115-memory-lifecycle-verb/brain-drafts/harness-contract-hydrate.draft.md
> ```
>
> **Your commit is the signature** (ADR-0028).

```brain-amendment/1
target: brain/core/methodology/harness-contract.md
issue: 1115
body: ## The hydration verb is `hydrate` (issue #1115)
body-end: ### Notes for the promoter
```

```amend-find
the active backend picks the record up on its next hydration (`session:start`, `cli.mjs import`); direct hydration lands with #874.
```

```amend-replace
the active backend picks the record up on its next hydration (`session:start`, `cli.mjs hydrate` **[amended, #1115: was `cli.mjs import`, now its deprecated alias]**); direct hydration lands with #874.
```

## The hydration verb is `hydrate` (issue #1115)

**Signed**: DD/MM/YYYY — <Name>

### What changed

The `brain:memory:save` row named `cli.mjs import` as the next hydration. That op was engram's,
and `plainfiles` refused it. The dispatcher's op is now `hydrate`, implemented by every backend
(`memory-backend-contract.md` Amendment 3). `import` stays as a deprecated alias for one release.

### What this does NOT change

The verb table and the `session:start` row's "hydrates the active memory backend". That row was
already backend-neutral.

### Notes for the promoter

One in-place annotation, on the `brain:memory:save` row.
