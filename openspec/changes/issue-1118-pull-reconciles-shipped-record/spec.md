# Spec delta: pull reconciles the shipped record

## ADDED Requirements

### Requirement: `pull` deletes a byte-identical untracked record whose blob `@{u}` carries, and never leaves it lost

Both `MEMORY_BACKEND` adapters' `pull` MUST, after `git fetch` and before the
literal `git pull`, resolve `@{u}` and, for each untracked `.memory/records/`
path present in `@{u}`'s tree: delete the file when its `git hash-object`
equals the `@{u}` entry's oid (remembering `{path, oid}`), and REFUSE, before
pulling and touching nothing, when the bytes differ, naming the file. With no
upstream, nothing is reconciled and `git pull` runs as before.

After the pull, each remembered path MUST be verified: exists, tracked at HEAD,
hashes to the oid. A path that fails MUST be rewritten from
`git cat-file blob <oid>`, never overwriting an existing file with different
content (reported instead). The pull error is then rethrown; if the pull exited
0, an error naming each unrecreated path is thrown. One log line per reconciled
path states what was verified or restored; nothing is claimed that was not
checked.

#### Scenario: the capturing checkout's shipped record no longer blocks its pull
- **GIVEN** an untracked record byte-identical to `origin/main`'s copy
- **WHEN** `pull` runs
- **THEN** the pull succeeds, the record is tracked, bytes unchanged

#### Scenario: no upstream
- **WHEN** the branch has no `@{u}`
- **THEN** no file is deleted and `git pull` runs as before

#### Scenario: `@{u}` lacks the path
- **THEN** that file is never deleted

#### Scenario: different bytes
- **THEN** `pull` refuses before pulling, names the file, and leaves it and HEAD untouched

#### Scenario: the pull fails (diverged with `pull.ff=only`, or with stock config)
- **THEN** the pull error is rethrown and the file is back, byte-identical

#### Scenario: the path is removed upstream between the fetch and the pull
- **GIVEN** the pull fast-forwards and does not recreate the path
- **THEN** the file is rewritten from the blob, the restore is logged, and an error names the path

#### Scenario: nothing outside the working tree and the object store
- **THEN** no file under the git dir holds a copy, and `git worktree remove` is irrelevant
