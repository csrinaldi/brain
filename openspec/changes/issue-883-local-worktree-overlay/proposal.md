---
status: approved
approved: 2026-10-03 (maintainer: R1–R6, "sigo hasta el PR")
issue: 883
---

# Proposal — local-worktree-overlay (issue 883)

## Intent

The drawer shows nothing for work that exists only on this machine. When the served root's `main` has no `openspec/changes/issue-N-*` dir, `findChangeDir` (`ui/change-route.mjs:47`) returns null, because `snapshot.changes` is built from the served tree alone (`readChanges`, `status/snapshot.mjs:282`). `readHeadDocuments` (`ui/change-route.mjs:276`) then returns null for every document, and every tab says `no change dir at openspec/changes/issue-N-*` (`noChangeDirTab`, `:52`). The work is not missing: it sits, uncommitted or committed but unpushed, in a linked worktree that `brain:ticket:start` created by default (#782). An operator with 13 worktrees on open issues sees none of their proposals, specs or ticked tasks.

This change is slice 5 of #878. It adds a read-only, local-only overlay: the UI discovers this clone's linked worktrees, keeps those whose issue is open, and shows each one's SDD documents from its working tree, marked as uncommitted where they are. It never becomes a way to publish: nothing is written, committed, pushed or sent anywhere.

## Scope

### In
- Worktree discovery as a snapshot section, `localWorktrees`, from one `git worktree list --porcelain` (D69, D70).
- The open-issue filter (R6), from the open-issue set the snapshot already holds (D71).
- At most 3 worktrees per issue with documents, newest first; the rest are listed without them (D72).
- A working-tree reader for the seven documents of a worktree's change dir (R2), with safe reads (D73, D77).
- Per-document state from a git blob-hash comparison: `uncommitted: new`, `uncommitted: modified`, `committed on <branch>, not on main`, and `same as main`, collapsed (R3, D74, D75).
- An "on this machine" block in the drawer between the served change and the "on origin" blocks (R1, D76, D78).
- Watches on each shown worktree's `openspec/changes/` and its change dir, so an edit reaches the open drawer within one watcher tick (D79, D80).
- A content marker in the stamp of an uncommitted document, so a re-render follows an edit (D78).
- `resolveBranch` widened from `feat/issue-N-*` to every canonical branch type (D81).
- The amendment, never the deletion, of R881-3, the `-C` assertion at `ui/server.test.mjs:918`, R1198-4's working-tree guard, and the watcher's and the snapshot's committed-tier wording (D82).

