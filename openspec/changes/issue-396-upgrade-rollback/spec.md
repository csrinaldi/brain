---
status: spec
issue: 396
epic: 313
artifact_store: openspec
topic_key: sdd/issue-396-upgrade-rollback/spec
---

# Spec — Rollback / atomic apply for `brain:upgrade` (issue 396)

Requirements are tagged `REQ-396-N` and map to the `REQ-S6-*` test identifiers in
`brain/scripts/lib/installer.test.mjs`. Slice 1 covers REQ-396-1 … REQ-396-8;
REQ-396-9 is slice 2.

## REQ-396-1 — a failed write leaves every managed path at its pre-copy bytes

`copyManaged` MUST capture the on-disk state of every path it may write BEFORE the first
write, and MUST restore those bytes if any write throws. The restoration MUST be complete
regardless of where in the loop the failure landed.

### Scenario 1 — a copy-phase throw rolls back a merge-phase write

```
GIVEN a managed path routed through specialMerge whose dest holds consumer bytes
  AND a second managed path whose parent exists as a FILE (so mkdirSync throws)
WHEN copyManaged runs and reaches the copy phase
THEN it throws
  AND the merge-phase dest holds its original consumer bytes
```

Merges run before copies by construction, so the merge write is always on disk before
the copy throws — the scenario cannot pass vacuously.

### Scenario 2 — a copy-phase throw rolls back an EARLIER copy in the same phase

```
GIVEN two plain-copy managed paths, sorted so "a-first" precedes "z-sub/boom"
  AND "a-first" exists in dest with OLD bytes
  AND dest "z-sub" exists as a FILE
WHEN copyManaged runs
THEN it throws
  AND "a-first" holds OLD
```

This is the dominant shape: 364 of the 366 real managed files are plain copies. Write
order is sorted (REQ-396-8), so this cannot depend on `readdirSync` order.

### Scenario 3 — negative control: the success path writes and keeps nothing

```
GIVEN a managed path that copies cleanly
WHEN copyManaged runs
THEN the file is copied
  AND no snapshot directory remains
```

A rollback that fired on every run would satisfy Scenarios 1-2 and still be wrong.

## REQ-396-2 — a path that did not exist rolls back to ABSENT, not to empty

Paths with no prior on-disk state MUST be deleted on rollback, and any directory the
write had to create MUST be pruned with them.

### Scenario 1 — created file removed, created directory pruned

```
GIVEN a managed path "brain/core/newdir/a.json" absent from dest
  AND dest has no "newdir"
WHEN the write creates both and a later write throws
THEN "a.json" does not exist
  AND "newdir" does not exist
```

## REQ-396-3 — an incomplete rollback is reported, and its snapshot is PRESERVED

`restore()` MUST be best-effort per path: one unrecoverable entry MUST NOT strand the
rollback of the others. Paths still on disk afterwards MUST be returned to the caller.
When any path could not be restored, the snapshot MUST NOT be discarded, and its location
MUST be reported.

### Scenario 1 — the snapshot survives an incomplete rollback

```
GIVEN a managed path whose dest holds PRECIOUS consumer bytes
  AND a merge fn that replaces that path with a directory and then throws
WHEN copyManaged runs
THEN the error carries rollbackIncomplete containing that path
  AND the snapshot still holds PRECIOUS
  AND the error names the snapshot directory
```

This is the only branch where the snapshot is the sole surviving copy of those bytes, and
it is precisely the branch the CLI tells the operator to go and inspect. Discarding it
here would delete what the message points at.

### Scenario 2 — the preserved snapshot survives a later run

```
GIVEN a preserved snapshot from an incomplete rollback
WHEN brain:upgrade is run again over the same repo
THEN the preserved snapshot still holds the original bytes
  AND it is NOT at the path createRestorePoint clears on entry
```

Without this the promise is a trap: the operator is told to restore from that directory, and
their most natural next action — re-running the upgrade — would clear it on entry.

### Scenario 3 — negative control: a complete rollback discards its snapshot

```
GIVEN a rollback in which every path is restored
WHEN copyManaged throws
THEN no snapshot directory remains
```

### Scenario 4 — a failed cleanup never becomes a failed upgrade

