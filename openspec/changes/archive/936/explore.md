# Exploration: issue-936 — lane sweep must revisit unreconciled branches (same-day + cross-day)

## Current State

### The lane ship path
- `brain/scripts/memory/lane/plan.mjs` — pure planner. `planLaneCommit()` skips any `??` candidate whose path is already in `mainPaths` (`origin/main`'s `ls-tree`) as `reason: 'already-on-main'` (plan.mjs:117-121). A fresh scan never re-collects a record already on `origin/main`.
- `brain/scripts/memory/lane/collect.mjs` — the IO shell. `collectLane()` scans every worktree of the repo (collect.mjs:219-261). Worktrees share one `.git`, so `refs/heads/memory/<host>-<date>` is one ref per host per day (ADR-0034).
  - Step 8 (collect.mjs:276-282): if the local ref exists, `plan.parent` is unconditionally overwritten to its tip ("D2: same-day append parents off the ref's tip"), even when that tip's content is already merged into `origin/main`.
  - Step 10: `read-tree plan.parent` plus `update-index --add` of the new blobs. `collected` is derived from a tree diff against the parent (C1), so collectLane's own count is accurate.
  - Nothing in `collect.mjs`, `ship.mjs` or `cli.mjs` deletes the local lane ref after its PR merges.
- `brain/scripts/memory/lane/ship.mjs`
  - `surveyDelivery()` (ship.mjs:75-119, #920) computes `lanePaths` with a three-dot diff (ship.mjs:104), then `undeliveredPaths` with a content diff `ref origin/main -- <lanePaths>` (ship.mjs:113). This is the existing content-containment primitive (a squash merge is never an ancestor, so `--is-ancestor` cannot be used).
  - `buildTitleAndBody()` (ship.mjs:144-163) uses the raw three-dot diff for the title count and the body list.
  - GitHub's "Files changed" and the required `lane-paths`/`lane-scrub` contexts (`governance/lane-paths.mjs:29-43`) compute the same three-dot diff against real ancestry. Filtering the PR text alone would not fix what reviewers and CI see.
- `brain/scripts/memory/day-start-sweep.mjs` runs `cli.mjs ship --json --invoker sweep` for today only (`cli.mjs:488` derives `date` from now). It never enumerates `refs/heads/memory/<host>-*`.

### Governance coupling
- `brain/scripts/governance/checks/lane.mjs:15` — `LANE_BRANCH_RE = /^memory\/[a-z0-9][a-z0-9-]*-\d{4}-\d{2}-\d{2}$/`, deliberately narrower than ADR-0034 L1 (no `-\d+` suffix, "nothing in this repo can produce" it). `ship.mjs`'s `BRANCH_GRAMMAR` (ship.mjs:124) tolerates the suffix.
- `lane-paths` and `lane-scrub` classify a PR as lane by branch name alone. Any branch-naming change must update `LANE_BRANCH_RE` in the same PR.
- ADR-0034 L2 (adr-0034:66-82): tier lite enables auto-merge on green; standard/regulated refuse with `requires-human-approval`.

### Repo settings (verified 2026-09-19 via `gh api repos/csrinaldi/brain`)
- `delete_branch_on_merge: true` — the remote lane branch is deleted when its PR merges.
- `allow_auto_merge: false` — `mrAutoMerge` is refused at every tier; ship.mjs:408-413 swallows it into `autoMerge.enabled:false`.
- `allow_update_branch: false`.

## Reproduction (from the code)

1. Worktree A ships record X. No local ref, so parent = `O` (origin/main). Commit C1 (tree {X}), ref set to C1, PR opened, later squash-merged as M (parent O). The remote branch is deleted; the local ref stays at C1.
2. Later the same day a new record Y is collected. `originMainTip = M`; X on disk is skipped as `already-on-main`.
3. Step 8: `existingTip = C1`, so `plan.parent = C1`, overriding the planner's M.
4. New tree {X, Y}, commit C2 with parent C1. `collected = 1` (correct).
5. `surveyDelivery`: merge-base(M, C2) = O, so `lanePaths = [X, Y]`; content diff says only Y is undelivered; ship proceeds.
6. `buildTitleAndBody()` reports 2 records and lists X again. This matches PR #1050 (the new record plus `rec-0ae8abdbc96f2b8c`, already merged by #1036) and #1023.

"Update branch" fixed #1023 because the merge commit gives the head an edge into origin/main's history, so the merge-base moves to origin/main's tip.

## The cross-day half (the ticket's original title)

No entry point (`day-start-sweep.mjs`, `session-end-ship.mjs`, `npm run brain:memory:ship`) ever names a lane ref from a prior day. This confirms the ticket's unreachability proof. The 2026-09-18 maintainer comment extends the scope to the same-day already-merged case.

## Fix options

| Option | Description | Pros | Cons | Effort |
|---|---|---|---|---|
| (a) Fresh base every ship | Rebuild from origin/main plus undelivered records, force-push | Simple model | Force-push every run; risk to an open PR's in-flight content | Medium |
| (b) New branch name per ship | Suffix per ship | Avoids stale ref reuse | Breaks `LANE_BRANCH_RE` and the one-PR-per-host-per-day model (`ship.integration.test.mjs:106`) | High |
| **(c) Content-aware reparent at append time** | Share `surveyDelivery`'s content primitive; in step 8, if the existing tip's tree is fully delivered to origin/main, parent on origin/main's tip and CAS-reset the ref (`update-ref <ref> <new> <old>`). Otherwise append as today | Fixes real ancestry; no grammar or gate change; keeps append-to-open-PR | Push must be a clean create; resolved by `delete_branch_on_merge: true` | Medium |
| (d) Delete branch after merge | Repo setting or post-merge step | Cheap | Does not fix the local ref alone; already on at the repo level | Low |

**Recommendation: (c).** The companion (d) is already satisfied by the repo setting, so after a merge the remote branch is gone and the reparented push is a plain create. The shared helper must live in `collect.mjs` or a new sibling module to avoid a circular import (`ship.mjs` imports from `collect.mjs`). The check must fail closed: partial or unknown delivery keeps appending, never resets.

## Auto-merge

`allow_auto_merge` is false, so every lane PR waits for a human merge, tier lite included, contradicting ADR-0034 L2's table. Recommend a short factual ADR-0034 amendment draft, or deferring the policy question to epic task 6.1.

## Tests

Reuse the real bare-origin fixtures in `lane/collect.integration.test.mjs` and `lane/ship.integration.test.mjs` (recordingVcs fake). Reproduce: ship X, simulate a squash merge on origin/main with plain git, keep the local ref, add Y, ship again the same host/date. Red: the three-dot diff includes X. Green: only Y, and the new commit's parent is origin/main's tip. Unit-level branch logic can be pinned with `ship.test.mjs`'s fakeGit style; only the integration test proves the merge-base claim.

## Risks
- The content check must look at the existing tip's own tree only and be all-or-nothing; fail closed.
- If the remote branch still exists (setting flipped off later), the reparented push is non-fast-forward and ship fails with `memory.ship.diverged`. This is a loud failure, not silent data loss.
- `LANE_BRANCH_RE`'s comment becomes a trap if a suffixed name is ever reintroduced; note it in the design.
- Delivery size for slice 1: roughly 250-450 changed lines, mostly integration test (tests are excluded from the lite 1000-line budget).
- The cross-day sweep is a separate, larger surface that should reuse slice 1's helper.

## Slices
1. **Same-day reparent (urgent, #1023/#1050 shape)**: shared content-delivered helper, reparent in collectLane step 8, pinning integration test.
2. **Cross-day sweep (the ticket's literal scope)**: enumerate `refs/heads/memory/<host>-*` local and remote, reconcile or skip via the helper, a stated retention policy, and a report for every branch beyond retention.
3. **Optional**: ADR-0034 L2 auto-merge amendment draft.

## Open product questions
1. Is slice 1 part of #936 or split into its own issue?
2. Retention policy for the cross-day sweep.
3. ADR-0034 auto-merge amendment here or deferred to 6.1.

## Ready for Proposal
Yes for slice 1. Slice 2 needs the retention answer.
