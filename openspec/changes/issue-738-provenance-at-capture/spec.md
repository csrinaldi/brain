---
status: proposed
issue: 738
---

# Delta — Provenance at Capture (#738)

Parent: `openspec/changes/issue-864-memory-2-0/spec.md`, Requirement "a record carries its
provenance" (task 2.2). Ruling: `sdd/issue-738-provenance-at-capture/ruling` (obs #3329).
Normative surfaces: `brain/core/methodology/memory-format.md` §4, `memory-backend-contract.md:82`
("a handle, never a branch"), ADR-0017. `openspec/specs/**` stays empty by repo convention — this
delta edits the parent epic spec's requirement and adds capture-specific ones.

## MODIFIED Requirements

### Requirement: a record carries its provenance

A fresh record captured by `memory:save` MUST carry `actor` resolved from `git config
brain.actor` (handle-shaped, never a branch or PII) and `actorKind` measured from the session
environment, never a hardcoded constant.
(Previously: `actor` was `getBranch(root)`; `actorKind` was `PLAINFILES_ACTOR_KIND`, a
constant.)

#### Scenario: a fresh capture is attributed
- GIVEN `brain.actor` is set to `@csrinaldi`
- WHEN `memory:save` captures a record
- THEN the record's `actor` is `@csrinaldi`, never the branch name

