---
status: verified
issue: 1284
verdict: PASS
---

# Verify report — inflight-home-one-line-header (issue 1284)

Verdict: PASS. CRITICAL 0, WARNING 2, SUGGESTION 2.

## Runs

- `npm test`: 7585 tests, 7582 pass, 0 fail, 3 skipped.
- `npm run brain:repo:check`: pass. `npm run brain:nav`: pass.
- Red-on-parent (detached worktree at origin/main 94b2d134, new test files copied in, then removed):
  - `ui/lib/inflight-model.test.mjs`: ERR_MODULE_NOT_FOUND, 0 pass.
  - `ui/static/inflight-render.test.mjs`: 9 fail, 0 pass.
  - `ui/static/header-render.test.mjs`: 4 fail, 2 pass.
  - `ui/static/local-render.test.mjs`: 1 fail (the R1284-12 no-absence-line test), 14 pass.
  - `ui/lib/sdd-model.test.mjs`: fails on the parent (new D102 exports missing).

## Requirement to test map

All paths under brain/scripts/ui.

- R1284-1: lib/inflight-model.test.mjs:31 (closed no row), :43 (missing-dir worktree in flight).
- R1284-2: :52 (one row, counts across worktrees/branches/PRs), :72 (author, hostile literal), :87.
- R1284-3: :104 (null state kept as unknown; unlisted issue gets no row, D96); static/inflight-render.test.mjs:120 ("state unknown").
- R1284-4: :121 (latest wins), :131 (change-dir last commit, head commit), :144 (failed read is unknown, not stale).
- R1284-5: :157 (order, ties), :165 (exactly 7 days stale, 7d-1ms not); render :133 ("stale (N)", collapsed).
- R1284-6/7: model :176, :194, :208, :220; render :85, :109.
- R1284-8 amended scenarios: render :70 (no rows while hierarchy pending, names the three, candidate count text); model :194 (candidates count, no rows); render :98 (late hierarchy draws only open candidates, closed gets none, hierarchy no longer named).
- R1284-9: render :58 (section before lanes, `?` lane after), :151 (click opens drawer), :159 (hostile author is text, no img).
- R1284-10/11: static/header-render.test.mjs:46 (`epic: not resolved`, long sentence as title only), :57 (#banners holds it), :63 (failed source in #banners), :69, :80, :92 (nowrap); lib/header-model.test.mjs:59.
- R1284-12: static/local-render.test.mjs:253 (card drops line, drawer keeps it), :263 (unread forge section keeps the line), :269 (remote-only keeps its line); lib/sdd-model.test.mjs:363, :373 (quietAbsence only when both read and nobody holds the issue).
- R1284-13: lib/inflight-model.test.mjs:226 (no I/O imports, no clock).
- Data layer: status/local-worktrees.test.mjs (D103 single git show, failure leaves null), status/snapshot.test.mjs (D94 one git log, untracked, throwing log degrades, no call for zero dirs).

Specific checks requested: unknown-activity never in stale (:144), STALE_DAYS boundary (:165), null state (:104), unlisted no row (:104), one row across worktrees/branches (:52), epic sentence not in visible header text (header-render:46), R-E only when both read and empty (local-render:263 and sdd-model:373): all present.

## Findings

### WARNING

1. D103 precedence is untested. `activityOf` (lib/inflight-model.mjs:55-67) puts `headCommitAt` in the fallback pool, so it is used only when no worktree `touchedAt` or branch `tipAt` exists. No test gives a row both `headCommitAt` and a `touchedAt`/`tipAt` and asserts the latter wins (test :131 covers only the fallback use). Behavior reads correct; the guard is missing.
2. The change dir's `lastCommit` is in the same fallback pool as `headCommitAt`, so a row with a change dir and a stale branch tip uses the branch tip even if the dir was committed more recently. Matches R1284-4 text ("latest of worktrees/branches, and change-dir-only rows use the commit date"), so acceptable; noted as untested semantics.

### SUGGESTION

1. D96 drops an issue the hierarchy does not list. `hierarchyOf` exposes `closedRead`; the model does not consult it, so if the open list were itself truncated the row would silently vanish. Low risk (design ruled the open list complete); consider naming it in notices if `closedRead.ok` is false.
2. The working tree shows ` M .memory/index.jsonl` after running `npm test` (a test side effect, not part of this change). Do not commit it with the change.

## Deviations (apply-progress.md)

1. D103 placement in `readLocalWorktrees`: acceptable. The reader cannot see branch times; the model enforces the precedence. Entries gain a nullable `headCommitAt`, additive. See WARNING 1.
2. Extra model fields (`facts`, `authorLines`, `notices`, `empty`, `candidates`): acceptable. They keep app.js thin (R1284-13) and are covered by model tests :92, :194, :208.
3. Publish canary 9.6 to 9.7 MB (test/publish-allowlist.e2e.test.mjs): acceptable. About 60 KB of source and suites, in its own commit with the reasoning stated.
4. Phase-4 tests and `facts` code not run red first: acceptable with a note. Red-on-parent was proven here for sdd-model, local-render and header tests; `facts` is covered by :92, and apply-progress records a mutation sanity run.
5. R1284-3/R1284-8 spec text vs D96: spec was amended to match the ruling; the implementation and tests agree with the amended text.

## Honesty scan

- While hierarchy is pending or failed: no rows, candidate count stated, sources named (pending worded apart from failed). `empty` is null whenever any source is missing (model :194, render :109). PASS.
- "no open issue is in flight" only when all five sources are ready. PASS.
- Authors: never invented; worktrees name no author. PASS.
- Card absence line removed only when both forge sections are read and nobody holds the issue; the drawer keeps the statement. PASS.
- Unknown activity is labeled `activity unknown` and kept out of stale. PASS.
- Gated diff 330 lines (apply-progress) against the budget of 1000.

Tasks: all 1.1 through 7.4 reported done and match the code state.
