---
status: in-progress
issue: 889
---

# Apply progress — #889 lane governance, slice A (#905, PR 1)

**Batch**: 1 (first batch — no prior apply-progress existed). **Scope**: slice A only (A1-A6 +
Section 0 measurements). Slice B (B1-B2, audit + index-lag, #889) and both Wrap-up sections
(A.W1-A.W5, B.W1-B.W6, D7) are **untouched**, per the batch boundary.

**Mode**: Strict TDD (RED confirmed before every GREEN; full `npm test` run before every commit).

## Section 0 — live measurements (results)

- **0.1** CONFIRMED in a synthetic temp repo (git 2.53.0, this repo's default `diff.renames`,
  no `-M`/`--no-renames` needed): a rename's NEW path appears in `git diff --name-only A...B`
  and is ABSENT from `git diff --diff-filter=A --name-only A...B`. Re-verified with
  `--no-renames` explicitly (shows the expected two-entry A+D shape instead — confirms the
  behaviour is genuinely rename-detection, not an artifact). A modification and a deletion are
  excluded from the added-only list in both cases. `classifyLane`'s `changedFiles ⊆ addedFiles`
  conjunction holds as designed.
- **0.2** CONFIRMED byte-for-byte against the tasks.md snapshot, both before A1 and re-read
  before A6.1 — no drift.
- **0.3** CONFIRMED: eight jobs, `[issue-link, diff-size, local-checks, memory-gate,
  decision-gate, phase-order, actor-check, brain-writes-reviewed]`, in that exact order, before
  A5's append.
- **0.4** MEASURED, real (not forecast): slice A's counted diff (all six code/docs commits,
  excluding `**/*.test.mjs` and `openspec/changes/**` per `brain.config.json`'s ignoreList) is
  **~514 lines** (`git diff --numstat origin/main...HEAD` on the touched files, minus test files
  and the openspec change dir), against the design's ~277 forecast. Still well inside `lite`'s
  `diffBudget: 1000`; **exceeds the 400-line reviewer budget by ~114 lines**. See "Risks" below —
  not resolved unilaterally in this batch.
- **0.5** DONE: `explore.md`, `proposal.md`, `spec.md`, `design.md` bumped to `status: tasked`
  alongside `tasks.md`.

## TDD Cycle Evidence

| Task | RED | GREEN | REFACTOR | Notes |
|---|---|---|---|---|
| A1 `classifyLane` | Confirmed — `lane.test.mjs` failed with `ERR_MODULE_NOT_FOUND` (module absent) | 15/15 green | N/A (clean on first pass) | Includes the "producer oracle" test driving `plan.mjs`'s `planLaneCommit` over a host/date matrix |
| A2 `runIssueLinkCheck` lane branch | Confirmed by temporarily stashing the `run-check.mjs` implementation: 112/113 pass, 1 fail (the lane-exemption test) — every other new test already passed on the unmodified file, proving they exercise the *ordinary* fallback path, not new behaviour | 113/113 green after unstashing | N/A | Added `deps.issueLink` injection seam (not in design, minimal, mirrors existing `deps.fetchIssue`/`deps.readConfig` convention) so "issueLink() never consulted" is a literal spy, not an indirect inference |
| A3 actor-check pins | N/A — pins are new assertions against unchanged code (design says RED here means "assertion absent from the file", not "code fails it") | 157/157 green, `actor-check.mjs` diff is empty (confirmed via `git diff --stat`) | N/A | No production code touched, as designed |
| A4 `lane-paths`/`lane-scrub` | Confirmed — both `ERR_MODULE_NOT_FOUND` (modules absent) | 10/10 + 10/10 green | N/A | `lane-scrub`'s SOURCE GUARD test scans only `import` lines for `governance-tiers`, not the whole file — the module's own explanatory comments mention the string, which would have false-failed a naive whole-file grep |
| A5 registration | Confirmed — 4 new RED failures (`GOVERNANCE_JOBS` slice, `checkContexts('lite')`, ten-jobs, `GATE_MATRIX` policy) | 57/57 green after wiring | 3 pre-existing exact-array tests updated (see Deviations) | **Ripple beyond the two named files** — see Deviations |
| A6 template sentence | Confirmed — 2 new RED failures (lane wording absent, byte-equality) | 36/36 green | N/A | Regenerated both `PULL_REQUEST_TEMPLATE.md` and GitLab's `Default.md` via `renderScaffold()`, never hand-edited |

Full `npm test` was run and green after every single commit (7/7 times): 5040 → 5047 → 5049 →
5069 → 5076 (with 3 transient regressions fixed within the same batch, see Deviations) → 5078 →
5078.

## Deviations from design — discovered requirements (A5, GitLab + scaffold ripple)

Design/tasks named exactly three files for A5's "atomic" registration:
`governance-checks.mjs`, `governance-tiers.mjs`, `.github/workflows/governance.yml`. Wiring only
those three left `npm test` red in five unrelated places, all genuine drift guards this repo
already runs at `standard` STRICT TDD discipline:

1. `brain/scripts/ci/gitlab-governance.yml` — the GitLab CI mirror. `ci-context-drift-guard.test.mjs`
   (REQ-A2-5, #130) asserts its job-name set AND per-job command equal `GOVERNANCE_JOBS` /
   `governance.yml`'s `run:` lines. Added both jobs, `script:` lines matching the GitHub `run:`
   lines verbatim (same command, two providers — #130's own rule).
2. `brain/scripts/vcs/contributor-scaffold.mjs`'s `GATE_SUMMARY` — the scaffold's gate table lists
   every `GOVERNANCE_JOBS` entry (#570 drift guard). Added two rows; regenerated
   `.github/PULL_REQUEST_TEMPLATE.md` and `.gitlab/merge_request_templates/Default.md` via
   `renderScaffold()`.
3. `test/review-regulated/fixture.mjs` — the e2e fixture's canned GitHub check-run rollup is a
   hardcoded job-name list `tranche.mjs`'s `evaluateTranche` walks against `requiredJobs(tier)`.
   Without the two new names in the fixture, the rollup lookup finds no gate for
   `lane-paths`/`lane-scrub` (both required at every tier) and the evaluator correctly refused to
   `APPROVE` — a real signal, not a false failure, but only fixable by extending the fixture (added
   both, green by default, same shape as the existing eight).
4. Three pre-existing tests in `governance-checks.test.mjs`/`governance-tiers.test.mjs` asserted
   the FULL job array by literal value (`checkContexts()`, `requiredJobs('standard')`,
   `requiredJobs('lite')`). Updated each to include `lane-paths`/`lane-scrub` at the end — this is
   exactly the kind of drift the tasks.md's own note anticipated ("red until array + matrix + YAML
   all land — the intended signal"), just wider than the three files named.

None of this widens A5's actual doctrine (both gates are still `required` at every tier, per the
ruling) — it is the mechanical consequence of `GOVERNANCE_JOBS` growing in a repo with this many
independent drift guards. Flagged here rather than silently absorbed because it touches files
outside the orchestrator's originally-scoped path list (`brain/scripts/ci/**`,
`.gitlab/merge_request_templates/**`, `test/review-regulated/**`) — all mechanical, all covered by
existing tests, none of them touch `brain/core/**`, `brain/project/**`, or `.memory/**`.

## Risks — real counted diff exceeds the 400-line reviewer budget

Section 0.4's real measurement (~514 counted lines) exceeds the review-workload guard's 400-line
budget by ~114 lines, driven mostly by the discovered A5 ripple above (~237 of those lines are the
GitLab mirror + scaffold table + regenerated templates + fixture, not the two check scripts
themselves). The design's own forecast (~277) assumed only the three named A5 files. Two paths
forward, neither taken unilaterally here:
- accept as `size:exception` on PR 1 (still well inside `lite`'s 1000-line CI budget, and the
  ripple is mechanical/drift-guard-driven, not new logic), or
- split the discovered-ripple commit (A5) into its own follow-up PR before #905 — costlier, since
  the ripple is *required* for `npm test` to stay green on top of the registration commit; it
  cannot land after A5 without a red window.

Recommend the orchestrator/maintainer decide and label accordingly before opening PR 1.

## Rollback trap (inherited from design, unchanged)

Reverting any of the A1-A6 commits before `brain:protect` is re-armed leaves two *required*
contexts (`lane-paths`, `lane-scrub`) declared in `GATE_MATRIX` but with no job producing them —
this is the same trap design.md's "Risks and residuals" table already names for the whole slice,
not new to this batch.

## Files changed (7 commits)

| Commit | Files |
|---|---|
| `e00fca63` feat(governance): add classifyLane | `brain/scripts/governance/checks/lane.mjs` (new), `lane.test.mjs` (new) |
| `83888134` feat(governance): recompute the lane predicate before exempting issue-link | `brain/scripts/governance/run-check.mjs`, `run-check.test.mjs` |
| `1a0bce32` test(vcs): pin actor-check's lane-shaped warn and denied-approver fail | `brain/scripts/vcs/actor-check.test.mjs` only (no production code) |
| `e669b0a3` feat(governance): add lane-paths and lane-scrub check scripts | `brain/scripts/governance/lane-paths.mjs` (new), `lane-paths.test.mjs` (new), `lane-scrub.mjs` (new), `lane-scrub.test.mjs` (new) |
| `4636a096` feat(governance): register lane-paths and lane-scrub as required contexts | `brain/scripts/vcs/governance-checks.mjs`, `governance-checks.test.mjs`, `governance-tiers.mjs`, `governance-tiers.test.mjs`, `.github/workflows/governance.yml`, `brain/scripts/ci/gitlab-governance.yml`, `brain/scripts/vcs/contributor-scaffold.mjs` (GATE_SUMMARY only), `.github/PULL_REQUEST_TEMPLATE.md`, `.gitlab/merge_request_templates/Default.md`, `test/review-regulated/fixture.mjs` |
| `2d47a848` docs(vcs): describe the lane in the contributor template sentence | `brain/scripts/vcs/contributor-scaffold.mjs` (the L6 sentence), `contributor-scaffold.test.mjs`, `.github/PULL_REQUEST_TEMPLATE.md`, `.gitlab/merge_request_templates/Default.md` |
| `3c7a17df` docs(sdd): tick slice A tasks and bump artifact status | `openspec/changes/issue-889-lane-governance/{tasks,explore,proposal,spec,design}.md` |

## Completed tasks

- [x] Section 0 — all five measurements (0.1-0.5)
- [x] A1 `classifyLane`
- [x] A2 `runIssueLinkCheck` lane recomputation
- [x] A3 actor-check pins (no production code)
- [x] A4 `lane-paths` + `lane-scrub`
- [x] A5 registration (GOVERNANCE_JOBS + GATE_MATRIX + governance.yml, plus the discovered ripple above)
- [x] A6 template sentence

## Remaining tasks (next batch)

- [ ] Wrap-up A (A.W1-A.W5) — `npm test` record (done throughout this batch, not a separate
      action), `memory:save --issue 905` (blocked: outside this batch's allowed write paths —
      `.memory/**` is explicitly excluded), fresh-context review, push + open PR 1, `brain:review`
      — all maintainer/orchestrator acts, per the batch boundary ("no push, no PR, no gh writes")
- [ ] Maintainer act after PR 1 merges: `npm run brain:protect` + `npm run brain:governance-status`
- [ ] Slice B (B1 `brain-audit` `[LANE]` row, B2 `memory/index-lag.mjs`) — PR 2, closes #889
- [ ] Wrap-up B (B.W1-B.W6)
- [ ] D7 exit sequence (post-PR2-merge, no code)

## Slice A corrections (sub-ticket #905, cold-review batch, commits `dc4d24f9`/`a0231d1f` on
top of `e11b45a9`)

A fresh cold reviewer of the slice-A PR branch found three code/test corrections plus five
editorial nits. All three corrections were driven RED-first; the editorial batch is prose +
two dead-local removals, verified by the same full-suite gate. Both commits are LOCAL only, on
`feat/issue-905-featgovernance-the-lane-class-in-issue-link` — the sibling worktree building
slice B rebases on top of this branch, so no file outside the sub-ticket's allowed write list
was touched.

**Work unit 1 — `dc4d24f9`** (corrections 1-3, tests first):
1. `lane-scrub.mjs`'s `main()` called `evaluateLaneScrub` (which invokes the injected `readFile`)
   OUTSIDE any try/catch — an added record deleted between the diff and the run threw raw and
   exited 1 (a false VIOLATION), inverting C1's own "cannot verify must fail closed as
   uncomputable" rule. RED confirmed (new test threw the real ENOENT instead of returning 2).
   Fixed: wrapped the `evaluateLaneScrub` call, catch → `{ pass:false, uncomputable:true, reason:
   'lane-scrub: cannot read an added record — failing closed (uncomputable): <message>' }`, exit 2.
2. `lane-paths.mjs`'s `evaluateLanePaths` printed a blank `"lane-paths: offending path(s): "` on
   an empty diff (`classifyLane`'s `lanePaths:false` branch with `offending:[]`, e.g. an empty
   three-dot diff on a lane branch). RED confirmed (asserted the printed reason equalled
   `classifyLane`'s own `"lane: empty diff"`, got the blank message instead). Fixed: when
   `offending.length === 0`, return `classifyLane`'s own `result.reason` instead of joining an
   empty array.
3. `lane-scrub.test.mjs:61-75`'s A6 test was tautological (`evaluateLaneScrub` takes no
   `sourceBranch` param at all — both calls in the old test were byte-identical, so it proved
   nothing about lane exemption). Replaced with a `main()`-level assertion: `ctx: { sourceBranch:
   'feat/some-feature' }` plus a planted `ghp_…`-shaped secret in an added record → exit 1 — the
   same fixture-embedding style (`{"token":"..."}`,  JSON-quote-adjacent so the repo's
   `check-refs.mjs` hardcoded-secret rule's `token[=:]"..."` pattern does not match it — verified
   `npm run check-refs` clean both before and after) already used by the file's other secret
   tests. This test was ALREADY-TRUE against the unmodified `main()` (lane-scrub consults no
   `ctx.sourceBranch` input by design — A6), so it is a pin, not a RED→GREEN cycle — same
   shape as slice A's own A3 pins.

**Work unit 2 — `a0231d1f`** (editorial, folded into one commit):
- `spec.md:18` — dropped the `(-\d+)?` suffix group from the documented lane-branch grammar to
  match `lane.mjs:15`'s actual `LANE_BRANCH_RE` (design A3: the producer grammar never emits a
  suffixed ref; a same-day second `collect` appends to the SAME ref, #887 D2), with a one-line
  note carrying the rationale into the spec text itself.
- `spec.md:71` (`lane-paths` requirement) — "naming the first offending path" corrected to
  "naming every offending path (truncated to the first 20, with a count of the rest)", paired
  with an ACTUAL code change: `evaluateLanePaths` now slices `offending` to 20 entries and
  appends `", … and N more"` when there are more. New test with 25 synthetic offending paths
  confirms the first 20 are named, the 21st is absent, and the count reads "… and 5 more". RED
  confirmed before the truncation code landed.
- `spec.md:40` — clarified that a lane PR skips BOTH the closing-keyword requirement AND the
  issue lookup itself (no `fetchIssue` call, no approved-label check) — `runIssueLinkCheck`
  already returns `{ pass: true }` immediately on a lane match, before `extractIssueNumber`/
  `fetchIssue` are ever reached; the prior wording only named the keyword half.
- Removed the unused `args` param from `run-check.test.mjs`'s `spyIssueLink` spy (it never reads
  its arguments) and the write-only `logs` arrays inside `lane-scrub.test.mjs`'s and
  `lane-paths.test.mjs`'s shared `captureLog` helpers — every call site in both files only
  consumes the returned exit code, never the suppressed console output, so `console.log = (...args)
  => logs.push(...)` was dead weight; simplified to `console.log = () => {}`. (The two
  `lane-paths.test.mjs` tests that DO assert on printed text already build their own local
  capture closure, untouched.)
