# workflow-governance.md — a fifth gate, `integration-ready` (issue #1251)

> **Tier 2 target. Not promoted, and an agent may not promote it.** Changes to this document
> require an MR reviewed by `@crinaldi`. Promote it after ADR-0039 and ADR-0026 Amendment 11.
>
> ```
> npm run brain:promote -- openspec/changes/issue-1251-ticket-hierarchy/brain-drafts/workflow-governance-integration-ready.draft.md
> ```
>
> **Your commit is the signature** (ADR-0028).

```brain-amendment/1
target: brain/core/methodology/workflow-governance.md
issue: 1251
body: ## Invariant 5 — an integration PR merges only when its node is Ready to close (issue #1251)
body-end: ### Notes for the promoter
```

```amend-find
| Hard, in one direction — see below |
```

```amend-replace
| Hard, in one direction — see below |
| 5 **[Added, #1251, ADR-0039]** | An integration PR merges only when every child of its node is closed | `integration-ready` | _(none — no label bypasses it)_ | Tiered where `vcs.hierarchy` is declared: detection at `lite`, required at `standard` and `regulated`; detection-only at every tier on the implicit model (ADR-0026 Amendment 11) — see "Invariant 5" below |
```

## Invariant 5 — an integration PR merges only when its node is Ready to close (issue #1251)

**Signed**: DD/MM/YYYY — <Name>

### What changed

ADR-0039 (ruling N4, 2026-10-07) adds `integration-ready`. The table above still says "Four
Invariants" in its heading; this row is the fifth.

- **What it checks.** A PR is an integration PR when its head is the `tracker:` its issue's
  `brain-graph/1` block declares. The gate reads the hierarchy resolver's rollup of that issue's
  children and fails while any child is open or its state is unknown (`null`).
- **Judged by content, never by branch name** (ADR-0035). A head called `…/tracker` that no block
  declares is not an integration PR; a declared tracker is one whatever it is called.
- **Runs in every project, blocks only where a hierarchy is declared** (ADR-0039 ruling M1,
  ADR-0026 Amendment 11). With `vcs.hierarchy` declared: detection at `lite`, required at
  `standard` and `regulated`. On the implicit model: detection-only at every tier. No label
  bypasses it.
- **When a PR merges past it** (at `lite`, or through an admin override, "Lockout Recovery" path
  2), or on the implicit model, ADR-0039's close workflow closes nothing and deletes nothing, and
  reports the node as merged but open. A later remainder PR from the same tracker closes it (ruling
  M3).

### What L1 enforces, and what it does not

It enforces an observable output: the resolver's rollup says every child is closed. It does not
judge whether the children were the right work, or whether the node's scope is complete.

### Notes for the promoter

One table row added after invariant 4, plus this section.
