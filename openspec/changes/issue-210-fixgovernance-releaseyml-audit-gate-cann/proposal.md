# Proposal: Fix release.yml audit-gate ordering & release integrity

**Issue**: #210  
**Type**: Bug / Governance  
**Status**: Draft (SDD Phase: Proposal)  

---

## 1. Problem Statement

The `release.yml` workflow contains an `audit-gate` job documented as Rung 2 of the substrate ladder contract (ADR-0015). It is intended to be a fail-closed gate that prevents un-governed releases in repos where branch protection (Rung 1) is unavailable or incomplete.

However, `release.yml` currently triggers on `push: tags: ['v*']`. Under the current release flow:
1. A release PR is merged to `main`.
2. The maintainer pushes a git tag `vX.Y.Z` to `origin`.
3. GitHub Actions triggers `release.yml` on the tag push.

Because the git tag already exists on GitHub before `release.yml` runs, a failure in `audit-gate` (`exit 1`) fails the Actions run but **cannot prevent or undo the tag creation**. Furthermore, historical non-squash merge commits (e.g. `Merge pull request #N...`) lack issue closing keywords (`Closes #N`), causing `brain-audit` to fail on ranges containing legacy merges.

This makes Rung 2 enforcement illusory and overstates governance guarantees in `detectSubstrate`.

---

## 2. Proposed Solution

We propose a three-part fix:

### Part 1: Audit-Then-Tag Release Workflow (`release.yml`)
- Re-architect the release workflow to trigger via `workflow_dispatch` (manual trigger with `version` input, e.g., `v1.1.0`) or a pre-release check.
- Step 1: Run `brain-audit.mjs` against `PREV_TAG..HEAD` (or `origin/main`).
- Step 2: Only if `brain-audit` exits 0 (GREEN), automatically create and push the git tag `vX.Y.Z` and publish the GitHub release.
- If `brain-audit` fails (RED), abort before creating any tag.

### Part 2: Audit Baseline & Legacy Grandfathering
- Ensure `brain-audit.mjs` respects `governance.auditBaseline` (e.g. pinned to `v1.0.0`) so historical non-squash merge commits predating 1.0 policy do not permanently redden release audits.
- Enforce/document squash-merge or keyword conventions for post-1.0 merges.

### Part 3: Honest Substrate Reporting & ADR-0015 Alignment
- Update `detectSubstrate` and documentation to accurately report Rung 2 status based on the new audit-then-tag release guarantee.
- Draft an ADR update or amendment in `openspec/changes/issue-210-fixgovernance-releaseyml-audit-gate-cann/brain-drafts/` if needed for Tier 2 human review.

---

## 3. Scope & Non-Goals

### In Scope
- Refactoring `.github/workflows/release.yml` to audit before tagging (audit-then-tag).
- Configuring baseline/grandfathering in `brain.config.json` / `brain-audit.mjs`.
- Updating substrate detection (`detectSubstrate`) tests and assertions.
- Drafting any required ADR amendment in `brain-drafts/`.

### Non-Goals
- Changing Rung 1 branch protection rules (handled separately in #94).
- Modifying core governance invariant check logic inside `brain/scripts/governance/checks/`.

---

## 4. Risks & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Manual tag creation by maintainer bypasses workflow | High | Document release workflow usage (`npm run brain:ship` or `workflow_dispatch`); detect manual tags post-hoc |
| `workflow_dispatch` requires write permissions | Low | GitHub Actions default token has tag creation permissions when configured |

---

## 5. Verification Plan
- Unit & integration tests for `detectSubstrate` and `release.yml` workflow parameters.
- Test `brain-audit` execution with baseline configuration.
- Dry-run release workflow verification in test environment.
