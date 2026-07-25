# Spec Delta — migrate-v1 tool as fixture-tested CODE (slice C2-migrate)

> Realizes the real-run half of the C2 migration on top of C2a (#217, merged): `exportObservation`,
> the dry-run report, and the `.memory/` format library. This delta covers ONLY the C2-migrate
> scope — the tool as CODE, proven against fixtures. The real EXECUTION against the true store, the
> import direction, the scrub re-point, and the dual-write pipeline are C2b (see
> [design.md](design.md) Decisions 1 + 5).

## REQ-MIG-RUN-1: `runMigration()` converts chunks to records with no silent loss

`migrate-v1.mjs` MUST export `runMigration({ chunksDir, recordsDir, legacyDir, indexPath, … })`
(dependencies injected as `_`-prefixed seams). It writes each accepted record via the shared
`appendRecord` (bucketed `records/<record.ts.slice(0,7)>.jsonl`), moves every original chunk to
`legacyDir` (never deletes in place), persists a report, and rebuilds the index.

#### Scenario: accepted records written, chunks moved, report persisted, index rebuilt

- GIVEN a fixture store whose chunks hold one exportable observation, one non-enum-`type`
  observation, and one `scope:personal` observation
- WHEN `runMigration` runs
- THEN the accepted record lands in `records/<yyyy-mm>.jsonl`, the original chunk is in `legacyDir`
  (and absent from `chunksDir`), the report is persisted, and the index file exists

## REQ-MIG-RUN-2: The persisted report NAMES every non-migrated category

The report MUST itemize `rejected`, `skipped` (`scope:personal`, id/title/type/reason each),
`unparseableChunks`, and `emptyObservationsChunks` — **each key present even when empty** (a zero in
the report is counted-evidence, not silence; the same principle as the 0-recovered histogram).

#### Scenario: a scope:personal skip is named, not merely counted

- GIVEN a fixture with a `scope:personal` observation
- WHEN `runMigration` runs
- THEN `report.skipped` contains an entry naming that observation (`id`, `reason: "scope:personal"`),
  and all four category keys are present

## REQ-MIG-RUN-3: Idempotency abort is FIRST, routing to the cutover runbook

`runMigration` MUST throw BEFORE any filesystem work when `recordsDir` already has `.jsonl` content;
the message MUST contain `run the cutover runbook` and name the records dir.

#### Scenario: a populated records/ aborts with zero side effects

- GIVEN a `recordsDir` that already holds a `.jsonl` file, and a chunk present in `chunksDir`
- WHEN `runMigration` runs
- THEN it throws (message contains "run the cutover runbook" + the records dir), the chunk is NOT
  moved, no `legacyDir` is created, and no index is written

## REQ-MIG-RUN-4: The CLI REFUSES the real run — execution is the C2b cutover

`memory:migrate-v1` MUST support `--dry-run` (read-only report) and MUST REFUSE the non-`--dry-run`
path, routing the operator to the C2b cutover runbook. Execution gating lives in the runbook order,
NOT in a CLI bypass switch (the `--no-scrub` class C1b prohibited).

#### Scenario: the non-dry-run CLI path refuses

- GIVEN `memory:migrate-v1` invoked without `--dry-run`
- WHEN it runs
- THEN it prints the cutover-deferred message (pointing to the runbook) and exits non-zero, never
  executing `runMigration` against `.memory/`
