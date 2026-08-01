# Tasks — T2.3: Review Package Specification

## Phase 1: Specification (Complete)

- [x] Propose the review package spec scope (proposal.md)
- [x] Design the /2 activation condition (design.md)
- [x] Formalize prReviews contract (specs/vcs-pr-reviews-contract/spec.md)
- [x] Formalize brain-review/2 schema (specs/brain-review-protocol/spec.md)
- [x] Amend reviewer-protocol.md with /2 definition (brain/core/methodology/)

## Phase 2: Verification (Spec-only, no code changes)

- [x] brain-review protocol audit (verdict schema)
- [x] Technical review (all cites verified against source)
- [x] local-checks validation (SDD folder structure complete)

## Phase 3: Merge to main

- [ ] Remove stale note from PR #392 (issue #391 label status)
- [ ] Document M10 branch spec.md collision risk
- [ ] Obtain one human APPROVE review (non-author, brain-writes-reviewed gate)
- [ ] Merge PR #392 to main

## Phase 4: Follow-up Implementation (Out of scope for T2.3)

**Not included in this slice; tracked separately:**

- [ ] **Implement cli.mjs wiring** (Issue #TBD) — add `resolveReviewProtocol(tier)` logic
  - Depends on: Q5's `governance-tiers.mjs` implementation
  - Work: 1-line change in `cli.mjs:204-216`

- [ ] **Sync feature/m10-seam-contract-coverage** (Related issue #331, #317) — merge main's PR #383 fix
  - Currently: spec.md has pre-#383 content (no body field)
  - Must: resolve merge conflict by keeping this PR's version
  - Work: Expected conflict on merge, intentional

- [ ] **Wire refuter evaluation** (Issue #284, not T2.3 scope) — populate `evidence_class`/`causal_disposition`
  - Prerequisite for safely defaulting `/2` at `regulated` tier
  - Currently: only `refuter.mjs` reads these fields; no evaluator writes them

---

## Notes

- **No production code changes in this slice** — only spec/doctrine/design
- **Backward compatible** — `/1` remains the default; `/2` activation is conditional per design.md
- **M10 conflict expected** — when `feature/m10-seam-contract-coverage` merges, it will conflict on `openspec/specs/vcs-pr-reviews-contract/spec.md`; keep this PR's version
