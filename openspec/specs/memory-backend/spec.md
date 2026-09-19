### [issue-1061] engram-duplicate-heal — 2026-09-19

# Memory Backend Specification

## Purpose

Implements `brain/core/methodology/memory-backend-contract.md` (Deletion): "The adapter MAY
delete its own rows for reconciliation (a duplicated key …). Records are never deleted."
Defines the duplicate-detection and heal contract for the active memory backend (engram).
Complements, without duplicating, "hydration is idempotent by record id"
(`openspec/changes/issue-864-memory-2-0/spec.md:66-74`), which this heal restores when
pre-guard data violates it.

## Requirements

### Requirement: REQ-MB-1: Duplicate Detection By Record Id

The system MUST group `engram export` rows by `topic_key`, considering only `rec-`-prefixed
keys. A key with more than one live row MUST be classified a duplicate. The keeper MUST be
the row with the lowest observation id in the group.

#### Scenario: two rows, one key
- GIVEN two live rows sharing `topic_key: rec-abc123`
- WHEN the module processes the export
- THEN it reports the lower-id row as keeper and the higher-id row as delete-candidate

#### Scenario: non-record keys are ignored
- GIVEN two live rows sharing a `topic_key` without the `rec-` prefix
- WHEN the module processes the export
- THEN that key is not reported as a duplicate

### Requirement: REQ-MB-2: Dry-Run By Default

Without an explicit apply flag, the system MUST print each duplicate's key, keeper id, and
the ids it would delete, and MUST NOT delete or mutate any row.

#### Scenario: dry-run on the measured store
- GIVEN the live store's three known duplicate pairs
- WHEN the heal verb runs without the apply flag
- THEN it lists exactly ids `3092`, `3093`, `3094` to delete, and the store is unchanged

### Requirement: REQ-MB-3: Refusals Delete Nothing

The system MUST refuse (delete nothing, exit non-zero, name the offending key) when: copies
of one key differ in content, title, or type; a key has more than two live rows; or the
export shape is unrecognized (missing `observations`/required fields, or an untested engram
version).

#### Scenario: divergent copies refuse
- GIVEN two rows sharing a key whose content differs
- WHEN the heal verb runs
- THEN it exits non-zero, names the key, deletes nothing

#### Scenario: more than two rows refuse
- GIVEN three or more live rows sharing one key
- WHEN the heal verb runs
- THEN it exits non-zero, names the key, deletes nothing

#### Scenario: unrecognized export shape refuses
- GIVEN an export missing a required field
- WHEN the heal verb runs
- THEN it exits non-zero before classifying any key, deletes nothing

#### Scenario: an untested engram version refuses before any export or delete
- GIVEN the installed engram reports a version outside the tested `1.20.x` range (or the
  version probe returns no answer)
- WHEN the heal verb runs, with or without the apply flag
- THEN it exits non-zero naming the version, runs no `engram export` and no `engram delete`,
  and deletes nothing

### Requirement: REQ-MB-4: Apply Deletes Only Non-Keeper Rows Via the Backend

With the apply flag, the system MUST delete exactly the non-keeper rows of each valid
duplicate group through the backend's own delete, and MUST NOT read or write
`.memory/records/` or `.memory/index.jsonl`. A second apply run MUST find no duplicates.

#### Scenario: apply removes the duplicate
- GIVEN a duplicate group with a keeper and one non-keeper row
- WHEN the heal verb runs with the apply flag
- THEN `engram export` afterward returns one row per key, and `.memory/records/` and
  `.memory/index.jsonl` are byte-unchanged

#### Scenario: second apply is a no-op
- GIVEN a store already healed
- WHEN the heal verb runs again with the apply flag
- THEN no duplicates are reported and no delete is issued

### Requirement: REQ-MB-5: Post-Apply Verification Matches the Epic Audit

After a successful apply, the backend audit line MUST read `distinct = rows` for `rec-`
keys, satisfying the epic's "measured on the live store" acceptance
(`openspec/changes/issue-864-memory-2-0/spec.md:66-74`).

#### Scenario: audit confirms the heal
- GIVEN a store healed by an apply run
- WHEN the backend is exported and `rec-` keys are counted
- THEN distinct keys equal rows

## Out of Scope

The record-layer excess (`rec-4a22e13fd3c3aebd`, `rec-95740755792f0f1c`; ADR-0017) is never
collapsed by this heal. Running the heal automatically (inside `import` or `session:start`)
is not covered — this spec governs only an explicitly invoked, one-time verb.
