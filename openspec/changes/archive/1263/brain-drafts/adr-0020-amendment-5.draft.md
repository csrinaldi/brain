# ADR-0020 Amendment 5: a third key, `governance.owners`, read only by the team-config gate; and `prReviews` carries `commitId` (issue #1263)

> **Tier 3 target. Not promoted, and an agent may not promote it.**
>
> ```
> npm run brain:promote -- openspec/changes/issue-1263-config-ownership/brain-drafts/adr-0020-amendment-5.draft.md
> ```
>
> **Your commit is the signature** (ADR-0028).

```brain-amendment/1
target: brain/project/decisions/adr-0020-reviewer-port-verbs-and-two-key-split.md
amendment: 5
issue: 1263
home-summary: a third identity key, `governance.owners`, lists the humans who own the team config and is read by one gate, `team-config-reviewed`; `reviewActors` and `approvalActors` are unchanged and no key feeds two gates; `prReviews` gains `commitId` so a gate can tell a current approval from a stale one, `null` on GitLab, #1263
body: ## Amendment 5 — a third key, `governance.owners`, read only by the team-config gate; and `prReviews` carries `commitId` (issue #1263)
body-end: ### Notes for the promoter
```

```amend-find
No key feeds two gates. The dual-semantics coupling is dissolved by construction, not by convention.
```

```amend-replace
No key feeds two gates. The dual-semantics coupling is dissolved by construction, not by convention.
**[Amended by Amendment 5 (#1263, ADR-0040): a third key, `governance.owners`, lists the humans who
own the team config. Its one gate is `team-config-reviewed`. It is not a reuse of `approvalActors`,
which keeps its meaning and its single reader. See Amendment 5.]**
```

## Amendment 5 — a third key, `governance.owners`, read only by the team-config gate; and `prReviews` carries `commitId` (issue #1263)

**Signed**: DD/MM/YYYY — <Name>

### What changed

ADR-0040 names this ADR in "Amendments this requires". Two changes, both on the
`feature/issue-1114-axis-ports` tracker.

**1. `governance.owners`, a third identity key.** It is the list of bare forge logins of the humans
who own `brain.config.json`. One gate reads it: `team-config-reviewed`
(`brain/scripts/vcs/team-config-reviewed.mjs`). That gate passes a change to the team config only
with an APPROVED review from an owner who is not the PR author, on the current head. It reads the
owners from the BASE ref, never from the PR head, so a PR cannot add its own author and approve
itself. A sole owner who authored the change passes only at `lite`, labelled as ADR-0037's
solo-maintainer exception, never as independent review.

`diagnoseAxes` (`brain/scripts/lib/axis-config.mjs`) also reads the list, to report
`owners-undeclared` and a `codeowners-drift` between `CODEOWNERS` and the list. Those are findings,
not gate decisions. A founding `env:init` seeds the list with the adopter's login
(`lib/env-init-setup.mjs`). The 1.11.1 migration never seeds it on an existing consumer.

**2. `prReviews` carries `commitId`.** Each entry gains the commit the review was submitted against:
GitHub's `commit_id`, `null` if absent; on GitLab always `null`, because neither endpoint says which
commit an approval was for. `team-config-reviewed` counts an approval only when its `commitId`
equals the head, and treats `null` as "cannot verify", failing closed. The field is additive, and
existing consumers ignore it. The `vcs-contract.md` row is drafted separately
(`vcs-contract-prreviews-commitid.draft.md`).

### Why

ADR-0040's first draft seeded owners into `approvalActors`. That key is an automation allow-list: in
`vcs/actor-check.mjs`, an allow-listed actor returns `pass` before the tier branch and before the
`actor === author` failure. A human owner listed there could approve their own change at any tier,
which ADR-0037 forbids. A separate key keeps this ADR's rule that no key feeds two gates.

`commitId` exists because `branchProtect` sets no `dismiss_stale_reviews`, so an approval given to a
harmless edit survived a later commit that rewrote `brain.config.json`.

### What this does NOT change

The four COMMENT-only write verbs, the three structural locks, `reviewActors` (read by L6 only) and
`approvalActors` (read by L5 only).

### What the code does not do yet, said plainly

- **On GitLab the gate cannot pass on an approval.** With `commitId` always `null`, an owner's
  approval is reported as unverifiable: a failure at `standard`/`regulated`, a warning at `lite`.
- **No existing consumer declares owners**, this repository included. Until an owner is added by PR,
  the gate reports "no owner declared": a failure at `standard`/`regulated`, a warning at `lite`.

### Notes for the promoter

One in-place annotation of the "No key feeds two gates" sentence in Decision 2. Amendment 4 is the
latest amendment today, so this is number 5. Sources: ADR-0040 §5 and §6, Ratified points 4 and 8,
"Amendments this requires" (ADR-0020); #1263 slice 4.
