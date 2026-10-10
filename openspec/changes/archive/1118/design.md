# Design: pull reconciles the shipped record

## Decision 1: the blob's oid is the backup

An untracked file whose `git hash-object` equals the oid of the same path in
`@{u}`'s tree is already stored, byte for byte, as a blob in the object store,
reachable from `@{u}`'s commit. Deleting the working copy loses nothing; the
copy can be rewritten with `git cat-file blob <oid>`. No aside file is needed,
so nothing has to be created, moved, fsynced, cleaned up or reported as
leftover, and nothing lives where `git worktree remove` can destroy it.

**Why this holds even when a later upstream commit removes the path.** The blob
is reachable from the commit in `@{u}`'s history that added the path, and a
later commit that deletes the path does not make that earlier commit
unreachable: history is append-only along the branch. That is precisely the
fetch-to-pull race, and the restore path relies on it.

**The one remaining edge:** a force-push that rewrites `@{u}` and drops the
commit, followed by a `gc` that prunes the blob before we restore. The blob
stays fetched and reachable until the next fetch updates the remote-tracking
ref and until reflog expiry; the window between our fetch and our verification
is seconds. If `cat-file` still fails, the restore reports it by name and
path/oid (the oid is printed) rather than claiming success. Reachability is the
guarantee, not a new mechanism.

## Decision 2: the ref is `@{u}`

`git pull` merges from `@{u}`, so reconciliation reads `@{u}` (via
`upstreamRecordEntries({ref})`), never the `memory.upstreamRef` chain, which
answers a different question. No upstream means nothing is reconciled.

## Decision 3: literal `git pull`, verified afterwards

The user's pull configuration stays in force. Whatever the pull does, each
remembered path is then checked (exists, tracked at HEAD, same oid). Failure to
pass is repaired from the blob and reported; exit code 0 is never trusted alone.
A file that exists with different bytes is never overwritten.

## Decision 3b: byte-strict identity, regular files only (review of the simplified design)

- Identity is `git hash-object --no-filters`: raw bytes. A CRLF working copy
  under `core.autocrlf=true` hashes differently from the LF blob and is treated
  as divergent (refused, untouched), never deleted and restored as LF.
- The blob is read as a Buffer (`cat-file blob`, no encoding) and written as a
  Buffer, so invalid UTF-8 survives byte-identical.
- Verification accepts a path that is present and whose tracked blob (HEAD's,
  else the index's stage-0 entry) equals the oid: a merge that conflicts
  elsewhere leaves the record staged, which is fine. Tracked-blob comparison
  (not a working-tree hash) also keeps a legitimate autocrlf checkout valid.
- Only `100644`/`100755` `@{u}` entries are candidates; symlink and submodule
  entries are never reconciled.
- If an unlink fails mid-loop, the error names the already-deleted paths and
  the blob oids that are in `@{u}`.

## Decision 4: one shared `defaultGitPull`

`reconcile-pull.mjs` exports the one default `_gitPull` used by both adapters
(reuse, never duplicate). `_afterReconcile` is a test-only seam for the race.

## How the four review rounds are closed

| Round | Defect | Closed by |
|---|---|---|
| 1 | wrong ref | Decision 2 (`@{u}`) |
| 2 | deleted before a pull that refused | restore from the blob on any pull failure |
| 3 | discarded after exit 0 without recreation | Decision 3 verification |
| 4 | asides destroyed by `worktree remove`; ~700 lines | no aside exists; 147 lines in one module (comments included) |
