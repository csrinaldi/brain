---
status: draft
issue: 1201
---

# Design — multidev-remote-branches (issue 1201)

## Technical approach

This design extends #1198 (D1–D14) and #1218 (D15–D29). It contradicts none of them. D7 is amended: the `resume.md` path moves from the branch root to the change dir. D27 is extended: `git-run.mjs` gains an asynchronous runner.

```
poller.mjs  tick ─┬─ forge lane (unchanged)
                  └─ remotes lane: gitRunAsync fetch origin --no-tags --prune --no-write-fetch-head
POST /api/remotes/refresh ─▶ poller.refreshRemotes()   (allowed while paused, 5 s collapse, single flight)
        │ (both settle) ─▶ onTick ─▶ recomputeAndBroadcast ─▶ buildSnapshot
buildSnapshot ─▶ readRemoteChanges({run, prs, cache, budget})   [status/remote-changes.mjs]
   for-each-ref ×2 (listing + --merged) ─▶ classify ─▶ per-branch read at its SHA (cache miss only)
GET /api/change/{N} ─▶ readHeadDocuments({ref: sha, label: origin/<b>}) per remote entry of N
```

Two path corrections to the proposal:
- The snapshot is at `brain/scripts/status/snapshot.mjs`, not `ui/snapshot.mjs`.
- `featureCheckpoint` is at `brain/scripts/axes/memory/adapters/engram.mjs:1057`; its doc comment is at :1037.

## Decisions

