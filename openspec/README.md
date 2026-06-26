# openspec/ — SDD Artifacts (OpenSpec format)

> **Source of truth** for spec-driven design, in tool-agnostic Markdown.
> The harness (gentle-ai today) is replaceable; engram is a disposable index.
> See [`../brain/decisions/adr-0002-harness-reemplazable-openspec.md`](../brain/decisions/adr-0002-harness-reemplazable-openspec.md).

## Structure

```
openspec/
├── specs/                      # consolidated live requirements
│   └── [feature]/spec.md
└── changes/                    # in-progress changes (one per ticket)
    └── [change-id]/
        ├── proposal.md         # what and why
        ├── design.md           # how (technical decisions)
        ├── tasks.md            # implementation checklist
        └── specs/[feature]/spec.md   # requirement deltas for the change
```

## Rules

1. **MD wins.** If engram and these files diverge, these files win.
2. **One change per ticket.** `change-id` is linked to the GitLab issue ID.
3. **Always committed.** Artifacts travel with the code in the same MR.
4. **Replaces** the previous `docs/sdd/tasks/` convention (deprecated).
