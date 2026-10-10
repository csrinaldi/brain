---
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:dc0ebc89cd199dc20de856caadef0289bee6920d889f63dfd103a58dd8a52b91
verdict: pass-with-warnings
blockers: 0
critical_findings: 0
requirements: 16/16 compliant, 0/16 partial
scenarios: 37/37 compliant, 0/37 partial
test_command: "npm test"
test_exit_code: 0
test_output_hash: sha256:721af948a2d1b28a6d76973d3ff00fa1561bf1d78959b1837f19d9a18de06d17
build_command: "npm run brain:repo:check && npm run brain:change:verify"
build_exit_code: 0
build_output_hash: sha256:5b395ef70d287f84a929a2c3b29d8096461c1df108514625f3cdd7b55cf36ce0
---

# Verify Report: issue-883-local-worktree-overlay

**Date**: 2026-10-03
**Verdict**: PASS WITH WARNINGS (0 CRITICAL, 3 WARNING, 5 SUGGESTION). The warnings are a stale proposal row that contradicts the corrected spec (W1), a widened `resolveBranch` that turns "one feat/ branch plus a tracker branch" from resolved into ambiguous (W2), and the change dir not being tracked in git yet (W3).
**Verified in**: `/home/gandalf/IA/brain-issue-883`, branch `feat/issue-883-featui-slice-5-local-overlay-uncommitted`, HEAD `cf4ef68c`, 5 commits over `origin/main`. Read-only: no source edited, nothing committed, no stash. `evidence_revision` is the sha256 of `git diff origin/main...HEAD`.
**Mode**: Strict TDD. Full artifact set. engram was unavailable, so apply-progress was read from the change dir file and the TDD cycle table was cross-checked by a red-on-parent audit.

## Completeness

Tasks: 32 of 32 ticked, none open (`rg -c '^\s*- \[x\]' tasks.md` = 32, unchecked = 0). Every file named in the apply-progress "Affected areas" exists, except `openspec/changes/archive/881/spec.md`, which is correctly NOT modified (see W1). `git diff origin/main...HEAD --stat` shows nothing under `openspec/changes/archive/**`, and no review/cache file (R5 held).

## Build and tests (executed)

| Command | Result |
|---|---|
| `npm test` | exit 0. tests 7483, pass 7480, fail 0, cancelled 0, skipped 3, todo 0 (38 s). The 3 skips are pre-existing. |
| `npm run brain:repo:check` | exit 0. "No prohibited references found." and "Artifact structure is valid." |
| `npm run brain:change:verify` | exit 0. "Validacion completa: repo + scripts". |
| Gated diff | **651** (expected 651), against the `lite` budget of 1000. |
| Flakiness | local-overlay, local-worktrees, watcher, local-render, 10 runs each under `taskset -c 0`: 0 failing runs in 40. |

## TDD compliance: red on the parent of each commit

Method: a detached scratch worktree at `<commit>~1` under the session scratchpad, the commit's added or modified `*.test.mjs` checked out from the commit, `node --test --test-timeout`. The scratch worktree was removed after each commit; `git worktree list` no longer shows it.

| Commit | Test files and result on the parent | Verdict |
|---|---|---|
| `2a10fe85` | `local-worktrees.test` (fail, missing module), `snapshot-cli.test` (fail), `local-overlay.test` (fail, missing module), `server.test` (1 fail, 55 pass) | RED |
| `c3cb1fc2` | `local-overlay.test`: cancelled by the 15 s timeout, 0 pass. The parent's reader opens a FIFO with a plain read and hangs, which is exactly the red apply-progress records for 3.3/3.4. | RED (hang) |
| `15c3be46` | `change-route.test` (5 fail), `local-overlay.test` (2 fail); `drawer-model.test` 37 pass | RED |
| `94f67d2b` | `drawer-model.test` (1 fail, import of a missing export), `local-overlay.test` (1 fail), `local-render.test` (6 fail) | RED |
| `cf4ef68c` | `server.test` (3 fail), `watcher.test` (8 fail); `publish-allowlist.e2e.test` 6 pass | RED |