| # | Decision | Rejected | Why |
|---|---|---|---|
| D30 | **The section's shape.** `remoteChanges` is `field({base, branches, unjoined, hidden, prsApplied, deferred})` or `uncomputable(reason)` (see Interfaces). Fetch state is NOT in the snapshot. It lives in `poller.state().remotes = {lastAttemptAt, lastOkAt, lastError, inFlight}` and reaches the page through `meta.poller`. | `refsAsOf`/`lastFetch` inside the section | There is precedent: forge freshness (`forgeAsOf`) lives in poller state (`poller.mjs:91,103`) and the band reads it from meta (`banners.mjs:28`). The CLI never fetches, so a fetch field in the section would be a value the CLI must fake (ruling 2). A timestamp that changes on every tick would also make `diffSections` (`diff.mjs:27`) re-send the whole section every 60 s. Without it, the section changes only when the refs or the reads change. |
| D31 | **The entry.** `{branch, sha, tipAt, author, kind, issue, pr, change, resume}`. `tipAt` is the committer date (iso-strict). `author` is `%(authorname)` only, with no email (R3). `change` is `{ok:true, value:{dir, artefacts}}` or `{ok:false, state:'missing'\|'unreadable'\|'deferred', reason}`. `artefacts` maps stage to `{state, blob, bytes}`, with **no text**. `resume` is `{state:'present'\|'missing'\|'unreadable'\|'invalid'\|'deferred', path, reason, fields}`. An unjoined entry carries `change: {ok:false, reason:'outside the branch grammar: no issue to look a change dir up by'}` and `resume: null`. | Document text in the snapshot | About 70 branches × 6 documents × up to 256 KB would go into every `sync` frame. Text is read on demand through the drawer route (D37). |
| D32 | **Enumeration.** Spawn 1: `for-each-ref --format=%(refname)%00%(objectname)%00%(committerdate:iso-strict)%00%(authorname)%00%(symref) refs/remotes/origin/`. The base is `origin/HEAD`'s `%(symref)` from that same listing, falling back to `refs/remotes/origin/main`. Spawn 2: `for-each-ref --format=%(refname) --merged=<base> refs/remotes/origin/`. The rest is classification. | `merge-base --is-ancestor` per branch; `git branch -r --merged` | `--is-ancestor` costs about 120 spawns × 5 ms (measured per spawn) ≈ 0.6 s, against two `for-each-ref` spawns. `--merged` is one revision walk, and its meaning (tip reachable from the base) is R6's "ancestor" exactly. `branch -r` is porcelain output. **Measured by the orchestrator on 2026-10-01 (T0 below):** the listing spawn takes 13 ms and the `--merged` spawn 12 ms. |
| D33 | **Classification, in order.** (1) Hide the base itself and `origin/HEAD`. (2) Hide the prefixes `memory/` and `auto-archive/` (R4, literally a prefix). (3) If merged **and** no open PR, hide. An open PR wins (R6). The open PR is matched by `snapshot.prs` `headBranch === branch`, the cached `mrList` (`snapshot.mjs:366`). (4) If `parseCanonicalIssueBranch` matches, the entry is `joined` with `issue` set; otherwise it is `unjoined`. `hidden` holds counts per rule, never silence. If `prs` is uncomputable, R6 cannot be applied: merged branches are hidden and `prsApplied` carries the reason. An empty listing is `uncomputable('no refs/remotes/origin/* in this clone')`, never `[]`. | A regex per lane (`LANE_BRANCH_RE`) | R4 names the prefixes. |
| D34 | **Order.** `branches` sorts by issue, then branch. `unjoined` sorts by `tipAt` descending, then branch (R8). Age is computed in the page from `tipAt` and the page clock (D9: no clock in `lib/`). | | |
| D35 | **Per-branch read, at its SHA.** For a joined entry there are at most three spawns. (a) `ls-tree -z <sha> -- openspec/changes/`, filtered by `parseChangeId` with `iid === issue`: zero matches is `missing`, more than one is `unreadable` (ambiguous). (b) `--literal-pathspecs ls-tree -l -z <sha> -- <6 stage paths> <dir>/resume.md`. (c) `cat-file blob` for resume only, refused above `RESUME_READ_LIMIT = 65536`. Resume states: `missing` means no entry; `unreadable` means not a regular blob, over the limit, or the read threw; `invalid` means there is no frontmatter or `validateResume` (`resume-schema.mjs:34`) threw, with its message as the reason. `parseTreeListing` moves from `change-route.mjs:229` to a new pure `brain/scripts/lib/git-tree.mjs`, together with `pickChangeDir(names, issue)`, so both readers share one parser. | Importing `ui/change-route.mjs` from `status/` | That would be an inverted layer, and `change-route` pulls in `git-run.mjs` (child_process). |
| D36 | **Budget and cache.** `buildSnapshot` gains `_remoteCache` (a Map, default `null`) and `remoteBudget` (default `REMOTE_READ_BUDGET = 24` branches per build, at most 2 + 3×24 = 74 spawns per cold build). The key is `${sha}:${issue}`. A commit is immutable, so the value is a pure function of the key. Only results derived from git objects are cached; a thrown read is never cached. Entries whose SHA has left the listing are evicted on every build. Cache misses beyond the budget are `deferred` (newest `tipAt` first), and `deferred` counts them. The server owns the Map and passes it in. The CLI passes none, so it is always cold and deterministic. While `deferred > 0` the server schedules one follow-up recompute after `REMOTE_FOLLOWUP_MS = 1000`; the chain ends at 0. RULE ZERO (`snapshot.mjs:4-8`) is amended in its header: the snapshot persists nothing, and an injected in-memory memo of immutable-object reads is allowed. | A cache inside `snapshot.mjs`; no budget | A module-level cache would make the CLI depend on process history. With no budget, a cold build on this repo (48 grammar branches today, 3 spawns each) is about 146 spawns of synchronous event-loop block. |
| D37 | **Drawer reuse (R1).** `readHeadDocuments({run, dir, ref = 'HEAD', label = ref})` runs `rev-parse --verify ${ref}^{commit}` (which also proves a pruned SHA is gone) and is otherwise unchanged. `buildChangeView` adds `remote: [{branch, sha, pr, author, tipAt, dir, documents, resume}]` for the snapshot's entries of this issue, capped at `REMOTE_DRAWER_CAP = 3`; extra entries are listed without documents and said. An entry whose `sha === head` is marked `sameAsServed` and not re-read. | Replacing the served change with the remote one | The two are different commits and neither is more true. The served HEAD stays first, because it is what the operator serves and reviews. Each remote block below it is labelled `on origin/<branch> @ <sha12>`. Replacing would hide exactly the divergence a teammate's push creates. |
| D38 | **The R2 path.** `readResumeDocument` splits in two. (1) `resolveBranch` (unchanged) gives the commit `C`. (2) `readResumeAt({run, commit, issue, label})` lists `openspec/changes/` at `C`, picks the dir with `pickChangeDir`, and reads `<dir>/resume.md`. No dir on the branch gives `missing` with the reason `no change dir for #N on <label>`. The same function serves D37. `shapeResumeView({frontmatter, branch, path})` stamps the source `${branch}:${path}`. `drawer-model.mjs:185` stamps `${ref}:${path}`. | Using the served snapshot's dir | The branch is authoritative for its own tree, and the served HEAD may have no change dir at all. |
| D39 | **The fetch.** `git-run.mjs` exports `gitRunAsync(root)`, which is `(file, args, {timeout, env}) => Promise<stdout>` over promisified `execFile`. It sets `cwd`, `encoding`, `timeout`, `killSignal: 'SIGKILL'` and `env: {...process.env, GIT_TERMINAL_PROMPT: '0'}`. The rejected error carries `.stderr`, so `gitErrorLine` works unchanged. The argv is `fetch origin --no-tags --prune --no-write-fetch-head`. `FETCH_TIMEOUT_MS = 20000`; a kill is reported as `fetch timed out after 20000 ms`. | `execFileSync` with `timeout` | A synchronous fetch takes about 1 s warm and up to the timeout on a bad network, and it blocks the server's event loop, so SSE and HTTP stall on every tick. `--no-write-fetch-head` (git ≥ 2.29) keeps every write inside `refs/remotes/**` and the object store (AC4). It also removes the `FETCH_HEAD` write in the git dir, which the `<git-common>/` watch would otherwise see (`watcher.mjs:315`). |
| D40 | **The remotes lane.** `createPoller({fetchRemotes})`. `tick()` runs the forge lane and the remotes lane with `Promise.allSettled`, each with its own catch, so one failing never skips the other. `onTick` fires after both settle, so the recompute sees the new refs. `refreshRemotes()` is single-flight (it returns the in-flight promise), collapses within `ONCE_COLLAPSE_MS`, works while paused (AC6), and calls `onTick`. A failure sets `lastError` and keeps the refs, which a failed fetch never changed. With `fetchRemotes` absent the lane is a no-op, so existing poller tests are untouched. **The lane is independent of the forge (W3):** the poller keeps `userPaused` (Pause button, `--no-poll`) apart from `forgeHalted` (`initialError`). The timer runs unless the USER paused, so a forge-less server still fetches on its timer while its forge lane never runs; `state().paused` still reports either. If the lane has never attempted a fetch and none is running, the R7 band says so (`meta.poller.remotes.lastAttemptAt` is null). **No feedback loop:** fetch has exactly two callers, the timer and the POST route, and a recompute or watch event never fetches. A test pins this. | | |
| D41 | **Routes.** `POST /api/remotes/refresh` joins `POST_ONLY_PATHS` and `KNOWN_ROUTES` (`server.mjs:57,62`) and answers with the poller state, like `servePollControl`. | | |
| D42 | **UI.** A new pure module, `lib/remote-model.mjs`, provides `remoteBadges(section, issue)` and `remotePanel(section, nodeNumbers, nowMs)` and is the single source for both views. `ago` is exported from `banners.mjs:84`. A card line reads `on origin: <branch> · PR #n · last commit by <author> · <age>`, at most 2 lines plus "and N more". A "Remote work" panel lists joined entries whose issue is not on the board, with their reason, and the unjoined group, collapsed by default (`collapsedTracks`-style page Set), with each row's age. The drawer gets one block per remote entry: the byline, the resume fields with their state wording, and document rows built by the existing `documentView`, stamped `path @ sha12` with ref `origin/<branch>`. The expand path is #1218's worker (`requestDoc`), whose cache key `path@commit` already separates HEAD from remote. `degradationBands` adds `remotes`: `remote branches as of <lastOkAt> — last fetch failed: <reason>`, or `… no fetch has succeeded since this server started; the list is this clone's remote-tracking refs` (R7). A refresh button sits beside the poll controls. Only `el()`/`textContent`/`setAttribute` are used, with NodeList-honest walks (D29). | Rendering inside `lane-model.mjs` | The lane model never receives non-graph sections (`lane-model.mjs:35-38`). |
| D43 | **No session (AC3).** No field or string contains "session". A guard test scans the section JSON, `remote-model` output and the rendered DOM text for `/session/i`. | | |

