---
status: draft
issue: 864
---

# Memory 2.0 Specification

Each requirement below is proved by a measurement, not by reading the code. The
measurements are the ones that found the property failing (audit 2026-09-03, analysis
2026-09-05), re-run after the slices land. `brain:change:verify` on this change is the
epic's exit.

## Requirements

### Requirement: memory is implementation-agnostic (the test)

No property of memory may depend on which backend is active.

#### Scenario: the plainfiles test
- **WHEN** `MEMORY_BACKEND=plainfiles` and any scenario in this spec is run
- **THEN** it passes with the same outcome as under `engram`

#### Scenario: no backend artifact is load-bearing
- **WHEN** `.memory/manifest.json`, `.memory/chunks/` and the `.engram` symlink are absent
- **THEN** `session:start`, `memory:share`, `memory:pull` and `memory:import` complete and hydrate the active backend from `.memory/records/` alone

### Requirement: hydration is idempotent by record id

#### Scenario: two hydrations, one snapshot
- **WHEN** two `import` runs are driven through the same snapshot of the backend's state (the #820 shape)
- **THEN** the backend holds exactly one row per record id

#### Scenario: measured on the live store
- **WHEN** the backend is exported and `rec-` keys are counted
- **THEN** distinct keys equal rows, and `session:start` prints the count next to the recency line

### Requirement: a capture is a record before it is anything else

#### Scenario: record first
- **WHEN** an agent captures an observation during a session
- **THEN** a file exists under `.memory/records/` before the live index is updated, and the index row cites that record's id

#### Scenario: no loss before durability
- **WHEN** two sessions capture the same topic before any `share`
- **THEN** two records exist, and the later carries `supersedes` naming the earlier

### Requirement: a record carries its provenance

#### Scenario: a fresh capture is attributed
- **WHEN** a record is captured today
- **THEN** it carries `actor`, `actorKind` and `issue`, and `actor` is not `@legacy`

#### Scenario: a correction is expressible
- **WHEN** an agent corrects a record
- **THEN** it writes a new record with `supersedes` = the corrected id, and the store refuses a `supersedes` that names no existing record

### Requirement: memory reaches `main` on its own lane

#### Scenario: a record does not wait for its feature
- **WHEN** a record is captured on a worktree branch that never merges
- **THEN** the record reaches `main`

#### Scenario: feature pull requests carry no records
- **WHEN** a feature PR is opened after the lane exists
- **THEN** its diff adds nothing under `.memory/records/`

#### Scenario: the lane is path-restricted
- **WHEN** a memory-lane PR touches any path outside `.memory/records/` additions and `.memory/index.jsonl`
- **THEN** it is refused, naming the path

#### Scenario: latency, measured
- **WHEN** learn→main latency is measured over the records captured after the lane exists
- **THEN** p50 is stated on #864 next to the 10.9 h that opened it, and is lower

### Requirement: the contract is documented in the vocabulary of records

#### Scenario: no verb is described as "engram → .memory"
- **WHEN** `harness-contract.md` and `consolidation-protocol.md §5` are read
- **THEN** every memory verb is described in terms of `.memory/records/` and "the active backend"

#### Scenario: the backend contract exists
- **WHEN** an adapter is written or reviewed
- **THEN** there is a contract document it cites, stating hydration idempotence, record-first capture, and the no-artifact rule

### Requirement: the store's integrity is reported, not queried by hand

#### Scenario: duplicates are audible on both sides
- **WHEN** a duplicated record id exists in the log or a duplicated key in the backend
- **THEN** the next `session:start` or `post-merge` prints it to stderr
