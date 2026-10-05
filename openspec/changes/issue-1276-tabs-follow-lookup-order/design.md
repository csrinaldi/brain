---
status: approved
issue: 1276
---

# Design — tabs-follow-lookup-order (issue 1276)

## Technical approach

This design extends #883 (D69–D85) and continues its numbering at D86. It amends D76 (D93). It contradicts no other decision of #1198, #1201 or #883.

```
buildChangeView (change-route.mjs:500)
  dir = findChangeDir(snapshot, N)                         :513  (unchanged)
  {head, headDocuments} = readHeadDocuments({run, dir})    :514  (unchanged)
  {local, localNote, held} = readLocalBlocks(...)          :518  (+ held: Map, never serialized)
  {remote, remoteNote} = readRemoteBlocks(...)             :532  (moved above the tabs, unchanged)
  source = pickTabSource({snapshot, issue, dir, head, headDocuments, local, held, remote})   NEW
        head ─▶ worktree ─▶ origin, first holder wins; several holders ─▶ refused; unread step ─▶ none
  spec  = buildSpecTab({source})      sdd = buildSddTab({snapshot, source})      tasks = buildTasksTab({source, run})
  documents = {...source.documents, resume}                (resume unchanged, D81 of #883)
  value = {..., tabSource: publicSource(source), local, localNote, remote, remoteNote}
page: drawer-model ─▶ tab.from, tasks progress source, sdd row detail ─▶ app.js renderTab (textContent only)
```

## Decisions

