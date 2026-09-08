---
status: applying
issue: 820
---

# Hydration Guard Specification (#820)

## Requirements

### Requirement: two importers through one snapshot yield one row per record

#### Scenario: the #820 shape
- **WHEN** importer B starts while importer A holds the guard between its read and its write
- **THEN** B returns `{deferred: true, contended: true}` and the backend receives exactly one import payload

### Requirement: contention is a skip, never a wait

#### Scenario: never blocks
- **WHEN** the guard is held by a live process
- **THEN** `importMemory` returns without writing, in the time of a single read of the lock, and prints a line to stderr naming the holder and the retry rule

### Requirement: a stale guard does not wedge hydration forever

#### Scenario: dead holder
- **WHEN** the guard's owner pid is not alive
- **THEN** the guard is reclaimed and the import proceeds

#### Scenario: old holder
- **WHEN** the guard is older than the stale threshold
- **THEN** it is reclaimed and the import proceeds

### Requirement: the guard is released on every exit

#### Scenario: throw inside the window
- **WHEN** the read or the write throws
- **THEN** the guard is released before the error propagates

### Requirement: the twin hazard is written where the first one is

#### Scenario: header
- **WHEN** `engram.mjs`'s import header is read
- **THEN** it names both hazards — unreadable store, concurrent reader — and states that this guard is mitigation and the fix is #863
