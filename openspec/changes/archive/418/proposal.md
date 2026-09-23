---
status: draft
issue: 418
epic: 313
artifact_store: openspec
topic_key: sdd/issue-418-lite-distinct-act-rearm/proposal
---

# Proposal: `lite` distinct-act re-arms only on foreign commits (issue #418)

Issue #418. Epic #313 (M6, pulled forward — it blocks the #409 automation loop).
Change folder: `openspec/changes/issue-418-lite-distinct-act-rearm/`.

## Intent

At `lite`, `actor-check`'s distinct-act evidence compares the approved-label event
against the head-commit push (`actor-check.mjs`, `compareTimestamps`). Any push after
approval re-arms the gate. Measured cost on #396: five pushes, five re-applications of
`status:approved`, each certifying nothing new — at `lite` the approver is allowed to
be the author. Structurally it blocks #409's automated loop: every agent fix-push
demands a fresh human signature.

## Decision path — doctrine first

This relaxes a row of ADR-0026's tiered-evidence table, so it is an **ADR amendment
with a human signature** before it is code (the epic's own ruling; same shape as
ADR-0027). The full amendment text, the accepted losses, and the residuals to weigh
are in `brain-drafts/adr-0026-amendment-1-distinct-act-rearm.md`.

**Hard precondition, satisfied:** #413 / PR #424 — the `reviewActors` exemption is
only safe with a verifiable reviewer identity.

## Scope (contingent on signature)

- `actor-check.mjs`: `evaluateDistinctAct` compares the label event against the
  latest **foreign** commit (author ∉ {approver} ∪ `governance.reviewActors`;
  unresolvable author = foreign, fail closed) instead of the head commit.
- `standard`/`regulated` paths untouched.
- ADR-0026 row replacement + appended Amendment 1 (Tier-2, lands with the signed PR
  under the `decision` label).

Out of scope: GitLab authorship resolution (`login: null` residual — GL keeps today's
behavior), any change to who may apply `status:approved` (#124), the reviewer's
`event: COMMENT` constraint (ADR-0020).
