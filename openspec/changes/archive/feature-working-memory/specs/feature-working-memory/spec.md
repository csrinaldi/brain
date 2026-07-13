# Feature-Scoped Working Memory Specification

## Purpose

A second memory layer that travels with the feature branch, structurally
separated from durable team memory. Source of truth:
`openspec/changes/<feature>/resume.md` (committed, git-reconstructible, never
merged to `main`). Hydrated into local engram per machine on resume via
`feature-resume`. Never exported through `engram sync`.

## Requirement Index

| Req | Slice | Name |
|-----|-------|------|
| REQ-S0-1 | 0 | Memory Path Abstraction |
| REQ-S0-2 | 0 | Pre-push Memory Guard |
| REQ-S1-1 | 1 | Resume Schema |
| REQ-S1-2 | 1 | Dispatcher Verb Contract |
| REQ-S2-1 | 2 | Feature Checkpoint |
| REQ-S2-2 | 2 | Feature Resume Projection |
| REQ-S3-1 | 3 | Auto-Resume on Re-checkout |
| REQ-S4-1 | 4 | Pre-push Checkpoint Automation |
| REQ-E-1  | epic | Feature Memory Isolation |

---

### Requirement REQ-S0-1: Memory Path Abstraction

`.memory/` MUST be the canonical committed directory for durable team memory.
`.engram` MUST be a filesystem symlink to `.memory/`. `setup()` MUST create the
symlink when `.memory/` exists and `.engram` is absent; it MUST be a no-op when
the symlink already exists.

#### Scenario: Setup creates the symlink

- GIVEN `.memory/` exists as a real directory and `.engram` does not exist
- WHEN `node scripts/memory/cli.mjs setup` runs
- THEN `.engram` is a symlink whose resolved target is `.memory/`

#### Scenario: Setup is idempotent

- GIVEN `.engram → .memory` symlink already exists
- WHEN `node scripts/memory/cli.mjs setup` runs again
- THEN no error is thrown and the symlink is unchanged

---

### Requirement REQ-S0-2: Pre-push Memory Guard

The pre-push hook MUST inspect `git status --porcelain -- .memory` after
`memory:share` and MUST exit 1 with an actionable message when uncommitted
changes remain under `.memory/`.

#### Scenario: Blocks push on uncommitted memory

- GIVEN `memory:share` writes uncommitted chunks to `.memory/`
- WHEN `git push` triggers the hook
- THEN the hook exits 1 with a message that references `.memory/`

#### Scenario: Passes when memory is clean

- GIVEN `.memory/` has no uncommitted changes after `memory:share`
- WHEN `git push` triggers the hook
- THEN the hook exits 0

---

### Requirement REQ-S1-1: Resume Schema

`openspec/changes/<feature>/resume.md` MUST contain `next_action`,
`current_slice`, and `blockers` fields. It MUST NOT duplicate slice or task
progress already tracked by checkboxes in `tasks.md`.

#### Scenario: Required fields are present after checkpoint

- GIVEN `feature-checkpoint <feature>` has run
- WHEN `openspec/changes/<feature>/resume.md` is parsed
- THEN `next_action`, `current_slice`, and `blockers` fields are all present

#### Scenario: No tasks.md content is duplicated

- GIVEN `tasks.md` contains checkbox-formatted task entries
- WHEN `feature-checkpoint <feature>` writes `resume.md`
- THEN `resume.md` contains no checkbox task entries

---

### Requirement REQ-S1-2: Dispatcher Verb Contract

`scripts/memory/cli.mjs` MUST accept `feature-checkpoint` and `feature-resume`
as valid ops. Each op MUST dispatch to the corresponding named export
(`featureCheckpoint` / `featureResume`) in the active `MEMORY_BACKEND` adapter.
The op contract MUST be backend-agnostic.

#### Scenario: Verbs dispatch to backend without error

- GIVEN `MEMORY_BACKEND=engram`
- WHEN `node scripts/memory/cli.mjs feature-checkpoint <feature>` runs
- THEN `engram.mjs::featureCheckpoint(<feature>)` is called and no "unknown op" error is emitted

---

### Requirement REQ-S2-1: Feature Checkpoint

`featureCheckpoint(<feature>)` MUST write or update
`openspec/changes/<feature>/resume.md` containing the required schema fields.
It MUST NOT call `engram sync --export` or `engram save`.

#### Scenario: Writes resume.md with required fields

- GIVEN `openspec/changes/<feature>/` exists
- WHEN `node scripts/memory/cli.mjs feature-checkpoint <feature>` runs
- THEN `openspec/changes/<feature>/resume.md` is created with `next_action`, `current_slice`, and `blockers`

