---
status: draft
issue: 1201
---

# Tasks — multidev-remote-branches (issue 1201)

Delivery: ONE PR (R9, `delivery_strategy: exception-ok`). If the gated diff exceeds 1000 lines, the PR carries `size:exception` and its description says why. No chained PRs.

Conventions:
- Strict TDD, `node:test`. Single file: `node --test <file>`. Full run: `npm test`.
- Every group is ordered RED (failing test written and seen failing for the right reason), GREEN (smallest change that passes), REFACTOR (clean up with the tests green).
- Paths are relative to `brain/scripts/` unless they start with `brain/` or `openspec/`.
- A timing bound is always a named constant sized for a CI runner (about 3x local), never a literal. Spawn counts are the primary assertion; timings go to `t.diagnostic` (#1218 lesson).
- Tasks are sequential unless marked `[P]` (parallel-safe: disjoint files, no shared fixture edits).
- T0 (measurement) is done and recorded in `design.md`: git 2.53.0, listing 13 ms, `--merged` 12 ms, 24 branches cold 165 ms. Copy the numbers into `apply-progress.md` when it is created.

## Phase 1 — R2: the resume path (fixes the defect on main)

Satisfies R1201-7. D38.

- [x] 1.1 RED. Create `ui/resume-path.test.mjs`. Build a real temp repo, branch `feat/issue-7-x`, dir `openspec/changes/issue-7-x/`. Call the real `featureCheckpoint('issue-7-x', {root, getTimestamp, getHostname, getBranch: () => 'feat/issue-7-x', _doEngramEnrich: () => {}})` from `brain/scripts/axes/memory/adapters/engram.mjs`, commit, then run `buildChangeView` with `gitRun(root)`. Assert resume `present` at `openspec/changes/issue-7-x/resume.md` with its five fields. Add: a root-only `resume.md` yields `missing` and its content is not shown; no change dir yields `missing` with `no change dir for #7 on <label>`. Run it and confirm it fails because the reader looks at the root. (R1201-7: real-writer scenario, old-root scenario, detector scenario)
- [x] 1.2 GREEN. In `ui/change-route.mjs` (`readResumeDocument`, ~:311) split into `readResumeAt({run, commit, issue, label})` (list `openspec/changes/` at the commit, pick the dir, read `<dir>/resume.md`) and `shapeResumeView({frontmatter, branch, path})` stamping `${branch}:${path}`. `resolveBranch` is unchanged. Keep the old `parseTreeListing` local for now (moved in 2.x). (R1201-7)
- [x] 1.3 GREEN. Migrate the fixtures that put `resume.md` at the root to `openspec/changes/<dir>/resume.md`: `ui/change-route.test.mjs` (:63, 91-92, 182-184, 446, 563-564, 579, 635-637), `ui/static/markdown-render.test.mjs` (:48), `ui/lib/provenance.test.mjs` (:109), `ui/lib/drawer-model.test.mjs` (:121-135, 336, 520-529, 542, 553; also `drawer-model.mjs:185` stamp as `${ref}:${path}`), `ui/lib/resume-view.test.mjs` (:17-26). Extend `ui/test-support/fake-git.mjs` with `ls-tree -z <ref> -- <dir>/` (immediate children) if the migrated fixtures need it. Run the touched files, then `npm test` for the ui tree. (R1201-7)
- [x] 1.4 REFACTOR. Remove any dead root-path helper left in `ui/change-route.mjs`; confirm no read of a branch-root `resume.md` remains (`rg "resume.md" brain/scripts/ui`). (R1201-7)

## Phase 2 — `lib/git-tree.mjs` (pure)

Satisfies R1201-6, R1201-8. D35. Depends on 1.x.

- [x] 2.1 RED. Create `lib/git-tree.test.mjs`: `parseTreeListing` over `ls-tree -z` and `ls-tree -l -z` output (modes, types, sha, size, paths with spaces) and `pickChangeDir(names, issue)` (one match, none, ambiguous with `state:'unreadable'`). Seen failing (module absent).
- [x] 2.2 GREEN. Create `lib/git-tree.mjs` exporting `parseTreeListing(out) -> Map<path,{mode,type,sha,size}>` and `pickChangeDir(names, issue) -> {ok,dir}|{ok:false,state,reason}` (uses `parseChangeId`). Move `parseTreeListing` out of `ui/change-route.mjs:229` and import it there; `change-route` and `remote-changes` share one parser. (R1201-6, R1201-8)
- [x] 2.3 REFACTOR. Point `ui/change-route.mjs`'s dir pick at `pickChangeDir`; run `ui/change-route.test.mjs` and `lib/git-tree.test.mjs` green.

## Phase 3 — `status/remote-changes.mjs` (`readRemoteChanges`)

Satisfies R1201-1, 2, 3, 4 (data half), 8. D31-D35. Depends on 2.x.

- [x] 3.1 Test-support (no behaviour, enables the REDs). Create `ui/test-support/git-remote-fixture.mjs` (real git: bare `origin.git`; pusher clone with pinned `GIT_*_DATE` and author name; branches `feat/issue-11-a` and `feat/issue-12-b` with different change dirs, one carrying a `featureCheckpoint` resume, one an invalid resume, one none; `memory/h-2026-10-01`; `auto-archive/2026-10-01`; `spike/x`; `feat/issue-13-c` at main's tip; then a served clone). Create `ui/test-support/recording-git.mjs` (wraps a sync and an async runner, records argv, throws on `checkout`, `switch`, `worktree add`, `reset`, `merge`, `pull`, `push`, `update-ref`, and `branch` without `--list`). Extend `ui/test-support/fake-git.mjs` with `for-each-ref` over modelled remote refs. [P] with 3.2 only if the files are disjoint.
- [x] 3.2 RED. Create `status/remote-changes.test.mjs`, first the listing and classification cases (each seen failing):
  - AC1: two grammar branches listed with `{branch, sha}`, change documents from their own dir only (R1201-1).
  - Lane branches `memory/*`, `auto-archive/*` hidden, with `hidden.lane` count (R1201-3).
  - Merged branch hidden; empty/fast-forwarded branch (`feat/issue-13-c`) hidden as merged (R1201-3).
  - Open PR wins over merged, matched by `headBranch` (R6, R1201-3); a closed-PR merged branch stays hidden.
  - Grammar vs unjoined (`spike/x`), `hidden` counts `{base, lane, merged}` (R1201-3).
  - `prs` uncomputable: merged hidden, `prsApplied` carries the reason (D33).
  - Empty listing and a throwing `for-each-ref` yield `uncomputable(reason)`, never `[]` (R1201-1).
  - Base is `origin/HEAD`'s symref, falling back to `origin/main`; neither present is `uncomputable`.
- [x] 3.3 GREEN. Create `status/remote-changes.mjs`: the two `for-each-ref` calls (listing with `%(refname)%00%(objectname)%00%(committerdate:iso-strict)%00%(authorname)%00%(symref)`, and `--merged=<base>`), classification in D33 order, entry shape `{branch, sha, tipAt, author, kind, issue, pr, change, resume}` with `author` as name only (no email, no session key). No `fetch`, `pull`, `ls-remote` or ref write anywhere in the module. (R1201-1, R1201-2, R1201-3)
- [x] 3.4 RED then GREEN. Ordering and the PR collapse data: `branches` sorted by issue then branch; `unjoined` by `tipAt` descending then branch (D34, R1201-5 data); entry carries `pr` for an open PR with the same `headBranch` and never produces two entries for one branch (R1201-4).
- [x] 3.5 RED then GREEN. Blob metadata with no text: per-stage `{state, blob, bytes}` via `ls-tree -z <sha> -- openspec/changes/` and `--literal-pathspecs ls-tree -l -z <sha> -- <6 stage paths> <dir>/resume.md`; serialize the section and assert it contains no document text; a grammar branch without its change dir gives `change: {ok:false, state:'missing'}` and stays listed; an ambiguous dir gives `unreadable`; an unjoined entry carries the D31 `change`/`resume: null` shape and its tree is never read (R1201-1, R1201-6, R1201-12). The section carries no fetch state: byte-identical across two builds over unchanged refs (D30).
- [x] 3.6 RED then GREEN. Resume states (R1201-8): `present` (real `featureCheckpoint` file, five fields); `missing`; `unreadable` (not a regular blob, over `RESUME_READ_LIMIT = 65536`, or `cat-file` throws; reason one line, at most 200 chars); `invalid` (no frontmatter or `validateResume` throws, message as reason); one bad resume does not affect another entry.
- [x] 3.7 REFACTOR. Extract the per-branch reader and the classifier into small pure functions inside the module; no behaviour change; run `status/remote-changes.test.mjs` green.

## Phase 4 — Budget, cache, snapshot wiring

Satisfies R1201-1, R1201-12. D36. Depends on 3.x.

- [x] 4.1 RED. Extend `status/remote-changes.test.mjs` using `recording-git` spawn counts:
  - 30 unmerged grammar branches, cold cache: at most 74 spawns, 24 read, 6 `deferred` (newest `tipAt` first), section `deferred` equals 6.
  - A deferred branch has `change`/`resume` state `deferred`, never `unreadable`, and keeps `{branch, sha, tipAt, author}`.
  - 30 unjoined branches and no grammar branch: exactly the 2 base spawns.
  - Warm cache (every `${sha}:${issue}` present): exactly 2 spawns, and the section deep-equals a cold unlimited-budget build.
  - A moved tip (new SHA) misses the cache and is read again; a thrown read is never cached; entries whose SHA left the listing are evicted on every build.
  Name constants (`REMOTE_READ_BUDGET = 24`, `REMOTE_FOLLOWUP_MS = 1000`); no wall-clock assertion.
- [x] 4.2 GREEN. Implement budget, `${sha}:${issue}` cache, deferral and eviction in `status/remote-changes.mjs`. (R1201-12)
- [x] 4.3 RED. `status/snapshot-cli.test.mjs`: add a second one-shape parity test on the fixture's served clone, where `remoteChanges` is `ok`; add `remote` to the text-mode section list; assert the CLI passes no cache and two runs over the same refs produce identical output ("The CLI runs cold"). Also a `snapshot` test that the snapshot spawns no `fetch`/`pull`/`ls-remote`/`remote update` and never touches the vcs for this section, and that a branch pushed after the last fetch is absent ("The snapshot never fetches"). (R1201-1, R1201-12)
- [x] 4.4 GREEN. `status/snapshot.mjs`: add the `remoteChanges` section calling `readRemoteChanges({run, prs: <mrList result>, cache: _remoteCache, budget: remoteBudget})`; accept `_remoteCache` (default `null`) and `remoteBudget` (default 24); amend the RULE ZERO header (:4-8): the snapshot persists nothing, an injected in-memory memo of immutable-object reads is allowed. (R1201-1, R1201-12)
- [x] 4.5 GREEN. `ui/server.mjs`: own the in-memory cache Map and pass it into `buildSnapshot`; while `deferred > 0` schedule one follow-up recompute after `REMOTE_FOLLOWUP_MS`, ending the chain at 0. Test in `ui/server.test.mjs` with an injectable timer: first build leaves `deferred > 0`, one follow-up runs, chain stops at 0. A watch-triggered recompute never fetches (recording shim). (R1201-12, R1201-9)
- [x] 4.6 REFACTOR. Keep `diffSections` behaviour intact (the section carries no timestamp, D30); run `status/` and `ui/server.test.mjs` green.

## Phase 5 — `gitRunAsync`, poller remotes lane, refresh route

Satisfies R1201-9, 10, 11 (data). D39-D41. Depends on 4.x (server wiring).

- [x] 5.1 RED. `ui/git-run.test.mjs`: `gitRunAsync` rejects with an error that carries `.stderr` (so `gitErrorLine` works unchanged); `env` reaches the child (`GIT_TERMINAL_PROMPT=0`) without mutating `process.env`; a child that never exits (`process.execPath -e 'setTimeout(()=>{},1e4)'`) with `timeout: 200` is killed with `SIGKILL` and rejects with `fetch timed out after 20000 ms`-style wording from the caller, within a named `FETCH_TIMEOUT_TEST_BOUND_MS = 5000`; the event loop stays responsive meanwhile (a 20 ms interval keeps ticking). (R1201-9)
- [x] 5.2 GREEN. `ui/git-run.mjs`: export `gitRunAsync(root)` over promisified `execFile` with `cwd`, `encoding`, `timeout`, `killSignal: 'SIGKILL'`, `env: {...process.env, GIT_TERMINAL_PROMPT: '0'}`. Export `FETCH_TIMEOUT_MS = 20000`. (R1201-9)
- [x] 5.3 RED. `ui/poller.test.mjs` with an injected `fetchRemotes`: a tick fetches once and `onTick` fires after both lanes settle; a paused timer tick does not fetch; `refreshRemotes()` fetches while paused; two refreshes within `ONCE_COLLAPSE_MS` run one fetch; single flight (a tick during an in-flight fetch does not start a second); a failing forge lane does not skip the fetch and vice versa (`Promise.allSettled`); failure sets `state().remotes.lastError` and keeps `lastOkAt`; success sets `lastOkAt` and clears `lastError`; `fetchRemotes` absent is a no-op (existing tests untouched). (R1201-9, R1201-11)
- [x] 5.4 GREEN. `ui/poller.mjs`: `createPoller({fetchRemotes})`, remotes lane per D40, `refreshRemotes()`, `state().remotes = {lastAttemptAt, lastOkAt, lastError, inFlight}` exposed through `meta.poller`. (R1201-9, R1201-11)
- [x] 5.5 RED. `ui/server.test.mjs`:
  - `POST /api/remotes/refresh` is in `POST_ONLY_PATHS` and `KNOWN_ROUTES` (update the route-list assertion) and answers with the poller state; GET is refused.
  - Refresh while paused fetches and the new remote branch appears in the next snapshot; two calls 1 s apart run one fetch.
  - A tick runs exactly one `fetch origin --no-tags --prune --no-write-fetch-head` with `GIT_TERMINAL_PROMPT=0`, and the snapshot is recomputed after it.
  - AC4 through `recording-git` with a real fetch on the fixture: no `checkout`, `switch`, `worktree add`, `merge`, `rebase`, `reset`, `pull`, `stash`; `refs/heads/*`, `HEAD`, `worktree list` and `status --porcelain` byte-identical before and after on a dirty working tree; no `FETCH_HEAD`; only `refs/remotes/origin/*` changed.
  - Prune removes only the stale `refs/remotes/origin/<name>`; the same-named local branch and live remote branch remain.
  - A failed fetch ("Could not resolve host") keeps the last list; `meta.poller` carries cause and `lastOkAt`; recovery clears the error.
  (R1201-9, R1201-10, R1201-11)
- [x] 5.6 GREEN. `ui/server.mjs`: wire `fetchRemotes` (argv `fetch origin --no-tags --prune --no-write-fetch-head`, `gitRunAsync`, `FETCH_TIMEOUT_MS`), add the route in `POST_ONLY_PATHS` and `KNOWN_ROUTES` (:57,62), `servePollControl`-style handler. Fetch has exactly two callers: the timer and the POST route. (R1201-9, R1201-10)
- [x] 5.7 REFACTOR. Share the collapse and single-flight helper between `once` and `refreshRemotes` if it removes duplication; all poller and server tests green.

## Phase 6 — `readHeadDocuments({ref, label})` and the drawer's remote blocks

Satisfies R1201-6. D37. Depends on 2.x, 3.x.

- [x] 6.1 RED. `ui/change-route.test.mjs`: with no `ref` the reader returns exactly what it returned before (existing tests unchanged); with a remote SHA it returns that branch's documents and leaves the working tree and index untouched; a pruned or unknown SHA is `unreadable`, not an empty change; provenance stamps use `label`. (R1201-6)
- [x] 6.2 GREEN. `ui/change-route.mjs`: `readHeadDocuments({run, dir, ref = 'HEAD', label = ref})`, starting with `rev-parse --verify ${ref}^{commit}`. (R1201-6)
- [x] 6.3 RED. Drawer tests (`ui/change-route.test.mjs`, `ui/lib/drawer-model.test.mjs`, `ui/lib/provenance.test.mjs`): served HEAD's change first, then one block per remote entry of the issue labelled `on origin/<branch> @ <sha12>`; served change never replaced; cap `REMOTE_DRAWER_CAP = 3` with the other entries listed without documents and the cap stated (5 entries gives 3 + 2); an entry whose `sha` equals the served head is `sameAsServed` and not re-read; each remote block carries `{branch, sha, pr, author, tipAt, dir, documents, resume}`, with resume read through `readResumeAt`. (R1201-6, R1201-7)
- [x] 6.4 GREEN. `ui/change-route.mjs` `buildChangeView`: add `remote: [...]` from the snapshot's entries of this issue. `ui/lib/drawer-model.mjs` and `ui/lib/resume-view.mjs`: render model for remote blocks (byline, resume state wording, document rows via existing `documentView`, stamp `path @ sha12`, ref `origin/<branch>`). (R1201-6)
- [x] 6.5 REFACTOR. Dedupe the resume view shaping between the served block and remote blocks; tests green.

## Phase 7 — UI: model, badges, panel, unjoined group, R7 band

Satisfies R1201-2, 3, 4, 5, 8, 11. D42, D43. Depends on 6.x, 5.x (meta.poller). Files in 7.1-7.3 are disjoint from 7.4-7.5 and may be done in parallel `[P]` until the app.js wiring (7.6).

- [x] 7.1 RED. Create `ui/lib/remote-model.test.mjs`: `remoteBadges(section, issue)` (card line `on origin: <branch> · PR #n · last commit by <author> · <age>`, at most 2 lines plus "and N more"); `remotePanel(section, nodeNumbers, nowMs)` (joined entries whose issue is not on the board with their reason; unjoined sorted by `tipAt` desc, each with age, header with count, collapsed by default, a 400-day-old branch still listed); distinct wording for `missing`, `unreadable`, `invalid`, `deferred` resume states; author wording is exactly "last commit by <name>" with no handle and no email; no output matches `/session/i` (D43/AC3). (R1201-2, 3, 4, 5, 8) [P] with 7.4
- [x] 7.2 GREEN. Create `ui/lib/remote-model.mjs` (pure, no clock: `nowMs` injected; reuse `ago` exported from `lib/banners.mjs:84`). (R1201-2, R1201-5)
- [x] 7.3 REFACTOR. Single source for both card and drawer wording; tests green.
- [x] 7.4 RED. `ui/lib/banners.test.mjs`: `degradationBands` gains `remotes` from `meta.poller.remotes` only (never from the section): `remote branches as of <lastOkAt> — last fetch failed: <reason>`; the never-succeeded form `no fetch has succeeded since this server started; the list is this clone's remote-tracking refs` with no time shown; recovery clears the band and shows the new time; the cause comes from `gitErrorLine`. (R1201-11) [P] with 7.1
- [x] 7.5 GREEN. `ui/lib/banners.mjs`: add the `remotes` band. (R1201-11)
- [x] 7.6 RED. Create `ui/static/remote-render.test.mjs` (same DOM harness as the existing render tests): remote badge on the ticket node; one node for a branch and its open PR showing both (R1201-4), and a branch with no PR standing alone; the "Remote work" panel and the unjoined group collapsed with its count, expanding on click; an author name `<img src=x onerror=alert(1)>` renders as literal text and creates no element; drawer remote blocks with provenance; the refresh button POSTs `/api/remotes/refresh`; no rendered text, key or label matches `/session/i`; lane branches and merged branches appear in no list or count. (R1201-2, 3, 4, 5, 11)
- [x] 7.7 GREEN. `ui/static/app.js` and `ui/static/app.css`: remote badge, "Remote work" panel, collapsed unjoined group (page Set, `collapsedTracks`-style), drawer remote blocks, refresh button beside the poll controls. Use only `el()`/`textContent`/`setAttribute`, with NodeList-honest walks (D29); expand path stays #1218's worker (`requestDoc`, cache key `path@commit`). (R1201-2, 4, 5, 6, 11)
- [x] 7.8 REFACTOR. Remove duplicated formatting between `app.js` and `remote-model.mjs`; run `ui/static/*.test.mjs` and `ui/lib/*.test.mjs` green.

## Phase 8 — Guards and final gates

Satisfies the whole spec's traceability. Depends on everything above.

- [x] 8.1 Guards. Update the route-list test and `KNOWN_ROUTES` expectation for `POST /api/remotes/refresh` (if not already green from 5.5). Add or extend the source guards: no `fetch`/`pull`/`ls-remote`/`remote update` literal in `status/remote-changes.mjs` or `status/snapshot.mjs`; `app.js` adds no `innerHTML`/`insertAdjacentHTML` for remote data; no `/session/i` in the new modules' output. (R1201-1, R1201-2, R1201-9)
- [x] 8.2 Full run: `npm test` green. Record the spawn counts and the `t.diagnostic` timings in `apply-progress.md`; confirm every timing bound is a named constant sized for CI.
- [x] 8.3 Run `npm run brain:repo:check` clean (no prohibited references).
- [x] 8.4 Size check. Measure the gated diff (excluding `*.test.mjs`, `.memory`, `openspec/changes/**`). If over 1000, add the `size:exception` label to the PR and state why in the description (R9). Do not split.
- [ ] 8.5 PR notes (human-gated, Tier 2): the PR description states the R2 behaviour change (a real resume appears where "missing" showed before), the `--no-write-fetch-head` addition to R1's argv (maintainer may veto), and the single-PR size ruling. No AI attribution in commits or the body.

## Traceability

| Requirement | Tasks |
|---|---|
| R1201-1 | 3.2, 3.3, 3.5, 4.3, 4.4, 8.1 |
| R1201-2 | 3.3, 7.1, 7.2, 7.6, 7.7, 8.1 |
| R1201-3 | 3.2, 3.3, 7.6 |
| R1201-4 | 3.4, 7.1, 7.6, 7.7 |
| R1201-5 | 3.4, 7.1, 7.2, 7.6, 7.7 |
| R1201-6 | 2.2, 3.5, 6.1-6.4 |
| R1201-7 | 1.1-1.4, 6.3 |
| R1201-8 | 2.1, 2.2, 3.6, 7.1 |
| R1201-9 | 4.5, 5.1-5.6, 8.1 |
| R1201-10 | 5.5, 5.6 |
| R1201-11 | 5.3-5.5, 7.4-7.7 |
| R1201-12 | 3.5, 4.1-4.5 |

## Micro-decisions made on the fly

(none yet — record here, then promote through the consolidation protocol)

## Review Workload Forecast

- Estimated changed lines, excluding `*.test.mjs` and `openspec/changes/**`: about 840 (design size table: new `remote-changes.mjs` ~170, `git-tree.mjs` ~40, `remote-model.mjs` ~90; snapshot +20, change-route +60/-15, git-run +25, poller +45, server +30; test-support ~125; banners/drawer-model/resume-view ~53; app.js/app.css ~145). Review growth of about 47% (#1218) would put it near 1200.
- Chained PRs recommended: No (R9, single PR).
- 400-line budget risk: High against 400, but the repository is at the `lite` tier whose budget is 1000; risk against 1000 is Medium, and R9 pre-authorizes `size:exception`.
- Decision needed before apply: No (R9 rules `size:exception` if the gated diff exceeds 1000; recorded in task 8.4).
