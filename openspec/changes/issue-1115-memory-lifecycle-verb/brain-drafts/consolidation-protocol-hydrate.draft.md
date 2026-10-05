# consolidation-protocol.md — §5's hydrate step is `cli.mjs hydrate` (issue #1115)

> **Tier 2 target. Not promoted, and an agent may not promote it.**
>
> ```
> npm run brain:promote -- openspec/changes/issue-1115-memory-lifecycle-verb/brain-drafts/consolidation-protocol-hydrate.draft.md
> ```
>
> **Your commit is the signature** (ADR-0028).

```brain-amendment/1
target: brain/core/methodology/consolidation-protocol.md
issue: 1115
body: ## §5 hydrate step names the backend-owned verb (issue #1115)
body-end: ### Notes for the promoter
```

```amend-find
1. **hydrate** (`brain:memory:pull` — `git pull`, then `cli.mjs import`)
```

```amend-replace
1. **hydrate** (`cli.mjs hydrate`, after `day:start`'s own `git pull`; `brain:memory:pull` is `git pull` followed by the same projection **[amended, #1115: was "`git pull`, then `cli.mjs import`"; `import` is now a deprecated alias of `hydrate`]**)
```

## §5 hydrate step names the backend-owned verb (issue #1115)

**Signed**: DD/MM/YYYY — <Name>

### What changed

§5 described the hydrate step as `brain:memory:pull` followed by `cli.mjs import`, which is
engram's op. `day:start` step 4a now calls `cli.mjs hydrate`, which every backend implements
(`memory-backend-contract.md` Amendment 3). It no longer runs `engram sync --export`, so nothing
copies the backend back into `.memory/`.

### What this does NOT change

Steps 2 (`index`) and 3 (`share`), and the lane rule below them.

### Notes for the promoter

One in-place annotation, §5 item 1.
