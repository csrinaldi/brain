---
status: draft
issue: 1094
---

# Tasks — #1094

- [x] **T1** Write the drift guard (`brain/scripts/lib/managed-workflow-script-drift.test.mjs`),
      data-driven discovery off `managed`, both YAML shapes, `npm test` as a named allowance,
      failure message names file/line/script.
- [x] **T2** RED: run the guard standalone against the unmodified workflows and confirm it
      fails naming both `repo:check` call sites (`.github/workflows/governance.yml:128`,
      `brain/scripts/ci/gitlab-governance.yml:140`).
- [x] **T3** Part 1 fix: rename both call sites to `npm run brain:repo:check`. Do NOT add bare
      `repo:check` to `MANAGED_SCRIPT_KEYS`.
- [x] **T4** GREEN: re-run the guard standalone, confirm it passes.
- [x] **T5** Full suite (`npm test`) green, no regressions.
- [x] **T6** SDD artifacts for this change (`proposal.md`, `spec.md`, `design.md`, `tasks.md`).
