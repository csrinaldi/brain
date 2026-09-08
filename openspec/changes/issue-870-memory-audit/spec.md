---
status: applying
issue: 870
---

# memory:audit Specification (#870)

## Requirements

### Requirement: the five numbers come from records and git, no backend needed

#### Scenario: fresh clone, no backend
- **WHEN** `npm run memory:audit` runs where the active backend cannot be exported
- **THEN** latency, line accounting, actor shape and coverage print from `.memory/records/` and `git log`, and the backend row states why it was not measured

#### Scenario: the quoted numbers reproduce
- **WHEN** the audit runs with `--since 2026-08-01` on the history that opened the epic
- **THEN** latency n, p50, p90 match the hand query within the same nearest-rank definition, or the difference is explained in the ticket

### Requirement: latency is learn→main, measured against the landing commit

#### Scenario: percentiles
- **WHEN** records in the window have a landing commit
- **THEN** p50, p75, p90, max are nearest-rank over (landed − ts), and counts within 1 h / over 24 h / over 72 h are printed

#### Scenario: not yet landed
- **WHEN** a record file in the window has no landing commit in the current history
- **THEN** it is excluded from percentiles and counted on its own line

### Requirement: actor shape is classified, not guessed

#### Scenario: four shapes
- **WHEN** actors are `@legacy`, contain `/`, match `^@[A-Za-z0-9][A-Za-z0-9-]*$`, or none of these
- **THEN** they count as legacy, branch-name, handle, other — in-window and all-time

### Requirement: the backend row is real under both backends

#### Scenario: engram
- **WHEN** `MEMORY_BACKEND=engram` and the export succeeds
- **THEN** `rec-` rows vs distinct keys come from the export, with duplicated keys listed

#### Scenario: plainfiles (vacuity row)
- **WHEN** `MEMORY_BACKEND=plainfiles`
- **THEN** rows are `index.jsonl` entries and distinct keys are distinct ids, labelled as the vacuity row

### Requirement: failure is stated, never zero

#### Scenario: unreadable records dir
- **WHEN** `.memory/records/` is absent or unreadable
- **THEN** the audit exits non-zero naming the path; it prints no zeros

#### Scenario: JSON for machines
- **WHEN** `--json` is passed
- **THEN** the same report is printed as one JSON object with the same fields