```
GIVEN a write that succeeds
  AND removing the snapshot afterwards fails (EACCES/EPERM/EBUSY)
WHEN copyManaged runs
THEN it returns normally, reporting the write as done
```

`rmSync`'s `force` suppresses ENOENT but not permission errors, so an unguarded cleanup
would report a fully-applied upgrade as a failure — and inside the catch it would replace
the very error being reported.

## REQ-396-4 — the original failure is never lost

The failure the write loop threw MUST always reach the caller, and annotating it with
rollback state MUST NOT be able to throw, whatever value was thrown.

Precisely: when the rollback was complete, or when the thrown value can carry the
annotation, the caller receives **that same value by identity**. When it cannot — a frozen
`Error`, or a primitive — and the rollback was incomplete, the caller receives a wrapper
carrying the original as `cause`. Identity is preserved wherever it can be; the original is
preserved always. The caller MUST surface `cause`, or the root reason is never seen.

### Scenario 1 — an Error is re-thrown by identity

```
GIVEN a merge fn that throws a specific Error instance
WHEN copyManaged runs
THEN the caught value is that same instance
```

### Scenario 2 — a non-Error throw still carries the rollback state

```
GIVEN a merge fn that dirties its dest and then throws a bare string
WHEN copyManaged runs and the rollback is incomplete
THEN the caught value carries rollbackIncomplete
  AND the original string is preserved as its cause
```

Modules are strict mode, so a naive `err.rollbackIncomplete = …` throws a TypeError on a
string, a frozen Error or null — replacing the real failure AND dropping the dirty-tree
signal, which makes the CLI report a clean rollback over a dirty tree. `specialMerge` is
caller-supplied on an exported API, so this is reachable without a brain-side bug.

## REQ-396-5 — a path that cannot be protected is refused before any write

`copyManaged` MUST refuse, before writing anything, exactly two classes of path:

1. one that **resolves outside `destRoot`** after every symlink on its path is followed —
   the snapshot lives inside the repo, so a write landing outside it is beyond any
   rollback's reach. The whole path MUST be resolved, not just the leaf, or a symlinked
   ancestor directory passes unnoticed;
2. a **dangling symlink** — there is nothing to copy, so no snapshot of it can be taken.

A symlink that resolves **inside** `destRoot` MUST NOT be refused. It is protected like any
other path. This is measured, not assumed: `copyFileSync` follows the link when the snapshot
is taken, on the write, and on the restore, so the target returns to its original bytes and
the link itself is never replaced. Refusing these would soft-lock any consumer using
`AGENTS.md -> CLAUDE.md`, which is both a managed path and the canonical agent-interop symlink.

The message MUST name the paths and the remedy.

### Scenario 1 — a dangling symlink is refused, nothing written

```
GIVEN a dangling symlink at a managed path in dest
  AND a second, ordinary managed path present with OLD bytes
WHEN copyManaged runs
THEN it throws naming the path
  AND the symlink still exists
  AND no file was created at the link's target
  AND the ordinary path still holds OLD
  AND no snapshot directory remains
```

`existsSync` follows symlinks, so a dangling link reads as absent — it would be recorded as
created-by-this-run and DELETED on rollback. Presence MUST therefore be judged with `lstat`.

### Scenario 2 — a symlinked ANCESTOR that escapes is refused

```
GIVEN dest "brain/core" is a symlink to a directory outside the repo
WHEN copyManaged runs over "brain/core/**"
THEN it throws, naming the path as resolving outside the repository
  AND nothing is written through the link
```

A leaf-only symlink test never sees this: `lstat` does not follow the final component but
does resolve every ancestor.

### Scenario 3 — negative control: a VALID internal symlink is allowed and rolls back

```
GIVEN a managed path that is a symlink to a file inside dest, target holding CONSUMER bytes
WHEN copyManaged runs and a later write throws
THEN the refusal message is NOT raised
  AND the target holds CONSUMER bytes again
  AND the path is still a symlink
```

Without this control, a blanket "refuse every symlink" rule would satisfy Scenarios 1-2 and
still be wrong.

## REQ-396-6 — runs that write nothing take no snapshot

`--dry-run` and an `abortOnCollision` abort MUST NOT create a snapshot directory.

### Scenario 1 — neither mode leaves a snapshot

