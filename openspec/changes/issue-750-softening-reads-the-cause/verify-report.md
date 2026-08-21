---
status: verified
issue: 750
change: issue-750-softening-reads-the-cause
---

# Verify Report — issue #750, worktree /home/gandalf/IA/brain-issue-750

Branch `fix/issue-750-softening-reads-the-cause`, tip `d0ffb32`, 8 commits over `origin/feature/issue-682`@bf8240f. Tree clean, not pushed, no PR. Verification done read-only in the shared worktree; all mutating checks (full `npm test`, `brain:check`, mutation census, RED-commit reruns) ran in isolated worktrees (`wt-verify` detached at d0ffb32, `wt-red` detached per-commit) to avoid interference from a concurrent reviewer also working in the shared worktree.

**Verdict: PASS**

## 1. REQ → test map (all pass)

| Requirement | Test file:approx-line | Result |
|---|---|---|
| REQ-750-1 tranche rollup-not-array | tranche.test.mjs:452 | pass |
| REQ-750-1 tranche budget-uncomputable, no blocker | tranche.test.mjs:457 | pass |
| REQ-750-1 tranche budget-uncomputable + blocker | tranche.test.mjs:463 | pass |
| REQ-750-1 tranche normal exit w/ blocker | tranche.test.mjs:470 | pass |
| REQ-750-1 tranche normal exit w/o blocker | tranche.test.mjs:476 | pass |
| REQ-750-1 checkpoint inherited-only | checkpoint.test.mjs:359 | pass |
| REQ-750-1 checkpoint observed-only | checkpoint.test.mjs:~377 | pass |
| REQ-750-1 checkpoint union/dedup | checkpoint.test.mjs:385 | pass |
| REQ-750-1 ruling malformed fork | ruling.test.mjs:151 | pass |
| REQ-750-1 ruling valid fork (STOP) | ruling.test.mjs:156 | pass |
| REQ-750-1 non-producers silent | verified by `rg` (0 matches in inferential.mjs, refuter.mjs, causal-admission.mjs) | pass |
| REQ-750-2 `[]` fail-closed | verdict.test.mjs:906 | pass |
| REQ-750-2 mixed causes | verdict.test.mjs:914 | pass |
| REQ-750-2 omitted field | verdict.test.mjs:920 | pass |
| REQ-750-3 KNOWN GAP closure | verdict.test.mjs:870 | pass |
| REQ-750-3 real-verb differential (main()) | cli.test.mjs:331 | pass (both arms) |
| REQ-750-4 #483 case still softens | verdict.test.mjs:963 (+ companion at ~174) | pass |
| REQ-750-5 threading/no-render/no-parse | cli.mjs:658 diff, `rg` on parse-verdict.mjs (0 matches), verdict.mjs single read site | pass |
| REQ-750-6 doctrine §6.2 | `git diff` + `rg` on reviewer-protocol.md | confirmed textually |

## 2. Issue #750 acceptance criteria