- `governance.yml:3` — "Enforces four process invariants" corrected to name the actual job
  count (ten, listed by name) rather than carry a stale number from before A5's registration.

**Verification**: focused suite (`lane-scrub.test.mjs` + `lane-paths.test.mjs` + `lane.test.mjs`
+ `run-check.test.mjs`) 148 → 151/151 green after work unit 1 (no change in work unit 2, same
151). Full `npm test` 5078 → 5081/5081 green after work unit 1, 5081/5081 unchanged after work
unit 2. `npm run check-refs` clean after both commits.

## Status

7/7 assigned slice-A tasks complete, PLUS the #905 correction batch above (3 code/test fixes + 5
editorial nits, 2 commits, 5081/5081 full-suite green). Working tree clean, all commits local (no
push). Slice A shipped separately as PR #907 (merged to `main` at `ffe038a0`, `size:exception`) —
see "Batch 3 — PR 2 prep" below for what happened after that merge; full engram history for slice
B (B1/B2) lives at topic `sdd/issue-889-lane-governance/apply-progress` (observation #3287).

## Batch 3 — PR 2 prep (2026-09-10)

**Context at batch start**: slice A (#905) already merged as PR #907 (`ffe038a0`,
`size:exception`). Worktree rebased onto it with slice B's three commits already present
(`3aa152c8` [LANE] audit row, `3388187d` index-lag, `4e68bb16` docs ticking B1.1-B2.3/B.W1 and
epic 3.1c) — B1/B2 were NOT redone in this batch, they were already done; see engram observation
#3287 for their full RED/GREEN detail, since this file's slice-B section was not carried forward
by that earlier batch.

**This batch's own work — cold-1 from PR #907's cold review** (`lane-scrub.mjs:126-140`):
`main()`'s single try/catch around `evaluateLaneScrub` reported every thrown error as `lane-scrub:
cannot read an added record — failing closed (uncomputable): <message>`, but `compilePatterns()`
(`memory/lib/secret-scrub.mjs:42-44`, throws on an invalid regex source) also runs inside that
same call — via `evaluateLaneScrub`'s internal `resolveSecretConfig`/`compilePatterns` step —
misattributing a bad secret-config pattern to a record-read failure.

RED: added `main: an invalid secret pattern in config → exit 2 with a config-specific reason,
never "cannot read"` to `lane-scrub.test.mjs`, confirmed failing against the un-fixed code (it
printed the "cannot read" reason for a config error).

GREEN: `evaluateLaneScrub` now accepts optional pre-compiled `patterns`/`allowPatterns` (falls
back to compiling from `config` when omitted, for direct unit-level calls — backward compatible
with the existing pure-function tests). `main()` compiles patterns via `resolveSecretConfig` +
`compilePatterns` in its OWN try/catch, before and outside the per-record read loop, reporting
`lane-scrub: invalid secret pattern in config — failing closed (uncomputable): <message>` on
failure; the read-loop's try/catch (now wrapping only `evaluateLaneScrub` with pre-compiled
patterns passed in) keeps its original `cannot read an added record` reason, now only ever
reported for an actual read failure. Both paths still exit 2 (`resultToExit`'s `uncomputable`
dominance, unchanged).

Commit `60af7abc` (fix + test, work unit 1). Focused suite (`lane-scrub.test.mjs` +
`brain-audit.test.mjs` + `index-lag.test.mjs`) 71 → 72/72 green. Full `npm test` 5081 → 5097/5097
green (the jump includes slice B's tests already present from the prior batch, not just this
one).

Docs: this note (tasks.md's "PR 2 prep note" under the Slice B header) and design.md's A6 section
(the two distinct UNCOMPUTABLE reasons — config-compile vs. read failure). Commit `13bec541`
(docs, work unit 2).

**Status**: cold-1 fixed and tested. Working tree clean, both commits local (no push). Remaining
before PR 2 opens: B.W2 (`memory:save --issue 889`), B.W4 (fresh-context review), B.W5 (push +
open PR 2), B.W6 (`brain:review`) — none attempted in this batch, out of its assigned scope.

## Batch 4 — slice B corrections (2026-09-10)

**Context at batch start**: a fresh cold reviewer of PR 2 prep (post-batch-3, worktree at
`22d0bc72`) found two coverage/wording defects in `brain-audit.mjs`'s `[LANE]` branch (A8) and one
wording issue each in `index-lag.mjs`'s warning, its own test's assertion strength, and the epic
tracker. None were behavior bugs in the shipped `[LANE]`/index-lag logic itself — this batch is
test coverage, comment accuracy, and docs.

**MAJOR 1 — `[LANE]`'s production PR-body shape had zero test coverage.** The existing B1
happy-path test (`brain-audit.test.mjs:1915`, now renamed "fallback path, no resolvable PR")
put the `Memory lane:` marker in the COMMIT body with a subject carrying no `(#N)`, so `prNum`
resolved to `null`, `fetchPrMeta` never called `gh`, and `selectIssueLinkBody` fell back to the
commit body by construction. The shape PR 2 actually ships — marker only in the PR body via
`gh pr view`, since GitHub squash bodies carry the branch's commit messages and never the PR
description — had no test at all: mutating `issueLinkBody` → `body` at `brain-audit.mjs:341` left
52/52 green. Added a new "production shape" test: records-only addition, squash subject carrying
`(#N)`, `writeReviewedGhStub` (extended with an optional `body` override) stubbing the marker into
the PR body, and an empty commit body. RED/mutant proof: applied the `issueLinkBody` → `body`
mutation directly to `brain-audit.mjs` (scratch text saved first, reverted via the same Edit
after), confirmed the new test fails (`[FAIL] … issueLink: no issue reference found` instead of
`[LANE]`) while the renamed fallback test still passes against the same mutant, then reverted —
`git diff --stat` confirmed byte-identical to pre-mutation. Never used `git checkout --`. Commit
`0088f536`.

**MAJOR 2 — the neighboring comment claimed the marker is "never the raw commit body."** False:
`selectIssueLinkBody` (`lib/audit-helpers.mjs:52-54`) falls back to the commit body exactly when
`prBody` is absent — that fallback is what makes the fallback test above meaningful in the first
place. Reworded per design A8: the marker is read from `issueLinkBody` (PR body when reachable,
commit body as the fallback), and it is the `[UNCOMPUTABLE]` guard above this line — not the
choice of `issueLinkBody` itself — that stops a failed PR fetch from ever reaching the `[LANE]`
check. Same commit `0088f536` (kept with the test it explains, not split into a docs-only unit).

**MINOR 3 — `index-lag.mjs`'s warning could read in-sync when it was not.** `indexed N, rebuilt M`
alone can pass with equal counts even when one id was swapped for another (one missing, one
stale) — the message never said which direction the lag actually ran. RED: added an assertion to
the existing lagged-index test expecting `(1 missing from the index, 0 stale in it)`, confirmed it
failed against the un-fixed message. GREEN: appended the missing/stale counts (counts only, never
raw ids — those stay in `result` for a caller that wants them) to the warning string in
`index-lag.mjs`. TRIANGULATE: added a second `main()` test where the index lags in BOTH directions
at once (`indexed 2, rebuilt 2` — equal, but genuinely lagged), asserting
`(1 missing from the index, 1 stale in it)`. Commit `210a38ec`.

**SUGGESTION 4 — the "NO FILE IS WRITTEN" test only snapshotted `index.jsonl`.** A writer that
touched a record file under `.memory/records/` instead (added/removed/rewrote one) would have
gone uncaught. Added a `snapshotDir()` helper (names + bytes + mtime, keyed by filename) and
widened the existing test to snapshot the whole `recordsDir` before/after `main()`, plus a fixture
invariant asserting the pre-snapshot is non-empty (so the "untouched" assertion cannot pass
vacuously on an empty directory). Same commit `210a38ec` as MINOR 3 — one work unit, one
deliverable ("the index-lag warning is precise and its non-mutation guarantee is real").

**SUGGESTION 5 — `openspec/changes/issue-864-memory-2-0/tasks.md:39`.** The ticked 3.1c bullet
still described the CI check as refusing "any path outside `.memory/records/` additions +
`index.jsonl`" — stale wording from before A9/L3 established that `index.jsonl` is NEVER an
allowed lane-PR path, only a byproduct `memory:reindex` regenerates separately. Amended to
"additions only; `index.jsonl` never (L3)."

**design.md A8** gained an "Operational fact (for the release note)" paragraph: `[LANE]` depends
on `gh pr view` returning the PR body — an unauthenticated `brain:audit` run over a window
containing a lane merge does NOT silently pass it as a plain merge; the `[UNCOMPUTABLE]` guard
fires first and the run exits 2, fail-closed by design. And a `[LANE]` row skips ALL of
`evaluateMerge` (diff-size, memory presence, human-review gate) for that merge — the surface the
ruling deliberately trades away.

**Verification**: focused suite (`brain-audit.test.mjs` + `index-lag.test.mjs`) 60 → 61/61 green
after work unit 1, 61 → 62/62 green after work unit 2 (unchanged by work unit 3, docs-only). Full
`npm test` 5097 → 5098/5098 green after work unit 1, 5098 → 5099/5099 green after work unit 2.

**Files touched this batch**: `brain/scripts/brain-audit.mjs`, `brain/scripts/brain-audit.test.mjs`
(work unit 1, commit `0088f536`); `brain/scripts/memory/index-lag.mjs`,
`brain/scripts/memory/index-lag.test.mjs` (work unit 2, commit `210a38ec`);
`openspec/changes/issue-889-lane-governance/design.md`,
`openspec/changes/issue-864-memory-2-0/tasks.md`, this file (work unit 3, docs). Never touched
`brain/core/**`, `brain/project/**`, or `.memory/**`.

**Status**: all five cold-review findings (2 MAJOR, 1 MINOR, 2 SUGGESTION) addressed and tested.
Working tree clean, all three commits local (no push). Remaining before PR 2 opens, unchanged from
batch 3: B.W2 (`memory:save --issue 889`), B.W4 (fresh-context review of THIS batch), B.W5 (push +
open PR 2), B.W6 (`brain:review`) — none attempted in this batch, out of its assigned scope.
