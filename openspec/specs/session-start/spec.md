### [issue-138] session-start — 2026-07-13

# Session Start Specification

## Purpose

Defines the observable behavior of `session:start` — a universal, read-only,
local-only context loader that any agent or human can run to restore brain's
operational context (manifest, engram, active change, ticket memory) without
the cost or network surface of `day:start`.

## Requirements

### Requirement: REQ-1 Universal Invocation

The system MUST expose `npm run session:start` as an agent-agnostic entry
point. The core script MUST NOT contain Claude-specific (or any other
agent-specific) logic.

#### Scenario: Run from any shell context
- GIVEN a clean checkout of the `brain` repo
- WHEN any agent or human runs `npm run session:start`
- THEN the process exits with code 0 and prints a context block

### Requirement: REQ-2 Local-Only / No-Network Invariant

The system MUST perform ZERO network calls on the `session:start` hot path.
`memory/cli.mjs pull` MUST NEVER be invoked from this path. Only local
operations from the allowlist (`memory/cli.mjs import`, `feature-resume`-class
reads) are permitted.

#### Scenario: No network calls during execution
- GIVEN network access is disabled (e.g. via a network-stub/sandbox in tests)
- WHEN `npm run session:start` runs
- THEN it completes successfully with no network I/O attempted

#### Scenario: pull is never invoked
- GIVEN `session-start.mjs` source and its dependency graph
- WHEN inspected/tested
- THEN no code path calls `memory/cli.mjs pull` or any non-allowlisted op

### Requirement: REQ-3 Manifest Restore Before Other Ops

The system MUST restore `.memory/manifest.json` churn before any git or
engram operation, and this restore MUST be idempotent and safe to repeat.

#### Scenario: Manifest restored first
- GIVEN a `.memory/manifest.json` with local churn
- WHEN `session:start` runs
- THEN the manifest is restored before engram hydration or branch resolution begins

#### Scenario: Idempotent on repeat runs
- GIVEN `session:start` already ran once in the session
- WHEN it runs again
- THEN the manifest restore produces no errors and no unintended state change

### Requirement: REQ-4 Local Engram Hydration

The system MUST hydrate local engram from `.memory/` using
`memory/cli.mjs import` (a local-only operation).

#### Scenario: Engram hydrated from local store
- GIVEN `.memory/` contains exported chunks
- WHEN `session:start` runs
- THEN local engram is populated via `import` with no network call

### Requirement: REQ-5 Branch-to-Change Resolution

The system MUST derive the active change(s) from the current git branch by
extracting an `issue-<N>` token and matching it against
`openspec/changes/*` directory names.

#### Scenario: Exactly one match
- GIVEN the current branch contains `issue-138`
- AND `openspec/changes/issue-138-session-start` exists
- WHEN resolution runs
- THEN that single change is returned and shown in the context block

#### Scenario: Zero matches
- GIVEN the current branch is `main` or has no `issue-<N>` token, or no matching dir exists
- WHEN resolution runs
- THEN no change context is returned, no error is thrown, and the output shows a graceful "no active change" line

#### Scenario: Multiple matches
- GIVEN the branch token matches more than one `openspec/changes/*` directory
- WHEN resolution runs
- THEN all matching changes are listed in the output and none is silently dropped

### Requirement: REQ-6 Active-Ticket Operational Memory

The system MUST reuse the existing `tryFeatureResume()`
(`brain/scripts/memory/lib/auto-resume.mjs`) to surface `next_action`,
`blockers`, and `current_slice` when a `resume.md` exists for the resolved
change.

#### Scenario: Resume context found
- GIVEN a `resume.md` exists for the active change
- WHEN `session:start` runs
- THEN `next_action`, `blockers`, and `current_slice` are printed in the context block

#### Scenario: No resume context
- GIVEN no `resume.md` exists for the active change (or no change is resolved)
- WHEN `session:start` runs
- THEN `tryFeatureResume()` returns null, no error is thrown, and a graceful "no context" line is printed

### Requirement: REQ-7 Deterministic Context Output

The system MUST print a compact, deterministic context block to stdout
containing: brain version (optional/best-effort), current branch, resolved
change(s) (or "none"), and the ticket resume summary (or "none").

#### Scenario: Full context available
- GIVEN manifest restore, engram hydration, branch resolution, and resume all succeed
- WHEN `session:start` completes
- THEN stdout contains all four sections in a stable, parseable order

#### Scenario: Partial context still prints a valid block
- GIVEN branch resolution finds no change
- WHEN `session:start` completes
- THEN the block still prints with an explicit "no active change" section rather than omitting it

### Requirement: REQ-8 i18n Coverage

All user-facing strings produced by `session:start` MUST be sourced from
`session.*` keys defined in `en.mjs` (canonical) and `es.mjs`.

#### Scenario: Key coverage test passes
- GIVEN the i18n coverage test suite
- WHEN it runs against `session.*` keys
- THEN every key in `en.mjs` has a matching key in `es.mjs` and no string is hardcoded outside the i18n layer

### Requirement: REQ-9 day:start Non-Regression

After extracting `lib/git-branch.mjs` and `lib/memory-manifest.mjs` for reuse
by `session:start`, `day:start` MUST preserve its existing observable
behavior (networked steps, output, exit codes).

#### Scenario: day:start behavior unchanged after extraction
- GIVEN the pre-extraction `day:start` test suite
- WHEN `day:start` is run after the libs are extracted and consumed
- THEN all prior `day:start` behavior and tests still pass unchanged
