---
status: approved
issue: 1276
---

# Tasks — tabs-follow-lookup-order (issue 1276)

Strict TDD: every phase is RED → GREEN → REFACTOR. A RED task names the test and why it fails today; a GREEN task makes exactly that test pass with the least code; a REFACTOR task changes no behaviour and keeps the suite green. Test runner: `npm test`; one file runs with `node --test <path>`. No network and no real timers. Requirement and decision numbers refer to `spec.md` and `design.md`.

**Gate before apply: cleared.** The maintainer ruled Q1 (several origin branches: the open PR's head branch wins, else refuse) and Q2 (an unread step stops the walk), and withdrew R3 (the tile defect was a false report). The rulings are recorded in the proposal, spec and design.

## Phase 1 — The first RED and one source (R1276-1, D86–D88)

- [x] 1.1 Run `git --version` and record it in `apply-progress.md` (D91's risk).
- [x] 1.2 RED — create `brain/scripts/ui/tab-source.test.mjs`, "R1276-1: a worktree-only change feeds the SDD tab and says where it came from" (design's first RED, on `ui/test-support/git-worktree-fixture.mjs`). **Fails today:** `sdd` is `{ok: false, reason: 'no change dir at openspec/changes/issue-7-*'}`, and there is no `tabSource`.
- [x] 1.3 GREEN — `ui/local-overlay.mjs`: `readLocalBlocks` returns `held` (D88). `ui/change-route.mjs`: `holdingWorktrees`, `pickTabSource` with the `head` and `worktree` steps, `buildSddTab` from `source`, `tabSource` and `from` on the SDD tab, `documents` from the source; `readRemoteBlocks` called above the tabs.
- [x] 1.4 RED — `ui/local-overlay.test.mjs`: a `same-as-origin` block has no documents while `held` carries them; update the three `deepEqual`s at `:493-498` to include `held: new Map()`. Fails until `localBlock` hands its documents over before the collapse.
- [x] 1.5 GREEN — `localBlock` returns its read documents to `readLocalBlocks` before the collapse.
- [x] 1.6 REFACTOR — `resolveBranch` (`change-route.mjs:158-160`) uses `holdingWorktrees`; the existing R883-15 tests stay green.

## Phase 2 — Main unchanged, refusal and the unread step (R1276-2, R1276-3, R1276-5, D87, D90)

- [x] 2.1 RED — `ui/change-route.test.mjs`, R1276-2: before any GREEN in this phase, pin the `spec`, `sdd` and `tasks` values built for the existing main-change fixture, and add a worktree on the same issue with a dirty `tasks.md`; assert deep-equality and no `from`. It must pass on the Phase 1 code. If it fails, Phase 1 broke R2: fix that first.
- [x] 2.2 RED — `ui/tab-source.test.mjs`, R1276-3: two holders give `refused` with both leaves on all three tabs; a holder beside a no-dir worktree is chosen. `ui/change-route.test.mjs`, R1276-5: uncomputable and pending `localWorktrees` give the "were not read" reason and origin is not read; an `unreadable` holder block gives its reason. Fails: the walk has no refusal and no stop.
- [x] 2.3 GREEN — The `refused` and `none` kinds in `pickTabSource`; `sourceFailure` used by all three builders.

## Phase 3 — The Spec and Tasks tabs from the source (R1276-6, R1276-7, R1276-9, D91, D92)

- [x] 3.1 RED — `ui/tab-source.test.mjs`, R1276-7: cards from an untracked worktree `spec.md`, their source paths starting with `worktree wt-1:`, and `from worktree wt-1 · uncommitted: new`; an absent `spec.md` fails with `spec.md is not in worktree wt-1`. Fails: `buildSpecTab` still reads `dir`.
- [x] 3.2 GREEN — `buildSpecTab` from `source`; `<ref>:<path>` sources; the `from` line.
- [x] 3.3 RED — `ui/tab-source.test.mjs`, R1276-9 on real git: a committed `tasks.md` with one line ticked in the working tree gives row 1.2 `uncommitted in worktree <leaf>: no blame` and the fixture author on the others; an untracked `tasks.md` records no `blame` and every row carries the uncommitted reason; a runner whose blame throws still renders the checklist with git's reason per row. Fails: the tab still reads `dir` and blames `HEAD`.
- [x] 3.4 GREEN — `ui/git-run.mjs` accepts `opts.input`; `buildTasksTab` from `source` with D91's argv per overlay state; `attachAttribution` with `uncommittedReason`; `progressSource`.
- [x] 3.5 REFACTOR — `documentFailure` (`change-route.mjs:65`) names the source's ref instead of `HEAD`; one wording table, no copy.

## Phase 4 — Origin and the SDD rows (R1276-4, R1276-8, D89, D92)

- [x] 4.1 RED — `ui/change-route.test.mjs`, R1276-4 with a fake `remoteChanges` section and the fake runner: one holding branch feeds the Spec tab with `from origin/feat/issue-7-x @ <sha12>` and the Tasks blame at its sha; a capped holder gives the "past the drawer's read cap" reason; two holders with an open PR on one of them read that PR's branch, and two holders without one are refused (Q1, ruled). `ui/tab-source.test.mjs`, R1276-8: a deleted `design.md` row is not present with #883's deleted wording, and `archive` reads `not read outside the served root`. Fails: no origin step and no row detail.
- [x] 4.2 GREEN — The origin step in `pickTabSource`; SDD rows with `detail` (`localRowDetail` exported from `lib/drawer-model.mjs`); the slice plan from `parseSliceScopes(tasks.text)`.

## Phase 5 — The page (R1276-6, D92)

- [x] 5.1 RED — `ui/lib/drawer-model.test.mjs`: `from` on ok and failed tabs; `3 / 5 tasks done · working tree`; SDD `detail` used when present; a `head` view's tabs unchanged. `ui/static/local-render.test.mjs`: a `tab-from` line drawn as text; a hostile leaf `wt-<img src=x onerror=alert(1)>` yields no `img` (`Array.from` over the NodeList); the empty-state line names the source. Fails: the model and `renderTab` ignore `from`.
- [x] 5.2 GREEN — `buildDrawerModel` copies `from` and uses `progressSource`; `sddEntries` uses `detail`; `renderTab` and the empty-state line in `static/app.js`, through `el()` only.

## Phase 6 — Bounds and closing (R1276-10, D93)

- [x] 6.1 RED — `ui/tab-source.test.mjs`, R1276-10: a recording runner that throws on write verbs and a vcs that throws; no `-C`, `--git-dir` or `--work-tree`; exactly one `blame --porcelain --contents - <head>`; the worktree's files and admin `index`/`HEAD` byte-identical before and after. It should pass on the GREEN code; if it fails, the bound was broken and is fixed here.
- [x] 6.2 REFACTOR — `change-route.mjs` header (D93); R1198-4's guard (`change-route.test.mjs`, no `node:fs`) stays green; `rg "stay on the served HEAD|served HEAD only" brain/scripts/ui` finds no stale claim in code comments.
- [x] 6.3 Verify on this machine: `GET /api/change/1251` gives `spec.ok === true`, an SDD tab with `proposal` and `spec` present, and a `from worktree brain-issue-1251 · …` line on all three tabs. Record the output in `apply-progress.md`.
- [x] 6.4 `npm test` and `npm run brain:repo:check` green.

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~135 gated (`*.test.mjs`, `openspec/changes/**` and `.memory/**` excluded) |
| Governance tier budget (`lite`) | 1000 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | None |
| Delivery strategy | ask-on-risk |
| Chain strategy | Not applicable |

Decision needed before apply: No (Q1 and Q2 ruled, R3 withdrawn)
Chained PRs recommended: No
Chain strategy: not applicable
