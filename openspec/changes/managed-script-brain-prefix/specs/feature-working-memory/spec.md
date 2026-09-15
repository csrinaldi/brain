# Delta for feature-working-memory (issue #961)

Ratified rulings R1-R10 (maintainer, 2026-09-14, issue #961 comment) are the source of
truth and are not reopened here. Delivery: Tier-1 PR — these command literal renames
land in the same PR as the `package.json` rename.

## MODIFIED Requirements

### Requirement REQ-S0-2: Pre-push Memory Guard

The pre-push hook MUST inspect `git status --porcelain -- .memory` after
`brain:memory:share` and MUST exit 1 with an actionable message when uncommitted
changes remain under `.memory/`.

(Previously: cited the bare `memory:share` name.)

#### Scenario: Blocks push on uncommitted memory

- GIVEN `brain:memory:share` writes uncommitted chunks to `.memory/`
- WHEN `git push` triggers the hook
- THEN the hook exits 1 with a message that references `.memory/`

#### Scenario: Passes when memory is clean

- GIVEN `.memory/` has no uncommitted changes after `brain:memory:share`
- WHEN `git push` triggers the hook
- THEN the hook exits 0

### Requirement REQ-S4-1: Pre-push Checkpoint Automation

The pre-push hook MUST call `feature-checkpoint <feature>` after `brain:memory:share`
completes and before the uncommitted-memory guard check, when a matching
`openspec/changes/<feature>/` directory exists for the active branch.

(Previously: cited the bare `memory:share` name.)

#### Scenario: Checkpoint runs automatically on push

- GIVEN the active branch has a matching `openspec/changes/<feature>/` directory
- WHEN `git push` triggers the pre-push hook
- THEN `feature-checkpoint <feature>` runs after `brain:memory:share` and before the
  guard check exits

### Requirement REQ-E-1: Feature Memory Isolation (Epic Invariant)

Feature working memory MUST NOT enter `.memory/` as unversioned ephemeral engram state
via `brain:memory:share`. `featureCheckpoint()` MUST write only to the filesystem
(`resume.md`). After any `brain:memory:share` run, `.memory/` MUST NOT contain
observations whose sole origin is a call to `featureCheckpoint()`.

(Previously: cited the bare `memory:share` name, twice.)

#### Scenario: feature-checkpoint writes only to filesystem

- GIVEN `feature-checkpoint <feature>` runs
- WHEN backend execution is traced
- THEN no call to `engram save`, `engram sync --export`, or `mem_save` is made inside
  `featureCheckpoint()`
- AND `openspec/changes/<feature>/resume.md` is the only artifact written
