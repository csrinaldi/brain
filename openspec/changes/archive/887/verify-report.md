---
change: issue-887-lane-collector
status: PASS WITH WARNINGS
verified_at: 2026-09-10T01:33:58Z
head: 2ec285580de0d9f01ce5eed7b8d4f2c37cd42413
---

# Verification Report — #887 the lane collector

**Mode**: Strict TDD. Both slices landed: PR #898 (Slice A, planner, `Closes #897`, merged
`35fd2926`) and PR #899 (Slice B, shell + `collect` op, `Closes #887`, merged `2ec28558`).
Ruling `sdd/issue-887-lane-collector/ruling` (D1–D7) confirmed against the current tree.

## Completeness

| Metric | Value |
|---|---|
| tasks.md checkbox items (A1–A3, B1–B4, correction batches, X1, W1–W4, PR-A.1, PR-B.1, SP.1) | all `[x]` |
| Unchecked items remaining | 0 (`rg '^\s*- \[ \]' tasks.md` → no matches) |
| Uncommitted local edit | `tasks.md` ticks for X1, W2–W4, PR-A.1, PR-B.1, SP.1 — matches actual PR/issue state verified below |

## Build & Tests Execution

**Focused** (`node --test brain/scripts/memory/lane/plan.test.mjs brain/scripts/memory/lane/collect.integration.test.mjs brain/scripts/memory/cli.collect.test.mjs`):
`42 pass / 0 fail` (plan.test.mjs 27, collect.integration.test.mjs 7, cli.collect.test.mjs 8).

**CI-parity re-run**, isolated identity (`GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1 HOME=$(mktemp -d)`), same three files:
`42 pass / 0 fail` — confirms the ambient-identity fixture fix (batch 4, commit `f1917c8a`) holds under the exact isolation that reproduced the original GitHub-runner failure.

**Supporting suites** (`lib/store.test.mjs`, `lib/format.test.mjs`, `lib/split-records.test.mjs`, `__fixtures__/tmp-tree-adoption.test.mjs`, `__fixtures__/tmp-tree.test.mjs`):
`98 pass / 0 fail`.

**Full suite** (`npm test`): `4968 pass / 0 fail / 0 todo`, duration ~23.9s.

## Spec Compliance Matrix

| Requirement | Test file / case | Result |
|---|---|---|
| candidate selection (D5) — untracked/clean/off-main is a candidate | `plan.test.mjs` | ✅ COMPLIANT |
| candidate selection (D5) — modified-tracked/invalid/already-on-main skip with own reason | `plan.test.mjs` | ✅ COMPLIANT |
| candidate selection (D5) — `index.jsonl` never a candidate | `plan.test.mjs` | ✅ COMPLIANT |
| candidate selection (D5) — main checkout is a worktree; prunable/bare skipped, no `worktree prune` | `collect.integration.test.mjs` B1.6 | ✅ COMPLIANT |
| dedup (D3/C2) — identical bytes collapse | `plan.test.mjs` A1.2 | ✅ COMPLIANT |
| dedup (D3/C2) — divergent tiebreak (lexicographic worktree path, then line) | `plan.test.mjs` A1.2 | ✅ COMPLIANT |
| dedup (D3/C2) — stability under shuffled enumeration (6 permutations, exhaustive) | `plan.test.mjs` A1.3 | ✅ COMPLIANT |
| scrub (D4) — one bad candidate does not block the batch | `collect.integration.test.mjs` B1.3 | ✅ COMPLIANT |
| scrub (D4) — secret never reaches object db (blob id computed w/o `-w`, `cat-file -e` non-zero; absent from tree; absent from stdout/stderr) | `collect.integration.test.mjs` B1.3 | ✅ COMPLIANT |
| lane ref (D2) — first run creates ref, parent `origin/main` | `collect.integration.test.mjs` B1.4 | ✅ COMPLIANT |
| lane ref (D2) — same-day re-run appends, never `-<n>` | `collect.integration.test.mjs` B1.4 | ✅ COMPLIANT |
| lane ref (D2) — zero new candidates → `commit: null`, ref untouched | `collect.integration.test.mjs` B1.4 | ✅ COMPLIANT |
| no mutation (D6) — two scratch worktrees + main checkout `git status --porcelain` byte-identical before/after | `collect.integration.test.mjs` B1.2 | ✅ COMPLIANT |
| author identity (D6) — ambient identity, no token; unset identity fails loudly | `collect.integration.test.mjs` (batch-4 fixture-identity fix + pinning test) | ✅ COMPLIANT |
| collect op (D1) — success prints `memory.collect.done`, full shape incl. `baseFetched`, exit 0 | `cli.collect.test.mjs` | ✅ COMPLIANT |
| collect op (D1) — dispatch never invokes a backend's `share` | `cli.collect.test.mjs` + source inspection (`cli.mjs:306-359` exits before backend selection at `:486+`) | ✅ COMPLIANT |
| collect op (D1) — failure prints `memory.collect.failed`, exit 1 | `cli.collect.test.mjs` | ✅ COMPLIANT |
| scope boundary (D7) — no push/PR call, hooks unchanged | `collect.integration.test.mjs` B1.6 (behavioural seam-argv guard) + static grep (`push`, `mrCreate`, `mrAutoMerge` — zero matches in `lane/*.mjs`, `cli.mjs`; zero `collect` references in `brain/scripts/hooks/`) | ✅ COMPLIANT |

