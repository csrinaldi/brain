# Proposal: `brain:memory:pull` reconciles the record its own lane already shipped

**Issue:** #1118 · **Parent:** #864 · **Found by:** #1081 (finding F10)

## Problem

`save()` writes `.memory/records/<yyyy-mm>-<id>.jsonl` without ever `git add`ing
it; the lane ships it to `main` from blobs. The capturing checkout's copy stays
untracked. After the lane PR merges, `git pull` in that checkout refuses:
"untracked working tree files would be overwritten by merge", although the file
is byte-identical to `origin/main`'s. Every host that captures memory hits this
after every lane merge.

## Proposal

Before `git pull`, and only for untracked records that `@{u}` also carries:

- byte-identical (`git hash-object` equals the `@{u}` tree entry) → delete the
  file and remember `{path, oid}`;
- different bytes → refuse before pulling, naming the file, touching nothing.

Run the literal `git pull`. Afterwards verify each remembered path (exists,
tracked at HEAD, same oid). Any path that fails is rewritten from git itself
(`git cat-file blob <oid>`), never over a file with different content, and the
pull error is rethrown (or, if the pull exited 0, an error names the path). One
log line per reconciled path says what was verified or restored.

There is no aside copy: the blob is already durable in git's object store
because `@{u}` reaches it. The oid is the backup.

## Where

One shared `defaultGitPull(root)` in `brain/scripts/memory/lib/reconcile-pull.mjs`
is the default `_gitPull` seam of both `plainfiles.mjs#pull` and
`engram.mjs#pullMemory`. `upstream-records.mjs#upstreamRecordEntries` gains an
explicit `ref` parameter so `@{u}` (the ref `git pull` merges from) is read
instead of the `memory.upstreamRef` chain.

## History: four cold reviews and the simplification

The first implementation moved the file aside and restored it on failure. Cold
review found, in turn: (1) it compared against the wrong ref instead of `@{u}`;
(2) it deleted before a pull that then refused; (3) it discarded after an exit-0
pull that did not recreate the path; (4) the aside copies under
`.git/worktrees/<name>/brain-reconcile/` are destroyed by `git worktree remove`,
and about 700 production lines was disproportionate. The maintainer ruled
(2026-09-29): simplify. Every one of those defects lived in the aside machinery
(where the copy is kept, when it is discarded, who cleans it up). Removing the
copy removes the defect class; rounds 1-3 stay closed by `@{u}`, restore-on-any-
failure and post-pull verification, which the simplified design keeps.

## Non-goals

No aside directory, no EXDEV/rename logic, no leftover scanning, no change to
the user's pull configuration, no handling of tracked-but-modified records.