```
GIVEN a managed path that would collide
WHEN copyManaged runs with dryRun, then with abortOnCollision
THEN no snapshot directory exists after either
  AND dest still holds OLD
```

## REQ-396-7 — the snapshot directory is never itself managed

`RESTORE_POINT_DIR` MUST match no `managed` glob, so an upgrade can never copy its own
snapshot into the consumer tree. A snapshot left by an earlier run MUST NOT be trusted as
a source of restore bytes.

### Scenario 1 — drift-guard over the real manifest

```
GIVEN the real managed globs from brain/core/managed-paths.mjs
WHEN each of RESTORE_POINT_DIR and paths beneath it are matched
THEN none matches
```

### Scenario 2 — a stale snapshot is not reused

```
GIVEN a snapshot directory left behind holding STALE bytes
  AND the live file holding CURRENT
WHEN a restore point is taken and then restored
THEN the file holds CURRENT
```

## REQ-396-8 — the write order is deterministic

The write loop MUST iterate in sorted order, so a partial failure lands at a reproducible
point and the journal slice has a defined replay order.

### Scenario 1 — reported order matches written order

```
GIVEN several managed paths
WHEN copyManaged runs
THEN the paths are written in the same sorted order it reports
```

## REQ-396-9 — SIGKILL and power loss are recoverable

A hard kill during the write MUST leave a journal that a later invocation detects and
replays, restoring every managed path to its pre-copy bytes.

Recovery MUST be explicit, never automatic: between the crash and the next invocation the
consumer may have repaired the tree by hand, and replaying stale snapshot bytes over that
repair would destroy work while reporting success. A later run therefore REFUSES until the
operator asks.

The journal MUST be written after the snapshot completes and before the first write. Its
ABSENCE is then proof that the previous run never wrote anything, which is what makes
clearing a journal-less leftover safe.

### Scenario 1 — a real kill is replayable

```
GIVEN a run killed with SIGKILL after its first managed write
WHEN a later run starts
THEN it refuses, naming how many paths the interrupted run covered
  AND --recover returns every covered path to its pre-upgrade bytes
  AND a complete recovery consumes its own snapshot
```

### Scenario 2 — negative control: no journal means nothing to replay

```
GIVEN a leftover snapshot directory with NO journal
WHEN a run starts
THEN it proceeds normally
  AND the stale snapshot bytes are never restored
```

A rule that replayed any leftover directory would satisfy Scenario 1 and corrupt this one.

### Scenario 3 — an untrustworthy journal is not guessed at

```
GIVEN a journal that is unparseable, of an unknown version, or malformed
WHEN it is read
THEN it reads as ABSENT
```

### Scenario 4 — concurrency is decided by LIVENESS, not by a file existing

```
GIVEN one brain:upgrade whose process is alive and holding the lock
WHEN a second starts in the same repo
THEN it is refused, naming the owning pid
  AND --recover is refused too, because reverting under a live writer is the damage

GIVEN a lock whose owner is provably gone (SIGKILL leaves one every time)
WHEN a run starts
THEN the lock is reclaimed, not obeyed
```

A mutex that trusts file existence strands the repo after every hard kill; one that deletes
any lock it finds is not a mutex. The owner's pid — already written and previously never read
— is what separates the two.

### Scenario 5 — an unreadable journal is refused, never auto-cleared

```
GIVEN a journal that cannot be parsed or carries an unknown version
WHEN a run starts
THEN it refuses and the snapshot is left untouched
```

Absent and unreadable are OPPOSITE evidence. Absent proves nothing was written; unreadable
means something was and we no longer know what. Treating them alike is what turned a torn
journal into deleted bytes.

### Scenario 6 — --dry-run reports the interruption instead of hiding it

```
GIVEN an interrupted upgrade on disk
WHEN brain:upgrade runs with --dry-run
THEN it refuses and names --recover
```

"Dry-run first" is the habit the docs recommend, so it must not be the one path that stays
silent about a pending interrupted run.

## Out of scope

- Reverting the dependency install (step 1) or the config migration (step 3) — both sit
  outside the restore point and are named in `KNOWN-LIMITATIONS.md`.
- Supporting symlinked managed paths rather than refusing them.
- The merge-vs-copy classification (#397).
