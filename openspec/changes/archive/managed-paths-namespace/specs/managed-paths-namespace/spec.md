# Managed-Paths Namespace & Merge Safety Specification

## Purpose

Eliminates two silent data-loss collisions in `brain:upgrade` — settings.json overwrite
and scripts/ namespace takeover — by introducing a merge strategy for shared consumer
config, a general pre-upgrade collision guard, and a `brain/scripts/` namespace for the
managed harness. The change completes brain's 3-pillar model: `brain/core` (managed
methodology), `brain/project` (consumer-owned overrides), `brain/scripts` (managed harness
verbs). The consumer's root `scripts/` is restored to consumer ownership.

## Epic Invariant (Non-Goal — stated)

`brain:upgrade` MUST NOT overwrite consumer-owned content. Every path in the `managed`
array MUST be either (a) exclusively brain-owned, or (b) merged additively so consumer
keys are preserved and provably intact after every upgrade. Silent data loss via
`copyFileSync` on a consumer-controlled path is an absolute prohibition.

## Requirement Index

| Req | Slice | Name | Testable |
|-----|-------|------|---------|
| REQ-S1-1 | 1 | mergeClaudeSettings — fresh consumer | Unit (`node --test`) |
| REQ-S1-2 | 1 | mergeClaudeSettings — existing consumer, no clobber | Unit (`node --test`) |
| REQ-S1-3 | 1 | mergeClaudeSettings — idempotent re-run | Unit (`node --test`) |
| REQ-S1-4 | 1 | settings.local.json never touched | Unit (`node --test`) |
| REQ-S1-5 | 1 | .claude/settings.json excluded from raw copyManaged | Unit (`node --test`) |
| REQ-S2-1 | 2 | Pre-flight collision report | Unit (`node --test`) |
| REQ-S2-2 | 2 | --abort-on-collision aborts before any write | Unit (`node --test`) |
| REQ-S2-3 | 2 | No false positive when dest is identical or absent | Unit (`node --test`) |
| REQ-S3-1 | 3 | managed-paths declares brain/scripts/**, not scripts/** | Unit (`node --test`) |
| REQ-S3-2 | 3 | All runtime references resolve under brain/scripts/ | Full suite + integration |
| REQ-S3-3 | 3 | Consumer root scripts/ is not a managed path | Unit (`node --test`) |
| REQ-S3-4 | 3 | CHANGELOG documents breaking change and migration | File assertion |
| REQ-S3-5 | 3 | core.hooksPath transition window documented | File assertion |
| REQ-S3-6 | 3 | Single atomic commit delivers the rename | Git history assertion |
| REQ-S4-1 | 4 | brain:upgrade --dry-run on synergy: zero collisions | Manual / dry-run |
| REQ-E-1 | epic | brain:upgrade never overwrites consumer-owned content | Verified by S1+S2+S3 |

---

## Slice 1 — `.claude/settings.json` MERGE

### Requirement REQ-S1-1: mergeClaudeSettings — Fresh Consumer

`mergeClaudeSettings(existingPath, brainSettings)` in `installer.mjs` MUST detect when
`existingPath` does not exist and write `brainSettings` to disk as-is without any merge
step.

[**unit-testable**: call `mergeClaudeSettings()` with a non-existent path; assert output
equals `brainSettings` with no mutation]

#### Scenario: No existing settings.json — brain block written

- GIVEN no `.claude/settings.json` exists in the consumer repo
- WHEN `brain:upgrade` runs (via `mergeClaudeSettings()`)
- THEN the consumer's `.claude/settings.json` is created with brain's `hooks.PreToolUse` block
- AND its content is byte-for-byte identical to brain's 15-line settings block

---

### Requirement REQ-S1-2: mergeClaudeSettings — Existing Consumer, No Clobber

When the consumer already has `.claude/settings.json`, `mergeClaudeSettings()` MUST
perform an additive merge: brain's `hooks.PreToolUse` entries are inserted if absent,
and every consumer key (`permissions.allow`, other hooks, etc.) MUST be preserved
byte-for-byte. The function MUST deduplicate by `JSON.stringify(entry)` so the same
brain entry is never inserted twice.

[**unit-testable**: fixture with a pre-existing 63-entry `permissions.allow`; assert all 63
entries present, brain hooks present, no extra keys, no key order change in `permissions`]

#### Scenario: 63-entry permissions.allow survives upgrade

- GIVEN a consumer `.claude/settings.json` with 63 `permissions.allow` entries
- WHEN `brain:upgrade` runs
- THEN the result file contains all 63 original `permissions.allow` entries
- AND brain's `hooks.PreToolUse` entries are present
- AND no consumer key is absent from the merged result

#### Scenario: Consumer hooks not owned by brain are preserved

- GIVEN a consumer `.claude/settings.json` with a custom `hooks.PreToolUse` entry not in brain's block
- WHEN `brain:upgrade` runs
- THEN the custom entry is still present in `hooks.PreToolUse` alongside brain's entries

---

### Requirement REQ-S1-3: mergeClaudeSettings — Idempotent

Running `brain:upgrade` twice MUST produce the same `.claude/settings.json` on the
second run as on the first. No brain entry MUST be duplicated.

[**unit-testable**: run `mergeClaudeSettings()` twice on the same fixture; assert output
is identical on both runs; count of `hooks.PreToolUse` entries is unchanged after second run]

#### Scenario: Second upgrade adds nothing

- GIVEN `brain:upgrade` has already merged brain's `hooks.PreToolUse` into the consumer
- WHEN `brain:upgrade` runs a second time
- THEN the `.claude/settings.json` is byte-for-byte identical to the post-first-run result
- AND no brain `hooks.PreToolUse` entry appears more than once

---

### Requirement REQ-S1-4: settings.local.json Never Touched

`settings.local.json` MUST NOT be in the `managed` array and MUST NOT be read, written,
or inspected by `mergeClaudeSettings()` or any upgrade path introduced in S1.

[**unit-testable**: assert `settings.local.json` is absent from `managed-paths.mjs` export;
assert `mergeClaudeSettings()` does not reference the path]

#### Scenario: settings.local.json is byte-identical before and after upgrade

- GIVEN a consumer `settings.local.json` with arbitrary content
- WHEN `brain:upgrade` runs
- THEN `settings.local.json` is byte-for-byte identical to its pre-upgrade state

---

### Requirement REQ-S1-5: .claude/settings.json Excluded From Raw copyManaged

`.claude/settings.json` MUST NOT flow through the plain `copyFileSync` path in
`copyManaged()`. It MUST be routed through `mergeClaudeSettings()` exclusively.

[**unit-testable**: assert that `managed-paths.mjs` either (a) excludes `.claude/settings.json`
from the plain `managed` array, or (b) `copyManaged()` has an explicit gate that calls
`mergeClaudeSettings()` for this path and skips the raw copy]

#### Scenario: Raw copyManaged never writes settings.json

- GIVEN a consumer with an existing `.claude/settings.json`
- WHEN `copyManaged()` iterates managed paths
- THEN `.claude/settings.json` is NOT written via `copyFileSync` at any point during the run

---

## Slice 2 — Pre-Upgrade Collision Guard

### Requirement REQ-S2-1: Pre-Flight Collision Report

Before any managed file is written, `copyManaged()` (or `brain-upgrade.mjs`) MUST
compare the incoming brain content against the consumer's existing file for every managed
path. When a destination exists and its content differs from the incoming brain file, the
path MUST be recorded in a pre-flight collision report that is surfaced to the operator
before any write begins.

[**unit-testable**: stub filesystem reads; assert that a diff between src and dest produces
a collision record containing the path and diff summary before any write]

#### Scenario: Differing managed file produces collision record

- GIVEN a managed path whose destination exists with content different from the incoming brain file
- WHEN `brain:upgrade` runs the pre-flight check
- THEN the collision is recorded
- AND the collision report is printed before any file is written

#### Scenario: Collision report printed before first write

- GIVEN two managed paths have collisions
- WHEN `brain:upgrade` runs
- THEN both collision paths appear in the pre-flight output
- AND no managed file has been overwritten at the time the report is printed

---

### Requirement REQ-S2-2: --abort-on-collision Flag

`brain-upgrade.mjs` MUST accept a `--abort-on-collision` flag. When set and any
pre-flight collision is detected, the command MUST exit non-zero immediately without
writing any managed file.

[**unit-testable**: stub filesystem; assert exit non-zero and zero write calls when any
collision exists under `--abort-on-collision`; assert normal write when no collision exists]

#### Scenario: --abort-on-collision aborts before any write

- GIVEN a managed path whose destination differs from brain's version
- WHEN `brain:upgrade --abort-on-collision` runs
- THEN the command exits non-zero
- AND no managed file is written to disk

#### Scenario: --abort-on-collision is a no-op when no collision exists

- GIVEN all managed path destinations are absent or identical to brain's versions
- WHEN `brain:upgrade --abort-on-collision` runs
- THEN the command exits zero and writes proceed normally

---

### Requirement REQ-S2-3: No False Positive When Destination Is Identical or Absent

The collision guard MUST NOT report a collision when the destination file (a) does not
exist, or (b) is byte-for-byte identical to the incoming brain file.

[**unit-testable**: assert no collision record for absent dest; assert no collision record
for identical dest]

#### Scenario: Absent destination is not a collision

- GIVEN a managed path whose destination does not exist
- WHEN the pre-flight check runs
- THEN no collision is recorded for that path

#### Scenario: Identical destination is not a collision

- GIVEN a managed path whose destination exists and is byte-for-byte identical to the brain source
- WHEN the pre-flight check runs
- THEN no collision is recorded for that path

---

## Slice 3 — `scripts/` → `brain/scripts/` Atomic Rename (BREAKING)

### Requirement REQ-S3-1: managed-paths Declares brain/scripts/**, Not scripts/**

After S3 merges, `brain/core/managed-paths.mjs` MUST export `'brain/scripts/**'` in the
`managed` array. The entry `'scripts/**'` MUST NOT be present.

[**unit-testable**: import `managed-paths.mjs`; assert `'brain/scripts/**'` is present and
`'scripts/**'` is absent]

#### Scenario: managed array contains brain/scripts/**

- GIVEN S3 has merged
- WHEN the `managed` export from `managed-paths.mjs` is inspected
- THEN `'brain/scripts/**'` is present in the array
- AND `'scripts/**'` is absent

---

### Requirement REQ-S3-2: All Runtime References Resolve Under brain/scripts/

After S3 merges, all aliases (`package.json` scripts), `core.hooksPath`, inter-script
`node` calls, and test fixtures MUST reference `brain/scripts/` exclusively. No reference
to the old root `scripts/` path MUST remain in any runtime-critical file (hooks, verbs,
bootstrap, day-start, installer, managed-paths, verify-change, check-refs). `npm test`,
`npm run repo:check`, and `npm run brain:nav` MUST exit zero.

[**verified by full test suite (`npm test`) + fresh-install and upgrade integration tests
in the Docker test container**; these are integration-level, not unit tests]

#### Scenario: npm test green after rename

- GIVEN S3 has merged as a single atomic commit
- WHEN `npm test` runs in the brain repo
- THEN all tests exit zero

#### Scenario: hooks, verbs, and bootstrap resolve correctly

- GIVEN `bootstrap.sh` and `day-start.mjs` have been updated
- WHEN `core.hooksPath` is inspected after a fresh `env:init`
- THEN it resolves to `brain/scripts/hooks`

#### Scenario: Fresh-install integration test passes

- GIVEN a clean Docker test container
- WHEN the fresh-install integration test runs (installs brain, then runs `brain:upgrade`)
- THEN the install succeeds with no broken path references

#### Scenario: Upgrade integration test passes

- GIVEN a Docker test container with a previous brain installation
- WHEN the upgrade integration test runs
- THEN `brain:upgrade` completes with all files under `brain/scripts/`

---

### Requirement REQ-S3-3: Consumer Root scripts/ Is Not a Managed Path

A consumer that has its own files under root `scripts/` MUST retain those files
unchanged after `brain:upgrade` runs. brain MUST NOT write to the consumer's root
`scripts/` after S3 merges.

[**unit-testable**: assert `'scripts/**'` absent from managed array; integration: place
a sentinel file at `scripts/consumer-sentinel.sh` in a test fixture and assert it survives
an upgrade run]

#### Scenario: Consumer file under root scripts/ survives upgrade

- GIVEN a consumer with a file at `scripts/consumer-sentinel.sh`
- WHEN `brain:upgrade` runs after S3 merges
- THEN `scripts/consumer-sentinel.sh` is byte-for-byte identical to its pre-upgrade state
- AND no brain file is written under root `scripts/`

---

### Requirement REQ-S3-4: CHANGELOG Documents Breaking Change and Migration

`CHANGELOG.md` MUST include a breaking-change entry for the S3 rename containing:
(a) instruction to delete the orphaned root `scripts/` directory after upgrading,
(b) the updated initial bootstrap path (`node_modules/brain/brain/scripts/brain-upgrade.mjs`),
(c) the upgrade order required: `brain:upgrade` → `day:start` / `env:init`.

[**file assertion**: read `CHANGELOG.md` and assert all three items are present]

#### Scenario: CHANGELOG contains orphaned-scripts cleanup instruction

- GIVEN S3 has merged
- WHEN `CHANGELOG.md` is read
- THEN it contains an instruction to delete root `scripts/` after upgrading to the breaking version
- AND it references the new bootstrap path `node_modules/brain/brain/scripts/`
- AND it specifies the `brain:upgrade` → `day:start`/`env:init` required order

---

### Requirement REQ-S3-5: core.hooksPath Transition Window Documented

The upgrade notes (CHANGELOG or dedicated upgrade doc) MUST document the one-time
`core.hooksPath` gap: after `brain:upgrade` but before the next `env:init`/`day:start`,
hooks temporarily point to the stale path and self-heal on the next `day:start`. The
required mitigation order MUST be stated.

[**file assertion**: assert the transition gap and required order appear in upgrade notes]

#### Scenario: core.hooksPath transition gap is documented

- GIVEN S3 has merged
- WHEN the CHANGELOG or upgrade notes are read
- THEN the text explains that `core.hooksPath` points to the old path until `day:start` self-heals
- AND the mitigation order (`brain:upgrade` then `day:start`) is explicitly stated

---

### Requirement REQ-S3-6: Single Atomic Commit Delivers the Rename

The `git mv scripts/ brain/scripts/` (87 files) plus all reference updates MUST land in
a single git commit. No intermediate commit containing a partial rename is permitted.

[**git history assertion**: `git log --oneline` on the S3 merge commit shows one commit
containing both the `git mv` and all reference updates; `git show <sha> --stat` lists
both moved files and changed references]

#### Scenario: One commit contains move and all reference updates

- GIVEN S3 has merged
- WHEN `git show <S3-commit-sha> --stat` is run
- THEN both moved `brain/scripts/` files and updated references appear in the same commit
- AND no prior commit in the S3 branch contains a partial rename

---

## Slice 4 — Synergy Validation

### Requirement REQ-S4-1: brain:upgrade --dry-run on Synergy Reports Zero Collisions

After S1–S3 merge, running `brain:upgrade --dry-run` against `/home/gandalf/IA/synergy`
MUST report zero collisions. The NX monorepo coexistence notes (workspace-root
non-interference, `namedInputs` non-interference, root `package.json` alias coexistence)
MUST be written to the brain docs.

[**manual/dry-run acceptance**: operator runs `brain:upgrade --dry-run --cwd /home/gandalf/IA/synergy`
and confirms zero collision lines in output; reviewer inspects the written NX integration notes]

#### Scenario: Dry-run on synergy reports zero collisions

- GIVEN S1, S2, and S3 have merged
- WHEN `brain:upgrade --dry-run` is run targeting `/home/gandalf/IA/synergy`
- THEN the output contains zero collision records
- AND the command exits zero

#### Scenario: NX integration notes written

- GIVEN S4 is complete
- WHEN the brain docs are inspected
- THEN NX integration notes exist covering workspace-root coexistence, `namedInputs`
  non-interference, and root `package.json` alias coexistence

---

## Epic Requirements

### Requirement REQ-E-1: brain:upgrade MUST NOT Overwrite Consumer-Owned Content

At no point during `brain:upgrade` MAY a consumer-owned file be overwritten by a plain
`copyFileSync`. Every managed path MUST be one of: (a) exclusively brain-owned (no
consumer equivalent expected), (b) handled by `mergeClaudeSettings()` for additive
merge, or (c) refused by the collision guard when `--abort-on-collision` is set.

This invariant is verified compositionally: REQ-S1-2 (no clobber), REQ-S2-1/S2-2
(guard + abort), REQ-S3-3 (consumer scripts/ untouched).

#### Scenario: Upgrade on synergy consumer produces no data loss

- GIVEN synergy with its 63-entry `permissions.allow` and no root `scripts/` dir
- WHEN `brain:upgrade` runs after S1–S3 merge
- THEN `synergy/.claude/settings.json` retains all 63 `permissions.allow` entries
- AND brain's `hooks.PreToolUse` block is present
- AND no file under synergy's workspace is unexpectedly overwritten

---

## Gaps and Assumptions

| # | Gap / Assumption |
|---|-----------------|
| G1 | **Integration tests (REQ-S3-2)** require Docker or an equivalent isolated environment; they are not coverable by `node --test` alone. Verification: the fresh-install and upgrade in-container.sh scripts pass after S3. |
| G2 | **Version bump number** for the S3 breaking change is deferred to release time. The spec requires a breaking-change entry; the exact semver is an implementation decision. |
| G3 | **S4 dry-run is manual acceptance**, not automated. The zero-collision assertion cannot be automated without a checked-in synergy fixture; a live dry-run on the real monorepo is the acceptance gate. |
| G4 | **Orphaned root scripts/ cleanup** is a documented manual step for existing consumers. brain:upgrade MUST NOT auto-delete consumer files; the CHANGELOG instructs the operator to do it. |
| G5 | **ADR update** (ADR-0006 or new ADR) covering the 3-pillar model and merge-vs-overwrite policy is flagged by the proposal and deferred to S3. The spec requires the CHANGELOG to document the policy; the ADR authorship is out of spec scope. |
