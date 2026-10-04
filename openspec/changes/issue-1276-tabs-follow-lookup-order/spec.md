---
status: approved
issue: 1276
---

# Spec — tabs-follow-lookup-order (issue 1276)

Capability: `sdd-artifact-reader` (modified; #1198, #1201, #883). Delta requirements: what MUST be true after this change. The proposal's rulings R1, R2 and R4 are binding and are cited by number (R3 was withdrawn; see the proposal). The maintainer's rulings on Q1 and Q2 are recorded in R1276-4 and R1276-5. Requirement keywords follow RFC 2119. Every requirement not named here is unchanged.

Scenario grammar: each scenario carries exactly one `WHEN` line and one `THEN` line, with an optional `GIVEN`, so the Spec tab (`ui/lib/spec-cards.mjs`) renders it in full. A scenario with several outcomes states them in its single `THEN` line.

**This change modifies #883.** It replaces D76's "Tabs are unchanged and stay on the served HEAD" and R883-9's last sentence, "The tabs MUST keep reading the served HEAD only", with R1276-1 below. It removes the #883 out-of-scope line "Reading spec cards or the tasks checklist from a worktree; the tabs stay on the served HEAD". The rest of R883-9 (the block order, the labels, the `same-as-origin` collapse) is unchanged. The #883 artifacts are not edited; the amendment is recorded in this note and in design D93.

Fixed values used throughout:

- The three document tabs: Spec, SDD and Tasks. Working memory, Reviews and Records are not document tabs and are unchanged.
- A worktree that **holds** the change: a kept entry of the snapshot's `localWorktrees` section for issue N whose `dirState` is `present`. This is the predicate #883's W2 tie-break uses in `resolveBranch`.
- An origin branch that **holds** the change: an entry of the snapshot's `remoteChanges` section for issue N whose `change` is readable.
- Per-document wording, unchanged from #883: `uncommitted: new`, `uncommitted: modified`, `committed on <branch>, not on main`, `uncommitted: deleted (committed on <branch>, missing from the working tree)`, and the `unreadable` reason.
- `sha12`: the first 12 hex digits of a commit sha.

## Source of the document tabs

### R1276-1: The document tabs follow the lookup order (R1)

`buildChangeView` MUST choose exactly one document source per read and MUST feed the Spec, SDD and Tasks tabs and the view's `documents` map from it. The order MUST be: (1) the served HEAD, when the served root's `changes` section has a row for N; (2) the one worktree that holds the change; (3) the one origin branch that holds the change. The view MUST carry the chosen source as `tabSource`, with `kind` one of `head`, `worktree`, `origin`, `none` or `refused`. A later step MUST NOT be consulted when an earlier step holds the change.

#### Scenario: A worktree-only change feeds the SDD tab
- **GIVEN** a repo whose main has no `openspec/changes/issue-7-*`, and a linked worktree on `feat/issue-7-x` for open issue 7 holding an uncommitted `spec.md` and `tasks.md` in `openspec/changes/issue-7-x/`
- **WHEN** `buildChangeView` runs for issue 7
- **THEN** `tabSource.kind` is `worktree`, the SDD tab is ok with `spec` and `tasks` present and `proposal` missing, and its source line reads `from worktree <leaf> · feat/issue-7-x`

#### Scenario: A worktree wins over origin
- **GIVEN** no change dir on main, one worktree holding the change, and an origin branch of the same issue that also holds it
- **WHEN** `buildChangeView` runs
- **THEN** `tabSource.kind` is `worktree` and no tab reads the origin branch's documents

#### Scenario: No source anywhere keeps today's reason
- **GIVEN** no change dir on main, no worktree holding the change, and no origin branch holding it
- **WHEN** `buildChangeView` runs
- **THEN** `tabSource.kind` is `none` and each of the three tabs fails with `no change dir at openspec/changes/issue-N-*`

### R1276-2: Main holding the change leaves the tabs unchanged (R2)

When the served root's `changes` section has a row for N, `tabSource.kind` MUST be `head`, and the `spec`, `sdd` and `tasks` values MUST be deep-equal to what they are before this change for the same snapshot and repo, with no `from` line. Worktrees and origin branches of the same issue MUST NOT change any of the three tabs.

#### Scenario: A main change with a dirty worktree beside it
- **GIVEN** issue 11 with a change dir on main and a worktree on `feat/issue-11-a` holding an uncommitted edit of `tasks.md`
- **WHEN** `buildChangeView` runs for issue 11
- **THEN** the three tabs equal the values built from the served HEAD alone, carry no `from` line, and the worktree's edit appears only in its "on this machine" block

### R1276-3: The worktree is chosen with #883's tie-break, and several are refused (R1)

When exactly one worktree holds the change, it MUST be the source. When more than one holds it, `tabSource.kind` MUST be `refused`, each of the three tabs MUST fail with the reason `several worktrees hold the change dir for #N: <leaf>, <leaf>; the tabs read none of them — each is under "on this machine"`, and origin MUST NOT be consulted. The holding set MUST be computed by the same helper `resolveBranch` uses, so the two can never disagree.

#### Scenario: Two worktrees hold the change
- **GIVEN** no change dir on main, and worktrees `wt-a` on `feat/issue-7-x` and `wt-b` on `fix/issue-7-y`, each with `dirState` present
- **WHEN** `buildChangeView` runs for issue 7
- **THEN** each of the three tabs fails with a reason naming `wt-a` and `wt-b`, and `tabSource.kind` is `refused`

#### Scenario: A worktree with no change dir does not count
- **GIVEN** no change dir on main, worktree `wt-a` holding the change and worktree `wt-b` on the same issue with no change dir
- **WHEN** `buildChangeView` runs
- **THEN** the source is `wt-a` and no refusal is made

### R1276-4: Origin is the source only when no worktree holds the change (R1)

When neither main nor a worktree holds the change, the source MUST be an origin branch that holds it, read at the sha of #1201's remote entry, and the documents MUST be the ones that remote block already read. No extra fetch and no forge call MUST be made. When exactly one origin branch holds the change, it is the source. When more than one holds it (ruled, Q1), the source MUST be the holder whose branch is the headBranch of the issue's open PR in `snapshot.prs`, the same first precedence `resolveBranch` uses; when no holder is that branch, or the issue has no open PR, `tabSource.kind` MUST be `refused` and each tab MUST fail with `several origin branches hold the change dir for #N: <branch>, <branch>; no open PR names one of them, so the tabs read none`. When the chosen holding branch is past the drawer's remote cap and its block was not read, each tab MUST say so and MUST NOT read it.

#### Scenario: An origin-only change feeds the Spec tab
- **GIVEN** no change dir on main, no worktree on issue 7, and `origin/feat/issue-7-x` at sha `S` holding `spec.md` with one requirement
- **WHEN** `buildChangeView` runs for issue 7
- **THEN** the Spec tab shows that requirement's card and its source line reads `from origin/feat/issue-7-x @ <S12>`

#### Scenario: Several origin branches, the open PR picks one
- **GIVEN** no change dir on main, no worktree on issue 7, two origin branches `feat/issue-7-x` and `fix/issue-7-y` that both hold the change, and an open PR of issue 7 whose head branch is `fix/issue-7-y`
- **WHEN** `buildChangeView` runs for issue 7
- **THEN** `tabSource.kind` is `origin` and the tabs read `fix/issue-7-y`

#### Scenario: Several origin branches and no open PR are refused
- **GIVEN** no change dir on main, no worktree on issue 7, two origin branches that hold the change, and no open PR for issue 7
- **WHEN** `buildChangeView` runs for issue 7
- **THEN** `tabSource.kind` is `refused` and each of the three tabs fails with a reason naming both branches

### R1276-5: A step that could not be read stops the walk (ruled, Q2)

When the served root's `changes` section could not be read for any reason other than the directory being absent, the tabs MUST keep today's behaviour. A served root with no `openspec/changes` directory is a repository with no changes, so main holds no change dir and the walk MUST continue to the worktree step. When the `localWorktrees` section is not readable or still pending, the walk MUST stop, `tabSource.kind` MUST be `none`, and each tab MUST say `this machine's worktrees were not read, so the tabs cannot fall back past them: <reason>`. When the holding worktree's block is `unreadable`, each tab MUST fail with `the change dir in worktree <leaf> could not be read: <reason>`. A step that was not read MUST NOT be reported as a step that holds nothing.

#### Scenario: A root with no changes directory still shows a worktree change
- **GIVEN** a served root with no `openspec/changes` directory and a worktree holding an uncommitted `spec.md` and `tasks.md` for the issue
- **WHEN** `buildChangeView` runs
- **THEN** `tabSource.kind` is `worktree` and the Spec and SDD tabs are ok

#### Scenario: An unreadable worktree section is said, not skipped
- **GIVEN** no change dir on main, a `localWorktrees` section that is uncomputable, and an origin branch holding the change
- **WHEN** `buildChangeView` runs
- **THEN** each of the three tabs fails with a reason saying this machine's worktrees were not read, and no tab reads the origin branch

## What each tab shows

### R1276-6: Each tab states its source (R1)

When the source is a worktree or an origin branch, each of the three tabs, failed or not, MUST carry a `from` line, set as text. The Spec tab MUST read `from worktree <leaf> · <wording of spec.md>`, the Tasks tab `from worktree <leaf> · <wording of tasks.md>`, and the SDD tab `from worktree <leaf> · <branch>`; the wordings are #883's per-document wordings. From origin, all three MUST read `from origin/<branch> @ <sha12>`. The Tasks tab's progress label MUST name its source: `working tree` for a worktree and `at origin/<branch>` for origin, instead of `at HEAD`. The drawer's empty-state line MUST name the source when the served HEAD has no change dir and the source is not `none`.

#### Scenario: An uncommitted spec names its worktree and state
- **GIVEN** the source is worktree `brain-issue-1251` and its `spec.md` is untracked
- **WHEN** the drawer renders the Spec tab
- **THEN** a line reads `from worktree brain-issue-1251 · uncommitted: new`

#### Scenario: A worktree tasks count says working tree
- **GIVEN** the source is a worktree whose `tasks.md` has 3 of 5 boxes ticked
- **WHEN** the drawer renders the Tasks tab
- **THEN** the progress label reads `3 / 5 tasks done · working tree`

### R1276-7: The Spec tab's cards come from the source's spec.md

The Spec tab MUST parse its cards from the source's `spec.md` text with the existing grammar. Each card's and each scenario's source path MUST name the source: `worktree <leaf>:<path>` or `origin/<branch>:<path>`, so no card cites a main path it was not read from. A `spec.md` absent from the worktree MUST fail the tab with `spec.md is not in worktree <leaf>`; a deleted one MUST fail with #883's deleted wording; an unreadable one MUST fail with its reason. A truncated one MUST carry the existing truncation note.

#### Scenario: Cards from an uncommitted worktree spec
- **GIVEN** the source is worktree `wt-1` whose untracked `spec.md` holds `### R7-1: Title` with one complete scenario
- **WHEN** `buildChangeView` runs
- **THEN** the Spec tab holds card `R7-1` with one complete scenario, and the card's source path starts with `worktree wt-1:`

### R1276-8: The SDD tab's stages come from the source's documents

From a worktree or origin source, each of the six document stages MUST be `present` exactly when the source holds that document (a worktree document in state `deleted` is not present). The `archive` stage MUST carry `present: false` with the detail `not read outside the served root`, because neither source reads `archive-report.md`. A worktree row's detail MUST be #883's per-document wording. The slice plan MUST be parsed from the source's `tasks.md` text with `parseSliceScopes`; without one, the plan MUST say why.

#### Scenario: A deleted document is not present
- **GIVEN** the source is a worktree whose committed `design.md` is missing from its working tree
- **WHEN** the SDD tab is built
- **THEN** the design row is not present and its detail reads `uncommitted: deleted (committed on <branch>, missing from the working tree)`

### R1276-9: The Tasks tab never fails because a line is uncommitted

From a worktree source, the checklist MUST be parsed from the worktree's `tasks.md` text. Attribution MUST be read with one `git blame --porcelain --contents - <worktree head> -- <path>` on the served root's git dir, given the bytes already read as stdin. A line blamed to the all-zero sha MUST carry attribution `{ok: false, reason: "uncommitted in worktree <leaf>: no blame"}`; other lines MUST carry their author and time. An untracked `tasks.md` (state `new`) MUST NOT spawn a blame, and every row MUST carry the same uncommitted reason. A blame call that fails MUST be said per row with git's reason, as today, and the checklist MUST still render in full. From origin, the blame MUST run at the origin sha.

#### Scenario: A ticked box in a committed tasks.md
- **GIVEN** the source is a worktree whose committed `tasks.md` has one line changed from `- [ ] 1.2` to `- [x] 1.2` and not committed
- **WHEN** the Tasks tab is built
- **THEN** row 1.2 is done and says `uncommitted in worktree <leaf>: no blame`, and every other row carries the fixture's author

#### Scenario: An untracked tasks.md spawns no blame
- **GIVEN** the source is a worktree whose `tasks.md` is untracked, and a recording git runner
- **WHEN** the Tasks tab is built
- **THEN** the runner recorded no `blame`, and each row says `uncommitted in worktree <leaf>: no blame`

## Bounds

### R1276-10: Read-only, text-only, forge-free and bounded (R4)

No code added by this change MUST write a file, take a git lock, or run a git verb that writes. No git call MUST carry `-C`, `--git-dir` or `--work-tree`, and no git call MUST name a path under a worktree as a file to read. `change-route.mjs` MUST keep no `node:fs` import. The forge port MUST NOT be called. The drawer read MUST add at most one git spawn over today's: the Tasks blame of a worktree or origin source, which takes the place of the served-HEAD blame that a missing main change dir never runs. Every string this change renders MUST be set through `textContent` (the page's `el()`); any DOM walk in a test MUST use `Array.from` over a NodeList.

