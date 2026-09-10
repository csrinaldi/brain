---
status: proposed
issue: 805
---

# Supersedes Writer Specification (#805)

Delta over the durable-memory contract. Parent: `issue-864-memory-2-0/spec.md` requirement
"the later capture can name the earlier" (scenario, line `93-99`) and requirement "a record
carries its provenance" (scenario "a correction is expressible", line `123-127`) — both already
state the target behavior; this slice is their first producer. Doctrine already rules deletion:
`memory-backend-contract.md` Deletion section (`:90-95`) — "Records are never deleted. A wrong
record is corrected by a new record carrying `supersedes` (#805)." `memory-format.md`'s
`hashInput` (`:85`) already folds `supersedes` into `id` when present.

## ADDED Requirements

### Requirement: `memory:save` accepts a single, backend-agnostic `--supersedes <id>` flag

The CLI parser MUST accept exactly one `--supersedes <id>` per invocation and forward it,
unparsed, into the `opts` object every backend receives. The flag's presence in `opts` MUST NOT
depend on which backend is selected.

#### Scenario: the flag reaches the record
- **GIVEN** a local record `rec-aaaa000000000001` exists in `.memory/records/`
- **WHEN** `memory:save --type discovery --project brain --supersedes rec-aaaa000000000001` runs
- **THEN** the written record's `supersedes` field equals `rec-aaaa000000000001`, and its `id`
  differs from the `id` the same content would hash to without the flag

#### Scenario: a repeated flag is rejected
- **WHEN** `memory:save --supersedes rec-a --supersedes rec-b ...` runs
- **THEN** the CLI refuses before any write, naming that only one `--supersedes` is accepted

### Requirement: a `supersedes` id is checked against the store, local first, before the record is written

The store is local `.memory/records/` (`readRecordIds`) **union** `origin/main`
(`upstreamRecordEntries`). Local MUST be checked first; `origin/main` MUST be consulted only on a
local miss. No record MUST be appended when the id fails this check.

#### Scenario: a local id needs no upstream read
- **GIVEN** the target id is present in local `readRecordIds()`
- **WHEN** `--supersedes <id>` is saved
- **THEN** the record is written and `upstreamRecordEntries` is never invoked

#### Scenario: an upstream-only id is accepted
- **GIVEN** the target id is absent locally and present in `upstreamRecordEntries(...).byId`
  (`ok:true`)
- **WHEN** `--supersedes <id>` is saved
- **THEN** the record is written

### Requirement: three distinct refusal reasons, fail-closed, no partial write

Refusal MUST classify into exactly one of three reasons and MUST occur before `_appendRecord` is
called — no file is written on any refusal. Each reason has its own i18n key in `en.mjs` and
`es.mjs`, pinned by `i18n/coverage.test.mjs`.

#### Scenario: malformed id, refused purely
- **GIVEN** `--supersedes` is not shaped `rec-<16 hex>`
- **WHEN** `memory:save` runs
- **THEN** it is refused with the "malformed" reason before any filesystem or git call, and no
  record is written

#### Scenario: not in the store
- **GIVEN** the id is absent from local `readRecordIds()` and absent from
  `upstreamRecordEntries(...).byId` on `ok:true`
- **WHEN** `memory:save --supersedes <id>` runs
- **THEN** it is refused with the "not in the store" reason, and no record is written

#### Scenario: could not verify — refused, not silently allowed
- **GIVEN** the id is absent locally and `upstreamRecordEntries(...)` returns `ok:false` (no ref
  resolved, unfetched/shallow clone, `ls-tree` non-zero)
- **WHEN** `memory:save --supersedes <id>` runs
- **THEN** it is refused with a "could not verify" reason that quotes `reason` verbatim and states
  both remedies: `git fetch origin main`, or point `BRAIN_MEMORY_UPSTREAM_REF` /
  `memory.upstreamRef` at a ref that resolves; no record is written

### Requirement: chains are allowed; fan-in and cross-project scoping are unrestricted

#### Scenario: superseding an already-superseded record
- **GIVEN** record B already carries `supersedes: <A's id>`
- **WHEN** a new record C is saved with `--supersedes <B's id>`
- **THEN** the save succeeds; A, B, and C all remain readable and indexed

#### Scenario: a mismatched `--issue` is allowed
- **GIVEN** the target record was written under a different `--issue` than the current save
- **WHEN** `--supersedes <id> --issue <different-N>` is saved
- **THEN** the save succeeds; no rule ties `supersedes` to `issue` equality

> Note — self-supersede is structurally impossible, not a refusal: `id` is computed from
> `hashInput`, which includes `supersedes` (`memory-format.md:85`), so a record cannot name its
> own id before that id exists. No code enforces this; no scenario tests it.

> Note — fan-in (two records both superseding the same id) is explicitly deferred (proposal D1/D3,
> D1 option (b)). The union merge admits both; no ordering rule exists in this slice.

### Requirement: `engram.save` names the flag in its refusal, with no new behavior

#### Scenario: engram still refuses save, but says why
- **GIVEN** `MEMORY_BACKEND=engram`
- **WHEN** `memory:save --supersedes <id> ...` runs
- **THEN** it fails with `unsupportedOp("save", "engram", …)`, and the message names
  `--supersedes` explicitly

### Requirement: `memory:audit`'s `coverage.supersedes` counts the first real write

No change to `audit.mjs`. This requirement pins the integration outcome only.

#### Scenario: the epic's 6.1 exit scenario
- **GIVEN** a fresh record A is saved with no `--supersedes`
- **WHEN** a second record B is saved with `--supersedes <A's id>`, then `npm run memory:audit` runs
- **THEN** `coverage.supersedes` reports `1`, up from `0`; both A and B remain readable and indexed,
  and B's `**Supersede:**` line survives a `memory:reindex` round trip

### Requirement: the record-first correction sequence is drafted for promotion, not enforced in code

The four-step sequence (save with `--supersedes` → lane ships it → stale record untouched →
`memory:reindex`) MUST be proposed as a `brain-drafts/` amendment targeting
`memory-format.md`'s append-only paragraph (`:30-37`), with a cross-reference from
`memory-backend-contract.md`'s Deletion section. This is a drafting requirement, not a code
scenario: the draft sits in `openspec/changes/issue-805-supersedes-writer/brain-drafts/` for the
maintainer's sitting; no `brain/core/**` file is edited by this change.

## Non-Goals

- No `engram.save` writer (#874 owns record-first for engram).
- No index, hash, or format change — `supersedes` already round-trips (`format.mjs`, `store.mjs`,
  `upstream-records.mjs`, `audit.mjs` are unchanged).
- No reader-side chain resolution or "hide the superseded" behavior (#874/#880).
- No fan-in (array-valued `supersedes`) — `supersedes` stays a string (D1).
- No lane, tier, or auto-merge enablement work.

## STRICT TDD Test Map

| # | file | pins |
|---|------|------|
| 1 | `lib/supersedes.test.mjs` (new) | `classifySupersedes({id, localIds, upstream})` — malformed, local-hit-skips-upstream, upstream-hit, not-in-store, could-not-verify (quotes `reason`) |
| 2 | `lib/format.test.mjs` (extend) | `buildRecord` with `supersedes` changes `hashInput`/`id`; R3-omitted when absent |
| 3 | `backends/plainfiles.save.test.mjs` (extend) | refusal throws before `_appendRecord`; upstream reader injected as a seam |
| 4 | `cli.save-search.test.mjs` (extend) | `--supersedes` happy path and refusal path via `runCli` |
| 5 | `lib/supersedes.integration.test.mjs` (new) | temp repo + local bare `origin`: upstream-only id accepted; shallow/unfetched clone refused, degradation named |
| 6 | `lib/audit.test.mjs` (extend) | real-writer fixture moves `coverage.supersedes` off 0; existing pure cases untouched |
| 7 | `i18n/coverage.test.mjs` (existing, stays green) | three new keys present in both locales |
