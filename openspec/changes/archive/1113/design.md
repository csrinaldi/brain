---
status: draft
issue: 1113
---

# Design

## Approach

Extract the directory listing out of the CLI entrypoint's inline `readdirSync` call into a small,
exported, independently-testable function, `listChangeFolders(changesRootAbsPath)`, in
`sweep.mjs` itself (same module — no new file, no new dependency). It:

- `try`/catches the `readdirSync(path, { withFileTypes: true })` call.
- On `err.code === 'ENOENT'`, returns `[]`.
- On any other error, rethrows unchanged (permissions errors, a path that resolves to a file, etc.
  stay real failures — this fix narrows the swallow to exactly the one expected case).
- On success, filters to directories only and returns their names — identical behavior to the
  code it replaces.

The CLI entrypoint becomes:

```js
const changesRoot = 'openspec/changes';
const entries = listChangeFolders(join(process.cwd(), changesRoot));
```

This keeps the fix inside the one file the bug report names, reuses the existing `join`/`readdirSync`
imports already present, and needs no change to `runSweep`, `selectSweep`, or `archiveChange` —
`entries: []` is already a case `selectSweep` handles correctly (it is exactly what "nothing
eligible" looks like today when a repo's `openspec/changes/` is empty but present).

### Why not swallow the error inside the CLI `if` block instead of a named export

The CLI entrypoint (`if (process.argv[1] === fileURLToPath(import.meta.url))`) is not imported by
the test file — it only runs when the file is executed directly. Testing the fix requires a
function the test can call directly. `runSweep` already follows this same discipline (injected
`entries`, fully testable, no filesystem) — `listChangeFolders` is the one caller-side seam that
was missing it, and this change gives it the same shape.

### Why the alarm's stderr-capture fix belongs in this change too

The bug report's "Expected Behavior" explicitly names the empty "Sweep output" block as part of
the contract, not just the crash. Tracing it: `runSweep`'s fail-closed path (`selection.complete
=== false`, or an `archiveChange` failure) reports via `logError` (`console.error` by default),
never `console.log`. The workflow captures only stdout (`sweep_out="$(node ... )"`, no `2>&1`), so
even the DESIGNED, documented failure path — no crash involved — produces an empty alarm body.
Adding `2>&1` to that one command substitution closes this without touching `sweep.mjs`'s logging
choice (which is otherwise correct: `console.error` for errors, `console.log` for the one
machine-parsed summary line the workflow greps for).

## Alternatives considered

**Create `openspec/changes/` if missing, as part of some init step.** Rejected: a fresh consumer
that has never run an SDD change has no reason to carry an empty scaffold directory, and creating
one on every clean merge is unasked-for repo mutation from an automated job — exactly the kind of
side effect ADR-0035 and the sweep's own design (D5: "why the sweep must not redden the job") are
careful to avoid. Treating "does not exist" as "zero entries" is the smaller, correct fix.

**Fix `archive.mjs --backfill`'s identical bug in the same change.** Considered, since
`archive.mjs:225` has the exact same unguarded `readdirSync(join(process.cwd(), changesRoot))`.
Deferred: it is a human-invoked command, not the automated post-merge path #1113 reports on, and
folding it in here would widen the diff past what this issue's contract asks for. Noted in
`proposal.md`'s "What does not change" so it is not lost.

## Risks

- Merging stderr into `sweep_out` means any incidental warning Node prints to stderr (e.g. an
  experimental-feature warning) would now show up in the alarm body too. Acceptable: the alarm
  body is diagnostic text for a human investigating a failure, and a stray warning line is far
  better than an empty block hiding the real cause.
