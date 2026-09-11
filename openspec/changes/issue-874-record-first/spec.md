---
status: draft
issue: 874
---

# Record-First Capture Specification

## Purpose

Defines the producer path a capture takes on every memory backend: a record lands on disk
before any backend is touched, the backend is a projection of that record, and `share` commits
only what the durable layer already holds. Implements rules 2 and 3 of
`memory-backend-contract.md` for the `engram` backend; `plainfiles` already satisfies them by
construction.

## Vocabulary

- **record** — one file under `.memory/records/<yyyy-mm>-<id>.jsonl` (memory-format.md).
- **hydrate** — project one record into the active backend, keyed by the record's own id as
  `topic_key`.
- **the store** — `.memory/records/` plus `.memory/index.jsonl`.
- **deferred** — a hydration attempt that did not run to completion; the record is unaffected.

## Requirements

### Requirement: a capture is durable before the backend runs

`save` MUST append the record to the durable layer and rebuild the index before it attempts to
hydrate any backend. A backend failure MUST NOT make the capture appear lost.

#### Scenario: Durable before backend
- GIVEN a capture is issued via `save` under `MEMORY_BACKEND=engram`
- WHEN the engram binary is absent, exits non-zero, or the hydration guard is contended
- THEN the record file already exists on disk and the index is already rebuilt
- AND `save` returns `{written: true, hydrated: false, deferred: true, reason}` and exits 0
- AND an index-rebuild failure is still a thrown, annotated error — it is never folded into
  `deferred`

### Requirement: two captures on one topic are never collapsed before durability

`save` MUST write one record per invocation; a shared topic across two captures MUST NOT reduce
them to one record or one backend row before `share` runs.

#### Scenario: Two captures, one topic, before any share
- GIVEN two sessions each call `save` on the same topic before either calls `share`
- WHEN both calls complete
- THEN two record files and two backend rows exist
- AND the later call MAY carry `--supersedes <earlier-id>`, but the superseded row is never
  replaced or deleted by hydration

### Requirement: a secret never reaches disk

`save` MUST scan the serialized candidate record for secrets before any write, on every backend.

#### Scenario: A secret never reaches disk
- GIVEN `content` passed to `save` contains a secret
- WHEN `save` runs under `MEMORY_BACKEND=engram` or `MEMORY_BACKEND=plainfiles`
- THEN `save` throws before `appendRecord`, `rebuildIndex`, or the backend's hydrate seam are
  called
- AND no record file and no backend row exist for that capture

### Requirement: every backend refuses and shapes captures identically

`save` MUST apply the same refusal order and produce the same record shape regardless of the
active backend.

#### Scenario: Cross-backend parity
- GIVEN the same `save` call is issued once under each backend
- WHEN each run completes or refuses
- THEN both refuse the same inputs in the same order and, when accepted, emit records of the
  same shape

### Requirement: share commits what is already true

`share` MUST NOT be a producer. It MUST only reconcile the backend against records already on
disk.

#### Scenario: share commits what is true
- GIVEN the engram binary is absent
- WHEN `share` runs under `MEMORY_BACKEND=engram`
- THEN it completes, calling only `rebuildIndex`, and returns `{indexCount, duplicates}`
- AND it performs no export and no chunk read-back
- AND `_ensureSymlink` still runs

### Requirement: hydration is idempotent by record id

Hydrating the same record more than once MUST yield exactly one backend row for that record id.

#### Scenario: Hydration is idempotent
- GIVEN one record has already been hydrated
- WHEN the same record is hydrated a second time
- THEN the backend holds exactly one row keyed by that record's id, not two

### Requirement: the record-first door is reachable under every backend

The `memory:save` entry point MUST NOT force a single backend; it MUST reach `save` under
whichever backend the repository selects.

#### Scenario: Unpinned entry point
- GIVEN `MEMORY_BACKEND=engram` is the active setting
- WHEN `npm run memory:save` is invoked
- THEN it runs `save` under `engram`, not a forced `plainfiles` override
- AND the same command also works unmodified under `MEMORY_BACKEND=plainfiles`

## Non-Goals

- `mem_save` and the MCP plugin stay untouched — declared non-durable working memory by #863
  D2(a).
- The one-time heal of stranded MCP observations (epic task 1.2a) is out of scope.
- Ledger rows 6-7 — manifest untracking, `.gitattributes` merge driver, the `.engram` symlink's
  confinement to `setup()`, `.memory/legacy/*.gz` — belong to task 2.4, not this change.
- No change to `.memory/manifest.json`, the `.engram` symlink's lifecycle, `.gitattributes`, or
  the legacy `.gz` path.
