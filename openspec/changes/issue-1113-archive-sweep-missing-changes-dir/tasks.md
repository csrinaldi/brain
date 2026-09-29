---
status: draft
issue: 1113
---

# Tasks — #1113

- [x] **T1** Read `sweep.mjs`, its CLI entrypoint, `sweep.test.mjs`, and the workflow's `--apply`
      step to confirm the exact crash site and the empty-alarm-block mechanism.
- [x] **T2** Confirm the GitLab governance fragment (`brain/scripts/ci/gitlab-governance.yml`,
      ADR-0018) does not invoke the archive sweep — nothing to fix there.
- [x] **T3** RED: add `listChangeFolders` tests to `sweep.test.mjs` (missing root → `[]`,
      directories-only, non-ENOENT rethrows) — confirm they fail because the export does not
      exist yet.
- [x] **T4** GREEN: add `listChangeFolders` to `sweep.mjs`; wire the CLI entrypoint to use it
      instead of the bare `readdirSync`. Re-run `sweep.test.mjs` — all pass.
- [x] **T5** Fix the workflow: merge stderr into the `--apply` step's captured output (`2>&1`) so
      the alarm's "Sweep output" block carries real text on a genuine fail-closed failure
      (REQ-1113-3).
- [x] **T6** Full `npm test` green, no regressions.
- [x] **T7** `npm run brain:repo:check` green.
- [x] **T8** `npm run brain:nav` green (real exit code checked, not piped).
- [x] **T9** SDD artifacts for this change (`proposal.md`, `spec.md`, `design.md`, `tasks.md`).
- [x] **T10** Save the root cause to engram.
