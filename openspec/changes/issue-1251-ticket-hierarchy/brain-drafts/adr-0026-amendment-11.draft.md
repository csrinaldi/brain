# ADR-0026 Amendment 11: `integration-ready` is tiered by position (issue #1251)

> **Tier 2 target. Not promoted, and an agent may not promote it.** Promote it after ADR-0039,
> which decides the gate.
>
> ```
> npm run brain:promote -- openspec/changes/issue-1251-ticket-hierarchy/brain-drafts/adr-0026-amendment-11.draft.md
> ```
>
> **Your commit is the signature** (ADR-0028).

```brain-amendment/1
target: brain/project/decisions/adr-0026-governance-doctrine-tiers.md
amendment: 11
issue: 1251
home-summary: the `integration-ready` gate (ADR-0039) is tiered by position — detection at `lite`, required at `standard` and `regulated`; an integration PR merged early is never closed by brain, it is reported as merged but open, #1251
body: ## Amendment 11 — `integration-ready` is tiered by position (issue #1251)
body-end: ### Notes for the promoter
```

```amend-find
| `team-config-reviewed` **[Added by Amendment 10 (#1263, ADR-0040)]** | detection (a sole owner's own change passes as the ADR-0037 mode A exception) | required: an owner-approved review on the current head | required: same |
```

```amend-replace
| `team-config-reviewed` **[Added by Amendment 10 (#1263, ADR-0040)]** | detection (a sole owner's own change passes as the ADR-0037 mode A exception) | required: an owner-approved review on the current head | required: same |
| `integration-ready` **[Added by Amendment 11 (#1251, ADR-0039)]** | detection | required: every child of the PR's node closed | required: same |
```

## Amendment 11 — `integration-ready` is tiered by position (issue #1251)

**Signed**: DD/MM/YYYY — <Name>

### What changed

ADR-0039 (ruling N4, 2026-10-07) adds a gate, `integration-ready`. It refuses to merge an
integration PR, one whose head is the `tracker:` its issue's block declares, while its node is not
Ready to close: while any child of the node is open, or its state could not be read. It judges
through the hierarchy resolver, by content, never by branch name (ADR-0035).

| Tier | Policy | Evidence |
|---|---|---|
| `lite` | detection | the resolver's rollup of the node's children |
| `standard` | required | same |
| `regulated` | required | same |

No label bypasses it, at any tier.

### Why

ADR-0039's close workflow closes a node and deletes its tracker when the node's integration PR
merges. Merged early, that would close a node whose children are still open and delete the branch
they target. At `standard` and `regulated` the gate prevents it. At `lite`, detection only, the
early merge is possible, so the close workflow falls back: it closes nothing, deletes nothing, and
reports the node as merged but open. An admin override at any tier gets the same fallback.

### What this does NOT close

- **The gate does not exist yet.** Its job name and evidence form are ADR-0039's slices.
- **Whether it applies to a project with no declared hierarchy** is an open question on ADR-0039.

### Notes for the promoter

One table row added under the gate table, after `team-config-reviewed`.
