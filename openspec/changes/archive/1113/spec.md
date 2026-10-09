---
status: draft
issue: 1113
---

# Spec

## REQ-1113-1 — a missing `openspec/changes/` is zero eligible changes, never a crash

When the changes root directory does not exist, `sweep.mjs`'s `--apply` mode MUST treat this as
zero change folders and proceed through the normal fail-closed selection/report path — it MUST
NOT let the missing-directory read throw an uncaught exception.
**Falsifiable by**: calling the exported `listChangeFolders(absPath)` with a path that does not
exist and observing it throw instead of returning `[]`.

## REQ-1113-2 — a real directory-read failure still surfaces

When the changes root path exists but cannot be listed for a reason other than "does not exist"
(e.g. it is a file, not a directory), `listChangeFolders` MUST still throw — only `ENOENT` on the
root itself is swallowed.
**Falsifiable by**: pointing `listChangeFolders` at a path that is a regular file and observing no
exception is thrown.

## REQ-1113-3 — the alarm's "Sweep output" block carries real diagnostic text on a genuine failure

When `sweep.mjs --apply` exits non-zero for a legitimate reason (design D3: an incomplete
selection or an archive-write failure), the workflow's alarm issue MUST include the actual error
text logged by `runSweep` (`console.error`), not an empty code block.
**Falsifiable by**: running the `--apply` step's captured-output logic against a case where only
`console.error` was called (no `console.log`) and observing the captured `sweep_out` variable is
empty.

## REQ-1113-4 — directories-only listing

`listChangeFolders` MUST return only directory entries under the changes root, excluding regular
files (e.g. a stray `README.md` at that level).
**Falsifiable by**: seeding a directory with one subdirectory and one file, calling
`listChangeFolders`, and observing the file name appears in the result.
