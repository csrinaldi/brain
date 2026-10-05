---
status: approved
approved: 2026-10-01 (maintainer: rulings R1–R5 and "go through to the PR")
issue: 1201
---

# Proposal — multidev-remote-branches (issue 1201)

## Intent

The UI shows only local SDD work. A teammate's in-flight change, which is committed and pushed to an `origin/*` branch, is invisible until it merges. #1201 makes that work visible from git alone, with no hub (#885 stays deferred). The view is read-only.

Exploration also found a defect on `main`. `brain/scripts/ui/change-route.mjs:311` reads `resume.md` at the branch root. The contract (`feature-working-memory-contract.md:20`) and the writer `featureCheckpoint` (`brain/scripts/axes/memory/adapters/engram.mjs:1057`, doc comment at :1037) use `openspec/changes/<feature>/resume.md`. So the Working memory tab and the SDD resume row never find a real resume. The tests passed only because their fixtures put the file at the root.

## Scope

### In
- A `remoteChanges` snapshot section. For each `refs/remotes/origin/*` branch it records `{branch, sha, tipAt, author}`, a grammar or unjoined classification, per-stage blob metadata of the branch's own change dir (no document text; the drawer reads the text on demand), and `resume {state, reason, fields}`.
- A remote fetch owned by the poller: `git fetch origin --no-tags --prune --no-write-fetch-head` on each tick, asynchronous through `gitRunAsync` with a 20 s timeout, plus `POST /api/remotes/refresh`. Fetch state reaches the page through `meta.poller`, not through the section.
- `readHeadDocuments({ref})`, so #1198's reader serves remote refs.
- The `resume.md` path fix (R2) for the local and remote reads.
- UI: remote work attached to its ticket node, a "last commit by <name>" line, and a collapsed "unjoined" group.

### Out
- #885, the hub.
- Sessions. No value names a session, because no session field exists.
- An email-to-handle map.
- #1070's PR-side joining of lane PRs. #1121 owns it.
- #883's uncommitted local overlay.
- Checkout, worktree creation, or any write on a refresh.

## Maintainer rulings (2026-10-01, binding)

