---
status: draft
issue: 883
---

# Tasks — local-worktree-overlay (issue 883)

Strict TDD: every phase is RED → GREEN → REFACTOR. A RED task names the test and why it fails today; a GREEN task makes exactly that test pass with the least code; a REFACTOR task changes no behaviour and keeps the suite green. Test runner: `npm test`; one file runs with `node --test <path>`. No real timers and no network in any test: debounces run on injected `_setTimeout`, watches on an injected `_watch`, and the git fixture has no remote. Requirement and decision numbers refer to `spec.md` and `design.md`.

## Phase 1 — The fixture and the first RED (R883-6, D73–D76)

- [x] 1.1 Create `brain/scripts/ui/test-support/git-worktree-fixture.mjs`: `makeWorktreeRepo({mainFiles})` (real git, pinned `GIT_AUTHOR_*`/`GIT_COMMITTER_*` dates, name and email, `-c init.defaultBranch=main`, `mkdtemp` under `os.tmpdir()`) and `addWorktree(branch, files, {commit})` via `git worktree add -b <branch> <path>`. Follow `git-remote-fixture.mjs`'s env pattern so `test-spawn-hygiene.test.mjs` stays green.
- [x] 1.2 RED — `brain/scripts/ui/local-overlay.test.mjs`, "R883-6: an untracked proposal in a linked worktree shows as uncommitted: new when main has no change dir". Main has no `openspec/changes/issue-7-*`; worktree `feat/issue-7-x` holds an untracked `openspec/changes/issue-7-x/proposal.md`; a stub vcs lists issue 7 open, no PRs. Run `buildSnapshot` with that vcs, then `buildChangeView({root, issue: 7, snapshot})` with the real `gitRun`. Assert `value.local[0].documents.proposal.overlay === 'new'` and `.uncommitted === true`. **Fails today:** `value.local` is undefined; every tab says `no change dir at openspec/changes/issue-7-*`.
- [x] 1.3 GREEN — the thinnest path that passes 1.2: `parseWorktrees` gains `head`, `branch`, `detached` (`memory/lane/collect.mjs`); `status/local-worktrees.mjs` `readLocalWorktrees` (listing, grammar, open set, `pickChangeDir`); the section in `status/snapshot.mjs`; `ui/local-overlay.mjs` with `gitBlobHash`, `classifyLocalDocument`, a plain read and `readLocalBlocks`; `buildChangeView` spreads its result (`ui/change-route.mjs`).
- [x] 1.4 REFACTOR — Export `capText` from `change-route.mjs` for the overlay; keep `change-route.mjs` free of `node:fs` (R1198-4's guard at `change-route.test.mjs:546` stays green).

## Phase 2 — Discovery and the section (R883-1 to R883-4, D69–D72)

- [x] 2.1 RED — `brain/scripts/status/local-worktrees.test.mjs`: `parseWorktrees` returns `head`/`branch`/`detached` and its old fields unchanged; `fix/issue-12-b` joins like `feat/`; the served root, a detached, a `spike/x` and a prunable worktree are hidden and counted by cause; a recording runner sees exactly one `worktree list --porcelain`; only-the-root gives `ok` with zero entries; a throwing listing is `uncomputable`; a closed issue counts in `hidden.closed`; a pending graph gives `pending`, an uncomputable graph gives an uncomputable reason naming R6; four worktrees on one issue order by `touchedAt` and the fourth is `capped`; the fingerprint changes after a resize and after an `mtime` change. Fails: only the 1.3 path exists.
- [x] 2.2 GREEN — Complete `readLocalWorktrees`: `realpath` served-root exclusion, `hidden` counts, `touchedAt`, `fingerprint`, `capped`, `tier: 'working-tree'`, `pending`/`uncomputable` mirroring `readHierarchy`. `renderSnapshotText` prints a `local` line.
- [x] 2.3 RED — `brain/scripts/status/snapshot-cli.test.mjs`: the text mode lists `local` with its count; the JSON carries `localWorktrees`. Fails on the missing line.
- [x] 2.4 GREEN — The text line. The server's forge-unavailable override adds `localWorktrees` (`ui/server.mjs:199-201`, D71).
- [x] 2.5 REFACTOR — `hidden` causes named once as constants; the header of `snapshot.mjs` states the section as the one working-tree read and `SNAPSHOT_TIER` stays `committed` (R883-16).

## Phase 3 — Document states, safe reads and bounds (R883-5 to R883-8, R883-13, R883-14, D73–D77, D83)

- [x] 3.1 RED — `brain/scripts/ui/local-overlay.test.mjs`: `gitBlobHash` equals `git hash-object` for three byte strings; the four states and their order, including "same as main wins over uncommitted" and `resume` never `same-as-main`; all seven documents looked up and absent ones named in one line; no change dir and an ambiguous dir; the tasks document carries `progress`. Fails: classification and the `blob` field are missing.
- [x] 3.2 GREEN — `documentEntry` gains `blob` (`change-route.mjs:230`, set from the tree entry); `classifyLocalDocument` in full; block states `read`, `capped`, `no-change-dir`, `unreadable`.
- [x] 3.3 RED — Safe reads through the `_fs` seam: a symlinked document, a change dir symlinked outside the worktree, a FIFO, a file over `DOCUMENT_READ_LIMIT`, a 300 KiB file cut at `DOCUMENT_CAP` with its state from full bytes, and a torn read on both attempts (R883-7). Fails: the plain read follows links and never re-reads.
- [x] 3.4 GREEN — `readLocalDocument` per D77 (`lstat`, `realpath`, `O_RDONLY | O_NOFOLLOW`, `fstat`, one re-read).
- [x] 3.5 RED — R883-13 and R883-14 on the real fixture: four worktrees on issue 7 cost exactly three `ls-tree` calls in the drawer, none carrying `-C`, `--git-dir` or `--work-tree`; a vcs that throws is never touched; a recording runner that throws on write verbs sees none; each worktree's files and admin `index`/`HEAD` and the served root's `index` are byte-identical before and after. R883-8: an untracked `apply-progress.md` in the served root appears nowhere. Fails until the cap and the D74 argv are in place.
- [x] 3.6 GREEN — The cap in `readLocalBlocks`; the `ls-tree` argv of D74 (`--literal-pathspecs ls-tree -l -z <head> -- <7 paths>`).
- [x] 3.7 REFACTOR — Share `resumeOutcome` (renamed from `remoteResume`, `change-route.mjs:426`) between remote and local blocks; add the guard that `local-overlay.mjs` never joins a path onto `root` (R883-8, D82).

## Phase 4 — Precedence and branch resolution (R883-9, R883-15, D76, D81)

- [x] 4.1 RED — `brain/scripts/ui/change-route.test.mjs`: `local` sits beside `remote`; a block at its origin entry's sha with nothing uncommitted is `same-as-origin`; `resolveBranch` resolves `fix/issue-11-x` and reads the new reasons (update `:106`, `:113-117`, `:634`, `:640`); the Working memory reason no longer contains "slice 5" and points at "on this machine" when a local resume exists. Fails on the `feat/`-only list and the old wording.
- [x] 4.2 GREEN — `same-as-origin`; `resolveBranch` per D81; the Working memory wording at `change-route.mjs:154`.
- [x] 4.3 REFACTOR — Sweep the defect class: `rg "slice 5|feat/issue-\$\{" brain/scripts/ui` returns no stale wording; update `drawer-model.test.mjs:561`.

## Phase 5 — The drawer model and the page (R883-9, R883-11, R883-12, D78, D80)

- [x] 5.1 RED — `brain/scripts/ui/lib/drawer-model.test.mjs`: `localBlockModel` wordings for the four states and the five block states; a `same-as-main` row has `document: null`; a local stamp is `<path> @ worktree <leaf> · <bytes> B · <blob12>` and changes with one added line; `localChangedFor` is true for the selected issue's fingerprint, `dirState` or entry-set change and false for another issue's. Fails: none exist.
- [x] 5.2 GREEN — `localBlockModel`, `LOCAL_STATE_WORDING`, the marker stamp in `documentView`, `localChangedFor`; `buildDrawerModel` returns `local` and `localNote`.
- [x] 5.3 RED — `brain/scripts/ui/static/local-render.test.mjs` (with `test-support/dom.mjs` and `load-app.mjs`): block order with and without a served change dir; the empty-state line; no block and no band for zero entries (R883-2); a branch named `<img src=x onerror=alert(1)>` renders as text; a `section` frame changing issue 7's fingerprint while issue 7 is open triggers one change-view fetch, and one for issue 8 triggers none. Walk NodeLists with `Array.from`. Fails: no local block is rendered.
- [x] 5.4 GREEN — `renderLocalBlock(s)` in `app.js`, the order rule, the empty-state wording, the `subscribe` hook (read `before` ahead of `applyFrame`); `app.css` for `.local-block`.
- [x] 5.5 REFACTOR — Share the document-row loop between `renderRemoteBlock` and `renderLocalBlock`.

## Phase 6 — The watcher and liveness (R883-10, R883-11, R883-16, D79, D80, D82)

- [x] 6.1 RED — `brain/scripts/ui/watcher.test.mjs`: `setLocalTargets` opens two handles per target with `ignoreEnoent`; a fire plus 250 ms of fake time gives one recompute with a `watch:local:` cause; reconciliation of A,B → B,C; a failed watch is in `state().failed` and retried on the next call. The existing Q3-set test stays unchanged; a variant with one local target asserts the set plus exactly its two paths, and an edit in the served root outside the set fires nothing. Fails: `setLocalTargets` does not exist.
- [x] 6.2 GREEN — `setLocalTargets`, the `local` kind and the `watchedLocal` map in `ui/watcher.mjs`.
- [x] 6.3 RED — `brain/scripts/ui/server.test.mjs`: acceptance 1 end to end on the real fixture with fake `_watch` and timers. Open the stream, edit the worktree's committed `tasks.md` to tick a box, fire the change dir handle, flush the debounce: a `section` frame for `localWorktrees` arrives, and `GET /api/change/7` shows the tasks row "uncommitted: modified" with the new count. An uncomputable next build keeps the handles. The `:918` test's fixture gains a linked worktree on an open issue, its local block is present, and no call carries `-C`. Fails: the server never calls `setLocalTargets`.
- [x] 6.4 GREEN — `ui/server.mjs` calls `watcher.setLocalTargets` after `recomputeCurrent` when the section is `ok`.
- [x] 6.5 REFACTOR — Amend, never delete (D82): the headers of `watcher.mjs`, `change-route.mjs` and `snapshot.mjs`; the `server.mjs:237-241` comment; the `:918` assertion message cites R883-16; the R881-3 amendment is recorded as a dated "Modifies R881-3" note in this change's own `spec.md`, because archived changes are history and are not edited (orchestrator ruling); no line is removed.

## Phase 7 — Verification

- [x] 7.1 `npm test` green; `npm run brain:repo:check` green.
- [x] 7.2 Manual check on this clone: `npm run brain:snapshot -- --json` lists about 13 entries; the drawer for #883 shows its proposal, spec, design and tasks; edit `tasks.md` in this worktree and watch the row change within a second.
- [x] 7.3 Measure the gated diff with the governance ignore list and record it in `apply-progress.md`.

## Phase 8 — Fixes from the verify report (W1, W2, W3, S1, S2, S3, R883-2, R883-8, R883-15, R883-17, D81, D84)

- [x] 8.1 RED — `ui/change-route.test.mjs`: `feat/issue-N-x` and `feature/issue-N-y`, only the `feat` one in a kept worktree with the change dir present, resolves to `feat`; both in kept worktrees refuse, naming both. Fails: the reason lists names only.
- [x] 8.2 GREEN — `resolveBranch` breaks a tie by the kept worktree that holds the change dir (D81).
- [x] 8.3 RED — `ui/lib/sdd-model.test.mjs` and `static/views-owned.test.mjs`: a worktree-only change reads `change in worktree <leaf> (not on main)`. Fails: the card says no change directory names the issue.
- [x] 8.4 GREEN — `sddForIssue` takes the local section; `renderNodeSdd` passes it (D84).
- [x] 8.5 `ui/local-overlay.test.mjs`: a served root that is itself a linked worktree is never read (S2, R883-8).
- [x] 8.6 Docs — proposal points at R883-16 (W1); spec adds R883-17, the R883-2 note and scenarios; verify-report gains a Resolution section.

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~490 gated (`*.test.mjs`, `openspec/changes/**` and `.memory/**` excluded; the new test-support fixture, ~50, is counted) |
| Governance tier budget (`lite`) | 1000 |
| 400-line budget risk | Medium (over 400, well under the `lite` 1000) |
| Chained PRs recommended | No |
| Suggested split | None. If the measured diff exceeds 1000, split Phases 1–3 (data and reader, useful alone through the CLI and the route) from Phases 4–6 (precedence, page, watcher) |
| Delivery strategy | ask-on-risk |
| Chain strategy | Not applicable |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: not applicable