## Interfaces

```js
// status/remote-changes.mjs
readRemoteChanges({ run, prs, cache = null, budget = REMOTE_READ_BUDGET }) ->
  field({ base: 'origin/main', branches: Entry[], unjoined: Entry[],
          hidden: { base, lane, merged }, prsApplied: true | {ok:false, reason}, deferred: number })
  | uncomputable(reason)
// lib/git-tree.mjs
parseTreeListing(out) -> Map<path,{mode,type,sha,size}>;  pickChangeDir(names, issue) -> {ok,dir}|{ok:false,state,reason}
// git-run.mjs
gitRunAsync(root) -> (file, args, {timeout, env}?) => Promise<string>
// poller.state().remotes = { lastAttemptAt, lastOkAt, lastError, inFlight }
```

## Testing strategy (strict TDD, node:test)

**First RED:** `ui/resume-path.test.mjs`. It creates a real temp repo and branch `feat/issue-7-x` with `openspec/changes/issue-7-x/`, then calls the real `featureCheckpoint('issue-7-x', {root, getTimestamp, getHostname, getBranch: () => 'feat/issue-7-x', _doEngramEnrich: () => {}})`, commits, and runs `buildChangeView` with `gitRun(root)`. It asserts that the resume is `present` at `openspec/changes/issue-7-x/resume.md` with its fields. Today it fails, because the reader looks at the root. Why first: it is the defect on `main`, and every remote resume read depends on it.

