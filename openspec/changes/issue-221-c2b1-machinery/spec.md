# Spec Delta — records-as-write-truth machinery (slice C2b-1)

> Realizes the import direction + the scrubbed dual-write on top of C2a (#217) + C2-migrate (#219).
> Fixture-tested only; the real cutover is C2b-2 (#222). See [design.md](design.md).

## REQ-C2B1-1: Import — brain record → engram observation (inverse of export)

The library MUST export `importRecord(record)` producing an engram observation whose `content`
carries the record's provenance as §4 prose via the shared `renderProvenance`, reversing the R2
title fold and the UTC-seconds `ts` normalization. Import is the designed inverse of C2a's
`exportObservation`.

#### Scenario: record → engram → record preserves `id` (the C4-ready round-trip, id-equality)

- GIVEN a brain record (with or without `issue`/`source`)
- WHEN it is imported to an engram observation and that observation is exported back to a record
- THEN the two records are equal under **id-equality** (`computeRecordId` matches) — NOT byte
  equality (the `source`/`issue` render asymmetry is inert because `source` is hash-excluded)

## REQ-C2B1-2: Secret-scrub records reader — tested cutover seam (not wired into `share` this slice)

The library MUST provide a records-file reader (`scrubRecordsFile`) that scans
`.memory/records/*.jsonl` (plaintext JSONL) via the UNCHANGED `scanTextForSecrets`; only the
per-file reader changes (read JSONL, no gunzip). It fails closed and has no `--no-scrub` bypass.
**Correction (fix pass, issue #221):** this slice ships `scrubRecordsFile` tested in isolation but
does NOT wire it into the live `share` path — it is the seam C2b-2's real cutover will use (e.g. a
full-store/post-hoc scan). The live `share` records-protection for THIS slice is
`dualWriteRecords`'s pre-write candidate scan (REQ-C2B1-3): it scans in-memory candidate text
before anything hits disk, which is a different (and for new writes, stronger) mechanism than a
post-write file re-scan.

#### Scenario: a secret in a records file fails closed (tested seam, exercised in isolation)

- GIVEN a records file containing a line with a secret matching a default pattern
- WHEN `scrubRecordsFile` runs directly against that file (unit-level, not via `share`)
- THEN it fails closed, naming the pattern + `file:line`

## REQ-C2B1-3: Dual-write in `share` with scan-then-write over the records log, idempotent by id

**The dual-write is DORMANT by default (fix pass, issue #221 — human ruling; design.md Decision 5):**
`share` invokes `dualWriteRecords` ONLY when `memory.dualWrite === true` in `brain.config.json`
(default false, added by the additive `0.6.0` migration). Absent/false → `share` keeps C1b behavior
(export + chunk scrub only), so merging this machinery never populates `records/` ahead of the
C2b-2 cutover's abort-if-populated guard. The flip to true is a committed runbook step, not a merge.

When ACTIVE, `share` MUST, in order: export engram → **scan materialized chunks (C1b backstop)** →
read observations → transform to candidate records → **scan the candidate record lines for secrets**
→ **only if clean**, dedup candidates by content-addressed `id` against what `records/` already has
→ append the NEW records → reindex. The candidate-record scan runs BEFORE the records append. The
chunk backstop runs BEFORE the records dual-write (fix pass, issue #221, MINOR) so a
chunk-only secret aborts the share before `records/` is ever touched.

`dualWriteRecords` MUST be idempotent (fix pass, issue #221, BLOCKER): re-running `share` with the
same observations MUST NOT append duplicate physical lines to `records/` — a candidate whose `id`
is already present (from a prior run, or duplicated within the same batch) is counted as `deduped`,
never re-appended. The returned accounting MUST name every observation's fate — `written`,
`deduped`, `errored`, `rejected`, `skippedPersonal`, `unparseableChunks`,
`emptyObservationsChunks` — mirroring `buildMigrationReport`'s honest-accounting contract (fix
pass, issue #221, MAJOR); none of these categories abort the run for the others.

#### Scenario: a planted secret aborts before the records append (records log stays clean)

- GIVEN a candidate observation containing a secret
- WHEN `share` runs
- THEN it fails closed BEFORE appending, and `records/` is NOT written/mutated (the append-only log
  never receives the secret); the run does not push

#### Scenario: a clean run appends records and reindexes

- GIVEN clean candidate observations
- WHEN `share` runs
- THEN records are appended to `records/<yyyy-mm>.jsonl`, chunks are materialized (transitional,
  scanned by the C1b backstop), and the index is rebuilt

#### Scenario: a repeated share of the same observations is idempotent (no duplicate physical lines)

- GIVEN a `records/` file already containing a record for observation O (from a prior `share`)
- WHEN `share` runs again over the same observation O (unchanged content, same computed `id`)
- THEN `records/` gains zero new physical lines for O, and the accounting reports it as `deduped`

#### Scenario: every observation's fate is accounted for, none silently dropped

- GIVEN a batch of one clean observation, one that throws on export, one `scope:personal`, and one
  with a non-enum `type`
- WHEN `dualWriteRecords` runs
- THEN the returned accounting reports `written:1, errored:1, skippedPersonal:1, rejected:1` — every
  observation is named in exactly one bucket
