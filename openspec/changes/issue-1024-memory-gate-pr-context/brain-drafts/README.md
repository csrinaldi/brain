# Brain drafts — issue #1024

`workflow-governance-memory-gate.draft.md` is a `brain-amendment/1` contract targeting
`brain/core/methodology/workflow-governance.md` (one of the five `SOURCE_DOCS`). The maintainer
promotes it after this PR merges via:

```
npm run brain:promote -- openspec/changes/issue-1024-memory-gate-pr-context/brain-drafts/workflow-governance-memory-gate.draft.md
```

`AGENTS.md` regenerates automatically as part of that promotion (`SOURCE_DOCS` compilation,
`brain/scripts/harness/backends/antigravity.mjs`) — it must never be hand-edited to reflect
this change ahead of promotion.

**Historical, no edit**: ADR-0014 (`brain/project/decisions/adr-0014-workflow-governance.md:66`,
if present) and `evidence-reader-empty-on-failure.md:14` describe the pre-#1024 state as a
historical record of what shipped at the time they were written — they are not amended by this
change. Only `workflow-governance.md`'s live reference text is.
