# Tasks: M10 Phase 2 — contract test for `prReviews` (issue #317)

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~200 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Full `prReviews` contract-test slice (fixtures + test + recorder + doc) | PR 1 | Test-only, additive, ~200 lines — single PR, no split needed |

## Phase 1: Fixtures

- [x] 1.1 Create `brain/scripts/vcs/fixtures/github-prReviews-happy.json` — recorded via `gh api --paginate repos/csrinaldi/brain/pulls/307/reviews`, `_provenance.recorded: true`, 2 real reviews, includes `body` field (proves normalizer drops it). **DEVIATION**: verified live (GraphQL `review:approved` search across the whole account) that NO PR in this repo/account has ever received a GitHub-native APPROVED review (solo-maintainer repo; all reviews are the `brain-review` bot-protocol's own COMMENTED verdicts) — so "≥1 APPROVED, distinct-from-author login" cannot be satisfied by a genuinely recorded fixture. This fixture is 100% real/recorded (satisfies spec Req 1-3 verbatim); the chain assertion's APPROVED case (3.1) uses an inline fixture instead — same precedent as this file's existing headRefOid/baseRefOid/prStatusRollup inline blocks.
- [x] 1.2 Create `brain/scripts/vcs/fixtures/github-prReviews-failure.json` — hand-authored `{throws:true, error}`, `_provenance.derived: true`
- [x] 1.3 Create `brain/scripts/vcs/fixtures/gitlab-prReviews-happy.json` — derived `{data:{approved_by:[{user:{username}},...]}}` (2 approvers), `_provenance.derived: true`, no body field (documents GitLab structural limitation)
- [x] 1.4 Create `brain/scripts/vcs/fixtures/gitlab-prReviews-failure.json` — hand-authored `{throws:true, status:404}`, `_provenance.derived: true`

## Phase 2: Contract Test — shape + provenance (spec Requirement 1 & 2 & 3)

- [x] 2.1 RED: Added `prReviews: githubJsonCallArgs` / `prReviews: gitlabCallArgs` entries to `PROVIDERS` + happy-path exact-key test in `brain/scripts/vcs/providers/vcs.contract.test.mjs` — confirmed RED first (`prReviewsArgs is not defined`, 6 failures) before wiring the destructuring.
- [x] 2.2 GREEN: Wired fixture loading (`loadFixture`, `assertProvenance`) for `prReviews` happy fixtures on both providers — 2.1 passes.
- [x] 2.3 RED→GREEN: Added failure-path test per provider asserting `prReviews` returns `null` on a fetch failure, using the failure fixtures from Phase 1.
- [x] 2.4 RED→GREEN: Added inline zero-review success case (`data: []` / `approved_by: []`) asserting result is `[]`, distinct from the `null` failure case.

## Phase 3: Chain Assertion (spec Requirement 4, design D4)

- [x] 3.1/3.2 Wrote chain test importing `gatherBrainWritesReviewedInputs`/`evaluateBrainWritesReviewed` from `brain-writes-reviewed.mjs`, injecting `deps.getVcs` wired to the real transport seam (`chainVcs` helper, per design D4). **DEVIATION** (see 1.1): the "reviewed PR passes" case uses an inline APPROVED fixture (real transport/normalizer/wrapper, inline DATA only) since no real recorded fixture with an APPROVED review exists in this environment. GREEN on first run (no gap in existing production wiring) — this is a regression-pinning contract test, not new behavior; see 4.3.
- [x] 3.3 Added failure-path chain test using the REAL `prReviews` failure fixture — normalizer yields `null`, `defaultFetchReviews`'s `reviews ?? []` fallback (verified via `inputs.reviews` assertion) feeds `evaluateBrainWritesReviewed`, asserts `level: 'warn'` citing "no PR reviews found", never throws.

## Phase 4: Recorder + Documentation

- [x] 4.1 Added `recordGithubPrReviews` case and `CASES.prReviews` entry to `brain/scripts/vcs/fixtures/record-fixtures.mjs`; updated header endpoint list and usage string.
- [x] 4.2 Updated `brain/core/methodology/vcs-contract.md` row 34 — appended: `prReviews` carries approval state only; no `body` field on either provider (GitHub drops it in the normalizer, GitLab's approvals endpoint has none).
- [x] 4.3 Verified `brain-writes-reviewed.test.mjs` and `providers.test.mjs` remain green byte-identical — confirmed via `git status --short`: zero production `.mjs` files touched, only `vcs.contract.test.mjs` + 4 fixture JSONs + `record-fixtures.mjs` + `vcs-contract.md`. Full `npm test`: 1907/1907 pass (was 1897 before this change, +10 new tests, 0 regressions).