- **Real-verb differential proof**: `cli.test.mjs:331` drives `main()` in-process, arm A (base resolves) asserts `verdict: APPROVE` + `follow_ups:`, arm B (`baseSha: null`) asserts `verdict: REVISE` + `evidence uncomputable` + `assert.doesNotMatch(/verdict: APPROVE/)`. Both pass today.
- **#483 still softens**: `verdict.test.mjs:963` (`conclusionCauses: ['blocker']`) → APPROVE; companion pre-existing fixture at `verdict.test.mjs:~174` also updated (deviation #1, caught by apply's full-suite run, not the design's own census).
- **KNOWN GAP pin REPLACED, not deleted**: `git log -S'KNOWN GAP' -- verdict.test.mjs` → commits `cbc94b1` (#682, introduced) and `5a2ebff` (#750 RED). Diff of `5a2ebff` shows the old `test('KNOWN GAP: ...)` block removed and a new `test('#750: ... KNOWN GAP is CLOSED')` added at the same location, same fixture, asserting `REVISE` instead of `APPROVE`, with an explicit "REPLACES ... do not delete" comment.
- **Producer audit recorded**: spec.md REQ-750-1 six-row table present; apply-progress carries the same table (line-numbers updated post-edit) for the PR body (tasks.md work unit 6.1).

## 3. Five pre-existing conjuncts — byte-identical

`git diff origin/feature/issue-682 -- brain/scripts/review/verdict.mjs` shows exactly three hunks: (a) new `conclusionCauses = []` destructuring param + comment, (b) new `causeIsBlockerOnly` const + comment, (c) the guard line with only `&& causeIsBlockerOnly` appended — the original five conjuncts (`protocol === 'brain-review/2' && processed.length > 0 && candidateFindings.length === 0 && raisedConclusion === 'REVISE' && !escalatesWithoutBlocking`) are untouched, same text, same order.

## 4. `conclusionCauses` — builder-internal only

- Rendered: `rg conclusionCauses brain/scripts/review/verdict.mjs` → only the destructuring default, the guard read, and comments. No occurrence in `renderVerdict`'s output-line construction.
- Parsed: `rg conclusionCauses brain/scripts/review/lib/parse-verdict.mjs` → 0 matches (rc=1).

## 5. Doctrine

`git diff origin/feature/issue-682 -- brain/core/methodology/reviewer-protocol.md`: single hunk at `:327`, replacing the shape-only softening bullet with the cause-gated paragraph (states non-empty + all-blocker, states the §10 restatement, states the fail-closed silence rule). §10 (`:419`) untouched — confirmed by hunk location (only one `@@` at `:327`) and no second hunk near `:419`. `git diff --stat origin/feature/issue-682 -- brain/core/` → only `reviewer-protocol.md`, no other doctrine file touched.

## 6. Test execution (isolated worktree `wt-verify`, detached at d0ffb32)

- `npm test`: **4143/4143 pass**, 0 fail, run in a clean isolated worktree (not the shared one, per concurrency correction) — matches apply-progress's own count.
- `npm run brain:check`: 5/6 PASS (diffSize, adrPresence, memoryPresence, npmTest, repoCheck). 1 FAIL: `issueLink` — reads `git log -1 --format=%B HEAD` as a local PR-body proxy; expected since no PR/labels exist yet (P.6 explicitly deferred). No `tier2-frontier`/`decision-surface` findings surfaced (that evaluator is `brain:review`, not run here, consistent with apply-progress).

## 7. Mutation re-verification (isolated worktree, both applied/restored)

| # | mutation | file:line | `git diff --stat` | full-suite result | restored |
|---|---|---|---|---|---|
| A | delete sixth conjunct `&& causeIsBlockerOnly` | verdict.mjs:272 | 1 file, 1 insertion(+), 1 deletion(-) | 4138 pass / **5 fail**: pin (i) KNOWN-GAP closure, pins (ii)/(iii)/(iv), cli.test.mjs arm-B differential — exactly the named pins | yes, `git checkout --` |
| B | drop checkpoint union spread (`...tranche.conclusionCauses,`) | checkpoint.mjs:250 | 1 file, 1 deletion(-) | 4142 pass / **1 fail**: `evaluateCheckpoint: inherited-only ...` — exactly the named pin | yes, `git checkout --` |

Both counts match apply-progress's mutation census (#1 and #6) exactly. Post-restore `git status --short` clean in the isolated worktree both times.

## 8. RED commit verification (temporary worktrees, mandated by Strict TDD)

- `674ee54` (work unit 1 RED) checked out standalone: `node --test tranche.test.mjs` → **30 pass / 5 fail**, all 5 failures are the new `conclusionCauses` pins (field `undefined`) — RED confirmed.
- `5a2ebff` (work unit 3 RED) checked out standalone: `node --test verdict.test.mjs cli.test.mjs` → **114 pass / 5 fail**: the KNOWN-GAP closure test, pins (ii)/(iii)/(iv), and the cli differential — exactly matching the GREEN commit's claimed fix set. RED confirmed.

Commit order in `git log`: every RED commit (`674ee54`, `5a2ebff`) precedes its GREEN commit (`e69d9ce`, `55b8943`) — confirmed by `git log --oneline`.

## 9. tasks.md

22 tasks ticked `[x]`, 4 unticked `[ ]` (P.4 decision label, P.5 type:bug label, P.6 PR body content, P.7 cold review) — all four are PR-creation-time items explicitly deferred to the orchestrator per the apply-progress stop boundary; unticked by design, matches the design's own review-workload forecast (no chained PRs needed, single PR onto the tracker).

## Issues

**CRITICAL**: none.

**WARNING**: none.

**SUGGESTION**:
1. `brain:check`'s `issueLink` failure and P.4–P.7 remain open until PR creation — routine, not a defect, but the orchestrator must not skip them before merge.

## Summary

CRITICAL: 0, WARNING: 0, SUGGESTION: 1. Implementation matches spec REQ-750-1..6 and issue #750's acceptance criteria with passing, real-verb, differential test evidence. TDD RED→GREEN order confirmed for both behaviour-changing work units. Doctrine amendment is scoped correctly (§6.2 only, §10 untouched, no other doctrine file touched). Mutation census reproduced independently with matching fail counts. Remaining gaps are exclusively PR-creation-time checklist items (P.4–P.7), left unticked by design.