#### Scenario: `actorKind` is measured, not door-typed
- GIVEN the agent-marker env var (`AI_AGENT`, or `git config brain.agentEnv`'s override) is
  present or absent
- WHEN a record is captured
- THEN `actorKind` is `agent` when present, `human` when absent — never a constant

#### Scenario: a correction is expressible
- GIVEN an agent corrects a record it can see in the store
- WHEN it captures the correction
- THEN the new record carries `supersedes` naming the corrected id

## ADDED Requirements

### Requirement: capture refuses without a configured handle

`memory:save` MUST refuse the save when `brain.actor` is unset or not handle-shaped, exiting
non-zero. `BRAIN_ACTOR`, `git config user.name`/`user.email`, and the forge login MUST NOT be
consulted as a fallback.

#### Scenario: unset config refuses naming the remedy
- GIVEN `brain.actor` is unset
- WHEN `memory:save` runs
- THEN it exits non-zero and the message names `git config --local brain.actor @<handle>`

#### Scenario: a non-handle-shaped value is refused
- GIVEN `brain.actor` is set to a value that is not `@`-prefixed handle-shaped
- WHEN `memory:save` runs
- THEN it refuses with the same remedy message

### Requirement: an agent capture carries the operator's handle

When the agent-marker env indicates an agent session, the record's `actor` MUST still be the
configured operator handle (never an agent identity such as `@claude-code`); the agent MUST be
named in `source`.

#### Scenario: agent session capture
- GIVEN `brain.actor` is `@csrinaldi` and the agent-marker env is present
- WHEN `memory:save` captures a record
- THEN `actor` is `@csrinaldi`, `actorKind` is `agent`, and `source` names the agent instrument

### Requirement: the write gate refuses a branch-shaped actor

`validateWritableRecord` (W3) MUST refuse an `actor` containing `/` or equal to
`main`/`master`/`develop`/`trunk`, enforced at the `appendRecord` chokepoint. The read gate
(`validateRecord`) MUST continue to admit branch-shaped historical `actor` values.
`exportObservation` MUST soft-reject a §4-recovered branch-shaped actor (`{ rejected }`),
never throw.

#### Scenario: appendRecord refuses a branch-shaped actor
- GIVEN a record with `actor: "feat/x"` or `actor: "main"`
- WHEN `appendRecord` calls `validateWritableRecord`
- THEN the write is refused

#### Scenario: the read gate still admits historical branch-shaped actors
- GIVEN a stored record with `actor: "feat/issue-864-..."`
- WHEN `validateRecord` reads it
- THEN it is admitted, unchanged

#### Scenario: export soft-rejects, never throws
- GIVEN a §4 block recovers a branch-shaped actor
- WHEN `exportObservation` processes it
- THEN it returns `{ rejected: true }` and does not throw

### Requirement: the actor predicate is owned by `format.mjs`

`HANDLE_RE`, `DEFAULT_BRANCHES`, and `classifyActor` MUST live in `format.mjs`; `audit.mjs`
MUST import them rather than define them. `audit.test.mjs` MUST stay green unchanged as proof
the move is behavior-preserving.

#### Scenario: relocation is behavior-preserving
- GIVEN `audit.mjs` imports the predicate from `format.mjs`
- WHEN `audit.test.mjs` runs unmodified
- THEN it passes with no assertion changes

### Requirement: `issue` is derived from the branch when not declared

`issue` MUST come from `--issue` when given; otherwise from a branch matching
`^[a-z]+/issue-(\d+)(-|$)`; otherwise it MUST be absent, never fabricated. A derived value MUST
be named in `source` so a reader can distinguish declared from derived.

#### Scenario: `--issue` wins over the branch
- GIVEN `--issue 738` and a branch not matching the grammar
- WHEN `memory:save` runs
- THEN `issue` is `738`

#### Scenario: derived from a matching branch
- GIVEN no `--issue` and branch `fix/issue-738-provenance`
- WHEN `memory:save` runs
- THEN `issue` is `738` and `source` states it was derived from the branch

#### Scenario: no match leaves `issue` absent
- GIVEN no `--issue` and a branch not matching the grammar
- WHEN `memory:save` runs
- THEN `issue` is omitted, never guessed

### Requirement: brain's own capture path never emits a legacy sentinel

No record produced through `memory:save` → `buildRecord` → `appendRecord` MUST ever carry
`actor: "@legacy"`. The `@legacy`/`human` export fallback MUST remain scoped to
`exportObservation`'s legacy door and MUST be documented as retiring with #874.

#### Scenario: the capture path cannot produce `@legacy`
- GIVEN any input to `memory:save`'s capture path
- WHEN a record is built and appended
- THEN its `actor` is never `@legacy`

#### Scenario: the fresh-record audit target is met
- GIVEN records captured by `memory:save` after this change merges
- WHEN `npm run memory:audit` measures that window
- THEN handle share is 100%, branch-shaped share is 0%, and `@legacy` share is 0%

## Non-Goals

No change to engram's `mem_save`/`mem_session_summary` MCP tools or `save()` stub (#874). No
backfill of the 2177 `@legacy` historical records (#864 task 1.2a / #368). No `HANDLE_RE`
grammar change. No ADR-0017 amendment, no `actorKind: unknown`. No `--actor`/`--actor-kind`/
`BRAIN_ACTOR` flag or env var. No network call on the capture path.

## STRICT TDD Map

| # | File | Cases |
|---|------|-------|
| 1 | `memory/lib/actor-identity.test.mjs` (new) | configured handle resolves; unset refuses naming the command; non-handle value refuses; marker present/absent ⇒ agent/human; `brain.agentEnv` override honored; no env var supplies the handle |
| 2 | `memory/lib/format.test.mjs` | W3 refuses `feat/x` and each default-branch name; read gate still admits both; `@legacy`/`@csrinaldi` pass both gates; `classifyActor` re-export matches prior behavior |
| 3 | `memory/lib/audit.test.mjs` | unchanged and green — proves the predicate move is behavior-preserving |
| 4 | `memory/backends/plainfiles.save.test.mjs` | `actor` is the configured handle, never the branch; `actorKind` follows the session; `source` names the instrument; `issue` derives when absent and matching, stays absent when not |
| 5 | `memory/backends/plainfiles.actorkind-consistency.test.mjs` (rewritten) | neither CLI door accepts caller-supplied `actor`/`actorKind`; a branch value can never reach `actor`; `featureCheckpoint` still branch-scopes its own working memory |
| 6 | `memory/cli.save-search.test.mjs` | refusal exits non-zero naming `git config --local brain.actor`; no `--actor`/`--actor-kind` flag recognized |
| 7 | `memory/lib/engram-export.test.mjs` | genuine §4 recovery unchanged; recovered branch-shaped actor ⇒ `{rejected}`, never a throw; `@legacy` historical path unchanged |
| 8 | `memory/lib/plainfiles-actorkind-doc-tripwire.test.mjs` | `#738` accepted as a decision anchor alongside obs #578; tracked-docs scan stays clean |
