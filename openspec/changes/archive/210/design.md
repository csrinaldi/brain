# Technical Design: Fix release.yml audit-gate ordering & release integrity

**Issue**: #210  
**Status**: Approved  

---

## 1. Architecture & Component Changes

### A. Release Workflow (`.github/workflows/release.yml`)
1. **Trigger Change**:
   - Replaces `on: push: tags: ['v*']` with `on: workflow_dispatch: inputs: tag_name: ...`.
2. **Audit Execution Step**:
   - Runs `node brain/scripts/brain-audit.mjs "${PREV_TAG}..HEAD"` fail-closed.
3. **Tag & Release Creation Step**:
   - Executed **only after** `brain-audit.mjs` exits 0.
   - Executes `git tag "${TAG_NAME}"` and `git push origin "${TAG_NAME}"`.
   - Optionally creates GitHub release using `gh release create`.

### B. Audit Baseline Configuration (`brain.config.json` & `brain-audit.mjs`)
- Sets `"governance": { "auditBaseline": "v1.0.0" }` in `brain.config.json`.
- Ensures legacy merge commits before `v1.0.0` (which lack `Closes #N`) are logged as `[SKIP] ... before audit baseline` instead of failing the audit.

### C. Substrate Detection (`brain/scripts/vcs/substrate.mjs`)
- Rung 2 evaluation (`evalRung2`) continues to verify `releaseGate` probe presence (`.github/workflows/release.yml`).
- Verification tests confirm that Rung 2 reflects the fail-closed pre-tag guarantee.

---

## 2. Technical Contracts & Invariants

- **ADR-0015 Alignment**: Rung 2 is genuinely fail-closed because `brain-audit` runs before the release tag exists.
- **Fail-Closed Rule**: A non-zero exit code from `brain-audit.mjs` prevents tag creation.

---

## 3. Implementation Steps

1. Update `brain.config.json` to include `"auditBaseline": "v1.0.0"`.
2. Refactor `.github/workflows/release.yml` for `workflow_dispatch` audit-then-tag logic.
3. Add tests in `brain/scripts/vcs/substrate.test.mjs` or `brain/scripts/brain-audit.test.mjs` validating the baseline and release workflow contract.
4. Execute `npm run brain:repo:check` and `npm run test` to verify zero regressions.
