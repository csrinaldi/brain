# ADR-0026 Amendment 10: `team-config-reviewed` is tiered by position, and an adoption PR is judged at `lite` (issue #1263)

> **Tier 3 target. Not promoted, and an agent may not promote it.**
>
> ```
> npm run brain:promote -- openspec/changes/issue-1263-config-ownership/brain-drafts/adr-0026-amendment-10.draft.md
> ```
>
> **Your commit is the signature** (ADR-0028).

```brain-amendment/1
target: brain/project/decisions/adr-0026-governance-doctrine-tiers.md
amendment: 10
issue: 1263
home-summary: the `team-config-reviewed` gate (ADR-0040) is tiered by position — detection at `lite`, required at `standard` and `regulated` — with the sole-owner exception at `lite` only; and the adoption PR that founds `brain.config.json` is judged at the new-consumer tier `lite`, never at the tier its own head declares, #1263
body: ## Amendment 10 — `team-config-reviewed` is tiered by position, and an adoption PR is judged at `lite` (issue #1263)
body-end: ### Notes for the promoter
```

```amend-find
| post-merge auto-revert (rung 3) | detection | detection | required |
```

```amend-replace
| post-merge auto-revert (rung 3) | detection | detection | required |
| `team-config-reviewed` **[Added by Amendment 10 (#1263, ADR-0040)]** | detection (a sole owner's own change passes as the ADR-0037 mode A exception) | required: an owner-approved review on the current head | required: same |
```

```amend-find
migration may change a consumer's tier. See Amendment 8.]**
```

```amend-replace
migration may change a consumer's tier. See Amendment 8.]** **[Amended by Amendment 10
(#1263): the adoption PR that founds `brain.config.json` is judged by `team-config-reviewed` at
`lite`, the new-consumer tier, never at the tier its own head declares. See Amendment 10.]**
```

## Amendment 10 — `team-config-reviewed` is tiered by position, and an adoption PR is judged at `lite` (issue #1263)

**Signed**: DD/MM/YYYY — <Name>

### What changed

ADR-0040 names this ADR in "Amendments this requires". Two changes, both on the
`feature/issue-1114-axis-ports` tracker.

**1. A new gate row.** `team-config-reviewed` (`brain/scripts/vcs/team-config-reviewed.mjs`) is
appended to `GOVERNANCE_JOBS` and to `GATE_MATRIX` (`brain/scripts/vcs/governance-tiers.mjs`):

| Tier | Policy | Evidence |
|---|---|---|
| `lite` | detection | `owner-approval-or-solo-maintainer` |
| `standard` | required | `owner-approved-review` |
| `regulated` | required | `owner-approved-review` |

On any PR that touches `brain.config.json`, the gate needs an APPROVED review from a
`governance.owners` login who is not the author, on the current head, and still that owner's latest
decisive review. It reads the owners and the tier from the BASE ref. At `lite`, a sole owner who
authored the change passes, labelled ADR-0037 mode A's solo-maintainer exception. At `lite` any other
failure is a warning that names the tier.

**2. The founding tier.** When the base has no `brain.config.json` and never had one, in a history that
is not shallow, the PR is the adoption: the founding decision. The gate passes it, labelled as such
and never as independent review, and judges it at `lite`, the tier Amendment 8 gives a new consumer.
It never uses the tier the PR's own head declares. A base that once had the file and lost it is a
removal, judged with the owners and tier of its last version. A shallow history cannot tell the two
apart, so it is an evidence failure, never a founding.

### Why

The team config sets the tier, the ignore list, the reviewer and the axes for every gate. Changing it
with the review a typo gets is self-authorization one level up (ADR-0040). The row is position-tiered
by proportionality. A `lite` repository is typically one maintainer who owns the config, and a team
that has declared no owner yet should be told, not blocked.

The founding PR has no owner to approve it, and its head declares a tier nobody has reviewed yet.
Reading that tier would let the PR choose the rule it is judged by.

### Why `lite` is detection here when `brain-writes-reviewed` is required at every tier

`brain-writes-reviewed` guards `brain/**`, the signed doctrine, and is never-tiered by position.
`team-config-reviewed` guards configuration a solo maintainer edits routinely. At `lite` the sole-owner
exception already covers that maintainer, and detection reports everything else. Invariant 3 holds: the
job runs at every tier and is never below `detection`.

### What this does NOT change

The other gates, their evidence and parameters, the seven invariants, and Amendment 8's rule that no
migration changes a consumer's tier.

### What the code does not do yet, said plainly

- **GitLab cannot pass on an approval.** `prReviews` returns `commitId: null` there, so a current
  approval cannot be told from a stale one and the gate fails closed: a failure at
  `standard`/`regulated`, a warning at `lite`.
- **No existing consumer declares `governance.owners`.** The gate then reports "no owner declared"
  until an owner is added by PR.
- **A missing or unreadable base config is judged at `standard`.** Outside a founding, the gate falls
  back to `resolveTier({})`, the fail-closed side.

### Notes for the promoter

One table row added beside the existing position-tiered rows, and one annotation of the Decision's
tier-default paragraph. Amendment 9 is the latest amendment today, so this is number 10. Sources:
ADR-0040 §4 and §6, "Amendments this requires" (ADR-0026); #1263 slice 4.
