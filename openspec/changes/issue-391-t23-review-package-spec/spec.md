# Delta Spec — T2.3: Review Package (prReviews + brain-review/2)

## Overview

T2.3 delivers two formal specifications that close gaps left open by prior work:

1. **vcs-pr-reviews-contract** — prReviews verb contract (GitHub + GitLab dual-endpoint normalization)
   - File: `specs/vcs-pr-reviews-contract/spec.md`
   - Promotes PR #383's fix to formal, testable contract
   - 10 requirements, all cited against shipped code on `main`

2. **brain-review-protocol** — brain-review/2 schema (alongside /1)
   - File: `specs/brain-review-protocol/spec.md`
   - Documents the already-implemented v2 schema as formal doctrine
   - 6 requirements, all cited against `schema-v2.mjs` and `verdict.mjs`

## Design Dependencies

- **design.md** — specifies the `/2` activation condition (tier→protocol tie-in)
- **reviewer-protocol.md** §6 amendment — formal schema docstring

## Acceptance Criteria

- [ ] Both spec files are present and cross-referenced
- [ ] All REQs in both specs are testable and cited against source
- [ ] No behavioral change from this slice (spec-only)
- [ ] design.md's activation condition is clear on the condition, not implementation

## Notes

- The spec.md files here (in the change folder) are the delta work items
- `openspec/specs/` versions are the published, merged-to-main state
- M10 branch's stale `openspec/specs/vcs-pr-reviews-contract/spec.md` (pre-#383 content) will conflict when M10 merges — that's expected and documented in design.md
