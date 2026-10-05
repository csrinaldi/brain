---
status: draft
issue: 883
---

# Spec — local-worktree-overlay (issue 883)

Capabilities: `local-worktree-overlay` (new) and `sdd-artifact-reader` (modified; #1198, #1218 and #1201). Delta requirements: what MUST be true after this change. The proposal's rulings R1–R6 are binding and are cited by number. Requirement keywords follow RFC 2119. A requirement that modifies R881-n, R1198-n or R1201-n says so; every requirement not named here is unchanged.

Scenario grammar: each scenario carries exactly one `WHEN` line and one `THEN` line, with an optional `GIVEN`, so the Spec tab (`ui/lib/spec-cards.mjs`) renders it in full. A scenario with several outcomes states them in its single `THEN` line.

Fixed values used throughout:

- The seven documents (R2) and their files: proposal `proposal.md`, spec `spec.md`, design `design.md`, tasks `tasks.md`, apply `apply-progress.md`, verify `verify-report.md`, resume `resume.md`, all under the worktree's own `openspec/changes/<dir>/`.
- Per-document states (R3): `new` (worded "uncommitted: new"), `modified` ("uncommitted: modified"), `committed` ("committed on <branch>, not on main"), `same-as-main` ("same as main", collapsed), and `unreadable` (with its reason).
- Cap: `LOCAL_DRAWER_CAP = 3` worktrees with documents per issue (D72).
- Spawn bounds: the snapshot adds exactly 1 git spawn (`worktree list --porcelain`); the drawer route adds at most 1 git spawn per shown worktree (`ls-tree -l -z <head> -- <paths>`), so at most 3 per drawer read.
- Debounce: the watcher's existing 250 ms trailing debounce is "one watcher tick".
- Read limits: `DOCUMENT_READ_LIMIT` (8 MiB, not read above it) and `DOCUMENT_CAP` (256 KiB, cut at it), the values of `ui/change-route.mjs`.

## Discovery

### R883-1: The snapshot carries a `localWorktrees` section discovered from one worktree listing

`buildSnapshot` MUST include a `localWorktrees` section built by `readLocalWorktrees` (`brain/scripts/status/local-worktrees.mjs`) from exactly one `git worktree list --porcelain` spawn. A worktree MUST be joined to an issue by `parseCanonicalIssueBranch` on its branch, for every canonical type (`feat/`, `fix/`, `chore/`, `docs/` and any other `[a-z]+` type). The section MUST exclude the served root itself (compared by real path), bare entries, prunable entries, detached HEADs and branches outside the grammar, and MUST count each exclusion by cause in `hidden`, never silently. Each kept entry MUST carry `{path, leaf, branch, head, issue, dir, dirState, reason, touchedAt, fingerprint, capped}`. At snapshot time the section MUST read only directory listings and `lstat` metadata under a kept worktree's `openspec/changes/`, and MUST NOT read any file's content.

#### Scenario: Two worktrees on two open issues are listed
- **GIVEN** a repo with linked worktrees on `feat/issue-11-a` and `fix/issue-12-b`, and issues 11 and 12 open
- **WHEN** `buildSnapshot` runs
- **THEN** `localWorktrees` lists both with their branch, head and issue, and the `fix/` worktree is joined like the `feat/` one

#### Scenario: The served root is excluded
- **GIVEN** a server whose served root is itself a linked worktree on `feat/issue-13-c`, with issue 13 open
- **WHEN** `buildSnapshot` runs
- **THEN** the served root is not an entry and `hidden.served` is 1

#### Scenario: Excluded worktrees are counted by cause
- **GIVEN** a detached worktree, a worktree on `spike/x`, and a prunable worktree whose path was deleted
- **WHEN** `buildSnapshot` runs
- **THEN** none is an entry, and `hidden.detached`, `hidden.notIssue` and `hidden.prunable` are each 1

#### Scenario: Discovery costs one spawn
- **GIVEN** a recording git runner and five linked worktrees on open issues
- **WHEN** `buildSnapshot` runs
- **THEN** the section's git calls are exactly one `worktree list --porcelain`

### R883-2: No worktrees is an empty overlay, not an error

A clone whose `worktree list` names only the served root MUST yield `localWorktrees` as a readable section with no entries, and the drawer MUST show no local block and no failure wording for it (acceptance 2). A failure of the listing itself MUST be `uncomputable(reason)`, never an empty list. When the section is unreadable, for example on a forge-less server with no open-issue set, the drawer MUST show the `localNote` "this machine's worktrees were not read: <reason>" and no local block.

#### Scenario: No linked worktrees
- **GIVEN** a repo with no linked worktree
- **WHEN** `buildSnapshot` runs and the drawer opens on an open issue
- **THEN** `localWorktrees` is `ok` with zero entries and the drawer renders no "on this machine" block and no failure band for it

#### Scenario: A failed listing is said
- **GIVEN** a runner whose `worktree list` throws
- **WHEN** `buildSnapshot` runs
- **THEN** `localWorktrees` is `uncomputable` with a one-line reason and is not an empty list

#### Scenario: An unreadable section is said in the drawer
- **GIVEN** a snapshot whose `localWorktrees` section is not ok, as on a forge-less server
- **WHEN** the drawer opens on any issue
- **THEN** `localNote` reads "this machine's worktrees were not read: <reason>" and the drawer carries no local block

### R883-3: Only worktrees of open issues are kept (R6)

The section MUST keep a worktree only when its issue is in the open-issue set of the same snapshot's `graph` section, and MUST count the rest in `hidden.closed`. It MUST NOT filter on merge ancestry. When `graph` is pending, the section MUST be pending with the graph's reason; when `graph` is uncomputable, the section MUST be uncomputable with a reason naming R6. It MUST NOT list unfiltered worktrees in either case.

#### Scenario: A closed issue's worktree is hidden
- **GIVEN** worktrees on issues 11 (open) and 40 (closed)
- **WHEN** `buildSnapshot` runs
- **THEN** only issue 11's worktree is an entry and `hidden.closed` is 1

#### Scenario: An unknown open set filters nothing in
- **GIVEN** a snapshot whose `graph` section is uncomputable
- **WHEN** the section is built
- **THEN** `localWorktrees` is uncomputable, its reason names the open-issue filter, and no worktree is listed

#### Scenario: A loading open set is loading
- **GIVEN** a snapshot whose `graph` section is pending
- **WHEN** the section is built
- **THEN** `localWorktrees` is pending, not failed and not empty

### R883-4: At most three worktrees per issue carry documents, newest first

Within one issue, entries MUST be ordered by `touchedAt` descending (the latest `mtime` of the change dir and its documents; an entry with none sorts last), then by path. The first `LOCAL_DRAWER_CAP = 3` MUST have `capped: false`; the rest MUST have `capped: true`. The drawer MUST read documents only for uncapped entries, and MUST list capped entries by `leaf` and `branch` with a note stating the cap.

#### Scenario: The fourth worktree is listed without documents
- **GIVEN** four worktrees on open issue 11 with distinct `touchedAt`
- **WHEN** the drawer opens on issue 11
- **THEN** the three newest carry documents, the oldest is listed without documents, and the note states the cap of 3

## Documents and their states

### R883-5: The overlay covers all seven documents (R2)

For each uncapped entry with one change dir, the drawer MUST look up all seven documents in the worktree's change dir. A document with no file MUST NOT be a row; the block MUST name the absent documents in one line. A worktree with no change dir for its issue MUST be listed with the wording "no change dir in this worktree", and one with more than one MUST be listed as unreadable with the dir names.

#### Scenario: All seven are looked up
- **GIVEN** a worktree whose change dir holds all seven files
- **WHEN** the drawer opens
- **THEN** the local block has seven document rows, including `apply-progress.md`, `verify-report.md` and `resume.md`

#### Scenario: A worktree with no change dir is still listed
- **GIVEN** a worktree on `feat/issue-11-a` whose tree has no `openspec/changes/issue-11-*`
- **WHEN** the drawer opens on issue 11
- **THEN** the worktree is listed with "no change dir in this worktree" and no document rows

### R883-6: Each present document carries one state; identical to main is collapsed (R3)

Each present document MUST carry exactly one state, decided in this order by hashing its bytes as a git blob: `same-as-main` when the hash equals main's blob for the same stage at the served HEAD; else `new` when the worktree's HEAD tree has no entry at its path; else `modified` when the hash differs from that entry; else `committed`. A document in the worktree's HEAD tree and absent from its working tree MUST carry the state `deleted`, decided from the `ls-tree` already read, and MUST NOT carry a body; it is distinct from a document that was never in the worktree, which is only named in the absent line. A `same-as-main` row MUST NOT carry a body. Every `new`, `modified` or `deleted` document MUST carry `uncommitted: true` and render with its marker; `committed` and `same-as-main` MUST carry `uncommitted: false`. `resume.md` MUST NOT be compared with main, because main's HEAD has no reader for it. A tasks document that is read MUST carry its own task count.

#### Scenario: An untracked proposal is new while main has no change dir
- **GIVEN** a temp repo whose main has no change dir and a linked worktree for open issue N holding an untracked `proposal.md`
- **WHEN** `buildChangeView` runs for issue N
- **THEN** the local block's proposal row is marked `uncommitted: new`, while today the view says only "no change dir"

#### Scenario: An edited committed file is modified
- **GIVEN** a worktree whose committed `tasks.md` has one more ticked box in its working tree
- **WHEN** the drawer opens
- **THEN** the tasks row reads "uncommitted: modified" and carries the working tree's task count

#### Scenario: A committed file not on main
- **GIVEN** a worktree whose `spec.md` is committed on its branch, unchanged since, and absent from main
- **WHEN** the drawer opens
- **THEN** the spec row reads "committed on <branch>, not on main" and is not marked uncommitted

#### Scenario: A document committed on the branch and deleted in the worktree is deleted
- **GIVEN** a worktree whose `tasks.md` is committed on its branch and removed from its working tree
- **WHEN** the drawer opens
- **THEN** the tasks row reads "uncommitted: deleted (committed on <branch>, missing from the working tree)", carries no body, and is not named as not in this worktree

#### Scenario: A document identical to main is collapsed
- **GIVEN** a worktree whose `proposal.md` has the same bytes as main's at the served HEAD
- **WHEN** the drawer opens
- **THEN** the proposal row reads "same as main" and carries no body

#### Scenario: Same as main wins over uncommitted
- **GIVEN** an untracked `design.md` in a worktree whose bytes equal main's `design.md`
- **WHEN** the drawer opens
- **THEN** the design row reads "same as main", not "uncommitted: new"

### R883-7: Reads of working-tree files are safe

The drawer's reader MUST refuse, as `unreadable` with a one-line reason: a document that is a symbolic link; a document or change dir whose real path is outside the worktree's change dir; a non-regular file; and a file larger than `DOCUMENT_READ_LIMIT`. A readable document MUST be cut at `DOCUMENT_CAP` on a UTF-8 boundary with the existing truncation note, while its hash covers all its bytes. The reader MUST `lstat`, read, then `fstat`; when the sizes disagree it MUST read once more, and a second disagreement MUST be `unreadable` with the reason that the file changed while it was read. A failure of one document MUST NOT affect another.

#### Scenario: A symlinked document is refused
- **GIVEN** a worktree whose `spec.md` is a symbolic link to `/etc/hostname`
- **WHEN** the drawer opens
- **THEN** the spec row is unreadable with a symlink reason and no content of the target is read

#### Scenario: A change dir that escapes is refused
- **GIVEN** a worktree whose `openspec/changes/issue-11-a` is a symbolic link to a dir outside the worktree
- **WHEN** the snapshot and the drawer read it
- **THEN** the change dir is unreadable with an escape reason and no file under it is read

#### Scenario: A large document is cut, not refused
- **GIVEN** a worktree `design.md` of 300 KiB
- **WHEN** the drawer opens
- **THEN** the row is truncated at `DOCUMENT_CAP` with its note, and its state is computed from the full bytes

#### Scenario: A torn read is said
- **GIVEN** a filesystem seam whose `fstat` size differs from `lstat` on both attempts
- **WHEN** the document is read
- **THEN** it is unreadable with the reason that it changed while it was read, and the other documents are unaffected

### R883-8: The served root's uncommitted files are never read (R4)

No reader added by this change MUST read a path under the served root's working tree. `ui/change-route.mjs` MUST keep no filesystem read; the only working-tree reader is `ui/local-overlay.mjs`, and it MUST read only under a linked worktree that the section kept. This modifies R1198-4: "no artifact is read from the working tree" becomes "no artifact is read from the served root's working tree".

#### Scenario: A stray untracked file in the served root is ignored
- **GIVEN** an untracked `openspec/changes/issue-11-a/apply-progress.md` in the served root and no such file at HEAD
- **WHEN** the drawer opens on issue 11
- **THEN** the served change's apply document is missing at HEAD and no local block names the served root

#### Scenario: A served root that is itself a linked worktree is still never read
- **GIVEN** the served root is a linked worktree on `feat/issue-11-a` with an untracked `apply-progress.md` in its change dir
- **WHEN** the drawer opens on issue 11
- **THEN** the section hides the served root, no local block names it and the untracked text appears nowhere in the view

## Precedence

### R883-9: The drawer stacks main, then this machine, then origin (R1)

The change view MUST carry `local` (one block per entry of the issue) and `localNote`, beside the unchanged tabs and the unchanged `remote` blocks. The page MUST render the served change first, then an "on this machine" heading with the local blocks, then the "on origin" blocks; when the served HEAD has no change dir for the issue and a local block exists, the local blocks MUST be rendered first and the empty-state line MUST say the served HEAD has none and this machine's worktrees follow. Each local block MUST be labelled `worktree <leaf> · <branch>`. A local block whose head equals the sha of an `origin` entry for the same branch, MUST be listed as `same-as-origin` without documents only when every document is readable, none is uncommitted and none is deleted from the working tree; otherwise the block MUST be read, so the refusal or the deletion is shown. The tabs MUST keep reading the served HEAD only.

#### Scenario: Local before origin
- **GIVEN** issue 11 with a served change dir, one local worktree and one remote branch
- **WHEN** the drawer renders
- **THEN** the order is the served change, then "on this machine", then "on origin"

#### Scenario: No change dir on main puts the local block first
- **GIVEN** issue 11 with no served change dir and one local worktree
- **WHEN** the drawer renders
- **THEN** the "on this machine" block is the first block and the empty-state line says the served HEAD has no change dir

#### Scenario: An unreadable or deleted document keeps a block at its origin tip read
- **GIVEN** a worktree at its origin tip whose `proposal.md` is now a symbolic link and whose committed `tasks.md` is missing on disk
- **WHEN** the drawer renders
- **THEN** the block is read, the proposal row says it is a symbolic link and the tasks row reads "uncommitted: deleted"

#### Scenario: A clean worktree at its origin tip collapses into origin
- **GIVEN** a worktree whose head equals `origin/feat/issue-11-a` and whose documents are all committed or same as main
- **WHEN** the drawer renders
- **THEN** its block is listed as the same as origin, without documents

## Liveness

### R883-10: The watcher notices a worktree edit within one tick

This modifies R881-3. The watcher MUST expose `setLocalTargets(targets)` and MUST hold, for each uncapped entry, a non-recursive directory watch on its `openspec/changes/` and, when it has one, on its change dir. A fire MUST go through the existing 250 ms debounce with a `watch:local:` cause. Targets that leave the list MUST be closed; a watch that fails MUST be said in `state().failed` and retried on the next `setLocalTargets` call. An uncomputable section MUST leave the current targets untouched. The server MUST call `setLocalTargets` after each recompute with the section's uncapped entries. When a worktree has no `openspec/changes/` yet, the server MUST pass the nearest existing directory above it inside the worktree (`openspec/`, else the worktree root) as an `ancestor`, watched non-recursively as one extra handle and dropped once the changes dir exists; a path that resolves outside the worktree MUST never be passed.

#### Scenario: An edit fires one debounced recompute
- **GIVEN** a watcher with a fake `fs.watch`, fake timers, and one local target
- **WHEN** the target's change dir handle fires and 250 ms elapse
- **THEN** exactly one recompute runs with a cause starting `watch:local:`

#### Scenario: Targets are reconciled
- **GIVEN** a watcher holding targets for worktrees A and B
- **WHEN** `setLocalTargets` is called with B and C
- **THEN** A's handles are closed, B's are kept, and C's are opened

#### Scenario: The first change dir of a bare worktree is noticed
- **GIVEN** a worktree of an open issue with no `openspec/` directory
- **WHEN** a change dir is created in it and the worktree's handle fires
- **THEN** a recompute runs, the changes dir and the change dir are watched, and the worktree root handle is closed

#### Scenario: An uncomputable section keeps the watches
- **GIVEN** a server whose previous section listed worktree A and whose next build is uncomputable
- **WHEN** the recompute ends
- **THEN** A's handles are still open

### R883-11: A local edit reaches the open drawer

Each entry's `fingerprint` MUST change when a document of its change dir is created, removed, resized or re-written (from `lstat` size and `mtime`). The page MUST reload the open drawer when a `section` frame for `localWorktrees` changes the fingerprint, `dirState` or entry set of the selected issue, and MUST NOT reload it for a change of another issue only (acceptance 1).

#### Scenario: A ticked task shows as uncommitted within one tick
- **GIVEN** a running server with fake watch and timers, the drawer open on issue 11, and a worktree whose committed `tasks.md` is then edited to tick a box
- **WHEN** the change dir handle fires and one debounce elapses
- **THEN** a `section` frame for `localWorktrees` is sent, the page reloads the change view, and the tasks row reads "uncommitted: modified"

#### Scenario: Another issue's edit does not reload the drawer
- **GIVEN** the drawer open on issue 11
- **WHEN** a `localWorktrees` frame changes only issue 12's fingerprint
- **THEN** the page does not request the change view again

### R883-12: The stamp of a local document carries a content marker

A local document's stamp MUST be `<path> @ worktree <leaf> · <bytes> B · <blob12>`, where `blob12` is the first 12 hex digits of its git blob hash. Two different contents MUST yield two different stamps, so the page's render cache (`docTrees`, keyed by stamp) renders an edit afresh and reuses a render only for identical bytes.

#### Scenario: An edit gets a new stamp
- **GIVEN** a local `spec.md` rendered once in the open drawer
- **WHEN** the file gains one line and the drawer reloads
- **THEN** its stamp differs from the first one and the page starts a new render for it

## Bounds and side effects

### R883-13: No forge call and a bounded spawn count (R11)

Neither the section nor the drawer's local reader MUST call the forge port. The section MUST add exactly one git spawn per build, and the drawer MUST add at most one git spawn per uncapped entry of the issue. Every git call MUST run on the served root's own git dir, with no `-C`, `--git-dir` or `--work-tree` argument. No first render MUST wait on the overlay: a pending open set is a pending section (R883-3).

#### Scenario: The drawer's local reads are bounded and forge-free
- **GIVEN** a recording git runner, a vcs that throws when touched, and four worktrees on issue 11
- **WHEN** `buildChangeView` runs for issue 11
- **THEN** the local reader made exactly three `ls-tree` calls, none carrying `-C`, and the vcs was never called

### R883-14: The overlay writes nothing

No code added by this change MUST write a file, take a git lock, refresh an index, or run `status`, `add`, `commit`, `stash`, `checkout`, `switch`, `reset`, `worktree add` or `push`. Files are opened read-only; the reader opens no file for writing.

#### Scenario: A drawer read leaves every worktree byte-identical
- **GIVEN** a fixture with a dirty linked worktree and a recording git runner that throws on any write verb
- **WHEN** the snapshot is built and the drawer is read
- **THEN** each worktree's files, its admin dir's `index` and `HEAD`, and the served root's `index` are byte-identical to before, and no write verb was attempted

## Branch resolution

### R883-15: The Working memory branch is resolved for every canonical type

This modifies D12 of #881 (`resolveBranch`). After the issue's open PR, the branch MUST be the single local branch for which `parseCanonicalIssueBranch` yields the issue, whatever its type, matched with `git branch --list '*/issue-N' '*/issue-N-*'`. None MUST read `no open PR and no */issue-N branch in this clone`. When more than one name matches, the branch MUST be the one checked out in exactly one kept `localWorktrees` entry of that issue whose `dirState` is `present` (read from the snapshot, no extra spawn); when none or several such worktrees hold the change dir, the reason MUST read `more than one */issue-N branch in this clone: <names>`, followed by `; held by worktrees <leaves>` when several hold it. When no committed resume exists and a local block holds one, the Working memory tab MUST say so and point at "on this machine"; the wording "the local overlay arrives in slice 5 (#883)" MUST be gone.

#### Scenario: A fix/ branch resolves
- **GIVEN** a clone whose only branch for issue 11 is `fix/issue-11-x`, with no open PR
- **WHEN** the Working memory tab is built
- **THEN** it reads the resume at `fix/issue-11-x`

#### Scenario: Several branches resolve to the one a worktree holds
- **GIVEN** `feat/issue-11-x` and `feature/issue-11-y` exist, no open PR, and only the `feat/` branch is checked out in a kept worktree whose change dir is present
- **WHEN** the Working memory tab is built
- **THEN** it reads the resume at `feat/issue-11-x`

#### Scenario: Several worktrees holding the change stay ambiguous
- **GIVEN** `feat/issue-11-x` and `feature/issue-11-y` each checked out in a kept worktree whose change dir is present
- **WHEN** the Working memory tab is built
- **THEN** it refuses with `more than one */issue-11 branch`, naming both branches and both worktree leaves, and never calls `git show`

#### Scenario: The slice-5 placeholder is gone
- **GIVEN** a resolved branch with no committed resume and a local worktree holding an uncommitted `resume.md`
- **WHEN** the Working memory tab is built
- **THEN** its reason points at "on this machine" and does not contain "slice 5"

## Map card

### R883-17: A card whose change lives only in a local worktree says so

When the served root's `changes` section has no change dir for an issue and `localWorktrees` has an entry for that issue with `dirState: 'present'`, the map card MUST read `change in worktree <leaf> (not on main)`, with ` and N more` after the leaf when several hold it, instead of `no change directory names issue #N`. The card MUST NOT show progress numbers, because it reads no file content (the drawer does). When the served root has the change, it wins. An unreadable `localWorktrees` section MUST leave the existing wording unchanged.

#### Scenario: A worktree-only change is named on the card
- **GIVEN** the served root has no change dir for issue 7 and a kept worktree `wt-seven` holds one with `dirState` present
- **WHEN** the card strip for issue 7 is built
- **THEN** it reads `change in worktree wt-seven (not on main)` and carries no task count

## Amended invariants

### R883-16: Invariants are amended in place, never deleted

R881-3 is amended by this change, and the amendment is recorded here, in the note below, never in the archived `openspec/changes/archive/881/spec.md` (archived changes are history and are not edited): the watcher MAY watch, and the drawer MAY read, the change dir of an open issue's linked worktree; git still never runs in a worktree. Its scenario "an uncommitted edit produces no event" MUST stay, re-scoped to the served root and to paths outside the overlay's targets.

**Modifies R881-3 (amended 2026-10-03, #883).** R881-3 held that no path under a worktree is watched or read. From this change on, exactly two things are admitted: (1) the watcher's two non-recursive directory watches per uncapped worktree of an open issue (`openspec/changes/` and its change dir, R883-10), and (2) the drawer's reads of that change dir by `ui/local-overlay.mjs` (R883-5 to R883-8). Nothing else is admitted: git still never runs inside a worktree (no `-C`, `--git-dir` or `--work-tree`), the served root's working tree stays unwatched outside the Q3 set, and a symlink out of the worktree is never followed. No line of R881-3 is removed. The `-C` assertion at `ui/server.test.mjs:918` MUST stay and MUST run on a fixture with a linked worktree. R1198-4's guard test MUST stay, re-scoped as R883-8 states. The headers of `watcher.mjs`, `change-route.mjs` and `snapshot.mjs` MUST state the overlay as the one working-tree exception, and `SNAPSHOT_TIER` MUST stay `committed`, with the section declaring `tier: 'working-tree'`.

#### Scenario: The -C assertion runs against a linked worktree
- **GIVEN** the route test's fixture extended with a linked worktree on an open issue holding a change dir
- **WHEN** the drawer route is read for that issue
- **THEN** the local block is present and no recorded git call carries `-C`

#### Scenario: The served root's uncommitted edit still produces no event
- **GIVEN** a watcher with local targets and a fake `fs.watch`
- **WHEN** a file in the served root outside its watched set is edited
- **THEN** no handle fires and no recompute is scheduled

## Out of scope

- The cold-review cache and its parser (R5): a follow-up, for the Reviews tab.
- Remote mode (#885): no remote-mode flag exists in `ui/`; the overlay is local by construction.
- The served root's own uncommitted files (R4).
- Reading spec cards or the tasks checklist from a worktree; the tabs stay on the served HEAD.
- Per-hunk diffs, `git status`, and clean/smudge or end-of-line normalisation.
- Any write, publish, push or PR action from the overlay.
- Comparing `resume.md` with main.

## Traceability

| Item | Requirement | Scenarios proving it |
|---|---|---|
| R1 lookup order | R883-9 | Local before origin; No change dir on main puts the local block first; A clean worktree at its origin tip collapses into origin; An unreadable or deleted document keeps a block at its origin tip read |
| R2 seven documents | R883-5 | All seven are looked up |
| R3 states, same as main collapsed | R883-6 | An untracked proposal is new while main has no change dir; An edited committed file is modified; A committed file not on main; A document identical to main is collapsed; Same as main wins over uncommitted; A document committed on the branch and deleted in the worktree is deleted |
| R4 served root out of scope | R883-8 | A stray untracked file in the served root is ignored; A served root that is itself a linked worktree is still never read |
| R5 cold-review cache split out | Out of scope | — |
| R6 open-issue filter | R883-3 | A closed issue's worktree is hidden; An unknown open set filters nothing in; A loading open set is loading |
| Cap of 3, rest listed | R883-4 | The fourth worktree is listed without documents |
| Served root excluded | R883-1 | The served root is excluded |
| Safe reads | R883-7 | A symlinked document is refused; A change dir that escapes is refused; A large document is cut, not refused; A torn read is said |
| R11, no forge, bounded spawns | R883-1, R883-13 | Discovery costs one spawn; The drawer's local reads are bounded and forge-free |
| Acceptance 1 (ticked task within one tick) | R883-10, R883-11 | An edit fires one debounced recompute; A ticked task shows as uncommitted within one tick; The first change dir of a bare worktree is noticed |
| Content-marker stamp | R883-12 | An edit gets a new stamp |
| Acceptance 2 (no worktrees, empty overlay) | R883-2 | No linked worktrees; An unreadable section is said in the drawer |
| Read-only, never publishes | R883-14 | A drawer read leaves every worktree byte-identical |
| `resolveBranch` for every type | R883-15 | A fix/ branch resolves; Several branches resolve to the one a worktree holds; Several worktrees holding the change stay ambiguous; The slice-5 placeholder is gone |
| Card of a worktree-only change | R883-17 | A worktree-only change is named on the card |
| Amended R881-3, `-C` test, R1198-4, tier wording | R883-8, R883-16 | The -C assertion runs against a linked worktree; The served root's uncommitted edit still produces no event |
