---
status: draft
issue: 1116
---

# Design

## Root cause

`brain/scripts/axes/memory/adapters/engram.mjs`, `buildImportPayload()` (the function that
replaced the former thin `engram sync --import` wrapper, #433) builds one synthetic session row
per project present in the batch:

```js
sessions.push({ id, project, started_at: startedAt, ended_at: null, summary: null });
```

engram 2.0.0's `import` verb validates every session row and requires a non-empty `directory`.
Measured directly (issue #1081 evidence `45-engram-directory-probe.txt`): the identical payload,
differing only in whether the session carries `directory`, is accepted with it and refused
without it with `pulled session directory is invalid: directory is required`.

`buildImportPayload()` never received the repo root — only `records`, `existingTopicKeys`,
`startedAt`, and the record transformer — so it had no value to put there even if it tried.
`importMemory()`, the sole caller, already has `root` in scope (its own parameter, defaulting to
this module's `repoRoot`) but never passed it down.

## Fix

1. `buildImportPayload()` gains a `root` parameter.
2. Each session row becomes `{ id, project, directory: root, started_at, ended_at: null, summary:
   null }`.
3. `importMemory()`'s one call site passes `root` through: `buildImportPayload({ records,
   existingTopicKeys, startedAt: _now(), root, _importRecord })`.

No other field, no version gate, no new public parameter on `importMemory()` (root already
existed there).

## Why `root` (repo root) and not something else

The issue's own "Expected Behavior" names it: "Import sessions carry `directory` (the repository
root)". `root` is already the concept every other `root`-accepting export in this file defaults to
via `repoRoot` (`join(dirname(fileURLToPath(import.meta.url)), "../../../../..")`), so reusing it
costs no new concept and stays consistent with the rest of the adapter. engram does not validate
that the directory exists on disk (measured: importing with `directory: "/tmp/probe"`, a path that
was never created, succeeded on both majors tested) — it is stored as session metadata, not a
filesystem check, so there is no risk of the import failing because `root` happens not to resolve
in some sandboxed caller.

## Version compatibility — measured, not assumed

Brain declares exactly one "tested" engram version formally: `TESTED_ENGRAM = { major: 1, minor:
20 }` in `brain/scripts/memory/lib/engram-heal.mjs`, consumed by `healDuplicates()`'s own version
gate — a *different* feature (duplicate healing), unrelated to the import path this change fixes.
`buildImportPayload()`/`importMemory()` have never checked `engram version` and still do not after
this change; the import path is meant to work across whatever engram happens to be installed.

Both majors brain has any declared position on were measured directly against the real binary,
not assumed:

| engram version | How obtained | Payload WITHOUT `directory` | Payload WITH `directory` |
|---|---|---|---|
| 2.0.0 | already installed in this environment (`engram version`) | refused: `pulled session directory is invalid: directory is required` | accepted, `Sessions: 1 / Observations: 1 imported` |
| 1.20.0 (`TESTED_ENGRAM`) | pinned build: `GOBIN=<isolated> go install github.com/Gentleman-Programming/engram/cmd/engram@v1.20.0` (note: no `/v2` module path at this tag — that path was introduced later) | (not separately tested — 1.x's own docs/behavior predate the requirement) | accepted, `Sessions: 1 / Observations: 1` — the extra field is tolerated as harmless metadata |

Conclusion: adding `directory` is safe on both majors. It fixes 2.x and does not regress 1.20.0.

## Reproduction (end to end, isolated)

Using brain's real `importMemory()` (no fixture stub for `_engramImport`/`_requireEngram`/
`_engramExistingTopicKeys` — only `_readRecords` is stubbed, to avoid touching the real
`.memory/records/`), against a throwaway `ENGRAM_DATA_DIR`/`HOME` (never `~/.engram`):

**Before the fix** (`engram.mjs` reverted to its pre-change state via `git stash`, real engram
2.0.0 on `PATH`):

```
$ ENGRAM_DATA_DIR=<isolated> HOME=<isolated> node e2e.mjs
THREW: Command failed: engram import /tmp/brain-engram-import-.../payload.json
engram: import session brain-batch-import-brain-1116-e2e: pulled session directory is invalid: directory is required
exit=1
```

The failure is not swallowed — `importMemory()`'s guarded section never wraps `_engramImport()` in
a `try`/`catch` (REQ-1116-4), so `execFileSync`'s error, including engram's own stderr, propagates
to the caller unmodified.

**After the fix** (same isolated store, freshly emptied):

```
$ ENGRAM_DATA_DIR=<isolated> HOME=<isolated> node e2e.mjs
[log] ✓ import complete — 1/1 records imported into engram (records-only, D2/C4).
RESULT: {"written":1,"skipped":0,"duplicates":{...}}
exit=0

$ ENGRAM_DATA_DIR=<isolated> HOME=<isolated> engram search "e2e probe" --project brain-1116-e2e
Found 1 memories:
[1] #1 (discovery) — ...
    2026-09-29 09:00:00 | project: brain-1116-e2e | scope: project
```

Isolation confirmed both ways: `engram search` against the *real* store (no `ENGRAM_DATA_DIR`
override) reports `engram: unknown project: brain-1116-e2e` — the probe project never reached the
real store.

## Alternatives considered

- **Hardcode a fixed `directory` string** (e.g. `"."`) instead of threading `root` through. Rejected:
  costs the same one parameter to thread, but loses the actual repo location the issue asks for
  ("the repository root") for no benefit — `root` was already sitting in scope at the only call
  site.
- **Gate the import path on engram version, branching payload shape.** Rejected: unnecessary — the
  field is harmless on the one older major measured, so there is nothing to branch on. Adding a
  gate here would introduce a refusal path (à la `healDuplicates`) that this function never needed
  and that isn't asked for by the issue.