Green on the parent, and that is correct: `drawer-model.test.mjs` in `15c3be46` (additions are assertions over helpers that already satisfied them, the new behaviour is in the failing `change-route`/`local-overlay` tests of the same commit) and `test/publish-allowlist.e2e.test.mjs` in `cf4ef68c` (canary constant 9.5 to 9.6, no behaviour).

## Spec compliance matrix (R883-1 to R883-16)

Runtime evidence: every test below passed in the `npm test` run above. Paths are under `brain/scripts/`.

| Req | Proving test (file:line) | Status |
|---|---|---|
| R883-1 discovery | `status/local-worktrees.test.mjs:54` (parseWorktrees fields), `:69` (feat/ and fix/ join), `:80` (served root by real path), `:87` (detached, spike/x, bare, prunable counted), `:98` (one spawn), `:197` (names and lstat only); `status/snapshot-cli.test.mjs:164,176` (text line, JSON tier) | COMPLIANT |
| R883-2 empty is not error | `status/local-worktrees.test.mjs:105`; `ui/static/local-render.test.mjs:100`; `ui/local-overlay.test.mjs:436` | COMPLIANT |
| R883-3 open-issue filter (R6) | `status/local-worktrees.test.mjs:115,122,135`; `ui/server.test.mjs:1418` (forge-less override) | COMPLIANT |
| R883-4 cap of 3 | `status/local-worktrees.test.mjs:141,150`; `ui/local-overlay.test.mjs:280` (three ls-tree, fourth never read, note "3 of 4") | COMPLIANT |
| R883-5 seven documents | `ui/local-overlay.test.mjs:112` (all seven, absent named once), `:129` (no change dir; two dirs); `status/local-worktrees.test.mjs:157` | COMPLIANT |
| R883-6 states (R3) | `ui/local-overlay.test.mjs:35` (new), `:57` (hash equals `git hash-object`), `:63` (order, resume never same-as-main), `:74`, `:82` (modified with own count; committed), `:97` (same-as-main wins); `ui/lib/drawer-model.test.mjs:591,609,626` | COMPLIANT |
| R883-7 safe reads | `ui/local-overlay.test.mjs:159` (symlink), `:174` (escaping dir), `:189` (stale section), `:202` (FIFO and over-limit never opened), `:215` (300 KiB cut), `:230` (torn read, one re-read, others unaffected); `status/local-worktrees.test.mjs:170` | COMPLIANT |
| R883-8 served root never read (R4) | `ui/local-overlay.test.mjs:346` (stray untracked file ignored), `:376` (source guard: no `root` identifier in the module, no write API, no `readFileSync`) | COMPLIANT |
| R883-9 precedence (R1) | `ui/static/local-render.test.mjs:78,91,110`; `ui/local-overlay.test.mjs:356,392,402` | COMPLIANT |
| R883-10 watcher | `ui/watcher.test.mjs:766,776,787,802,815,826,847,856`; `ui/server.test.mjs:1486,1512` | COMPLIANT |
| R883-11 reload on local edit | `ui/server.test.mjs:1444` (acceptance 1); `ui/static/local-render.test.mjs:139`; `ui/lib/drawer-model.test.mjs:639`; `status/local-worktrees.test.mjs:188` | COMPLIANT |
| R883-12 content-marker stamp | `ui/lib/drawer-model.test.mjs:618`; `ui/static/local-render.test.mjs:126,159` | COMPLIANT |
| R883-13 no forge, bounded spawns (R11) | `ui/local-overlay.test.mjs:280` (exactly 3 ls-tree for 4 worktrees, no `-C`, only `git` spawned), `:299` (section: exactly one `worktree list --porcelain`, forge log identical with 0 or 4 worktrees) | COMPLIANT |
| R883-14 writes nothing | `ui/local-overlay.test.mjs:327` (guarded runner refuses and records write verbs; worktree files, admin `index` and `HEAD`, served `index` byte-identical) | COMPLIANT |
| R883-15 resolveBranch | `ui/change-route.test.mjs:109` (fix/ branch, with and without slug), `:198`; `ui/local-overlay.test.mjs:420` (no "slice 5") | COMPLIANT (see W2) |
| R883-16 amended invariants | `ui/server.test.mjs:887-932` (`-C` assertion kept, now over a linked worktree, local block present); `ui/watcher.test.mjs:776`; `status/snapshot-cli.test.mjs:185` (tier stays `committed`) | COMPLIANT |

