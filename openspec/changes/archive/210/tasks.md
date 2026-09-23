# Tasks: Fix release.yml audit-gate ordering & release integrity

**Issue**: #210  
**Status**: Ready for Implementation  

---

- [x] 1. **Config & Baseline**: Set `"auditBaseline": "v1.0.0"` under `"governance"` in `brain.config.json`
- [x] 2. **Release Workflow**: Refactor `.github/workflows/release.yml` to trigger via `workflow_dispatch` and run `brain-audit.mjs` before tag creation
- [x] 3. **Substrate & Audit Tests**: Verify `substrate.test.mjs` and `brain-audit.test.mjs` test suites pass with new baseline and workflow contract
- [x] 4. **Verification**: Run `npm run brain:repo:check` and `npm run test` cleanly
