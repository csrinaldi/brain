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

## Status

7/7 assigned slice-A tasks complete. Working tree clean, all commits local (no push). Ready for
the orchestrator to cut the #905 PR branch and continue with Wrap-up A, or to launch batch 2 for
slice B.
