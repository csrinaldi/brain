---
status: draft
issue: 317
epic: 313
artifact_store: hybrid
---

# Tasks: `prReviewBodies` read verb (issue #317)

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~460 (A1 ~180, A2 ~150, A3 ~130) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 (A1) → PR 2 (A2) → PR 3 (A3) |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | A1 — GitHub verb + shared contract test | PR 1 | Base: main/tracker. Unblocks A2. |
| 2 | A2 — GitLab verb (system-note filter, desc-fetch/asc-sort) | PR 2 | Base: PR 1 or main per chain strategy. |
| 3 | A3 — Wire callers, real-shape fixtures, integration test | PR 3 | Depends on A1+A2. Only slice touching live behavior. |

## Phase 1: A1 — GitHub `prReviewBodies` (Requirements: contract shape, pagination)

- [ ] 1.1-RED `providers.test.mjs`: assert GH `prReviewBodies` uses `--paginate` on `pulls/{number}/reviews`; assert shape `{author, body, at}`, `body ?? ''`, ascending sort.
- [ ] 1.2-RED `vcs.contract.test.mjs`: add parameterized parity block (shape/order/`null` vs `[]` vs `''`) over 2 new GH fixtures.
- [ ] 1.3-GREEN `providers/github.mjs`: implement `prReviewBodies` (map `body ?? ''`, `user.login ?? null`, `submitted_at ?? null`; ascending; `null` on fetch failure).
- [ ] 1.4 Create fixtures `vcs/fixtures/github-prReviewBodies-{happy,failure}.json`.
- [ ] 1.5 Register verb: `vcs/cli.mjs` `VERBS`; `core/methodology/vcs-contract.md` Required-verbs row.

## Phase 2: A2 — GitLab `prReviewBodies` (Requirements: system-note filtering, D4 fetch/sort)

- [ ] 2.1-RED `providers.test.mjs`: assert GL query string `per_page=100&order_by=created_at&sort=desc`; assert `system: true` notes excluded; assert final ascending sort by `at`.
- [ ] 2.2-RED Parameterize A1's contract-test block over 2 new GL fixtures (parity with GH).
- [ ] 2.3-GREEN `providers/gitlab.mjs`: implement `prReviewBodies` over `merge_requests/{iid}/notes` (D1 filter, D4 fetch-desc/sort-asc, `body ?? ''`, `author.username ?? null`, `created_at ?? null`).
- [ ] 2.4 Create fixtures `vcs/fixtures/gitlab-prReviewBodies-{happy,failure}.json` (mark `_provenance: derived`).

## Phase 3: A3 — Wire callers + integration (Requirement: cold-boot/board integration, regression)

- [ ] 3.1-RED Create `review/verdict-thread.integration.test.mjs`: real (non-fabricated) `prReviewBodies` output → `parseVerdict` → non-null verdict.
- [ ] 3.2-GREEN `review/cold-boot.mjs:79-87`: swap `defaultFetchReviews` to `prReviewBodies`; delete stale H1-2 NOTE.
- [ ] 3.3-GREEN `review/board.mjs:78-87`: same swap in `reconcileOnePr`; update mirror comment.
- [ ] 3.4 `cold-boot.test.mjs` / `board.test.mjs`: replace fabricated `{state, author, body}` fixtures with real `prReviewBodies` shape.
- [ ] 3.5 Regression check: `brain-writes-reviewed.test.mjs` and `actor-check` tests stay green, unchanged (still call `prReviews`).

## Dependencies

Phase 1 → Phase 2 (shares contract-test block) → Phase 3 (depends on both verbs existing). All tasks strict-TDD RED→GREEN; `npm test` is the runner.
