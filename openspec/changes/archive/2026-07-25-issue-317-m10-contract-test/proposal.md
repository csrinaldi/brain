---
status: draft
issue: 317
epic: 335
sequence: 313
artifact_store: hybrid
topic_key: sdd/#317-m10-contract-test/proposal
related: openspec/changes/issue-317-prreviews-empty-body/
---

# Proposal — M10 Phase 2: contract test for `prReviews` (issue #317)

## Intent

`prReviews` is the last verdict-path read verb with **zero** contract-test coverage. `vcs.contract.test.mjs` covers `labelEvents`, `prView`, `mrCreate`, `prStatusRollup` and the write verbs — `prReviews` appears nowhere. Nothing asserts either provider's normalizer emits `{ state, author }` with the `null`-vs-`[]` discipline its live consumer (`brain-writes-reviewed.mjs` DETECTION gate) depends on. That is the M10 Gap A seam.

## Blocking Decision (read first)

Exploration `sdd/#317-m10-contract-test/explore` recommended widening `prReviews` with `body: r.body ?? ''`. **That contradicts an existing, more complete plan for the same issue.** `openspec/changes/issue-317-prreviews-empty-body/design.md` D3 explicitly rejects the `{ ...prReviews, body }` superset and instead splits out a `prReviewBodies` verb (GH reviews / GL notes). Evidence the split is stronger: GitLab's approvals endpoint structurally cannot carry `body`, so widening ships a field permanently `''` on GitLab — encoding the seam instead of closing it. The prior plan also catalogs a third inert guardrail the new exploration missed (`rev >= 3` STOP, `cli.mjs:207`).

**This proposal therefore scopes to test coverage only.** The body defect stays with the drafted change. Orchestrator/user must confirm.

## Scope

### In Scope
- `prReviews` contract block in `vcs.contract.test.mjs`, parameterized over both providers (`labelEvents` pattern).
- Recorded `github-prReviews-happy.json` + hand-authored `github-prReviews-failure.json`; derived `gitlab-prReviews-{happy,failure}.json`.
- `recordGithubPrReviews` case in `fixtures/record-fixtures.mjs`.
- Chain assertion: fixture → `prReviews` → `evaluateBrainWritesReviewed` (its real consumer today).
- `vcs-contract.md`: state `prReviews` = approval state only; GitLab carries no body by construction.

### Out of Scope
- Any change to `prReviews`' normalized shape.
- `prReviewBodies` / `priorVerdicts` fix — owned by `issue-317-prreviews-empty-body`.
- GitLab approvals→notes migration.

## Capabilities

### New Capabilities
- `vcs-pr-reviews-contract`: cross-provider normalized `prReviews` shape and failure discipline.

### Modified Capabilities
- None.

## Approach

Test-only, additive. Follow `labelEvents`: `{data}|{throws}` fixtures through `githubJsonCallArgs`/`gitlabCallArgs` (both fit `prReviews` unmodified). The chain assertion targets the gate that consumes `prReviews` today, so it stays green after `prReviewBodies` lands.

## Affected Areas

| Area | Impact | Description |
|---|---|---|
| `brain/scripts/vcs/providers/vcs.contract.test.mjs` | Modified | New `prReviews` happy/failure/chain block |
| `brain/scripts/vcs/fixtures/*-prReviews-*.json` | New | 4 fixtures (GH recorded, GL derived) |
| `brain/scripts/vcs/fixtures/record-fixtures.mjs` | Modified | `recordGithubPrReviews` case |
| `brain/core/methodology/vcs-contract.md` | Modified | Clarify approval-state-only semantics |

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Fixture/test collision with `issue-317-prreviews-empty-body` | Med | Namespace `prReviews` vs `prReviewBodies`; sequence the two changes |
| Recorded GH fixture leaks repo/PR content | Low | `_provenance.recorded` scrub discipline (as `github-prView-happy.json`) |
| Locks a shape the split change might later alter | Low | Intentional — that design preserves `prReviews` verbatim |

## Rollback Plan

Single revert of the change commit. Test-only; no production code path is modified, so rollback restores current behavior exactly.

## Dependencies

None hard. Coordinate ordering with `issue-317-prreviews-empty-body` (draft, unimplemented) to avoid duplicate fixture/test names.

## Success Criteria

- [ ] `prReviews` contract block green on both providers; `null` (fetch failure) vs `[]` (no reviews) asserted distinctly.
- [ ] GH happy fixture carries `_provenance.recorded`, not hand-authored.
- [ ] Chain assertion drives `evaluateBrainWritesReviewed` from fixture output with no inline fakes.
- [ ] M10 Gap A uncovered-verb list no longer contains `prReviews`.
