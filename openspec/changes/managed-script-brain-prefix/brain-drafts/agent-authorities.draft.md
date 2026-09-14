# agent-authorities.md — memory script names move to `brain:memory:*` (issue #961)

> **Tier 2 draft. Not yet promoted.** Promote only after the Tier-1 PR has merged (ruling R1).
>
> ```
> npm run brain:promote -- openspec/changes/managed-script-brain-prefix/brain-drafts/agent-authorities.draft.md
> ```
>
> `agent-authorities.md` is one of the five `SOURCE_DOCS` (`brain/scripts/harness/backends/antigravity.mjs:36-41`),
> so this promotion regenerates `AGENTS.md`. Promote it FIRST, then `harness-contract.draft.md`.
>
> The anchor was checked against the complete list of lines in the target that name one of the eleven
> scripts: it occurs exactly once, and it does not occur inside its own replacement (k = 0).

```brain-amendment/1
target: brain/core/methodology/agent-authorities.md
issue: 961
```

## Edit 1 — line 22

```amend-find
Capture memory as records: `npm run memory:save` writes a record
```

```amend-replace
Capture memory as records: `npm run brain:memory:save` writes a record
```
