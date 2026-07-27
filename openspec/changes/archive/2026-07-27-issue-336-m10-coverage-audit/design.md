---
status: draft
issue: 336
epic: 335
sequence: 313
milestone: M10
phase: 1
artifact_store: hybrid
---

# Design — M10 Phase 1: VCS contract coverage audit (issue #336)

## Technical Approach

Hand-executed read of three sources that already exist — the `vcs-contract.md` Required Verbs
table, `providers/vcs.contract.test.mjs`, and `fixtures/*.json` `_provenance` — reconciled into one
markdown table at `openspec/changes/issue-336-m10-coverage-audit/audit.md`. No tooling, no runtime.

**Measurement basis (mandatory in the artifact header).** Coverage is a moving target: #317's
`prReviews` work is in flight on this very branch. The audit MUST state the commit SHA and date it
was read at. Without that, the table is unfalsifiable — the exact failure mode of the
`seam-contract-coverage-roadmap.md` §3 snapshot this phase replaces.

    vcs-contract.md ──┐
    vcs.contract.test.mjs ──┼──→ reconcile @ pinned SHA ──→ audit.md ──→ Phase 2 slicing
    fixtures/_provenance ──┤
    call-site grep ────────┘

## Architecture Decisions

### D1 — Table structure: 5 columns, coverage and provenance stay separate

**Choice**: keep the proposal's 5 columns. Main table = 21 contract verbs (incl. zero-coverage
ones). Separate short table = the 3 non-contract extras.

**Alternatives rejected**:

| Option | Why rejected |
|---|---|
| Collapse provenance into coverage (`✅ recorded` / `⚠️ derived`) | Provenance is 4-valued, not 2: `recorded`, `derived`, **`inline`**, `none`. Codebase evidence: only `labelEvents`, `prView`, `issueView`, `mrCreate` are fixture-backed (`loadFixture`); `prStatusRollup`, `prReviewComment`, `issueComment`, `labelAdd`, `labelRemove`, `labelList` sit in the contract suite on **inline mocks** with a documented reason. Collapsing yields ~12 composite states and destroys sortability on either axis. |
| Inline the 3 extras with a `[non-contract]` label | Breaks the success criterion "count matches the drift guard" — the guard reconciles the Required Verbs set only. A reader scanning the main table must be able to count 21. |
| Exclude `authCheck` / `authLogin` (zero tests) | They ARE contract verbs. Excluding them hides the worst state and breaks the same count invariant. Zero coverage is a row, not an absence. |

**Rationale**: the audit's whole value is the orthogonality of *is it asserted cross-provider* vs
*is the assumed shape real*. `covered + derived` is the #334 failure mode and must remain readable
as its own cell pair. `inline` is a legitimate third state (documented rationale in the suite), not
automatically debt — flattening it would manufacture false gaps.

### D2 — Artifact placement: scoped to the change folder

**Choice**: `openspec/changes/issue-336-m10-coverage-audit/audit.md`. Not promoted to `docs/`.

**Rationale**: this phase exists *because* a durable-looking register (`seam-contract-coverage-
roadmap.md` §3) went stale and was still being cited. Promoting a second unowned register to `docs/`
recreates that defect with better formatting. A date-and-SHA-stamped, change-scoped snapshot is
honest about its half-life.

**Promotion criterion (stated, not deferred)**: promote to `docs/` only if Phase 2 lands ≥2 slices
AND the table is still being consulted afterwards — i.e. evidence of use, not intent of use.

### D3 — Gap ranking: published lexicographic rule

**Rule** (applied in order; ties fall to the next criterion):
`1. REQUIRED-gate consumer` → `2. mutating write` → `3. provider-divergent normalization` → `4. call-site fan-out`.

| # | Verb(s) | Defect the slice closes | Rank driver |
|---|---|---|---|
| 1 | `prReviews` | L6 self-approval gate (`brain-writes-reviewed.mjs`) reads a cross-provider shape never asserted at the seam | C1 — only verb hitting a REQUIRED gate; exact sibling of `issueView` Gap-A (#334) |
| 2 | `branchProtect` | Mutating write where GH/GL diverge on tier and permission semantics; failure is silent | C2 — sole mutating write in the gap set |
| 3 | `mrList` | `merge_requests`/`source_branch` → `headBranch` normalization drift | C3+C4 — widest read fan-out (board, queue, cold-boot, brain-next) |
| 4 | `issueList` | Same read class as `mrList`, same drift risk | C4 alone — dashboard-only consumers, no gate |
| 5 | `authLogin`, `authCheck` | Zero assertions anywhere; `authLogin` handles a token via stdin | Below C1-C3 despite zero coverage: local/interactive only, no CI gate. Severity ≠ blast radius |
| 6 | `whoami`, `commitStatus`, `repoCloneUrl`, `patSetupUrl`, `projectResolve` | Marginal — deterministic, single-shape reads | No criterion fires |

**Why rank 5 sits below rank 4**: a *partially* covered verb feeding a gate is riskier than an
*uncovered* verb feeding nothing — coverage count is not the ordering axis, consequence-of-wrongness
is. Publishing the rule lets Phase 2 disagree with reasoning rather than re-derive it.

**Ranking stops at priority order.** It does not commit to a Phase-2 PR count (open question 3
answered: no) — slicing is `sdd-tasks`' job under the 400-line guard.

## Example Output Shape

| Verb | Contract-parity | Provenance | Blast radius | Phase-2 |
|---|---|---|---|---|
| `issueView` | ✅ parity suite | recorded (GH) / derived (GL) | REQ-L5-1 author read | not candidate (#334) |
| `prReviews` | ⚠️ partial — `providers.test.mjs` inline mocks only | none | `brain-writes-reviewed` L6 **REQUIRED** gate, board, cold-boot | **rank 1** |
| `labelList` | ✅ parity suite | inline (documented) | label preflight | not candidate |
| `authLogin` | ❌ none | none | `day-start`, interactive only | rank 5 |

## File Changes

| File | Action | Description |
|---|---|---|
| `openspec/changes/issue-336-m10-coverage-audit/audit.md` | Create | The deliverable: header w/ SHA+date, main 21-verb table, 3-verb extras table, ranking, fixture-debt ledger |
| `openspec/changes/issue-336-m10-coverage-audit/design.md` | Create | This document |

## Trade-offs — what the audit does NOT do

No live GitLab validation. No fixture remediation or recorded-promotion. No test, spec, or provider
code written. No drift-guard extension to *enforce* coverage. No PR-count commitment. The audit is
detection-only; every remedy is Phase 2's to choose.

## Testing Strategy

Not applicable — documentation, zero runtime surface. Verification is the proposal's success-criteria
checklist, with one mechanical check: the main table's row count MUST equal the drift guard's
Required Verbs count (21).

## Migration / Rollout

No migration required. Rollback is deleting the change directory.

## Risks

| Risk | Mitigation |
|---|---|
| Every `gitlab-*.json` is derived — no live mirror ever validated | Named explicitly in the fixture-debt section as debt, not coverage |
| Derived fixtures encode the author's belief; `covered + derived` can still be wrong | Provenance is a first-class column (D1) |
| Staleness — #317 is in flight on this branch | Pinned SHA + date in the artifact header; scoped placement (D2) |
| `inline` mis-read as a gap | Provenance legend states inline is documented-and-acceptable where the suite says so |
| Ranking is judgement, not measurement | Rule published (D3) so Phase 2 can contest the reasoning |

## Open Questions

- [x] None blocking. All three proposal open questions are resolved: D2 (scoped), D1 (separate extras table), D3 (priority order only, no PR count).