Scenarios: 37 of 37 map to a passing test above.

## Maintainer rulings

| Ruling | Evidence | Status |
|---|---|---|
| R1 lookup order (served, this machine, origin; local first when main has none; clean-at-origin collapses) | `local-render.test.mjs:78,91`, `local-overlay.test.mjs:392,402` | HELD |
| R2 all seven documents | `local-overlay.test.mjs:112`; `LOCAL_DOCUMENT_FILES` has seven keys | HELD |
| R3 same-as-main collapsed, no body | `local-overlay.test.mjs:97`; `documentFor` sets `text: null` for it | HELD |
| R4 served root's uncommitted change dirs never read | test `:346` plus source guard `:376`. `rg 'join\([^)]*\broot\b'` over `ui/local-overlay.mjs`, `status/local-worktrees.mjs`, `ui/change-route.mjs` finds nothing; `root` appears in `local-worktrees.mjs` only as the argument of `realOrSelf` (the served-root comparison). `change-route.mjs` and `local-overlay.mjs` import `node:fs` only in the latter, and only `lstat/realpath/open/read/fstat/close`. | HELD |
| R5 no cold-review cache | no review or cache file in the diff; the spec lists it out of scope | HELD |
| R6 open-issue filter | `local-worktrees.test.mjs:115,122`; mutation (a) | HELD |

## Read-only and safety

- Recording shim (`guardedGit`, `local-overlay.test.mjs:249-263`) throws on `add, commit, status, stash, checkout, switch, reset, push, fetch, pull, merge, rebase, update-ref, update-index, clean, restore, gc, prune, apply` and on `worktree add/remove/prune/move/lock`, and records every attempt in `attempted` so a swallowed throw is still caught; the tests assert `attempted` is empty and that no call carries `-C`, `--git-dir` or `--work-tree`.
- Symlink and escape: lstat first, `O_NOFOLLOW`, real path must stay under the change dir; covered at `:159,:174,:189`.
- FIFO: `lstat` rejects non-regular files before any open (`local-overlay.mjs:72`); test `:202`. Without that line the parent hangs (TDD audit above).
- Cap: read limit 8 MiB checked by `lstat` and again in `readAll`; text cut at 256 KiB on a UTF-8 boundary; test `:215`.
- Hostile branch name: `local-render.test.mjs:110` (set as text, no markup).
- Nothing under `openspec/changes/archive/**` is touched (`git diff --stat` has no such path).

## Mutation checks (each reverted with `git checkout -- <file>`; `git status` clean afterwards except the untracked change dir)

| Mutation | Result |
|---|---|
| (a) drop the open-issue filter (`local-worktrees.mjs`) | `local-worktrees.test.mjs:115` fails (R883-3) |
| (b) include the served root (`local-worktrees.mjs`) | `local-worktrees.test.mjs` "served root is hidden" and "counted by cause" fail. The R4 drawer test `:346` does NOT fail, because that fixture's served root is not a linked worktree; R4 is held by the source guard `:376` (S2). |
| (c) skip the symlink check (`local-overlay.mjs:71`) | `local-overlay.test.mjs:159` fails |
| (d) stamp ignores the content marker (`drawer-model.mjs:150`) | `drawer-model.test.mjs:618`, `local-render.test.mjs:126` and `:159` fail |
| (e) drop the cap (`local-worktrees.mjs`) | `local-worktrees.test.mjs:141` and `local-overlay.test.mjs:280` fail |

## Design coherence (D69 to D83)

