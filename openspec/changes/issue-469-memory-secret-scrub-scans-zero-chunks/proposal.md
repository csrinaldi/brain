---
status: draft
issue: 469
---

# Propuesta — memory secret scrub scans zero chunks (issue 469)

## Qué

Make the pre-publication secret scrub actually scan the chunks a `memory:share` run
materialized, and make `share` fail loudly instead of silently writing zero records when it
cannot see them.

## Por qué

Issue #469. `share()` runs `scrubMaterializedChunks()` before any record is written — the
gate standing between local session content and a **public** repository. The set it scans
comes from `_defaultChangedChunkFiles`, which asks git:

```js
_spawn("git", ["status", "--porcelain", "--", ".memory/chunks"], …)
```

`.memory/chunks/` is gitignored (`.gitignore:84`). `git status --porcelain` never reports
ignored paths, so the set is **always empty** and the scrub has never scanned anything.

Reproduced on this branch with two real chunk files present:

```console
$ git status --porcelain -- .memory/chunks
                                             # ← empty. Zero chunks scanned.
$ ls -1 .memory/chunks/
probe-0000.jsonl.gz
probe-0001.jsonl.gz
```

An empty set is not an error, so the function's own fail-closed guard never trips: it fails
closed on a git *error* and passes on a git result that is empty for a **structural** reason.
That is `evidence-reader-empty-on-failure` with a third case neither branch models — *the
query cannot ever return anything*.

The repository is already public, so this is not a future risk. #435's go-public pre-flight
is specified to rely on this gate; it cannot.

**Second defect, same discovery.** `memory:share` is a silent no-op whenever `.engram` is a
real directory rather than a symlink to `.memory`: `engram sync --export` writes to
`.engram/chunks/`, while `_defaultReadObservations` reads `.memory/chunks/`. The export
prints `Created chunk …`, zero records are appended, and the run reports success.
`ensureMemorySymlink` already detects this state and only `console.warn`s (`engram.mjs:97`);
nothing downstream checks. Reproduced in the maintainer's own checkout.

## Alcance

- **Incluye:**
  - `_defaultChangedChunkFiles` stops asking git about a path git is told to ignore and
    reads the chunk directory directly — the same directory `_defaultReadObservations`
    already reads from the filesystem.
  - `share()` asserts, after the export, that the chunk directory it is about to scan and
    read is the one the export wrote to — and throws with an actionable message when it is
    not.
  - Both proven by mutation, not inspection: the current code passes every existing test
    while scanning nothing, so a test that merely passes proves nothing here.
- **No incluye:**
  - The chunk→records migration (#247). The chunk path is being retired; this change keeps
    the gate honest for as long as the path exists and adds no new dependency on it.
  - Changing what counts as a secret (`governance.memorySecretPatterns`) or the allowlist.
  - #435's go-public audit itself. This unblocks its premise; it does not perform it.
