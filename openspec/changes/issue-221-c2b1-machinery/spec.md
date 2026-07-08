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

## REQ-C2B1-2: Secret-scrub re-pointed to `records/`

The scrub MUST scan `.memory/records/*.jsonl` (plaintext JSONL) via the UNCHANGED
`scanTextForSecrets`; only the per-file reader changes (read JSONL, no gunzip). It still fails
closed and has no `--no-scrub` bypass.

#### Scenario: a secret in a records file fails closed

- GIVEN a records file containing a line with a secret matching a default pattern
- WHEN the records scrub runs
- THEN it fails closed, naming the pattern + `file:line`

## REQ-C2B1-3: Dual-write in `share` with scan-then-write over the records log

`share` MUST, in order: export engram → read observations → transform to candidate records → **scan
the candidate record lines for secrets** → **only if clean**, append records → reindex. The scan
runs BEFORE the records append. Chunks are materialized by engram's export and retain C1b's
post-materialization scan as the fail-closed backstop (design.md Decision 1).

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