| File | Action |
|---|---|
| `test-support/git-remote-fixture.mjs` | Create. Real git: a bare `origin.git`, a pusher clone with pinned `GIT_*_DATE`/name and branches `feat/issue-11-a` and `feat/issue-12-b` (different change dirs; one carries a `featureCheckpoint` resume, one an invalid resume, one none), `memory/h-2026-10-01`, `auto-archive/2026-10-01`, `spike/x`, `feat/issue-13-c` at main's tip, then a served clone. |
| `test-support/recording-git.mjs` | Create. Wraps a sync and an async runner, records argv, and throws on `checkout`, `switch`, `worktree add`, `reset`, `merge`, `pull`, `push`, `update-ref`, and `branch` without `--list`. |
| `status/remote-changes.test.mjs` | Create. AC1 (two branches, `{branch, sha}`); AC5 (unjoined listed, lanes and merged hidden, counts); R6 (a merged branch with an open PR is shown); `prs` uncomputable; ordering; AC2's three resume wordings; ambiguous dir; budget → `deferred`. **Warm costs exactly 2 spawns** (spawn count, not time). A warm build deep-equals a cold, unlimited-budget build. Eviction. |
| `status/snapshot-cli.test.mjs` | Modify. A second one-shape parity test on the fixture's served clone, where the section is `ok`. The text-mode list gains `remote`. |
| `git-run.test.mjs`, `poller.test.mjs`, `server.test.mjs` | Modify. `gitRunAsync`: `.stderr` and the env pass-through; a timeout over `process.execPath -e 'setTimeout(()=>{},1e4)'` with `timeout: 200` rejects within `FETCH_TIMEOUT_TEST_BOUND_MS = 5000`. Poller: tick fetches, paused refresh fetches, the paused timer does not, collapse, single flight, forge failure ≠ fetch skipped. Server: route, KNOWN_ROUTES, AC4 through `recording-git` with a real fetch on the fixture (refs outside `refs/remotes`, HEAD, `worktree list` and `status --porcelain` are byte-identical before and after), and a watch fire never fetches. |
| `change-route.test.mjs`, `static/markdown-render.test.mjs`, `lib/provenance.test.mjs`, `lib/drawer-model.test.mjs`, `lib/resume-view.test.mjs` | Modify. Every root `resume.md` fixture moves to `openspec/changes/<dir>/resume.md`: `change-route.test.mjs:63,91-92,182-184,446,563-564,579,635-637`; `markdown-render.test.mjs:48`; `provenance.test.mjs:109`; `drawer-model.test.mjs:121-135,336,520-529,542,553`; `resume-view.test.mjs:17-26`. Plus D37 (remote blocks, `sameAsServed`, cap). |
| `test-support/fake-git.mjs` | Modify. Adds `ls-tree -z <ref> -- <dir>/` (immediate children) and `for-each-ref` over modelled remote refs. |
| `lib/remote-model.test.mjs`, `lib/banners.test.mjs`, `static/remote-render.test.mjs` | Create or modify. Badges, panel, band wording (R7, both forms), D43 guard, collapsed unjoined group, refresh POST. |

