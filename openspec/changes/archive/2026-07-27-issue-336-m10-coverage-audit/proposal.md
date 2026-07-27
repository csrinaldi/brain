---
status: draft
issue: 336
epic: 335
sequence: 313
milestone: M10
phase: 1
artifact_store: hybrid
---

# Proposal — M10 Phase 1: VCS contract coverage audit (issue #336)

## Intent

M10 asserts "seam blindness" — logic proven, boundary assumed — but no one has counted the
seams. Today the gap list lives in a snapshot doc (`seam-contract-coverage-roadmap.md` §3),
written before #334 shipped and already stale. Phase 2 cannot slice reviewable PRs without a
ranked worklist, and the drift guard only proves verbs *exist*, never that they are *covered*.
This phase converts the claim into data: one table, every verb, ranked by blast radius.

## Scope

### In Scope
- **Coverage table**: all 21 contract verbs (`vcs-contract.md` Required Verbs) + the 3 documented
  non-contract extras (`capabilities`, `checkRuns`, `projectMergeSettings`).
- Columns: verb · contract-parity coverage (yes/no/partial) · fixture provenance
  (recorded/derived/none) · blast radius (consuming scripts) · Phase-2 candidate + priority.
- **Gap ranking**: top 6 Phase-2 candidates with rationale, ordered REQUIRED-gate consumers >
  mutating writes > reads.
- **Fixture debt section**: derived-vs-recorded ledger, incl. the unvalidated GitLab side.
- Deliverable: `openspec/changes/issue-336-m10-coverage-audit/audit.md`, self-contained enough to
  paste into a GitHub issue body.

### Out of Scope
- Writing any contract test, fixture, or spec — that is Phase 2 (#317 and its siblings).
- New test infrastructure, recording harness, or live GitLab mirror.
- Any change to `vcs-contract.md`, provider code, or the drift guard.
- Deciding *whether* zero-coverage verbs get fixed — the audit ranks, Phase 2 chooses.

## Capabilities

### New Capabilities
- None. The deliverable is a document; it introduces no runtime behavior.

### Modified Capabilities
- None. Detection-only, zero new invariants — same posture as #324.

## Approach

**Two distinct layers, never conflated.** `vcs.contract.test.mjs` is the fixture-provenance
cross-provider *parity* suite; `providers.test.mjs` is per-provider inline mocks with no parity or
provenance guarantee. A verb tested only in the latter is **partial**, not covered — that
distinction is the whole point of the audit and is exactly how #317 hid.

Sources are the three that already exist: the `vcs-contract.md` verb table, the drift guard's
reconciliation, and `fixtures/*.json` `_provenance` flags. Blast radius comes from call-site
grep. No new tooling; the audit is a read of state that is already true.

## Affected Areas

| Area | Impact | Description |
|---|---|---|
| `openspec/changes/issue-336-m10-coverage-audit/audit.md` | New | The deliverable table + ranking + fixture debt |
| `brain/core/methodology/vcs-contract.md` | Read | Verb enumeration source of truth |
| `brain/scripts/vcs/providers/vcs.contract.test.mjs` | Read | Parity coverage source |
| `brain/scripts/vcs/providers.test.mjs` | Read | Partial-coverage source |
| `brain/scripts/vcs/fixtures/*.json` | Read | `_provenance` recorded/derived flags |

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Every `gitlab-*.json` fixture is derived; no live mirror ever validated | High | Record it as fixture debt, not as coverage; Phase 2 inherits the decision, this phase does not resolve it |
| Derived fixtures encode the author's belief, so "covered" can still be wrong (the #334 mechanism) | High | Provenance is a first-class column, not a footnote; "covered + derived" reads as a distinct state |
| Audit goes stale the moment Phase 2 lands a test | Med | Date-stamp it and name it a Phase-2 input, not a maintained register |
| `providers.test.mjs` coverage gets miscounted as contract coverage | Med | Explicit partial state with the layer named in the cell |
| Blast-radius ranking is judgement, not measurement | Low | Publish the ranking rule in the doc so Phase 2 can disagree with the reasoning, not guess it |
| Scope creep into writing the first contract test | Low | Out-of-scope is explicit; #317 already holds `prReviews` |

## Rollback Plan

Delete the change directory. No code, no tests, no config, no consumer — the audit is additive
documentation with nothing downstream depending on it at merge time.

## Dependencies

None. Phase 1 is read-only and can run at any time. Reads state produced by #334 (merged, Phase 0)
and describes work claimed by #317 (Phase 2, already done). Sequencing source:
`docs/inbox/seam-contract-coverage-roadmap.md` (#335 M10 parent, #313 epic).

## Open Questions (for design)

- Does the table live in the change folder only, or get promoted to `docs/` as a durable register?
- Are the 3 non-contract extras listed for completeness, or split into a separate short table?
- Does the ranking commit to a Phase-2 PR count, or stop at priority order?

## Success Criteria

- [x] Every verb in `vcs-contract.md`'s Required Verbs table appears in the audit — count matches the drift guard.
- [x] Each row states contract-parity coverage AND fixture provenance as separate values.
- [x] Top 6 Phase-2 candidates are ranked with a stated rule, `prReviews` first.
- [x] Zero-coverage verbs (`authCheck`, `authLogin`) are flagged with their narrow blast radius stated.
- [x] Fixture debt section names the unvalidated GitLab side explicitly.
- [x] The diff contains no changes outside the change folder.
