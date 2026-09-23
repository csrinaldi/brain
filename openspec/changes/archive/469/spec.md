---
status: draft
issue: 469
---

# Spec — memory secret scrub scans zero chunks (issue 469)

## Requisitos delta

### REQ-469-1 — the scrub scans the chunks that EXIST, not the ones git will admit to

`_defaultChangedChunkFiles(root)` returns every `*.jsonl.gz` in `<root>/.memory/chunks`, read
from the filesystem. It does not call git.

`.memory/chunks/` is gitignored, so the git query it replaces returned an empty set on every
run since the directory was ignored — the scrub has never scanned a chunk. See design D1 for
the measurement of all four git spellings, three of which report the directory rather than
its files.

**Proven by:** a run with a planted secret in a chunk **aborts** the share before `records/`
is touched. Not by a passing test — the current code passes every existing test while
scanning nothing, so passing is not evidence here.

### REQ-469-2 — an unreadable chunk directory fails CLOSED; an empty one does not

The distinction the git version could not draw, and the reason it failed open:

| state | behaviour |
| --- | --- |
| directory missing (`ENOENT`) | **throw** — refuse to share |
| directory unreadable (`EACCES`, any other error) | **throw** — refuse to share |
| directory present, no chunks | return `[]` — a fresh clone is not a failure |

The thrown message names the directory and the underlying error, so the operator can tell
"nothing to scan" from "could not look".

`ENOENT` is deliberately fatal rather than empty: `share()` reaches the scrub only **after**
`engram sync --export` has run, so a missing chunk directory at that point means the export
did not write where this process reads — REQ-469-3's failure, caught a second way.

### REQ-469-3 — `share()` refuses to run when the export writes somewhere it does not read

After `_export(engram)` and before the scrub, `share()` compares the resolved paths of
`<root>/.engram` and `<root>/.memory`. If `.engram` exists and does not resolve to the same
directory as `.memory`, `share()` **throws**.

If `.engram` does not exist, the run proceeds: engram writes to `.memory` directly, which is
the normal post-migration state on a fresh clone.

The message names both resolved paths and the remedy, because the operator's next question is
which directory won.

This is the silent no-op reproduced in the maintainer's checkout: `engram sync --export`
writes to `.engram/chunks/`, `_defaultReadObservations` reads `.memory/chunks/`, the export
prints `Created chunk …`, zero records are appended, and the run reports success.
`ensureMemorySymlink` detects the state and only warns (`engram.mjs:97`) — a warning that was
in place while the defect reached production.

### REQ-469-4 — the docstrings state what the code does

`_defaultChangedChunkFiles`'s docstring currently claims the git query is *"the 'materialized
THIS run' boundary the scrubber respects (never the whole store)"*. After this change the
function scans the whole store, and design D2 records that the boundary was never real for
gitignored chunks. The docstring says so.

A comment that describes a property the code does not have is the defect class this
repository keeps finding; leaving it would ship a false normative claim alongside the fix for
a false empty set.

## Escenarios

### E1 — a planted secret aborts the share (REQ-469-1)

```
GIVEN  .memory/chunks/ contains a chunk whose decompressed content matches a configured
       secret pattern
AND    `records/` has N entries
WHEN   share() runs
THEN   it throws memory.share.secretFound naming the chunk path and line
AND    `records/` still has N entries — the append-only log was never touched
```

### E2 — a clean run still shares (REQ-469-1)

```
GIVEN  .memory/chunks/ contains only chunks with no pattern hit
WHEN   share() runs
THEN   the scrub resolves and dualWriteRecords proceeds
```

### E3 — the chunk directory cannot be read (REQ-469-2)

```
GIVEN  <root>/.memory/chunks does not exist, or cannot be listed
WHEN   _defaultChangedChunkFiles(root) runs
THEN   it throws, naming the directory and the underlying error code
AND    the message is distinguishable from "the directory is empty"
```

### E4 — an empty chunk directory is not a failure (REQ-469-2)

```
GIVEN  <root>/.memory/chunks exists and contains no *.jsonl.gz
WHEN   _defaultChangedChunkFiles(root) runs
THEN   it returns []
AND    share() proceeds — a fresh clone with no memory yet is a legitimate state
```

### E5 — non-chunk files are ignored, and only files are returned (REQ-469-1)

```
GIVEN  .memory/chunks/ contains a.jsonl.gz, notes.txt, and a subdirectory
WHEN   _defaultChangedChunkFiles(root) runs
THEN   it returns exactly [<root>/.memory/chunks/a.jsonl.gz]
```

The subdirectory case is not hypothetical: three of the four git spellings in design D1
returned a **directory** path, which is precisely what the old `.jsonl.gz` suffix filter
silently dropped. The filesystem reader must drop directories on their type, not on their
name.

### E6 — the export writes to a directory share does not read (REQ-469-3)

```
GIVEN  .engram is a real directory, so it does not resolve to .memory
WHEN   share() runs
THEN   it throws after the export and BEFORE the scrub
AND    the message names both resolved paths
AND    neither the scrub nor dualWriteRecords runs
```

### E7 — a symlinked or absent .engram proceeds (REQ-469-3)

```
GIVEN  .engram resolves to the same directory as .memory, OR .engram does not exist
WHEN   share() runs
THEN   the check passes and the run continues to the scrub
```
