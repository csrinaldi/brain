# openspec/ — SDD Artifacts (OpenSpec format)

> **Source of truth** for spec-driven design, in tool-agnostic Markdown.
> The harness (gentle-ai today) is replaceable; engram is a disposable index.
> See [`../brain/project/decisions/adr-0001-arquitectura-3-capas-harness-reemplazable.md`](../brain/project/decisions/adr-0001-arquitectura-3-capas-harness-reemplazable.md).

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
3. **Always committed**, with one exception: `.memory/records/**` travels on
   its own memory lane (ADR-0034, #862), not with the code's MR. Every other
   artifact under `openspec/` and `brain/` still travels with the code in the
   same MR.
4. **Replaces** the previous `docs/sdd/tasks/` convention (deprecated).
5. **Archived automatically.** A change whose issue is CLOSED is swept out of `changes/` into
   `changes/archive/<iid>/` by the post-merge governance workflow, which opens one
   `auto-archive/<date>` PR after a clean audit. `changes/` therefore lists in-flight work only.
