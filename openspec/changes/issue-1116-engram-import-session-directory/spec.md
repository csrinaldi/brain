---
status: draft
issue: 1116
---

# Spec

## REQ-1116-1 — every synthetic import session carries `directory`

`buildImportPayload()` MUST set `directory` on every session row it builds in the payload, equal
to the `root` it was called with.

**Falsifiable by**: calling `buildImportPayload({ records, existingTopicKeys, startedAt, root })`
with at least one fresh record and inspecting `payload.sessions` — any session row missing a
`directory` key, or whose `directory` does not equal the `root` argument, fails this requirement.

## REQ-1116-2 — `importMemory()` forwards its own `root` into the payload

`importMemory()` MUST pass its own `root` parameter (default `repoRoot`) through to
`buildImportPayload()`, so the session(s) `_engramImport` receives carry `directory` equal to
`root`.

**Falsifiable by**: calling `importMemory({ root, _readRecords, _engramExistingTopicKeys,
_engramImport, ... })` with fixture records and inspecting the payload captured by `_engramImport`
— `payload.sessions[].directory !== root` fails this requirement.

## REQ-1116-3 — a fresh engram 2.x store hydrates successfully

Against a real, empty (never-before-imported) engram 2.x store, `importMemory()` MUST succeed
(`written` equal to the number of fresh records, no thrown error) and the imported record MUST be
retrievable via `engram search` against that same store afterward.

**Falsifiable by**: pointing `ENGRAM_DATA_DIR`/`HOME` at a throwaway, empty directory, running
`importMemory()` for real (default seams, real `engram` binary) with one fixture record, and
observing either a thrown error or `engram search` against that same store finding no matching
observation.

## REQ-1116-4 — a hydration failure is reported, never swallowed

When the underlying `engram import` call fails (any cause, including the pre-fix `directory`
rejection), `importMemory()` MUST surface the failure with its cause rather than reporting success
or a silently empty result. This requirement is pre-existing behavior (no `try`/`catch` wraps the
`_engramImport()` call inside `importMemory()`'s guarded section) — pinned here because it is what
makes the pre-fix failure observable at all, rather than a silent no-op.

**Falsifiable by**: injecting an `_engramImport` seam that throws, and observing `importMemory()`
resolve as if nothing happened (no throw, no error surfaced) instead of propagating the failure.