Time is never the primary assertion: spawn counts are. Every bound is a named constant sized for CI (about 3× local), and timings are recorded with `t.diagnostic` (#1218 lesson).

**T0 (measurement, before the constants freeze):**
- On this worktree's real refs, time both `for-each-ref` spawns, a cold build with no budget, and a warm build.
- Record the numbers in `apply-progress.md`.
- **Done.** The orchestrator measured it on 2026-10-01 in this worktree (the design executor had no shell). Results:
  - git 2.53.0, so `--no-write-fetch-head` (git ≥ 2.29) is supported.
  - `for-each-ref refs/remotes/origin --format=...`: 13 ms. `for-each-ref --merged=origin/main`: 12 ms.
  - `origin/HEAD` exists and resolves to `refs/remotes/origin/main`.
  - 48 unmerged branches match the grammar.
  - Reading 24 branches × 3 spawns (`ls-tree`, `ls-tree -l`, `cat-file`), cold: 165 ms.
- Consequences: a budgeted cold build (24 branches, at most 2 + 3×24 = 74 spawns per cold build) costs about 165 ms plus the base reads; the 48 grammar branches here need 2 builds to warm the cache. A warm build costs exactly 2 spawns (about 25 ms). The constants (`REMOTE_READ_BUDGET = 24`, `REMOTE_FOLLOWUP_MS = 1000`) are kept.

## Size (gated, excluding `*.test.mjs`)

| File | Lines |
|---|---|
| `status/remote-changes.mjs` (new) | ~170 |
| `lib/git-tree.mjs` (new) | ~40 |
| `status/snapshot.mjs` | +~20 |
| `ui/change-route.mjs` | +~60 / −~15 |
| `ui/git-run.mjs` | +~25 |
| `ui/poller.mjs` | +~45 |
| `ui/server.mjs` | +~30 |
| `test-support/git-remote-fixture.mjs`, `recording-git.mjs`, `fake-git.mjs` | ~60, ~40, +~25 |
| `ui/lib/remote-model.mjs` (new) | ~90 |
| `lib/banners.mjs`, `drawer-model.mjs`, `resume-view.mjs` | +~15, +~35, +~3 |
| `static/app.js`, `app.css` | +~120, +~25 |

The total is about 840, against the `lite` budget of 1000. The proposal's 500 left out the test-support fixtures and the drawer's remote blocks.

**Split point:**
- **PR 1** (~540): data, fetch and R2. That is `git-tree`, `remote-changes`, the snapshot, change-route, git-run, the poller, the server, and the test-support files.
- **PR 2** (~300): the UI. That is `remote-model`, `banners`, `drawer-model`, `app.js` and `app.css`.

PR 1 is useful alone: the CLI JSON, the route, and the R2 fix.

## Migration / rollout

No migration is required. A revert restores the root path, so a partial revert must keep D38 (proposal Rollback). `--prune` removes only stale remote-tracking refs.

## Risks

- **`--no-write-fetch-head` adds to R1's literal argv.** It needs git ≥ 2.29. The measured git is 2.53.0 (T0). On older git the fetch fails, the band says so, and the list keeps working. The maintainer may veto the flag (see the amendment in the proposal); without it the fetch also writes `FETCH_HEAD`, and AC4's byte-identity check must then exclude that one file.
- **SSH remotes.** `GIT_TERMINAL_PROMPT=0` does not stop ssh's own tty prompts. The timeout (D39) is the guarantee, and a hung ssh costs up to 20 s off-thread, never the event loop.
- **An empty or fast-forwarded feature branch with no open PR reads as merged and is hidden** (R6, by definition). The `hidden.merged` count says how many there are.
- **The snapshot's reads are still synchronous.** A budgeted cold build blocks for about 165 ms (measured, T0), and the follow-up chain repeats this until the cache is warm: 2 builds for the 48 grammar branches measured today.
- **Base resolution.** `origin/HEAD` is absent in some clones; the fallback is `origin/main`. Neither present gives `uncomputable`.
- **A remote entry whose issue is not an open node** (closed, or the forge is down) appears only in the panel, never on a card.
- **The design length** exceeds the skill's 800 words, because the brief asked for ten evidenced sections.