| # | Decision | Rejected | Why |
|---|---|---|---|
| D86 | **One source, picked once.** `pickTabSource` in `change-route.mjs` returns `{kind: 'head', dir, ref: 'HEAD', head, documents}`, `{kind: 'worktree', dir, leaf, branch, head, ref: 'worktree <leaf>', documents}`, `{kind: 'origin', dir, branch, sha, ref: 'origin/<branch>', documents}`, `{kind: 'none', reason}` or `{kind: 'refused', reason}`. Step 1 is `head` exactly when `findChangeDir` (`change-route.mjs:54`) finds a row, with today's `headDocuments` (`:514`). `buildSpecTab` (`:77`), `buildSddTab` (`:388`) and `buildTasksTab` (`:103`) take `source` instead of `{documents, head, dir}`; their `if (!dir) return noChangeDirTab(issue)` guards (`:78`, `:104`, `:398`) become `if (source.kind === 'none' \|\| source.kind === 'refused') return sourceFailure(source, issue)`. `documents` in the view (`:517`) is `{...source.documents, resume}`. The view gains `tabSource`, built by `publicSource` (`change-route.mjs`), with no document text: `{kind, dir}` for `head`, `{kind, leaf, branch, dir, label}` for a worktree, `{kind, branch, sha12, dir, label}` for origin and `{kind, reason}` for `none` and `refused`. `label` is what the empty-state line names. `readRemoteBlocks` moves above the tab calls; it takes `head`, which it already had (`:532`). | A fallback inside each builder | Three walks can pick three sources. One value feeding three builders cannot disagree with itself. |
| D87 | **The worktree step and its tie-break.** A new `holdingWorktrees(snapshot, issue)` returns the kept `localWorktrees` entries with `e.issue === issue && e.dirState === 'present'`. `resolveBranch` (`:158-160`) calls it instead of filtering inline, so the Working memory tab and the document tabs use one predicate (R1276-3). One holder: its documents come from `held.get(entry.path)`. Several: `refused`, naming every holder's `leaf` in path order. Zero: step 3. The one holder is always uncapped: `touchedAt` exists only for `present` entries (`status/local-worktrees.mjs:78`), and entries without it sort last (`:92-94`), so a lone holder ranks first, under `LOCAL_DRAWER_CAP`. A holder whose block is `unreadable` (`local-overlay.mjs:133`, `:139`) gives `none` with `the change dir in worktree <leaf> could not be read: <reason>`. | Filtering on `branch` names too | `resolveBranch` filters on names because it starts from `git branch --list`. Here the snapshot entry already names its branch. |
| D88 | **`held`: the documents before the collapse.** `readLocalBlocks` (`local-overlay.mjs:161`) returns `{local, localNote, held}`, where `held` is a `Map` from `entry.path` to `{documents, absent}` for every block it read, `same-as-origin` included. `localBlock` (`:128`) returns its read documents to the caller before the collapse at `:150-151` drops them from the block. `buildChangeView` destructures `held` and never spreads it into the view, so the JSON is unchanged. The three `deepEqual` assertions at `local-overlay.test.mjs:493-498` gain `held: new Map()`. | Keeping documents on a collapsed block | R883-9 says a `same-as-origin` block is listed without documents. A field the page ignores would still travel to the page. |
| D89 | **The origin step.** The holders are `snapshot.remoteChanges.value.branches` entries with `e.issue === issue && e.change?.ok` (the predicate `remoteBlock` uses at `change-route.mjs:469`). One holder: its block from `readRemoteBlocks`. Several holders (ruled, Q1): the holder whose `branch` equals `snapshot.prs.value.find(p => p.issue === issue)?.headBranch`, the same first precedence as `resolveBranch` (`:150-151`); none of them, or no open PR: `refused`, naming the branches in snapshot order (`several origin branches hold the change dir for #N: <b>, <b>; no open PR names one of them, so the tabs read none`). State `read`: its `documents` (`readHeadDocuments` at the entry's sha, `:470`, keyed by stage, `commit` set to the sha). State `capped`: `none`, reason `origin/<branch> holds the change dir but is past the drawer's read cap of 3`; it is not read again. `same-as-served` cannot occur, because `head` is null when main has no change dir (`:464`). No fetch and no forge call: the remote section and blocks are already built. | Reading a capped block for the tabs | It breaks #1201's read bound for a case that needs three unread branches of one issue to sort first. Saying so costs nothing. |
| D90 | **An unread step stops the walk (ruled, Q2).** A `changes` section that is not ok because of anything but an absent directory leaves today's `noChangeDirTab` (`:59`) unchanged, because `findChangeDir` returns null for both cases (`:55`) and R2 must hold. An absent `openspec/changes` directory (ENOENT) is not an unread step: it is a repository with no changes, so `readChanges` in `status/snapshot.mjs` returns `{ok: true, value: []}` and the walk reaches the worktree step (W1 of the verify report). The fix lives in the snapshot, not in the route, because the route only receives a `reason` string and matching ENOENT in that text would be brittle; the source knows the error code. Every other read error (EACCES, EIO, ...) stays `{ok: false, reason}` and still stops the walk. A `localWorktrees` section that is not ok, or pending, gives `none` with `this machine's worktrees were not read, so the tabs cannot fall back past them: <reason>`; origin is not consulted. | Skipping an unread step | "Not read" reported as "holds nothing" is the empty-on-failure defect the drawer's other readers already refuse (#1198, R881-9). |
| D91 | **Tasks attribution by source.** The blame argv is chosen from the source and the document's overlay state (`local-overlay.mjs:104`). `head`: `blame --porcelain HEAD -- <path>` (`change-route.mjs:114`, unchanged). `origin`: `blame --porcelain <sha> -- <path>`. Worktree, `committed`: `blame --porcelain <wt head> -- <path>`, because the bytes equal the head blob. Worktree, `modified`: `blame --porcelain --contents - <wt head> -- <path>`, with `doc.text` as stdin; git marks lines that differ from the head with the all-zero sha. Worktree, `new`: no spawn. `attachAttribution` (`:94`) gains an `uncommittedReason`: a row whose line is blamed to `/^0+$/`, or every row when the file is `new`, gets `{ok: false, reason: 'uncommitted in worktree <leaf>: no blame'}`. A failed spawn keeps today's per-row reason (`:117`), so an old git that refuses `--contents` with a revision still renders the checklist. `gitRun` (`git-run.mjs:15`) accepts `opts.input`, piping stdin only when it is given. Every git call still runs in the served root, with paths relative to it. | `--contents <worktree file path>`; no blame for any worktree file | The first makes git read a working-tree file directly, past the symlink and escape checks of #883 D77. The second hides attribution for every committed line, which is most of a worktree `tasks.md`. |
| D92 | **The source line, the progress label and the SDD rows.** The route adds `from` to the three tab values only when the source is `worktree` or `origin`, so the `head` values are deep-equal to today's (R1276-2). The Spec tab reads `from worktree <leaf> · <wording>`, the Tasks tab the same for `tasks.md`, and the SDD tab `from worktree <leaf> · <branch>`. The wording comes from `localStateWording`, newly exported from `lib/drawer-model.mjs` and imported by the route; it is the state half of `localRowDetail` factored out of it, the same `LOCAL_STATE_WORDING` table with no copy, so it is #883's wording. From origin, all three read `from origin/<branch> @ <sha12>`. Card and scenario sources, and task item sources, use the path `<ref>:<path>`, the shape the remote and local rows already use (`drawer-model.mjs:284`, `:349`). The Tasks tab adds `progressSource`: `SOURCE.workingTree` (`lib/progress-view.mjs:6`) or `at origin/<branch>`. `buildDrawerModel` (`drawer-model.mjs:406-408`) copies `from` onto ok and failed tabs (`failedTab`, `:45`), and uses `tasks.progressSource ?? SOURCE.head` at `:408`. Each SDD item may carry `detail`; `sddEntries` (`:172`) uses `item.detail ?? (present ? 'present' : 'missing')`. From a worktree, `detail` is `localRowDetail` (`:334`, exported). `archive` is `present: false` with the detail `not read outside the served root`. The slice plan comes from `parseSliceScopes(tasks.text)` (`lib/sdd-layout.mjs:437`) in the shape `sliceTab` (`change-route.mjs:370`) builds. `renderTab` (`static/app.js:1811`) draws `tab.from` first, as `el('p', 'tab-from', tab.from)`. The empty-state line (`app.js:1700`) becomes `the served HEAD has no change dir for this issue; the tabs read <worktree <leaf> \| origin/<branch> @ sha12>` when `tabSource.kind` is `worktree` or `origin`; otherwise it is today's text. Block placement (D78) is unchanged. | A source badge in the tab button | The button is a label; the source is a sentence and needs room for the state. |
| D93 | **The amendment of #883.** D76's "Tabs are unchanged and stay on the served HEAD", R883-9's "The tabs MUST keep reading the served HEAD only" and #883's out-of-scope line on worktree tabs are replaced by R1276-1. The rest of R883-9 and all of D78 are unchanged. The #883 change dir is not edited; the record is this design and `spec.md`'s header. `change-route.mjs`'s header (`:7-28`) gains one line: the document tabs follow main, worktree and origin, and the worktree read stays in `local-overlay.mjs`. R1198-4's guard (no `node:fs` in `change-route.mjs`) and the `-C` assertion stay. | Editing #883's artifacts | A shipped change's artifacts are history; its amendment belongs to the change that makes it. |

## Contract / API impact

Additive only. `GET /api/change/N` gains `value.tabSource`. The `spec`, `sdd` and `tasks` values gain `from` (worktree or origin only); `tasks` gains `progressSource`; each `sdd.value[]` item may carry `detail`. With main holding the change, none of these fields appears in the three tabs. `readLocalBlocks` returns `held`, which the route does not serialize. `gitRun`'s option contract (`git-run.mjs:12`) widens from `maxBuffer` to `maxBuffer` and `input`. No generation step.

## Interfaces

```js
// ui/change-route.mjs
holdingWorktrees(snapshot, issue) -> Entry[]              // shared with resolveBranch
pickTabSource({ snapshot, issue, dir, head, headDocuments, local, held, remote }) -> Source
// ui/local-overlay.mjs
readLocalBlocks({ run, snapshot, issue, mainDocuments, _fs }) -> { local, localNote, held: Map<path, {documents, absent}> }
// ui/git-run.mjs
gitRun(root) -> (file, args, { maxBuffer?, input? }) -> stdout
// ui/lib/drawer-model.mjs
localRowDetail(doc, branch) -> string                     // exported
```

## Testing strategy (strict TDD, node:test)

**First RED:** `brain/scripts/ui/tab-source.test.mjs`, "R1276-1: a worktree-only change feeds the SDD tab and says where it came from". `makeWorktreeRepo()` (`ui/test-support/git-worktree-fixture.mjs`) with no change dir on main; `addWorktree('feat/issue-7-x', {'openspec/changes/issue-7-x/spec.md': …, 'openspec/changes/issue-7-x/tasks.md': …})`, uncommitted. A stub vcs lists issue 7 open and no PRs; `buildSnapshot`, then `buildChangeView({root, issue: 7, snapshot})` with the real `gitRun`. Assert `value.sdd.ok === true`, the `spec` and `tasks` rows present and `proposal` missing, `value.sdd.from` starting with `from worktree `, and `value.tabSource.kind === 'worktree'`. It fails today: `sdd` is `{ok: false, reason: 'no change dir at openspec/changes/issue-7-*'}`. It is first because it is the defect as measured on #1251.

| File | Action |
|---|---|
| `ui/tab-source.test.mjs` | Create. First RED; R1276-3 (two holders refused, a holder beside a no-dir worktree); R1276-7 (cards and their `worktree wt-1:` source); R1276-8 (a deleted `design.md`); R1276-9 on real git (a committed `tasks.md` with one ticked line, row 1.2 uncommitted and the rest attributed; an untracked `tasks.md` with no `blame` recorded); R1276-10 (recording runner throwing on write verbs, a throwing vcs, byte-identity, the one `--contents -` blame). |
| `ui/change-route.test.mjs` | Modify. R1276-2: for the existing main-change fixture, the three tab values deep-equal a pinned copy built before the change and carry no `from`. R1276-4 and the capped-origin reason, with a fake `remoteChanges` section and the fake git runner. R1276-5: uncomputable and pending `localWorktrees`. `resolveBranch` still resolves through `holdingWorktrees`. |
| `ui/local-overlay.test.mjs` | Modify. `held` carries a `same-as-origin` block's documents while the block itself has none; `:493-498` gain `held`. |
| `ui/lib/drawer-model.test.mjs` | Modify. `from` on ok and failed tabs; `progressSource` in the tasks header; `detail` on SDD rows; `head` views unchanged. |
| `ui/static/local-render.test.mjs` | Modify. `tab-from` line drawn as text; a hostile leaf yields no element (`Array.from` over `querySelectorAll`); the empty-state line names the source. |
| 

No network, no real timers. The fixture has no remote; the origin step is tested with the fake runner and a fake `remoteChanges` section, as #1201's tests do.

## Size (gated, excluding `*.test.mjs`)

| File | Lines |
|---|---|
| `ui/change-route.mjs` | +~95 |
| `ui/local-overlay.mjs` | +~8 |
| `ui/git-run.mjs` | +~3 |
| `ui/lib/drawer-model.mjs` | +~15 |
| `ui/static/app.js` | +~12 |

About 135 in all, against the `lite` budget of 1000. One PR.

## Migration / rollout

None. All fields are additive, and a view with `tabSource.kind === 'head'` is unchanged.

## Risks

- **Git version (D91).** `--contents` with a revision needs a recent git; apply runs `git --version` and records it. An older git degrades to the per-row reason, never to a failed tab.
- **Line alignment of a truncated `tasks.md`.** A file over `DOCUMENT_CAP` is blamed on its cut text, so its last line may read as uncommitted. The tab already carries the truncation note.
- **Q1 and Q2 are ruled** (2026-10-04). The spec states both outcomes.
