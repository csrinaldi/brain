# Tasks — Fix `checkContexts()` workflow-name prefix bug (issue #203)

---
status: applying
---

## Phase 1: `checkContexts()` bare names (REQ-203-1)

- [x] 1.1 RED: update `governance-checks.test.mjs` to assert `checkContexts()` returns
  bare `REQUIRED_JOBS`, remove the prefixed-string assertions and the
  `WORKFLOW_NAME` value test.
- [x] 1.2 GREEN: `checkContexts()` returns `[...REQUIRED_JOBS]`; fix the module-header
  and JSDoc comments that claimed the "{workflow} / {job}" naming.

## Phase 2: Static wiring drift-guard (REQ-203-2)

- [x] 2.1 RED→GREEN: new drift-guard test parsing `governance.yml`'s REQUIRED job
  `name:` fields and asserting equality with `checkContexts()`.

## Phase 3: Arm-and-verify hardening (REQ-203-3)

- [x] 3.1 RED→GREEN: `diffArmedChecks(requiredContexts, existingCheckRunNames)` pure
  function in `governance-checks.mjs` — warn-missing / no-warning / zero-runs
  unverifiable cases.
- [x] 3.2 RED→GREEN: `verifyArmedProtection({ checks, project, branch, listCheckRuns,
  log })` in `brain-protect.mjs`, wired into `activateProtection()` after
  `result.enforced`.
- [x] 3.3 `checkRuns({ project, branch })` optional verb on `providers/github.mjs`
  (non-contract; GitLab degrades to the unverifiable note).
- [x] 3.4 i18n keys `protect.verify.unverifiable` / `protect.verify.missing` in
  `en.mjs` + `es.mjs`.

## Phase 4: `WORKFLOW_NAME` removal (REQ-203-4)

- [x] 4.1 Grep `brain/scripts/**` for `WORKFLOW_NAME` consumers — none found besides
  the buggy prefix and its own test.
- [x] 4.2 Remove the constant, its export, and its comment mentions.

## Verification

- [x] 5.1 `npm test` green (877/877).
- [x] 5.2 `npm run brain:repo:check` green.
- [x] 5.3 `npm run brain:nav` green.
- [x] 5.4 Repo-wide grep for `WORKFLOW_NAME` under `brain/scripts/**` returns no
  matches (historical `openspec/changes/governance/` and
  `issue-144-governance-v3` design docs are left untouched — closed-change history).