**Compliance summary**: 18/18 requirement scenarios from the spec's STRICT TDD test map compliant with passing covering tests.

## Correctness (Static + Runtime Evidence)

| Decision | Status | Evidence |
|---|---|---|
| D1 dispatch before backend selection | ✅ | `cli.mjs:103-119` (`VALID_OPS` includes `"collect"`), `:306-359` (dispatch block, `process.exit()` at every branch — never falls through to `:486+`'s `MEMORY_BACKEND` resolution). `package.json:73` — `"memory:collect": "node ./brain/scripts/memory/cli.mjs collect"`. |
| D2 same-day append + CAS | ✅ | `collect.mjs:260-266` observes the ref tip at plan time, sets `plan.parent = existingTip` for append; `:320-337` `update-ref <ref> <new> <old>` CAS, `raced` gated on git's actual CAS-lock stderr shapes (batch-4 E2 correction), never retried. |
| D3 tiebreak + stability | ✅ | `plan.mjs:20-23,48-51,154-190` — `byteCompare` (plain code-unit, never `localeCompare`), groups sorted by file then worktree path; `divergent` set only on `canonicalOrNull` mismatch (A6). |
| D4 scrub-before-hash | ✅ | `collect.mjs:167-183` (`buildCandidate` scans before the planner ever sees the candidate), `plan.mjs:160-180` (planner is the single gate — a secret-marked winner drops the whole group, never falls through), `collect.mjs:268-273` (`hash-object -w` only iterates `plan.files`, the winners — structurally unreachable for a marked candidate). |
| D5 candidate selection | ✅ | `collect.mjs:230-245` (one `status -z -uall` per non-bare/non-prunable worktree, `-C <wt>`), `plan.mjs:103-149` (closed skip-reason routing: `not-a-record`, `already-on-main`, `modified-tracked`, `unexpected-status`, `unreadable`, `invalid`); `index.jsonl` excluded by grammar (`plan.mjs:32,36,105`) and outside the pathspec. |
| D6 pure planner + no-mutation | ✅ | `plan.mjs` imports only `../lib/format.mjs` and `../lib/duplicates.mjs` — no `node:fs`/`child_process`/`os`/clock (source-guard test `E3` in `plan.test.mjs`, confirmed passing). `collect.mjs:275-286` builds the tree via `GIT_INDEX_FILE=<tmp>`, `read-tree`/`update-index --cacheinfo`/`write-tree` — no `-u`/`-m` flag, nothing checked out; `commit-tree` at `:312-316` carries no `env` override (ambient identity only). |
| D7 non-goals | ✅ | `rg "push\|mrCreate\|mrAutoMerge" lane/collect.mjs lane/plan.mjs cli.mjs` → only comment mentions of `pre-push`/`push` describing scope, no call sites; `rg "collect" brain/scripts/hooks/` → zero matches. |
| D8 `removeTempTree` relocation | ✅ | `brain/scripts/lib/tmp-tree.mjs` holds the implementation; `brain/scripts/__fixtures__/tmp-tree.mjs` re-exports it; `collect.mjs:26` imports from `../../lib/tmp-tree.mjs`. |

## Corrections From Fresh Reviews and Cold Review (Confirmed Landed)

| Correction | Evidence |
|---|---|
| `requiredReviews`-style pins for the planner (schema gate, sorts, slug truncation) | commit `5b8e5c27`; `plan.test.mjs` A1.4-adjacent cases pass |
| Secret-group reporting (over/under-report fix) | commit `05e9a7dc`; `plan.mjs:160-187` — every marked member gets its own skip, `duplicates` occurrences registered only after the secret-winner guard |
| `collected` = tree delta on re-run, not `plan.files.length` | commit in PR #899 ("fix: count new blobs, not group winners"); `collect.mjs:295-310` (`git diff-tree` between parent tree and written tree) |
| `raced` gating on actual CAS-lock stderr shapes | `collect.mjs:318-337`, regression test `E2` in `collect.integration.test.mjs` |
| `parseStatusZ` rename-record fix (cold-1) | `collect.mjs:129-158`; test `cold-1` in `collect.integration.test.mjs` — real `git mv` fixture |
| Repo-local identity in fixtures (CI-blocker fix) | `collect.integration.test.mjs`, `cli.collect.test.mjs` `buildFixtureRepo`/`fixtureRepo` — repo-local `git config user.name`/`user.email`; re-verified in this pass under full identity isolation (42/42 green) |

## PR & Review Evidence

- `gh pr view 898 --json state,mergedAt,mergeCommit`: `MERGED`, `mergeCommit.oid: 35fd2926`, `mergedAt: 2026-09-10T00:34:05Z`.
- `gh pr view 899 --json state,mergedAt,mergeCommit`: `MERGED`, `mergeCommit.oid: 2ec28558`, `mergedAt: 2026-09-10T01:19:09Z`.
- `gh api repos/csrinaldi/brain/pulls/899/reviews`: two `csrinaldibot` reviews, GitHub API `state: COMMENTED` both times (bot mechanics, not the native approve action) — body `verdict: REVISE` at `09d58bff` (blocker: `gate:local-checks` FAILURE — the CI identity blocker), then body `verdict: APPROVE` at `2db6a1ee`, `findings: []`.
- `gh api repos/csrinaldi/brain/pulls/898/reviews`: **zero reviews recorded on GitHub.** PR #898's own body and commit history (`5b8e5c27`, `05e9a7dc`, `a0f546bc`) document a "fresh cold review before the push (REVISE, no blockers)" that ran locally and was never posted as a GitHub PR review — see WARNING 2 below.
- Issue #897 (`gh issue view 897`): `state: CLOSED`, `closedAt: 2026-09-10T00:34:06Z` (auto-closed by PR #898's `Closes #897`).
- Issue #887 (`gh issue view 887`): `state: CLOSED`, `closedAt: 2026-09-10T00:34:06Z` — see WARNING 1 below.
- Issue #889 comment: present, `2026-09-10T00:02:05Z`, author `csrinaldi`, the exact X1 sentence about three-dot `lane-paths` diffing (`gh issue view 889 --json comments`).
- `.memory/` scope: `git show --stat 35fd2926 -- .memory` → exactly `index.jsonl` + one record (`rec-fa2869c4792a5941`). `git show --stat 2ec28558 -- .memory` → exactly `index.jsonl` + one record (`rec-7b2e1e8f09bcf068`).

## TDD Compliance

| Check | Result | Details |
|---|---|---|
| TDD evidence reported | ✅ | apply-progress (obs #3253) reports RED→GREEN per task and per correction batch, including a reproduced-then-fixed CI failure. |
| All tasks have tests | ✅ | Every A/B implementation task is preceded by its RED task per tasks.md. |
| RED confirmed | ✅ | apply-progress documents RED states for A1, B1, B3, and the batch-4 identity/parseStatusZ fixes (10/12 failing before the fix, reproduced in this pass too). |
| GREEN confirmed | ✅ | 42/42 focused (both normal and identity-isolated runs), 4968/4968 full suite, this verify pass. |
| Triangulation adequate | ✅ | Divergence/stability get 3 distinct cases (collapse, tiebreak, shuffled-permutation exhaustive); scrub gets 2 (skip-and-continue, object-db absence). |
| Safety net for modified files | ✅ | Full `npm test` green after each commit per apply-progress; confirmed again in this pass. |

**TDD Compliance**: 6/6 checks passed.

### Assertion Quality

No tautologies or ghost loops found in `plan.test.mjs`, `collect.integration.test.mjs`, or `cli.collect.test.mjs`. The no-mutation invariant (B1.2) asserts byte-identical `git status --porcelain` snapshots, not a weaker proxy; the no-secret invariant (B1.3) computes the would-be blob id independently and asserts its absence from the object database rather than trusting stdout alone.

**Assertion quality**: ✅ All assertions verify real behavior.

### Quality Metrics

**Linter**: not run — no linter invocation configured for this verify pass; no lint failures reported by apply-progress.
**Type Checker**: not applicable — plain `.mjs`, no TS build step.

## Issues Found

**CRITICAL**: None.

**WARNING**:
1. **Issue #887 closed prematurely, before Slice B (the code that makes the collector invocable) existed as a merged PR.** GitHub timeline shows `#887` closed at `2026-09-10T00:34:07Z` — one second after PR #898 (Slice A only) merged (`00:34:05Z`), and the `closed` event's `commit_id` is `null` (a manual close by `csrinaldi`, not an auto-close from a PR closing keyword — PR #898's body correctly says `Closes #897`, never `#887`). This is exactly the failure mode tasks.md's "Chained-PR mechanics" section names and marks "Not recommended" (shape 1: "GitHub auto-closes #887 the moment PR A merges... the issue reads closed while `npm run memory:collect` still doesn't exist"). tasks.md's own PR-A.1 note claims the sub-ticket approach was chosen precisely "so both PRs stack to `main` without closing #887 early" — but the GitHub record shows #887 was in fact closed early, by a manual action outside the code/CI path. Functionally harmless now that PR #899 also merged and #887 is correctly closed in its final state, but the apply-progress/tasks.md narrative and the actual GitHub timeline disagree on whether the premature-closure risk materialized.
2. **PR #898 (Slice A) carries no GitHub-recorded review of any kind.** `gh api repos/csrinaldi/brain/pulls/898/reviews` returns an empty array — no bot review, no human review — while PR #899 has two `csrinaldibot` reviews (REVISE then APPROVE) fully visible via the API. The "fresh cold review before the push" tasks.md/PR body describe for Slice A is evidenced only by prose in the PR description and by three correction commits (`5b8e5c27`, `05e9a7dc`, `a0f546bc`) that exist in history — real evidence, but not an independently-checkable review artifact the way #899's bot transcript is. Recommend running (or at least posting) the cold-review bot's verdict on #898-shaped PRs going forward, even when a local pre-push review already happened, so both slices carry the same class of evidence.

**SUGGESTION**:
1. `apply-progress` (obs #3253) states "PR #899 remains `mergeStateStatus: BLOCKED` — unrelated to this batch, not investigated further" as of batch 4; by the time of this verify pass PR #899 is `MERGED`, so that residual note is now stale and can be dropped in the archive report.
2. No `.env`/secret-config drift found in this slice; noting only that `resolveSecretConfig` reads `brain.config.json` fresh per `collectLane()` call with no caching — fine at current scale, worth a comment if `collect` is ever called in a hot loop by #888's `ship`.

## Verdict

**PASS WITH WARNINGS**

All 18 spec requirement scenarios compliant with passing covering tests (42/42 focused, reconfirmed 42/42 under CI-parity identity isolation); full suite 4968/4968 green; D1–D8 confirmed by source inspection against the current tree; all tasks.md items `[x]`; `.memory/` scope minimal in both merge commits; the #889 dependency comment (X1) is posted. Two WARNINGs, both process/evidence gaps rather than code defects: #887's issue closure happened earlier than the plan's own narrative claims (though the final state is correct), and PR #898 lacks a GitHub-recorded review artifact that PR #899 has. Zero CRITICAL — nothing blocks archive, but the archive report should carry both WARNINGs forward for traceability rather than silently dropping them.
