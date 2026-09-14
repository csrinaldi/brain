## Delta for session-start

Retires engram's transport artifacts (manifest, merge driver, legacy chunk
archive, `dualWriteRecords`) so memory-backend-contract Rule 3 ("no backend
artifact is load-bearing") holds. Two stacked PRs: Slice A (manifest, driver,
symlink, spec/doctrine) and Slice B (`dualWriteRecords`, rollback, legacy
archive).

## REMOVED Requirements

### Requirement: REQ-3 (Removed — #955)
(Reason: no writer of `.memory/manifest.json` remains since #874 split B; the
restore step is dead weight.)
(Migration: behavior replaced by Requirement "No Manifest Operation" below.
REQ-4 through REQ-9 keep their numbers — this entry stays a stub so nothing
is renumbered.)
`[Slice A]`

## MODIFIED Requirements

### Requirement: REQ-7 Deterministic Context Output
The system MUST print a compact, deterministic context block to stdout
containing: brain version (optional/best-effort), current branch, resolved
change(s) (or "none"), and the ticket resume summary (or "none").
(Previously: "Full context available" required manifest restore as a
precondition.)

#### Scenario: Full context available
- GIVEN engram hydration, branch resolution, and resume all succeed
- WHEN `session:start` completes
- THEN stdout contains all four sections in a stable, parseable order

#### Scenario: Partial context still prints a valid block
- GIVEN branch resolution finds no change
- WHEN `session:start` completes
- THEN the block still prints an explicit "no active change" section
`[Slice A]`

### Requirement: REQ-9 day:start Non-Regression
After extracting `lib/git-branch.mjs` for reuse by `session:start`,
`day:start` MUST preserve its existing observable behavior (networked steps,
output, exit codes) and MUST NOT reintroduce a manifest-restore call site.
(Previously: cited extracting `lib/memory-manifest.mjs` alongside
`git-branch.mjs`; that library no longer exists.)

#### Scenario: day:start behavior unchanged after extraction
- GIVEN the pre-extraction `day:start` test suite
- WHEN `day:start` runs after the libs are extracted and consumed
- THEN all prior `day:start` behavior and tests still pass unchanged
`[Slice A]`

## ADDED Requirements

### Requirement: No Manifest Operation
The system MUST NOT perform any `.memory/manifest.json` read, write, or
restore on the `session:start`, `day:start`, or `memory:pull` paths.

#### Scenario: Session start does not restore a manifest
- GIVEN no `.memory/manifest.json` exists in the worktree
- WHEN `session:start` runs
- THEN it performs no manifest operation and exits 0 with the same context block
`[Slice A]`

### Requirement: Symlink Confinement
The `.engram` symlink SHALL be ensured only by `setup()`. `share()` and other
verbs MUST NOT create or repair it.

#### Scenario: The symlink is set up, never repaired on the way
- GIVEN a worktree missing the `.engram` symlink
- WHEN `memory:share` or `memory:pull` runs
- THEN the symlink stays absent; only running `setup()` creates it
`[Slice A]`

### Requirement: No Backend Artifact Is Load-Bearing
With `.memory/manifest.json`, the `.gitattributes` merge-driver line,
`merge-engram-manifest.mjs`, and the `.engram` symlink all absent,
`session:start`, `memory:share`, `memory:pull`, and `cli.mjs import` MUST
hydrate the active backend from `.memory/records/` alone.

#### Scenario: No backend artifact is load-bearing
- GIVEN a fixture with no manifest, symlink, driver script, or driver attribute
- WHEN `session:start`, `memory:share`, `memory:pull`, and `cli.mjs import` each run
- THEN all four complete and hydrate from `.memory/records/` alone, under both `MEMORY_BACKEND=plainfiles` and `MEMORY_BACKEND=engram`
`[Slice A — R12 acceptance test]`

### Requirement: No Production Reference to a Retired Artifact
No file under `brain/scripts/` MUST reference `manifest.json` or
`engram-manifest` outside test fixtures.

#### Scenario: No production code references a retired artifact
- GIVEN the `brain/scripts/` tree after slice A merges
- WHEN a static guard scans it
- THEN it finds zero production references to `manifest.json` or `engram-manifest`
`[Slice A]`

### Requirement: Rollback Is Withdrawn
`migrate-v1 --rollback` and `rollbackMigration()` MUST NOT exist.

#### Scenario: Rollback is no longer offered
- GIVEN a user runs `cli.mjs migrate-v1 --rollback`
- WHEN the CLI parses the arguments
- THEN it refuses with a message naming the flag as retired, not a crash or silent success
(Rationale: the removed command deleted `.memory/records/` entirely after
restoring archives — removing it is a safety improvement, not a regression.)
`[Slice B]`

### Requirement: Forward Migration Is Preserved
`runMigration`, `collectChunkObservations`, and `migrate-v1 --dry-run` MUST
continue to exist and read a consumer's own `chunks/`.

#### Scenario: Forward migration still works for a consumer on v1
- GIVEN a consumer worktree with un-migrated `.memory/chunks/`
- WHEN `cli.mjs migrate-v1` (forward, non-rollback) runs
- THEN it still produces a migration report from that consumer's own chunks
`[Slice B — corrects epic ledger row 7]`

### Requirement: Observations-to-Records Write Path Is Removed
`dualWriteRecords()` and its default seams MUST NOT exist in `engram.mjs`.

#### Scenario: The observations-to-records write path is gone
- GIVEN `engram.mjs` after slice B merges
- WHEN the module is inspected or its test suite runs
- THEN no `dualWriteRecords` export, seam, or caller exists
`[Slice B]`

### Requirement: Consumer Residue Is Documented, Not Migrated
A consumer upgrading with a tracked `.memory/manifest.json` or a local
`merge.engram-manifest.driver` git config MUST be left unaffected; no
installer step MUST clean it.

#### Scenario: A consumer's leftover artifacts are inert
- GIVEN a consumer repo with a stale tracked manifest and a stale local driver config, upgraded to this version
- WHEN any memory verb runs
- THEN neither is read, written, or acted on, and the CHANGELOG documents the two manual cleanup commands
`[Slice A — R8, gap documented, not fixed]`

## Not in This Change

- Task 1.2a's engram-store duplicate-row heal (different store, different operation).
- Task 3.1d (#890), feature-PR memory surface retirement.
- The first real `memory:ship`.
- Any installer/`config-migrations.mjs` step that cleans a consumer's leftover manifest or driver config (R8) — see "Consumer Residue Is Documented, Not Migrated".