| Decision | Status |
|---|---|
| D69 to D72 (section, one spawn, open set from `graph`, cap) | followed |
| D73 to D77 (blob compare, state order, safe read, torn read) | followed |
| D78 to D80 (render, watcher targets, reload rule) | followed |
| D81 `resolveBranch` widened | followed, with the regression in W2 |
| D82 R881-3 amended in this spec, not in the archive | followed in code and spec; proposal not updated (W1) |
| D83 | followed |

Deviations in apply-progress, judged: (1) the server watches a worktree's `openspec/changes/` only when its real path stays inside the worktree (`server.mjs:escapes`), and the change dir only when `dirState` is `present`; this is stricter than design and tested at `server.test.mjs:1512`, ACCEPTED. (2) `localNote` for an unreadable section: ACCEPTED, see S3. (3) `fake-git.mjs` accepts several `--list` patterns: test support only. (4) canary 9.5 to 9.6 MB: the tarball measured 9.50 MB, one line, ACCEPTED (S5).

## Issues

### CRITICAL

None.

### WARNING

**W1. `proposal.md` contradicts the corrected spec and design.** `proposal.md:76` (Affected areas) still lists `openspec/changes/archive/881/spec.md | Modified: an amendment note under R881-3 (appended, nothing removed)`, and the Rollback and Risks text cites the same. Spec R883-16 and design D82 say the amendment lives in this spec and the archive is never edited, and the diff confirms the archive is untouched. Fix: edit that row to `openspec/changes/issue-883-local-worktree-overlay/spec.md | Amendment note under R883-16 (R881-3); the archived 881 spec is history and is not edited`. apply-progress already records it as a known deviation.

