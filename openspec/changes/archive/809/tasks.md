# Tasks: #809 — promote learns the migration shape

Single PR (estimated ~180 countable lines — lib + dispatch arm; tests and
openspec exempt). Closes #809. Strict TDD.

- [x] 1.1 RED: `migration-draft.test.mjs` — parser (one block / zero / two /
      JS refused / `migrate` refused / bad defaults), `proposeVersion`
      (next-minor, override, ≤ tail refusal), `spliceMigrationEntry`
      (append before `];`, anchor-missing refusal, key order).
- [x] 1.2 GREEN: `brain/scripts/lib/migration-draft.mjs`.
- [x] 1.3 RED: promote dispatch — a `config-migrations-*.md` draft routes to
      the migration plan; the proof step blocks a broken candidate; declining
      writes nothing; the plan prints the renumber line.
- [x] 1.4 GREEN: the arm in `brain-promote.mjs`.
- [x] 1.5 Convert the three pending drafts; parser test over all three.
- [x] 1.6 Full suite, `repo:check`, `nav`; work-unit commits; memory record
      with `--issue 809`.

## Review Workload Forecast

Estimated ~180 countable vs `lite` 1000 — single PR, no chain, no decision
needed before apply.