#### Scenario: Subsequent checkpoint updates in place

- GIVEN `resume.md` already exists with prior content
- WHEN `feature-checkpoint <feature>` runs again
- THEN `resume.md` is updated in place; no duplicate file is created

---

### Requirement REQ-S2-2: Feature Resume Projection

`featureResume(<feature>)` MUST project each file in
`openspec/changes/<feature>/` into the local engram as one observation per file,
using the file's relative path as the topic key. It MUST NOT call
`engram sync --export`.

#### Scenario: Projects change folder to local engram

- GIVEN `openspec/changes/<feature>/` contains one or more `.md` files
- WHEN `node scripts/memory/cli.mjs feature-resume <feature>` runs
- THEN each file is saved to local engram with topic `openspec/changes/<feature>/<filename>`

#### Scenario: Resume does not trigger sync

- GIVEN `feature-resume <feature>` runs to completion
- WHEN backend execution is traced
- THEN `engram sync --export` has not been called

---

### Requirement REQ-S3-1: Auto-Resume on Re-checkout

On the re-checkout path in `ticket-start.mjs` (branch already exists), when
`openspec/changes/<feature>/resume.md` is present, `feature-resume` MUST run
automatically and print `next_action` and `current_slice` to stdout. A failure
of `feature-resume` MUST NOT abort checkout, env-copy, or VCS steps.

#### Scenario: Auto-resumes when resume.md is present

- GIVEN a feature branch already exists and `openspec/changes/<feature>/resume.md` is present
- WHEN `ticket-start.mjs <id>` reaches the re-checkout path
- THEN `feature-resume <feature>` runs and prints resume context (`next_action`, `current_slice`) to stdout

#### Scenario: Resume failure is isolated

- GIVEN `feature-resume <feature>` throws an error
- WHEN `ticket-start.mjs` is on the re-checkout path
- THEN checkout completes successfully, a warning is logged, and the process does not exit 1

---

### Requirement REQ-S4-1: Pre-push Checkpoint Automation

The pre-push hook MUST call `feature-checkpoint <feature>` after `memory:share`
completes and before the uncommitted-memory guard check, when a matching
`openspec/changes/<feature>/` directory exists for the active branch.

#### Scenario: Checkpoint runs automatically on push

- GIVEN the active branch has a matching `openspec/changes/<feature>/` directory
- WHEN `git push` triggers the pre-push hook
- THEN `feature-checkpoint <feature>` runs after `memory:share` and before the guard check exits

---

### Requirement REQ-E-1: Feature Memory Isolation (Epic Invariant)

Feature working memory MUST NOT enter `.memory/` as unversioned ephemeral
engram state via `memory:share`. `featureCheckpoint()` MUST write only to the
filesystem (`resume.md`). After any `memory:share` run, `.memory/` MUST NOT
contain observations whose sole origin is a call to `featureCheckpoint()`.

#### Scenario: feature-checkpoint writes only to filesystem

- GIVEN `feature-checkpoint <feature>` runs
- WHEN backend execution is traced
- THEN no call to `engram save`, `engram sync --export`, or `mem_save` is made inside `featureCheckpoint()`
- AND `openspec/changes/<feature>/resume.md` is the only artifact written

## Gaps and Assumptions

| # | Gap / Assumption |
|---|-----------------|
| G1 | **Feature-name resolution in ticket-start and pre-push hook**: neither script has a direct mapping from branch name (`feat/issue-11-<slug>`) to change folder name (`feature-working-memory`). Resolution strategy (glob `openspec/changes/*/resume.md`, derive from branch slug, or read a config field) is deferred to design. |
| G2 | **Scope of REQ-S4-1 guard**: the proposal does not specify whether the hook should also block when a freshly written `resume.md` is uncommitted. This spec requires checkpoint to run; the commit enforcement boundary is flagged for design. |
| G3 | **Log message correction (Slice 0)**: the proposal lists fixing misleading log output as part of Slice 0. `engram.mjs::share()` does not emit logs directly (the binary does). The exact source of the misleading messages was not confirmed in the exploration. Not specced as a discrete requirement — treated as a polish item within REQ-S0-1. |
| G4 | **`.gitattributes` and merge-driver**: `.gitattributes` already references `/.memory/manifest.json merge=engram-manifest` and `setup()` already registers the driver. After `git mv .engram .memory`, both are correct with no additional code changes. Confirmed not a spec gap — included for completeness. |
