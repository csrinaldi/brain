# ADR-0035 Amendment 2: ancestry in a branch path is a claim, and two new automations judge by content (issue #1251)

> **Tier 2 target. Not promoted, and an agent may not promote it.** Promote it after ADR-0039,
> which decides what it records.
>
> ```
> npm run brain:promote -- openspec/changes/issue-1251-ticket-hierarchy/brain-drafts/adr-0035-amendment-2.draft.md
> ```
>
> **Your commit is the signature** (ADR-0028).

```brain-amendment/1
target: brain/project/decisions/adr-0035-archive-sweep-issue-link-exemption-is-content-earned.md
amendment: 2
issue: 1251
home-summary: the rule that a branch name is a claim extends from the two lanes to ADR-0039's hierarchical branch path — ancestry in a name is a claim, the resolver's sources are the proof — and the `integration-ready` gate and the close workflow judge by content, never by branch name or by an author-editable closing keyword, #1251
body: ## Amendment 2 — ancestry in a branch path is a claim, and two new automations judge by content (issue #1251)
body-end: ### Notes for the promoter
```

```amend-find
**A second content-earned `issue-link` exemption, for `auto-archive/<date>` heads. The branch
name makes the claim; a predicate recomputed over the diff is the proof.**
```

```amend-replace
**A second content-earned `issue-link` exemption, for `auto-archive/<date>` heads. The branch
name makes the claim; a predicate recomputed over the diff is the proof.** **[Amended by
Amendment 2 (#1251, ADR-0039): the same rule governs the hierarchical branch path — ancestry in
a name is a claim, and the hierarchy resolver's sources are the proof. See Amendment 2.]**
```

## Amendment 2 — ancestry in a branch path is a claim, and two new automations judge by content (issue #1251)

**Signed**: DD/MM/YYYY — <Name>

### What changed

ADR-0039 names this ADR in "Amendments this requires". Its branch names carry ancestry
(`release-1300/epic-878/issue-56-slug`), and a name that says where a ticket sits is exactly the
kind of claim this ADR refuses to trust.

- **Ancestry in a branch path is a claim.** The proof is the hierarchy resolver's sources: the
  `brain-graph/1` block and the `level:*` labels. A path that disagrees with them is drift,
  reported, and never a reason to re-parent anything.
- **`integration-ready` judges by content.** A PR is an integration PR when its head is the
  `tracker:` its issue's block declares, not when its head ends in `/tracker`. Readiness is the
  resolver's rollup of the node's children.
- **The close workflow judges by content.** It closes `#N` only when the resolver places N under
  the node whose tracker is the PR's base (ruling M2, 2026-10-07). A closing keyword in an
  author-editable PR body is a claim like a branch name; any other keyword is reported, never
  executed.
- **No level may produce a lane branch.** Config validation refuses a level whose `branch` pattern
  starts with `memory` or `auto-archive` (ruling Q9), so a hierarchical name can never claim this
  ADR's exemption or ADR-0034's.

### Why

The rule's reason is the same as for the lanes: recomputing the proof costs less than trusting
the claim, and both new automations act without a human in the loop.

### What this does NOT change

The two lane exemptions, their predicates, and the absence of any label bypass.

### Notes for the promoter

One in-place annotation on the Decision's opening statement, plus this section.