| # | Ruling |
|---|---|
| R1 | **Approach A.** The `remoteChanges` section reads `refs/remotes/origin/*` with NO fetch, so the snapshot stays local and read-only (#878 ruling 2). The poller owns the fetch: `git fetch origin --no-tags --prune` with `GIT_TERMINAL_PROMPT=0` on each tick, plus `POST /api/remotes/refresh`. *Amendment (design D39, 2026-10-01): the argv also carries `--no-write-fetch-head` (git >= 2.29; measured git is 2.53.0). It keeps every write under `refs/remotes` and the object store, which makes AC4 provable. This is an addition to the ruling's literal argv, and the maintainer may veto it.* `readHeadDocuments` gains a `{ref}` parameter so #1198's reader is reused. |
| R2 | Fix the `resume.md` path in this change. The Working memory tab, the SDD resume row and every remote read use `openspec/changes/<feature>/resume.md`. A test reads the path that the real writer (`featureCheckpoint`) produces, not one a fixture invents. |
| R3 | **Who.** Show the tip commit's git author, labelled as such ("last commit by <name>"), never as a brain handle. No email-to-handle mapping. No session. |
| R4 | **Which branches.** Grammar branches not merged into `origin/main` are shown, attached to their ticket node. The lane branches `memory/*` and `auto-archive/*` are hidden. Other unmerged branches outside the grammar go into an "unjoined" group, collapsed by default. Merged branches are hidden. A branch with an open PR collapses into one node with that PR. |
| R5 | **Prune.** The fetch uses `--prune`. It deletes only remote-tracking refs for branches already deleted on the remote, and never touches local branches or working trees. |

## Capabilities

- **New:** `remote-change-visibility`. It covers the section shape, the branch classification (R4), provenance, the three resume states, the fetch triggers and the degraded band.
- **Modified:** `sdd-artifact-reader` (#1198, not yet archived to `openspec/specs/`). The `resume.md` path moves to the contract path (R2), and the document reader takes a ref.

## Approach

**Option A (chosen, R1).**
- **Snapshot.** `readRemoteChanges({run, prs, cache, budget})` (`brain/scripts/status/remote-changes.mjs`) runs one `for-each-ref` listing (13 ms measured) and one `for-each-ref --merged=<base>` query (12 ms measured). It classifies each branch with `parseCanonicalIssueBranch` (`lib/branch-grammar.mjs`). Only unmerged grammar branches are read further, at most 24 per build (design D36); the rest are `deferred` and the server schedules follow-up rebuilds. A failure yields `uncomputable(reason)`.
- **Documents.** The section holds per-stage blob metadata only. The drawer reads the text on demand through `readHeadDocuments({ref})`, showing the served HEAD's change first and then up to 3 remote blocks labelled `on origin/<branch> @ sha12`. `resume.md` is checked with `validateResume`, giving three states with distinct wording: `missing`, `unreadable` and `invalid`.
- **Fetch.** `poller.mjs` runs the fetch through `gitRunAsync` on each tick, with a 20 s timeout. `/api/remotes/refresh` reuses `once`'s 5 s collapse. While polling is paused, only the explicit action fetches. A fetch failure sets the band to degraded and keeps the last known refs. It never empties the list.
- **Join.** Nodes are keyed by issue and branch. A PR whose `headBranch` equals the remote branch collapses into the same node.

**Rejected:**
- **B, drawer-only.** It reads a remote branch only when its drawer opens. A teammate's work then cannot appear on the board, which is the point of #1201. It also gives no list in which an unjoined branch can be shown rather than dropped (AC5).
- **C, fetch inside the snapshot.** It puts network I/O and a ref write inside `buildSnapshot`, which is synchronous, local and read-only by ruling (#878 ruling 2). Every snapshot would then cost about 1 s and could fail on the network.

## Affected areas

| Path | Impact |
|---|---|
| `brain/scripts/status/snapshot.mjs` | Modified. Adds the `remoteChanges` section, the `_remoteCache` and `remoteBudget` inputs. |
| `brain/scripts/status/remote-changes.mjs`, `brain/scripts/lib/git-tree.mjs` | New. `readRemoteChanges`, and the shared tree parser. |
| `brain/scripts/ui/change-route.mjs` | Modified. `readHeadDocuments({ref})`, the `resume.md` path fix (:311) and the three resume states. |
| `brain/scripts/ui/poller.mjs` | Modified. Fetch on each tick. |
| `brain/scripts/ui/server.mjs` | Modified. `POST /api/remotes/refresh` and the fetch wiring. |
| `brain/scripts/ui/git-run.mjs` | Modified. Adds `gitRunAsync`, which passes an env (`GIT_TERMINAL_PROMPT=0`) and a timeout. |
| `brain/scripts/ui/lib/drawer-model.mjs`, `lib/resume-view.mjs`, view-model | Modified. Provenance, author line, unjoined group. |
| `brain/scripts/ui/static/app.js` | Modified. Remote badge, drawer provenance, collapsed unjoined group. |
| `*.test.mjs`, a bare-remote fixture and a recording git shim | New or modified. |

## Risks

| Risk | L | Mitigation |
|---|---|---|
| The fetch costs about 1 s per 60 s tick | Med | It runs in the poller, outside `buildSnapshot`, and does not block the snapshot. Pausing polling stops it. |
| A private remote prompts for credentials and hangs | Med | `GIT_TERMINAL_PROMPT=0` makes it fail fast. The failure becomes the degraded band, with the cause from `gitErrorLine`. |
| An open feature branch looks merged (an empty branch, or one fast-forwarded into `origin/main`) and is hidden | Med | Design defines "merged" precisely. An open PR on the branch keeps it visible. |
| More git spawns per snapshot (about 5 ms each; 48 unmerged grammar branches today) | Med | Read only unmerged grammar branches, at most 24 per build; the rest are `deferred` and follow-up rebuilds finish them. The server caches by `sha:issue`, so a warm build costs exactly 2 spawns. Measured: 24 branches cold cost 165 ms. |
| The R2 fix changes what the Working memory tab shows: a real resume appears where "missing" did before | Low | This is the intended change. It is noted in the PR, and the test uses the path `featureCheckpoint` writes. |

## Size forecast

About 500 changed lines, excluding tests, against the `lite` budget of 1000. If a split is needed:
1. Data and fetch: the section, the ref parameter, the R2 fix, the poller and the route.
2. UI.

## Rollback

Revert the PR. No data migration, config change or dependency. `--prune` removes only stale remote-tracking refs, which the next fetch restores, so no local state is lost. A revert also restores the root `resume.md` path. A partial rollback must keep R2.

## Success criteria (mapped to the acceptance criteria)

- [ ] AC1. With two `origin/*` fixture branches carrying different `openspec/changes/**`, the snapshot lists both with `{branch, sha}` provenance. It uses git alone, a bare fixture remote and no forge.
- [ ] AC2. A branch's `resume.md` that is missing, unreadable, or fails `validateResume` is reported, with distinct wording for each.
- [ ] AC3. No value in the section or in the UI names a session. The author is labelled "last commit by".
- [ ] AC4. A recording git shim shows that a refresh never runs `checkout` or `worktree add`, and never writes outside remote-tracking refs.
- [ ] AC5. A branch outside the grammar appears in the unjoined group. The `memory/*` and `auto-archive/*` lane branches are hidden.
- [ ] AC6. The fetch runs on each poller tick and on the explicit action. With polling paused, only the explicit action fetches. A fetch failure gives a degraded band, never an empty list.
- [ ] R2. The Working memory tab and the SDD resume row read `openspec/changes/<feature>/resume.md`. The test fixture is produced by `featureCheckpoint`, and it fails against the old root path.

## Proposal question round

R1–R5 settle the main decisions. These items still need maintainer review:
- Does a branch with an open PR stay visible when the merge check calls it merged, or does the merge check win?
- When the fetch fails, does the degraded band show how old the last known refs are (the time of the last successful fetch)?
- Should the unjoined group show stale branches (no commit in N days), or only a count?

### Answers to the question round (orchestrator defaults, 2026-10-01)

The maintainer approved R1–R5 and asked to proceed through to the PR. These three defaults follow from the rulings, and the maintainer may override any of them:

| # | Default |
|---|---|
| R6 | **An open PR wins over "merged".** A branch with an open PR is never hidden as merged. It is shown on its ticket node with the PR. "Merged" (hidden) means: no open PR, and the tip is an ancestor of `origin/main`. |
| R7 | **The degraded band states the age of the refs.** When a fetch fails, the band says the remote list is "as of <time of the last successful fetch>". A fetch that never succeeded says so. |
| R8 | **Stale unjoined branches are shown, never filtered by age.** The "unjoined" group is collapsed. It is sorted by tip date, newest first, and each row shows its tip age. No age cutoff applies; R4's merged and lane rules are the only filters. |

### Delivery (maintainer, 2026-10-01)

**R9: a single PR, under a size exception.** Design forecasts about 840 gated lines, and #1218 grew about 47% across its review rounds, so this change may exceed the `lite` budget of 1000. The maintainer ruled that it ships as ONE PR rather than being split into data and UI. If the gated diff exceeds 1000, the PR carries the `size:exception` label, which `lite` honours, and the PR description states why. The split point in the size forecast is kept for reference only.