#### Scenario: A worktree-sourced drawer read is bounded and forge-free
- **GIVEN** a recording git runner that throws on write verbs, a vcs that throws when touched, and one worktree holding issue 7's change with a modified `tasks.md`
- **WHEN** `buildChangeView` runs for issue 7
- **THEN** the vcs was never called, no recorded call carries `-C`, `--git-dir` or `--work-tree`, the only blame is `blame --porcelain --contents - <head>`, and the worktree's files are byte-identical before and after

#### Scenario: A hostile worktree leaf in the source line is text
- **GIVEN** a worktree source whose directory leaf is `wt-<img src=x onerror=alert(1)>`
- **WHEN** the drawer renders the SDD tab
- **THEN** the `from` line's `textContent` holds that literal string and the tab contains no `img` element

## Out of scope

- The Working memory, Reviews and Records tabs.
- The placement of the "on this machine" and "on origin" blocks (#883 D78).
- The map card (R883-17).
- Reading `archive-report.md` from a worktree or an origin branch.
- Any write, publish, push or PR action.
- The holding-lane tiles of the map (R3 was withdrawn; the tiles already open the drawer).

## Traceability

| Item | Requirement | Scenarios proving it |
|---|---|---|
| R1 lookup order | R1276-1 | A worktree-only change feeds the SDD tab; A worktree wins over origin; No source anywhere keeps today's reason |
| R1 tie-break, several refused | R1276-3 | Two worktrees hold the change; A worktree with no change dir does not count |
| R1 origin fallback, Q1 several branches | R1276-4 | An origin-only change feeds the Spec tab; Several origin branches, the open PR picks one; Several origin branches and no open PR are refused |
| Unread step (Q2, ruled) | R1276-5 | An unreadable worktree section is said, not skipped |
| R1 source line | R1276-6 | An uncommitted spec names its worktree and state; A worktree tasks count says working tree |
| Spec cards from the worktree | R1276-7 | Cards from an uncommitted worktree spec |
| SDD stages from the source | R1276-8 | A deleted document is not present |
| Tasks blame on uncommitted lines | R1276-9 | A ticked box in a committed tasks.md; An untracked tasks.md spawns no blame |
| R2 unchanged on main | R1276-2 | A main change with a dirty worktree beside it |
| R4 read-only, text-only, no forge | R1276-10 | A worktree-sourced drawer read is bounded and forge-free; A hostile worktree leaf in the source line is text |
| Amends #883 D76, R883-9 | This spec's header note | — |