**W2. `resolveBranch` now reports "more than one" for an issue with one slice branch plus a tracker branch.** The new globs `*/issue-N` and `*/issue-N-*` also match `feature/issue-N-*` tracker branches (the repo's own convention for epics). Measured on this clone: issue 1114 has six `feat/issue-1114-*` branches (already ambiguous before this change) plus `feature/issue-1114-axis-ports` (now seven). The regression class is narrower than "tracker plus slices": an issue with exactly ONE `feat/` branch plus a tracker (or a `fix/` plus a `feat/`) went from resolved to `more than one */issue-N branch in this clone: ...`. Issue 1081 went from "none" to ambiguous, same outcome. It only affects the Working memory tab, and only when the issue has no open PR (the PR head wins first, `change-route.mjs:143`). Severity: WARNING, not blocking. Minimal fix, in `resolveBranch` after the PR head: when more than one name matches, keep the one that is checked out in a kept local worktree holding the issue's change dir (the section is already in `snapshot.localWorktrees`, no extra spawn), and only then refuse; alternatively exclude `feature/` (tracker) names from the glob. Needs one test with a tracker plus a slice branch.

**W3. The change dir is untracked.** `git status` shows `?? openspec/changes/issue-883-local-worktree-overlay/`, so proposal, spec, design, tasks, apply-progress and this report are not in the 5 commits. Commit them before the PR (the issue-link and artifact gates read them).

### SUGGESTION

**S1. Map card for #883 still reads "no change directory names issue #883"** (`ui/lib/sdd-model.mjs:260`) while the drawer shows its worktree's change dir, because card rows come from `snapshot.changes`, served root only. Seen in the orchestrator's smoke. Follow-up for the maintainer's visual pass: a card state "on this machine" fed by `localWorktrees`. Not a blocker; R883-9 scopes the overlay to the drawer.

**S2. R4 is held by a source guard, not by a behaviour test on a linked-worktree served root.** Mutation (b) is caught only by the section tests. Add one test where the served root is itself a linked worktree with an untracked document and assert no local block names it through `buildChangeView`.

**S3. `localNote` for an unreadable section** shows "this machine's worktrees were not read: ..." on every drawer of a forge-less server, including issues with no worktree. Spec R883-2 forbids failure wording only for an ok empty section, so this is within the spec, but the spec is silent on the note; add one sentence to R883-2 or the design so the behaviour is a requirement rather than a deviation.

**S4. The watcher never follows symlinks, but by pre-check** (`escapes` in `server.mjs`, then `fs.watch`). There is a small window between the check and the watch registration; the consequence is a watch (not a read) on a path that moved, and the next `setLocalTargets` closes it. Acceptable; noted only.

**S5. The publish canary was raised 9.5 to 9.6 MB** for a tarball of 9.50 MB. Headroom is now 0.1 MB, the same slack the previous value had; consider deriving the canary from the previous release size in a follow-up.

## Final verdict

PASS WITH WARNINGS. Archive is not blocked by any CRITICAL. Fix W1 (one-row edit) and commit the change dir (W3) before the PR; W2 can ship as a follow-up or be fixed in this PR with the small change described.

## Resolution

Closed after the verify run, in three commits over the verified head `cf4ef68c`. After the fixes: `npm test` tests 7487, pass 7484, fail 0, skipped 3; `npm run brain:repo:check` clean; gated diff 683 against the `lite` budget of 1000.

| Finding | Resolution |
|---|---|
| W1 proposal points at the archive | Fixed. The Affected-areas row, the Risks row, the Rollback text and the checklist now point at this spec's R883-16; nothing under `openspec/changes/archive/**` is edited. |
| W2 several matching branches refuse | Fixed (D81, R883-15). `resolveBranch` prefers the branch checked out in exactly one kept `localWorktrees` entry of the issue whose change dir is present, from the snapshot, no extra spawn. Several such worktrees refuse and the reason names their leaves. RED first: two tests in `change-route.test.mjs` failed, then passed. |
| W3 change dir untracked | Fixed. The whole change dir is committed in the docs commit. |
| S1 card lies | Fixed (R883-17, D84). `sddForIssue` takes the local section and says `change in worktree <leaf> (not on main)`; no progress numbers. RED first in `sdd-model.test.mjs`, plus a source guard in `views-owned.test.mjs` that the page passes the section. |
| S2 R4 held by a source guard only | Fixed. `local-overlay.test.mjs` gains a behaviour test where the served root is itself a linked worktree with an untracked document. It passes on arrival, as a regression guard for mutation (b), not a RED. |
| S3 `localNote` unspecified | Fixed. R883-2 states the note and gains one scenario. |
| S4 watcher check-then-watch window | No change. The consequence is a watch, never a read, on a path that moved, and the next `setLocalTargets` closes it; closing the window needs an fd-based watch API that `fs.watch` does not offer. |
| S5 publish canary 9.5 to 9.6 MB | No change. The tarball measures 9.50 MB, the raise is one line with the same slack as before, and deriving the canary from the previous release is a separate follow-up. |

## Cold review round 1

The cold review returned REVISE with one blocker and two lesser findings, all closed in this change.

| Finding | Resolution |
|---|---|
| cold-1 (BLOCKER) the same-as-origin collapse hides unreadable and deleted documents | Fixed (D85, R883-9). The collapse requires every document readable, none uncommitted and none deleted from the working tree. RED first: with `proposal.md` a symlink and `tasks.md` committed but missing on disk at the origin sha, the block collapsed to `same-as-origin`; it is now `read`, with the refusal shown. |
| cold-2 an uncommitted deletion has no state | Fixed (D85, R883-6). A fifth state `deleted`, detected from the `ls-tree` already read, `uncommitted: true`, no body, worded "uncommitted: deleted (committed on <branch>, missing from the working tree)", distinct from "not in this worktree". A deleted `resume.md` is a missing resume with a reason. RED first at the reader, drawer-model and render levels. |
| cold-3 (editorial) the first change dir in a worktree produces no event | Fixed (D85, R883-10). A worktree without `openspec/changes/` is watched at its nearest existing ancestor inside the worktree, one extra non-recursive handle, dropped once the changes dir exists; the `escapes` guard is unchanged. RED first with the injected watch seam, at the watcher and the server. The watcher docstring now states that the caller supplies the ancestor. |
