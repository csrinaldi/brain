---
status: draft
issue: 1201
---

# Spec — multidev-remote-branches (issue 1201)

Capabilities: `remote-change-visibility` (new) and `sdd-artifact-reader` (modified; introduced by #1198, with #1218's amendments, not yet archived to `openspec/specs/`). Delta requirements: what MUST be true after this change. The proposal's rulings R1-R8 (including the "Answers" section) are binding and are referenced by number. Requirement keywords follow RFC 2119. Requirements that modify an R1198-n or R1218-n requirement say so explicitly; every such requirement not named here is unchanged.

Scenario grammar: each scenario carries one `WHEN` and one `THEN` line and an optional `GIVEN`, so the UI's spec cards (`ui/lib/spec-cards.mjs`, which keeps only the last `THEN`) render this file in full. A scenario that needs several observable outcomes states them in its single `THEN` line.

Fixed values used throughout:

- Remote: `origin`. Remote-tracking namespace: `refs/remotes/origin/*`. Integration base: `origin/main`.
- Fetch command: `git fetch origin --no-tags --prune --no-write-fetch-head` (D39; the last flag is an addition to ruling R1, see the proposal's amendment), run asynchronously through `gitRunAsync` with `GIT_TERMINAL_PROMPT=0` and a 20 s timeout (`FETCH_TIMEOUT_MS = 20000`).
- Fetch state (`lastAttemptAt`, `lastOkAt`, `lastError`, `inFlight`) lives in poller state and reaches the page through `meta.poller` (D30). It is never part of the `remoteChanges` section.
- Lane branches (hidden): `memory/*` and `auto-archive/*`.
- Resume path: `openspec/changes/<dir>/resume.md`, where `<dir>` is the branch's own change dir.
- Author label: "last commit by <name>".
- Resume states, each with distinct wording: `missing`, `unreadable`, `invalid` (plus `present` for a valid file, and `deferred` for a branch not yet read, D36).
- Read budget: `REMOTE_READ_BUDGET = 24` branches per build (D36). Each branch costs at most 3 git spawns (`ls-tree` of `openspec/changes/`, `ls-tree -l` of the stage paths and `resume.md`, `cat-file` of `resume.md`), plus 2 base `for-each-ref` spawns per build. A warm build costs exactly 2 spawns. Branches over the budget are `deferred`, never `unreadable`.
- Cache: held by the server in memory, keyed by `${sha}:${issue}`. The CLI passes no cache and runs cold.
- Drawer cap: `REMOTE_DRAWER_CAP = 3` remote blocks (D37).
- Poll interval: 60 s. Explicit-refresh collapse window: 5 s (the existing `ONCE_COLLAPSE_MS`).

## Section shape and provenance

### R1201-1: The snapshot carries a `remoteChanges` section read from remote-tracking refs, with no network access

`buildSnapshot` MUST include a `remoteChanges` section. The section MUST be built by `readRemoteChanges({run, prs, cache, budget})` (`brain/scripts/status/remote-changes.mjs`) from `refs/remotes/origin/*` alone, using two `for-each-ref` queries as its base reads: one listing every `refs/remotes/origin/` ref, and one with `--merged=<base>`. The base is `origin/HEAD`'s symref from the listing, falling back to `origin/main`. It MUST NOT run `git fetch`, `git pull`, `git remote update`, `git ls-remote`, or any other command that opens a network connection, and MUST NOT write any ref, so the snapshot stays local and read-only (#878 ruling 2; R1). Each entry MUST carry `{branch, sha, tipAt, author, kind, issue, pr, change, resume}`, where `kind` is `grammar` (joined) or `unjoined`. A grammar entry's `change` MUST carry the per-stage blob metadata of the branch's own change dir (`{state, blob, bytes}` per stage) and MUST NOT carry any document text (D31); the text is read on demand by the drawer (R1201-6). A grammar entry also carries a `resume {state, reason, fields}` value. `branch` is the name without the `origin/` prefix; `sha` is the tip commit; `tipAt` is the tip committer date in ISO-8601; `author` is the tip commit's git author name. The section MUST NOT carry the fetch time, the age of the refs, or any other fetch state (D30): those live in poller state and reach the page through `meta.poller`, so the section changes only when the refs or the reads change. If a base read fails, or the listing is empty, the section MUST be `uncomputable(reason)` in the existing degraded-band shape and MUST NOT be an empty list.

#### Scenario: Two remote branches are listed with provenance (AC1)
- **GIVEN** a bare fixture remote with two grammar branches `feat/issue-101-a` and `feat/issue-102-b`, each carrying a different `openspec/changes/**` tree, cloned and fetched into the test repo
- **WHEN** `buildSnapshot` runs
- **THEN** `remoteChanges` lists both branches, each with its own `branch` and `sha`, and each entry's documents come only from its own change dir

#### Scenario: AC1 needs no forge
- **GIVEN** the fixture of the previous scenario, a `_run` that records every git call, and a vcs that throws if it is touched
- **WHEN** `buildSnapshot` runs
- **THEN** the section is complete, the vcs was never called, and the git calls contain no `fetch`, `pull`, `ls-remote`, `remote update` or ref-writing command

#### Scenario: The snapshot never fetches (ruling 2, one shape)
- **GIVEN** a recording git shim and a remote that has gained a new branch since the last fetch
- **WHEN** `buildSnapshot` runs
- **THEN** the new branch is absent from `remoteChanges` and the shim saw no network-capable command

#### Scenario: The section carries blob metadata and no document text (D31)
- **GIVEN** a grammar branch whose change dir holds `proposal.md` and `spec.md`
- **WHEN** `buildSnapshot` runs and the section is serialized
- **THEN** the entry's `change` lists each stage with `{state, blob, bytes}` and the serialized section contains no document text

#### Scenario: The section carries no fetch state (D30)
- **GIVEN** a snapshot built on a clone whose last fetch failed
- **WHEN** the section is serialized and searched for `lastFetch`, `refsAsOf` or any fetch timestamp
- **THEN** none is present, and two builds over unchanged refs produce byte-identical sections

#### Scenario: A failed base read is a degraded section
- **GIVEN** a `_run` whose `for-each-ref` call throws
- **WHEN** `buildSnapshot` runs
- **THEN** `remoteChanges` is `uncomputable` with a one-line reason and is not an empty list

### R1201-2: A branch is shown with the tip commit's author, labelled as such, and never a session

The UI and every value in the section MUST present the tip commit's git author as "last commit by <name>". The section MUST NOT carry, and the UI MUST NOT render, a brain handle, an email-derived handle, an email address, or any value that names a session (R3). No mapping from email to handle MAY be introduced. The author name MUST be rendered as text, never as markup.

#### Scenario: The author wording (R3)
- **GIVEN** a remote branch whose tip commit author is "Ada Lovelace"
- **WHEN** the drawer and the lane card render
- **THEN** they read "last commit by Ada Lovelace" and show no handle and no email

#### Scenario: No session field exists (AC3)
- **GIVEN** a snapshot with remote entries in every classification
- **WHEN** the section and the rendered UI are serialized and searched for a session key or value
- **THEN** no key, value or label names a session

#### Scenario: An author name with markup is inert
- **GIVEN** a tip commit whose author name is `<img src=x onerror=alert(1)>`
- **WHEN** the lane card renders
- **THEN** the name appears as literal text and no element is created from it

## Branch selection

### R1201-3: Branch classification and filters decide what is shown

For each `refs/remotes/origin/*` ref, the section MUST apply these rules in order (R4, R6):

1. The symbolic ref `origin/HEAD` and the base (`origin/main`, or the target of `origin/HEAD`) MUST be skipped.
2. A branch matching a lane pattern (`memory/*`, `auto-archive/*`) MUST be hidden.
3. A branch with an open PR whose `headBranch` equals the branch MUST be shown (R6), regardless of the merge check below.
4. A branch merged into `origin/main` MUST be hidden. "Merged" means exactly: the branch has no open PR, and its tip is an ancestor of `origin/main` (that is, it appears in `for-each-ref --merged=<base>`). An empty branch, or one fast-forwarded into `origin/main`, therefore counts as merged.
5. A remaining branch for which `parseCanonicalIssueBranch` returns an issue MUST be classified `grammar`.
6. Any other remaining branch MUST be classified `unjoined`.

Hidden branches MUST NOT appear in any list, count or group of the UI. Hiding MUST NOT depend on a label or on the branch name alone beyond the lane patterns above.

#### Scenario: Lane branches are hidden (AC5)
- **GIVEN** unmerged remote branches `memory/host-2026-09-30` and `auto-archive/2026-09-30`
- **WHEN** `buildSnapshot` runs
- **THEN** neither appears in `remoteChanges`, nor in the unjoined group, nor in any count

#### Scenario: A branch outside the grammar is unjoined (AC5)
- **GIVEN** an unmerged remote branch `wip/scratch` with no issue number
- **WHEN** `buildSnapshot` runs
- **THEN** the entry is classified `unjoined` and appears in the unjoined group

#### Scenario: A merged branch is hidden
- **GIVEN** a grammar branch with no open PR whose tip is an ancestor of `origin/main`
- **WHEN** `buildSnapshot` runs
- **THEN** the branch does not appear in `remoteChanges`

#### Scenario: An empty or fast-forwarded branch counts as merged
- **GIVEN** a grammar branch created from `origin/main` with no new commit, and no open PR
- **WHEN** `buildSnapshot` runs
- **THEN** the branch is hidden, because its tip is an ancestor of `origin/main`

#### Scenario: An open PR wins over merged (R6)
- **GIVEN** a grammar branch whose tip is an ancestor of `origin/main` and an open PR whose `headBranch` is that branch
- **WHEN** `buildSnapshot` runs
- **THEN** the branch is shown on its ticket node together with the PR, and is not hidden as merged

#### Scenario: A grammar branch not merged is attached to its ticket
- **GIVEN** an unmerged branch `feat/issue-101-a` and a ticket node for issue 101
- **WHEN** the board renders
- **THEN** the branch's remote work is attached to the ticket 101 node

#### Scenario: A branch with a closed or merged PR gets no special treatment
- **GIVEN** a grammar branch whose only PR is closed, and whose tip is an ancestor of `origin/main`
- **WHEN** `buildSnapshot` runs
- **THEN** the branch is hidden as merged

### R1201-4: A remote branch and its open PR collapse into one node

A remote branch and an open PR whose `headBranch` equals that branch MUST be one node, keyed by issue and branch, and never two rows (R4). The node MUST show the PR and the remote provenance together. This requirement MUST NOT change how lane PRs are joined; that is #1070, owned by #1121.

#### Scenario: One node for the branch and its PR
- **GIVEN** an unmerged branch `feat/issue-101-a` and an open PR with `headBranch` `feat/issue-101-a`
- **WHEN** the board renders
- **THEN** exactly one node exists for it, and it shows both the PR and the "last commit by" line

#### Scenario: A branch with no PR stands alone
- **GIVEN** an unmerged grammar branch and no PR for it
- **WHEN** the board renders
- **THEN** one node exists for it and it shows no PR

### R1201-5: The unjoined group is collapsed, sorted by tip date and shows age

Unmerged branches classified `unjoined` MUST be rendered in one group that is collapsed by default (R4). The group MUST be sorted by `tipAt`, newest first, and each row MUST show the branch, the "last commit by" line and the tip's age. No age cutoff MAY filter the group; only R1201-3's lane and merged rules filter it (R8). The collapsed header MUST show the row count.

#### Scenario: Collapsed by default (AC5)
- **GIVEN** three unjoined branches
- **WHEN** the board first renders
- **THEN** the group is collapsed and its header reads a count of 3

#### Scenario: Sorted by tip date, newest first (R8)
- **GIVEN** unjoined branches with tip dates of 2026-09-01, 2026-09-30 and 2026-08-01
- **WHEN** the group is expanded
- **THEN** the rows read 2026-09-30, then 2026-09-01, then 2026-08-01, and each row shows its age

#### Scenario: A stale branch is shown, not filtered (R8)
- **GIVEN** an unjoined branch whose tip is 400 days old
- **WHEN** the group is expanded
- **THEN** the branch is listed with its age

## Documents and resume

### R1201-6: Documents of a remote branch are read at its SHA through the existing reader

`readHeadDocuments` MUST accept a `{ref}` parameter whose default is `HEAD`, so a call with no argument behaves exactly as before. It MUST also accept an optional `label` (default: the ref) used in provenance stamps. With a ref, it MUST read the change dir's documents with `ls-tree` and `cat-file` at that ref's SHA, through the same reader #1198 defines, so #1198's and #1218's caps and rendering rules apply unchanged. A ref that no longer resolves (a pruned SHA) MUST be reported as unreadable, not as an empty change. A read MUST NOT check out a branch, create a worktree, or touch the working tree or index. For a `grammar` entry, the change dir is the dir under `openspec/changes/` whose name carries the branch's issue number. If that dir does not exist at the SHA, the entry MUST carry `change: {ok:false, state:'missing'}` and MUST NOT be dropped. Document text is read only on demand, by the drawer (D31).

The drawer (D37) MUST show the served HEAD's change first, then up to `REMOTE_DRAWER_CAP = 3` remote blocks, one per remote entry of the issue, each labelled `on origin/<branch> @ <sha12>`. Further entries MUST be listed without documents and said. An entry whose `sha` equals the served HEAD MUST be marked `sameAsServed` and not re-read. A remote block MUST NOT replace the served change.

This requirement modifies R1198-4 (one read path) and R1198-5 (the `{path, commit}` stamp): the reader takes a ref instead of a hardcoded `HEAD`.

#### Scenario: Default ref is unchanged
- **GIVEN** an existing test of the document reader that passes no ref
- **WHEN** `readHeadDocuments` runs
- **THEN** it reads at `HEAD` and returns what it returned before this change

#### Scenario: A remote ref reads that branch's documents
- **GIVEN** a remote branch whose change dir holds `proposal.md` and `spec.md`
- **WHEN** `readHeadDocuments({ref})` runs with the branch's SHA
- **THEN** it returns those two documents and the working tree and index are unchanged

#### Scenario: The drawer shows the served change first, then remote blocks (D37)
- **GIVEN** an issue whose served HEAD has a change dir and whose remote branch has a different commit of it
- **WHEN** the drawer opens
- **THEN** the served HEAD's change is shown first, followed by one block labelled `on origin/<branch> @ <sha12>`, and the served change is not replaced

#### Scenario: The drawer caps remote blocks (D37)
- **GIVEN** five remote entries for the same issue
- **WHEN** the drawer opens
- **THEN** three blocks carry documents, and the other two are listed without documents and the cap is stated

#### Scenario: A branch without its change dir is still listed
- **GIVEN** a grammar branch whose tree holds no `openspec/changes/issue-<N>-*` dir
- **WHEN** `buildSnapshot` runs
- **THEN** the entry is listed with `change` reporting `missing` and its provenance

### R1201-7: The resume.md path is `openspec/changes/<dir>/resume.md` (fixes a defect on main)

Every read of a feature's `resume.md` MUST use the path `openspec/changes/<dir>/resume.md`, where `<dir>` is the change dir (R2). This covers the Working memory tab, the SDD resume row, and every remote read. A read at the branch root path `resume.md` MUST NOT happen. The contract is `feature-working-memory-contract.md`; the writer is `featureCheckpoint` (`brain/scripts/axes/memory/adapters/engram.mjs:1057`, doc comment at :1037). The path in `change-route.mjs` (`readResumeDocument`) MUST be derived from the served snapshot's change dir, not hardcoded at the root.

This requirement modifies R1198-16 (the resume body and its frontmatter) and the resume row of R1198-1: the path moves from the branch root to the contract path.

#### Scenario: A real featureCheckpoint file is found (R2)
- **GIVEN** a fixture whose `resume.md` was produced by calling the real `featureCheckpoint`, and committed at the path the writer chose
- **WHEN** the Working memory route and the SDD resume row read the branch
- **THEN** both find the file and show its fields, and the test never writes the fixture by hand

#### Scenario: The old root path is not read (R2)
- **GIVEN** a branch holding `resume.md` at the repository root and no file at `openspec/changes/<dir>/resume.md`
- **WHEN** the Working memory route and the SDD resume row read the branch
- **THEN** both report the resume as `missing` and neither shows the root file's content

#### Scenario: The test fails against the old path
- **GIVEN** the `featureCheckpoint`-produced fixture and a reader reverted to the root path
- **WHEN** the test runs
- **THEN** it fails, so it is a real detector of the defect

#### Scenario: A real resume appears where "missing" showed before
- **GIVEN** a local feature branch with a `featureCheckpoint`-produced resume
- **WHEN** the Working memory tab opens
- **THEN** the tab shows the resume's fields and not the "missing" wording

### R1201-8: A branch's resume is reported in one of three states with distinct wording

For each grammar entry the section MUST read the branch's `resume.md` and report `resume {state, reason, fields}`, where `state` is exactly one of (AC2):

- `missing`: no file exists at the contract path at the SHA.
- `unreadable`: the entry exists but cannot be read (it is not a regular blob, it exceeds `RESUME_READ_LIMIT = 65536` bytes, or the blob read throws). The reason is one line, at most 200 characters. An ambiguous change dir (more than one dir carries the issue number) is also `unreadable`.
- `invalid`: the file reads but has no frontmatter or `validateResume` throws (a missing `next_action`, `current_slice` or `blockers`). The reason is the one-line cause.
- `deferred`: the branch is over the read budget of the build (R1201-12) and has not been read yet. This is not a failure.

A valid file MUST yield `state: present` with `fields` populated (`checkpointed_from`, `checkpointed_at`, `current_slice`, `next_action`, `blockers`). The UI MUST use different wording for `missing`, `unreadable`, `invalid` and `deferred`, and MUST NOT collapse any two into one message. A failure of one branch's resume MUST NOT affect another branch's entry.

#### Scenario: Missing resume (AC2)
- **GIVEN** a grammar branch with no file at `openspec/changes/<dir>/resume.md`
- **WHEN** the entry is built
- **THEN** `resume.state` is `missing` and the UI says no resume was found for the branch

#### Scenario: Unreadable resume (AC2)
- **GIVEN** a branch whose `resume.md` blob read fails
- **WHEN** the entry is built
- **THEN** `resume.state` is `unreadable`, the reason is one line of at most 200 characters, and the UI wording differs from the missing wording

#### Scenario: Invalid resume (AC2)
- **GIVEN** a branch whose `resume.md` lacks `next_action`
- **WHEN** the entry is built
- **THEN** `resume.state` is `invalid`, the reason names the failure, and the UI wording differs from both other states

#### Scenario: Valid resume
- **GIVEN** a branch whose `resume.md` is produced by `featureCheckpoint`
- **WHEN** the entry is built
- **THEN** `resume.state` is `present` and `fields` carries the five resume fields

#### Scenario: One bad resume does not affect another
- **GIVEN** two branches, one with an invalid `resume.md` and one with a valid one
- **WHEN** the section is built
- **THEN** the first is `invalid`, the second is `present`, and both are listed

## Fetch, prune and the degraded band

### R1201-9: The poller owns the remote fetch

The poller MUST run `git fetch origin --no-tags --prune --no-write-fetch-head` on each tick, asynchronously through `gitRunAsync` (so the server's event loop is never blocked), with `GIT_TERMINAL_PROMPT=0` in the child's environment and a 20 s timeout (R1; D39). A timeout kill MUST be reported as `fetch timed out after 20000 ms`. The fetch MUST run outside `buildSnapshot`, in a remotes lane that is independent of the forge lane in time as well as in failure (D40): a failure of one MUST NOT skip the other, and a tick MUST NOT wait for the fetch before scheduling the next tick or reporting the forge lane. The server MUST expose `POST /api/remotes/refresh`, which runs the same fetch and then recomputes the snapshot; it reuses `once`'s 5 s collapse, so repeated calls within the window run one fetch. The remotes lane MUST NOT depend on the forge: it ticks whenever polling is not paused by the USER (the Pause button or `--no-poll`), including on a server whose forge is unavailable (W3, D40). While the user has paused polling, a tick MUST NOT fetch, and only the explicit action fetches. A tick that finds the fetch still running MUST NOT start a second one. After a fetch the poller MUST recompute and broadcast the snapshot so the new refs appear, including when the fetch ends after the tick that started it. `gitRunAsync` MUST pass the environment so the variable reaches the child without mutating the server's own environment, and its rejected error MUST carry `.stderr` so `gitErrorLine` works unchanged. Fetch has exactly two callers, the timer and the POST route: a recompute or a watch event MUST NOT fetch.

#### Scenario: A tick fetches (AC6)
- **GIVEN** a running poller and a recording git shim
- **WHEN** one tick fires
- **THEN** the shim saw exactly one `fetch origin --no-tags --prune --no-write-fetch-head` with `GIT_TERMINAL_PROMPT=0` in its environment, and the snapshot was recomputed after it

#### Scenario: A user-paused poller does not fetch (AC6)
- **GIVEN** a poller the user paused (`--no-poll` or the Pause button)
- **WHEN** a tick would fire
- **THEN** no fetch ran

#### Scenario: A forge-less server fetches on its timer (W3)
- **GIVEN** a server with no forge provider (`forgeUnavailable` set), polling not paused by the user, and a fixture origin
- **WHEN** the poll timer fires
- **THEN** one fetch ran, the forge lane did not run, and the remotes section shows the new remote branch

#### Scenario: The explicit action fetches while paused (AC6)
- **GIVEN** a paused poller
- **WHEN** `POST /api/remotes/refresh` is called
- **THEN** one fetch ran and the new remote branch appears in the next snapshot

#### Scenario: Refresh calls collapse
- **GIVEN** two `POST /api/remotes/refresh` calls 1 s apart
- **WHEN** both are served
- **THEN** one fetch ran

#### Scenario: A slow fetch never delays the forge lane
- **GIVEN** a poller whose fetch is held open and never settles
- **WHEN** the cold-start tick runs
- **THEN** the next tick is already scheduled, the forge lane polls again on it while the first fetch is still pending, an overlapping tick starts no second fetch, and the fetch's later completion notifies once more so the section recomputes

#### Scenario: A hung fetch is killed at the timeout
- **GIVEN** a fetch child that never exits and a timeout of 200 ms in the test
- **WHEN** the timeout elapses
- **THEN** the child is killed with `SIGKILL`, the fetch rejects with the timeout message, and the server's event loop stayed responsive meanwhile

#### Scenario: A watch event or recompute never fetches
- **GIVEN** a recording git shim and a running server
- **WHEN** a watcher event triggers a recompute
- **THEN** the shim saw no `fetch`

#### Scenario: A credential prompt cannot hang the fetch
- **GIVEN** a remote that would prompt for credentials
- **WHEN** the fetch runs with `GIT_TERMINAL_PROMPT=0`
- **THEN** it fails fast and the failure becomes the degraded band

### R1201-10: A refresh never changes local state beyond remote-tracking refs (R5)

A fetch or refresh MUST NOT run `checkout`, `switch`, `worktree add`, `merge`, `rebase`, `reset`, `pull`, `stash`, or `branch -D`, and MUST NOT write outside `refs/remotes/origin/*` and git's object store. `--no-write-fetch-head` keeps `FETCH_HEAD` unwritten, so every write stays under `refs/remotes` and the object store, which makes AC4 provable. `--prune` MUST delete only remote-tracking refs whose branch was already deleted on the remote, and MUST NOT touch local branches or any working tree (R5). The refresh is read-only toward the user's checkout.

#### Scenario: A refresh runs no write verb (AC4)
- **GIVEN** a recording git shim wrapping a refresh and the snapshot recompute it triggers
- **WHEN** the refresh completes
- **THEN** the recorded calls contain no `checkout`, `worktree add`, `merge`, `rebase`, `reset`, `pull` or `stash`

#### Scenario: A refresh writes only remote-tracking refs (AC4)
- **GIVEN** a repo with local branches, a dirty working tree and a fixture remote with new commits
- **WHEN** a refresh completes
- **THEN** `refs/heads/*`, `HEAD`, the working tree and the index are byte-identical to before, no `FETCH_HEAD` was written, and only `refs/remotes/origin/*` changed

#### Scenario: Prune removes only stale remote-tracking refs (R5)
- **GIVEN** a branch deleted on the remote, a local branch of the same name, and a still-live remote branch
- **WHEN** a refresh completes
- **THEN** the stale `refs/remotes/origin/<name>` is gone, the local branch remains, and the live remote branch remains

### R1201-11: A failed fetch is a degraded band that keeps the last known list and states its age

When the fetch fails, the UI MUST show the degraded band, with the cause from `gitErrorLine`, and MUST keep rendering the last known `remoteChanges` entries. It MUST NOT empty the list (AC6). The band MUST state the age of the refs as "as of <time of the last successful fetch>" (R7). It MUST read the time (`lastOkAt`), the failure (`lastError`) and the fetch in flight from `meta.poller` (D30), never from the `remoteChanges` section. If no fetch has succeeded in this server's life, the band MUST say so, for example "no fetch has succeeded yet". If no fetch has even been attempted and none is running (for example the user paused polling at start), the band MUST say that no fetch has run, so the refs are never silently stale (W3). A later successful fetch MUST clear the band and update the time. A failed fetch MUST NOT break the snapshot or the other sections.

#### Scenario: Failure keeps the list (AC6)
- **GIVEN** a snapshot listing two remote branches and a fetch that then fails with "Could not resolve host"
- **WHEN** the next snapshot is served
- **THEN** both branches are still listed and the degraded band shows the cause

#### Scenario: The band states the refs' age (R7)
- **GIVEN** a last successful fetch at 10:00 and a failing fetch at 10:05
- **WHEN** the band renders
- **THEN** it reads that the remote list is "as of 10:00", in the UI's time format, from `meta.poller` and not from the section

#### Scenario: A fetch that never succeeded says so (R7)
- **GIVEN** a server whose first fetch fails
- **WHEN** the band renders
- **THEN** it says no fetch has succeeded yet, and does not show a time

#### Scenario: A lane that never ran says so (W3)
- **GIVEN** a server whose remotes lane has never attempted a fetch and has none in flight
- **WHEN** the band renders
- **THEN** it says no fetch has run since the server started, shows no time, and points at the refresh control

#### Scenario: Recovery clears the band
- **GIVEN** a degraded band after a failed fetch
- **WHEN** a later fetch succeeds
- **THEN** the band is gone and the "as of" time is the new fetch's time

## Bounds

### R1201-12: Each build reads a bounded number of branches, with an in-memory cache keyed by SHA and issue

`buildSnapshot` MUST accept an injected `_remoteCache` (a Map, default `null`) and a `remoteBudget` (default `REMOTE_READ_BUDGET = 24` branches per build) (D36). For one build, the `remoteChanges` section MUST spawn 2 base `for-each-ref` queries, plus at most 3 spawns per branch read, and MUST read at most 24 branches (at most 2 + 3×24 = 74 spawns per cold build). It MUST read documents and resume only for branches that survive R1201-3's filters and are classified `grammar`; it MUST NOT read `unjoined` branches' trees. The server owns the cache, in memory, keyed by `${sha}:${issue}`; a commit is immutable, so the value is a pure function of the key. Only results derived from git objects MUST be cached, and a read that threw MUST NOT be cached. A warm build, where every branch hits the cache, MUST cost exactly 2 spawns, and MUST deep-equal a cold build with an unlimited budget. The CLI passes no cache and MUST run cold and deterministic. Entries whose SHA has left the listing MUST be evicted on every build.

Cache misses beyond the budget MUST be marked `deferred` (newest `tipAt` first) in both `change` and `resume`, MUST still be listed with `{branch, sha, tipAt, author}`, and MUST be counted in the section's `deferred` field. A deferred branch MUST NOT be reported as `unreadable` and MUST NOT be silently dropped. While `deferred > 0` the server MUST schedule one follow-up recompute after `REMOTE_FOLLOWUP_MS = 1000`, and the chain MUST end when `deferred` reaches 0. The header of `snapshot.mjs` (RULE ZERO) is amended accordingly: the snapshot persists nothing, and an injected in-memory memo of immutable-object reads is allowed.

#### Scenario: The budget holds and the rest is deferred
- **GIVEN** 30 unmerged grammar branches, a cold cache and a recording git shim
- **WHEN** `buildSnapshot` runs
- **THEN** the shim counted at most 74 spawns for the section, 24 branches were read, and the other 6 are listed as `deferred` with `deferred` equal to 6

#### Scenario: A deferred branch is not unreadable
- **GIVEN** a branch over the budget of a cold build
- **WHEN** the entry is built
- **THEN** its `change` and `resume` state is `deferred` with its provenance, and neither is `unreadable`

#### Scenario: Follow-up rebuilds finish the work
- **GIVEN** a server whose first build left `deferred` greater than 0
- **WHEN** 1000 ms elapse
- **THEN** one follow-up recompute runs and the chain stops once `deferred` is 0

#### Scenario: Unjoined branches are not read
- **GIVEN** 30 unmerged unjoined branches and no grammar branch
- **WHEN** `buildSnapshot` runs
- **THEN** the section spawned only its two base queries

#### Scenario: A warm build costs exactly two spawns
- **GIVEN** a server cache that holds every listed branch at its current SHA
- **WHEN** the next snapshot runs
- **THEN** the shim counted exactly 2 spawns for the section, and the section deep-equals a cold unlimited-budget build

#### Scenario: A moved tip misses the cache
- **GIVEN** branch X read at SHA S, then advanced to SHA T by a fetch
- **WHEN** the next snapshot runs
- **THEN** X's change and resume are read again at T

#### Scenario: The cache evicts vanished SHAs
- **GIVEN** a cache holding SHA S for a branch that a prune then removed
- **WHEN** the next snapshot runs
- **THEN** S is no longer held in the cache

#### Scenario: The CLI runs cold
- **GIVEN** the snapshot CLI over the same refs twice
- **WHEN** both runs finish
- **THEN** both outputs are identical and no cache was passed

## Out of scope

- #885, the hub, and any server-to-server sync.
- Sessions: no field or label names one.
- An email-to-handle map: the author is a git author name only.
- #1070's PR-side joining of lane PRs, owned by #1121.
- #883's uncommitted local overlay.
- Checkout, worktree creation, merge or any other write on a refresh.
- Fetching from remotes other than `origin`, or tags.
- Filtering the unjoined group by age (R8).
- Pagination or virtualization of long remote lists.
- Writing to a remote branch or opening a PR from the UI.

## Traceability

| Item | Requirement | Scenarios proving it |
|---|---|---|
| AC1 (two branches listed with `{branch, sha}`, git only) | R1201-1, R1201-6 | Two remote branches are listed with provenance; AC1 needs no forge |
| AC2 (resume missing, unreadable, invalid; distinct wording) | R1201-8 | Missing, Unreadable, Invalid, One bad resume does not affect another |
| AC3 (no session; "last commit by") | R1201-2 | The author wording; No session field exists |
| AC4 (no checkout or worktree add; writes only remote-tracking refs) | R1201-10 | A refresh runs no write verb; A refresh writes only remote-tracking refs |
| AC5 (unjoined group; lane branches hidden) | R1201-3, R1201-5 | Lane branches are hidden; A branch outside the grammar is unjoined; Collapsed by default |
| AC6 (fetch per tick and on action; paused; failure degrades, never empties) | R1201-9, R1201-11 | A tick fetches; A paused poller does not fetch; The explicit action fetches while paused; Failure keeps the list |
| R1 (Approach A, poller-owned fetch, no fetch in the snapshot, `{ref}` reader; plus the `--no-write-fetch-head` addition) | R1201-1, R1201-6, R1201-9 | The snapshot never fetches; A remote ref reads that branch's documents; A credential prompt cannot hang the fetch |
| R2 (resume path fix, real-writer test) | R1201-7 | A real featureCheckpoint file is found; The old root path is not read; The test fails against the old path |
| R3 (author wording, no handle, no session) | R1201-2 | The author wording; No session field exists; An author name with markup is inert |
| R4 (grammar/unjoined/lane/merged filters; collapse with an open PR) | R1201-3, R1201-4, R1201-5 | Lane branches are hidden; A merged branch is hidden; One node for the branch and its PR |
| R5 (prune) | R1201-10 | Prune removes only stale remote-tracking refs |
| R6 (open PR wins; precise definition of merged) | R1201-3 | An open PR wins over merged; An empty or fast-forwarded branch counts as merged |
| R7 (degraded band shows refs' age) | R1201-11 | The band states the refs' age; A fetch that never succeeded says so |
| R8 (unjoined sorted by tip date, shows age, no cutoff) | R1201-5 | Sorted by tip date, newest first; A stale branch is shown, not filtered |
| Snapshot read-only, no fetch (ruling 2) | R1201-1 | The snapshot never fetches |
| `GIT_TERMINAL_PROMPT=0` | R1201-9 | A tick fetches; A credential prompt cannot hang the fetch |
| Bounded reads (24-branch budget, `deferred`), cache keyed by `sha:issue` | R1201-12 | The budget holds and the rest is deferred; A deferred branch is not unreadable; A warm build costs exactly two spawns; A moved tip misses the cache |
| D30 (fetch state in `meta.poller`, not in the section) | R1201-1, R1201-11 | The section carries no fetch state; The band states the refs' age |
| D31 (blob metadata, no document text) | R1201-1, R1201-6 | The section carries blob metadata and no document text |
| D37 (drawer: served HEAD first, up to 3 remote blocks) | R1201-6 | The drawer shows the served change first, then remote blocks; The drawer caps remote blocks |
| D39 (async fetch, `--no-write-fetch-head`, 20 s timeout) | R1201-9, R1201-10 | A tick fetches; A hung fetch is killed at the timeout; A refresh writes only remote-tracking refs |
| Modifies R1198-4, R1198-5 (reader takes a ref) and R1198-16 (resume path) | R1201-6, R1201-7 | Default ref is unchanged; The old root path is not read |
