# Spec Delta — THE CUTOVER (slice C2b-2)

> Un-refuses the migrate-v1 CLI, ships the cutover runbook + a rehearsed rollback. The real execution
> against the true store is @csrinaldi's post-APPROVE keystroke — NOT in this PR. See [design.md](design.md).

## REQ-C2B2-1: The CLI executes the real migration (un-refused)

`memory:migrate-v1` without `--dry-run` MUST execute `runMigration()` against `.memory/`
(no longer refuse). `--dry-run` is unchanged. The abort-if-populated guard (from C2-migrate) still
protects re-runs, and its message still routes to the runbook.

#### Scenario: the non-dry-run CLI path runs the migration (fixture)

- GIVEN a fixture `.memory/chunks/` and an empty `records/`
- WHEN `migrate-v1` runs without `--dry-run` (against the fixture root)
- THEN `runMigration` executes: records written, chunks moved to `legacy/`, report persisted, index rebuilt

## REQ-C2B2-2: A rehearsed rollback restores the pre-cutover state

The slice MUST provide a rollback (`memory:migrate-v1 --rollback` or equivalent) that restores chunks
from `.memory/legacy/`, removes `.memory/records/`, and rebuilds the index — returning the store to its
pre-cutover state. It MUST be rehearsed in a fixture and its output captured as evidence (an unrehearsed
rollback is not a rollback).

#### Scenario: rollback restores a migrated fixture to byte-identical pre-cutover state

- GIVEN a fixture store snapshotted, then migrated (records written, chunks → legacy/)
- WHEN the rollback runs
- THEN `.memory/chunks/` is restored, `records/` is gone, and the store matches the pre-migration snapshot

## REQ-C2B2-3: The cutover runbook is a committed artifact

`runbook.md` MUST live in the change dir with: numbered steps, the exact command per step, an observable
verification per step, the `memory.dualWrite=true` config flip as step 2 (immediately after the real
migrate), the rollback as its own section, and the post-cutover success criteria against the forecast
(275 fallback / 3 rejected named / 4 empty / 0 unparseable).

#### Scenario: the runbook is complete and ordered

- GIVEN `runbook.md`
- WHEN read
- THEN it contains steps (0) preflight+backup, (1) migrate real, (2) commit dualWrite=true, (3) verification share, (4) post-cutover criteria, and a rehearsed rollback section — in that order

## REQ-C2B2-4: No real-store mutation in this slice

No code path, test, or artifact in this PR mutates the real `.memory/`. The real cutover is @csrinaldi's
post-APPROVE keystroke, executed per the runbook.