### Out
- The cold-review cache (R5). It is keyed by PR, needs its own parser, and belongs to the Reviews tab. It is a follow-up.
- Remote mode (#885). There is no remote-mode flag in `ui/` today; local is the only mode, and this overlay is local by construction.
- The served root's own uncommitted files (R4).
- Any write: no commit, stash, index refresh, checkout or push, in any worktree.
- Spec cards and the tasks checklist read from a worktree. The tabs stay bound to the served HEAD; the overlay is its own block (D76).

## Maintainer rulings (binding)

| # | Date | Ruling |
|---|---|---|
| R1 | 2026-10-03 | Lookup order: (1) main, at the HEAD of the served root; (2) the local worktree working on that issue, read from its working-tree files and marked uncommitted; (3) the `origin/*` branch (#1201). |
| R2 | 2026-10-03 | All seven documents: proposal, spec, design, tasks, apply-progress, verify-report and resume. Not only tasks, spec and resume, which is what the issue's text says. |
| R3 | 2026-10-03 | A document identical to main is shown collapsed as "same as main", with no repeated body. Every present document shows its state. |
| R4 | 2026-10-03 | The served root's own uncommitted files are out of scope for SDD documents. Only memory legitimately lives in main and not in a worktree, and the Memory view already shows it. A stray untracked `apply-progress.md` in the main checkout (#557) is a leftover, not a case to support. |
| R5 | 2026-10-03 | The cold-review cache is split out to a follow-up (keyed by PR, own parser, Reviews tab). |
| R6 | 2026-10-03 | Stale worktrees are filtered out: only worktrees whose issue is OPEN are shown, from the open-issue set the snapshot already holds. "Not merged" is useless as a filter: squash merges leave no ancestry, so 60 of 62 worktrees would count as unmerged. |

## Approach

The exploration's recommendation, measured on this clone (65 worktrees, 13 on open issues):

1. **Discovery is a snapshot section.** One `git worktree list --porcelain` (6 ms for 65 worktrees) lists every worktree with its HEAD and branch. The branch grammar maps each to an issue; the open-issue set filters it. For each kept worktree, the snapshot lists its `openspec/changes/` and `lstat`s the seven documents to build a fingerprint. That is filesystem metadata only: no file content is read at snapshot time.
2. **Documents are read in the drawer route.** For each shown worktree of the selected issue (at most 3): one `git ls-tree -l -z <worktree HEAD> -- <seven paths>` on the served root's own git dir (about 3 ms; the object store is shared), then a safe read of each file. Each file is hashed as a git blob and compared with the worktree's HEAD entry and with main's blob.
3. **The drawer renders three stacked blocks:** main (unchanged), "on this machine" (one card per worktree), and "on origin" (unchanged). When main has no change dir, the local block comes first.
4. **Edits reach the page through the section diff.** The watcher watches each shown worktree's `openspec/changes/` and change dir. An edit changes the section's fingerprint, the existing diff sends a `section` frame, and the page reloads the open drawer.

### Rejected
- **`git status --porcelain` per worktree.** It costs about 50 ms per worktree and takes index locks: it refreshes the index, which is a write. The blob-hash comparison costs about 3 ms per worktree and writes nothing.
- **A "not merged" filter.** Squash merges leave no ancestry; 60 of 62 worktrees would pass it (R6).
- **Reading uncommitted change dirs from the served root.** R4: the only legitimate main-only content is memory, which the Memory view already shows.
- **Per-hunk diffs.** A diff renderer, a second text and a second cache key per document, for a question ("is this the same as main?") that one hash comparison answers.

## Affected areas

| Path | Impact |
|---|---|
| `brain/scripts/status/local-worktrees.mjs` | New: the `localWorktrees` section reader |
| `brain/scripts/status/snapshot.mjs` | Modified: the section, the text-mode line, the header's tier wording |
| `brain/scripts/memory/lane/collect.mjs` | Modified: `parseWorktrees` also returns `head`, `branch` and `detached` (additive) |
| `brain/scripts/ui/local-overlay.mjs` | New: the drawer's working-tree reader (safe read, blob hash, classification, blocks) |
| `brain/scripts/ui/change-route.mjs` | Modified: `blob` on head documents, the `local` blocks, `resolveBranch` widened, the Working memory wording, the header's tier wording |
| `brain/scripts/ui/watcher.mjs` | Modified: `setLocalTargets`, a `local` watch kind, the header's tier wording |
| `brain/scripts/ui/server.mjs` | Modified: targets passed to the watcher after each recompute; the forge-unavailable override covers the section; the R881-3 comment |
| `brain/scripts/ui/lib/drawer-model.mjs` | Modified: `localBlockModel`, the content-marker stamp, `localChangedFor` |
| `brain/scripts/ui/static/app.js`, `app.css` | Modified: the "on this machine" block and the reload on a local section change |
| `brain/scripts/ui/test-support/git-worktree-fixture.mjs` | New: a real-git repo with linked worktrees |
| `openspec/changes/issue-883-local-worktree-overlay/spec.md` | Amendment note under R883-16 (R881-3); the archived 881 spec is history and is not edited |
| `brain/scripts/ui/lib/sdd-model.mjs`, `ui/static/app.js` | Modified: a map card whose change exists only in a local worktree says so (R883-17) |
| `*.test.mjs` beside each module | New or modified |

## Risks

| Risk | L | Mitigation |
|---|---|---|
| A file under a clean/smudge filter or an end-of-line conversion hashes differently from its blob and reads as `uncommitted: modified` | Low | This repository declares no such filter. The wording is the reader's only claim, and design names the gap (D74). `git status` would answer it but was rejected for cost and index writes. |
| The overlay reads paths under linked worktrees, which R881-3 forbade | Med | R881-3 is amended, not deleted, in this change's own spec.md (R883-16; the archived 881 spec is never edited): git still never runs with `-C` or in a worktree, and the only working-tree reads are the seven documents of an open issue's change dir and two directory watches per shown worktree (D82). |
| A forge-less server has no open-issue set, so R6 cannot be applied | Low | The section is uncomputable with that reason, said in the block; nothing unfiltered is shown (D71). |
| An edit within the same millisecond and with the same size does not change the fingerprint | Low | The next edit, or any other recompute, heals it. The drawer's own read hashes the content, so what it shows is always exact. |
| A torn read while an editor writes | Low | Read, `fstat`, re-read once; a second mismatch is said as unreadable, and the next debounced recompute reads it again (D77). |
| Watch handles grow with open-issue worktrees | Low | Two per shown worktree, at most 3 shown per issue: about 26 today (D79). |

## Size forecast

About 450 gated lines by the exploration's estimate (400–450). `design.md`'s per-file table totals about 490, because it counts the new test-support fixture (about 50). Either way it is well under the `lite` budget of 1000. One PR.

## Rollback

Revert the PR. There is no data, no config key and no migration. The `localWorktrees` section, the `local` blocks and the `blob` field on documents are additive, and a consumer that ignores them is unaffected. Reverting removes the R883-16 amendment note with the code that needed it; the archived 881 spec was never touched. The widened `resolveBranch` reverts to `feat/` only, which is the defect it fixes, not a data loss. Its tie-break (the branch held by the worktree that holds the change dir) reverts with it.

## Success criteria

- [ ] With a linked worktree holding an untracked `proposal.md` for open issue N and no change dir on main, the change view shows that document marked `uncommitted: new` (today: "no change dir").
- [ ] A task ticked in a worktree's `tasks.md` shows as uncommitted in the open drawer within one watcher tick (acceptance 1).
- [ ] A clone with no linked worktrees yields an empty overlay, not an error (acceptance 2).
- [ ] A document identical to main is collapsed as "same as main" with no body.
- [ ] A worktree whose issue is closed is not shown; one whose issue is open is.
- [ ] No forge call, no `git -C`, no write of any kind; the snapshot adds exactly one spawn and the drawer at most one per shown worktree.
- [ ] R881-3 (amended in this spec's R883-16, not in the archive), the `-C` assertion, R1198-4's guard and the tier wording are amended in place, and their tests still run.
