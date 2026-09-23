# Spec: Fix release.yml audit-gate ordering & release integrity

**Issue**: #210  
**Status**: Approved Delta Specification  

---

## Requirements

### REQ-210-1: Audit-Then-Tag Pre-Release Execution
The `release.yml` workflow MUST execute `brain-audit.mjs` over `PREV_TAG..HEAD` BEFORE any git tag is created or pushed to GitHub. A non-zero exit code from `brain-audit.mjs` MUST abort the workflow immediately without creating a release tag.

### REQ-210-2: Trigger & Input Configuration
`release.yml` MUST support manual dispatch (`on: workflow_dispatch`) with a required `tag_name` input parameter (e.g. `v1.1.0`), preventing un-audited automatic triggers on raw tag pushes.

### REQ-210-3: Baseline Audit Filtering
`brain-audit.mjs` MUST honor `governance.auditBaseline` from `brain.config.json`. Any merge commit before the baseline ref MUST be marked `[SKIP]` without failing the audit, ensuring pre-1.0 legacy merge commits do not block post-1.0 releases.

### REQ-210-4: Substrate Verification Alignment
`detectSubstrate` (and associated substrate ladder tests) MUST probe `.github/workflows/release.yml` and verify that Rung 2 enforcement corresponds to the audit-then-tag release contract.
