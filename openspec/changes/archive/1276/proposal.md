---
status: approved
approved: 2026-10-04 (maintainer: "si")
issue: 1276
---

# Proposal — tabs-follow-lookup-order (issue 1276)

## Intent

#883 taught the drawer to read an open issue's change dir from a linked worktree on this machine. Its design D76 kept the Spec, SDD and Tasks tabs bound to the served HEAD and showed the lookup order as stacked blocks instead ("on this machine", then "on origin"). The maintainer reads the tabs. For an issue whose change lives only in a worktree, all three tabs say `no change dir at openspec/changes/issue-N-*`, and the documents appear only in a separate block under them.

Measured on the running UI: `GET /api/change/1251` returns `spec`, `sdd` and `tasks` as `{ok: false, reason: "no change dir at openspec/changes/issue-1251-*"}`, while `local[0]` (worktree `brain-issue-1251`) holds `proposal.md` and `spec.md`.

The cause is in one place. `buildChangeView` (`brain/scripts/ui/change-route.mjs:500`) passes the served change dir (`findChangeDir`, `:54`) and the served HEAD's documents (`readHeadDocuments`, `:514`) to the three tab builders (`:526-528`). Each builder opens with `if (!dir) return noChangeDirTab(issue)` (`:78`, `:104`, `:398`). The worktree's documents are read four lines later (`:518`), but only into the `local` blocks.

A second defect (undeclared-lane tiles that cannot be clicked) was reported in the same session. It was withdrawn: it was a false report. The tiles (`.batch-tile`, `static/app.js:966-973`) are wired to `selectNode`, and clicking #117 opens its drawer. The report came from a wrong selector (`[data-issue]`) and from paging (24 tiles per page). This change does nothing for tiles.

## Maintainer rulings (binding)

| # | Date | Ruling |
|---|---|---|
| R1 | 2026-10-04 | The tabs follow the lookup order: main, then the local worktree, then origin. When the served root has no change dir for N, the Spec, SDD and Tasks tabs take their documents from the local worktree that holds it, chosen with #883's tie-break: the worktree holding the change dir; when several hold it, refuse and name the candidates. If no local worktree holds it, use the origin branch from #1201's remote blocks. Each tab states its source, for example "from worktree <leaf> · uncommitted" or "from origin/<branch> @ sha12". Per-document states keep #883's wording. |
| R2 | 2026-10-04 | With main holding the change dir, the tabs are unchanged. |
| R3 | 2026-10-04 | WITHDRAWN. The defect was a false report (see Intent). No requirement, task or decision remains for it. |
| Q1 | 2026-10-04 | When neither main nor a worktree holds the change and several origin branches do, the tabs prefer the issue's open PR head branch (the same first precedence as `resolveBranch`); with no such PR they refuse and name the branches. |
| Q2 | 2026-10-04 | When a lookup step cannot be read, the walk stops and says why; it never shows origin text past an unread worktree step. |
| R4 | 2026-10-04 | Read-only, textContent-only, NodeList-honest code, with no forge call (R11). |

## Scope

### In
- One source decision per drawer read, made in `buildChangeView`, that feeds the Spec, SDD and Tasks tabs and the `documents` map (D86).
- The tie-break shared with `resolveBranch`'s W2 rule: the worktrees of the issue whose `dirState` is `present` (D87).
- The origin fallback over the remote blocks #1201 already reads (D88).
- A `from` line on each of the three tabs, and the tasks progress label naming its source (D89, D90).
- Tasks attribution for a worktree's `tasks.md`: a blame at the worktree's HEAD with the read bytes as the final image, so uncommitted lines say "no blame" per row and the tab never fails because of them (D91).
- The amendment of #883's D76, of R883-9's last sentence, and of #883's out-of-scope line on worktree tabs (D93).

### Out
- The Working memory tab. R1 names Spec, SDD and Tasks; Working memory keeps #883's D81 branch resolution and its "on this machine" pointer.
- The Reviews and Records tabs. They are not change-dir documents.
- The placement of the "on this machine" and "on origin" blocks (D78). They stay where #883 put them.
- The map card. R883-17 already names a worktree-only change.
- The served root's working tree (R4 of #883).
- Any write, publish, push or PR action.

## Approach

`buildChangeView` already holds everything the decision needs: the served change dir, the worktree blocks (`readLocalBlocks`, `change-route.mjs:518`) and the remote blocks (`readRemoteBlocks`, `:532`). The change adds one function, `pickTabSource`, which walks the three steps in order and returns one of `head`, `worktree`, `origin`, `none` or `refused`, with the documents and a label. The three tab builders take that source instead of `dir`. With `head`, they receive exactly today's arguments, so R2 holds by construction.

A worktree's documents are already read by `local-overlay.mjs`, with its safe reads and blob states. The only change there is that a block collapsed as `same-as-origin` hands its documents to the source decision before it drops them from the block.

## Rejected alternatives

| Alternative | Why not |
|---|---|
| Each tab builder looks for its own fallback | Three walks can disagree: the Spec tab could read worktree A while the Tasks tab reads origin. One decision feeds all three. |
| Move the "on this machine" block above the tabs and leave the tabs alone | That is what #883 shipped. The maintainer reads the tabs, and the block answers a different question (which state is each document in). |
| Fall through to origin when several worktrees hold the change | R1 says to refuse and name the candidates. A silent fall-through would show older text while newer work sits on disk. |
| Skip blame for any worktree `tasks.md` | The common worktree edit is ticking a box in a committed `tasks.md`. Per-line blame keeps the committed rows attributed and says "no blame" only for the lines that are uncommitted. |
| Run `git blame` with the worktree path as `--contents <file>` | That makes git read a working-tree file directly, bypassing #883's symlink and escape checks (D77). The bytes already read safely are passed on stdin instead. |

## Risks

- **Git version.** `git blame --contents - <rev>` needs a git that accepts `--contents` together with a revision (2.41/2.42 or later; apply measures this). With an older git, the blame call fails, and the existing per-row path says "attribution unavailable: <git's reason>". The tab still renders.
- **Origin with several branches** and **an unread step** were settled by the maintainer's rulings Q1 and Q2 (table above).

## Size

About 170 gated lines (`*.test.mjs` and `openspec/changes/**` excluded), against the `lite` budget of 1000. One PR.

## Success criteria

- `GET /api/change/1251` on this machine returns `spec.ok === true` with cards from `brain-issue-1251`'s `spec.md`, an SDD tab with `proposal` and `spec` present, and a `from worktree brain-issue-1251 · …` line on each of the three tabs.
- An issue whose change dir is on main returns byte-identical `spec`, `sdd` and `tasks` tab values to today's.
- No new forge call, no write verb, and no `-C`, `--git-dir` or `--work-tree` in any recorded git call.
