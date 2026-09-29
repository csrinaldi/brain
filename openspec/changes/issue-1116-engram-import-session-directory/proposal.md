---
status: draft
issue: 1116
---

# Proposal — a fresh engram 2.x store rejects brain's import sessions

## What was wrong

`buildImportPayload()` (`brain/scripts/axes/memory/adapters/engram.mjs`) builds the synthetic
per-project session row `engram import` requires as `{ id, project, started_at, ended_at,
summary }` — no `directory`. engram 2.0.0 requires one on every session:

```
engram: import session brain-batch-import-brain-test: pulled session directory is invalid: directory is required
```

Both recovery paths that hydrate a store from `.memory/records/` — `cli.mjs import` and
`brain:memory:pull` (the path the `engram save` deferral message itself recommends) — go through
`buildImportPayload()`, so both fail identically on a fresh engram 2.x store. Records stay durable
in `.memory/records/` (ADR-0017), but a deferred one can never reach engram: brain's own repo
hides this because its store already holds the session row from before engram 2.x existed; any
new consumer, machine, or teammate hits it on the very first import.

Found by #1081 (F6), during the memory 2.0 exit audit. Evidence: `45-engram-directory-probe.txt`
in that change's `evidence/` directory — a minimal `engram import` reproduction showing engram
2.0.0 accepts the payload with `directory` and refuses it without.

## Why now

Blocks #864 task 6.1: seam 1's recovery must be observed working, and it currently is not on any
store running engram 2.x.

## What changes

`buildImportPayload()` gains a `root` parameter (the repo root, already threaded through every
other `root`-accepting export in this file) and sets `directory: root` on every session row it
builds. `importMemory()`'s existing `root` (already in scope, already defaulting to `repoRoot`) is
passed through at its one call site. No new concept, no new parameter surface for callers of
`importMemory()` — the value was already available, just not forwarded one level deeper into the
payload engram actually sees.

Measured directly against both engram majors brain has a declared position on:

- **engram 2.0.0** (installed in this environment): refuses the payload without `directory`,
  accepts it with. Reproduced with brain's own `importMemory()` end to end against an isolated,
  throwaway `ENGRAM_DATA_DIR` (never the real store) — see `design.md`.
- **engram 1.20.0** (`TESTED_ENGRAM` in `brain/scripts/memory/lib/engram-heal.mjs` — the only
  version brain formally declares "tested", for a different, version-gated feature): accepts the
  same `directory` field as harmless extra metadata. Built pinned via `go install
  .../engram/cmd/engram@v1.20.0` into an isolated `GOBIN` (not on `PATH`) and measured directly,
  not inferred.

So the fix is compatible with both.

## What does not change

- The payload shape's other fields, and every other session/observation field, are unchanged.
- No version gate is added to the import path — `buildImportPayload()`/`importMemory()` never
  checked `engram version` before this change and still do not; the fix works unconditionally
  across the two measured majors, so a gate would add a refusal this path never needed.
- `healDuplicates()`'s own `TESTED_ENGRAM`/`isTestedVersion` gate (a different feature) is
  untouched.

## Rollback

Revert the commit touching `engram.mjs`. The two new unit tests pin the requirement; reverting
them together with the source change returns the file to its pre-fix (broken) state cleanly.
