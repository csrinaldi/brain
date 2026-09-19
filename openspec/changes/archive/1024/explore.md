# Exploration: issue-1024 — memory-gate never receives the PR description in CI

> Produced by the sdd-explore sub-agent (read-only, on `main` at 02896d69) and persisted
> by the orchestrator, which added the "Orchestrator verification" section.

## Summary

`.github/workflows/governance.yml`'s `memory-gate` job sets only `DEFAULT_BRANCH`.
`brain/scripts/vcs/ci-context.mjs` `loadGithubContext()` fetches the PR body through
`prView` only when `PR_NUMBER` is set, so `ctx.body` stays `null`, and
`brain/scripts/governance/run-check.mjs` `runMemoryGateCheck` falls back to the
repository-global `memoryPresence()`. The issue-scoped `memoryRetrieval()` never runs on
GitHub. `memory-presence.mjs`'s header already names this gap as #1024.

The fix is not new doctrine. `brain/scripts/vcs/governance-tiers.mjs` `GATE_MATRIX['memory-gate']`
already ratifies tiered evidence: `lite` = detection over a coverage report, `standard` =
required `issue-linked-record`, `regulated` = required `issue-linked-session-summary`.
`memoryRetrieval()` implements exactly the `standard`/`regulated` evidence. The CI wiring
never delivered it.

## Current state

- `governance.yml` `memory-gate` job: only `DEFAULT_BRANCH`; `issue-link` and `diff-size`
  set `VCS_TOKEN`, `PR_NUMBER` and `PR_BODY`.
- `run-check.mjs` `main`: applies the tier through `mapDetectionToWarning`, then prints
  `reason`. `memoryPresence()`'s clean pass returns no `reason`, so a green run says nothing
  about which path ran. `memoryRetrieval()` returns a reason on every branch.
- Vendoring: `.github/workflows/governance.yml` and `brain/scripts/ci/gitlab-governance.yml`
  are managed paths copied into consumers (`refuse` on a diverged copy at `brain:upgrade`).
  Fixing this repo's copy fixes fresh installs and unmodified consumer copies.
- GitLab: the `memory-gate` job has no env block, but `loadGitlabContext` reads
  `CI_MERGE_REQUEST_IID`, which GitLab sets on every MR pipeline, and fetches the body with
  `VCS_TOKEN`, a project-level CI variable by GitLab convention. GitLab is probably already
  issue-scoped where `VCS_TOKEN` is configured. Not verified against a live pipeline.
- Re-evaluation: `governance-relabel.yml` + `relabel-retrigger.mjs` already re-run
  `governance.yml` for open PRs that reference an issue when the issue is labelled.
  Nothing re-runs a feature PR's gates when its record lands on `main` through the lane.

## The lane-ordering problem

`readRecords(cwd)` reads `.memory/records/` from the checked-out PR merge ref. Since
ADR-0034 a record reaches `main` on its own lane PR, usually after the feature PR opens
(today: #1018 → #1023, #1027 → #1036). With a strict scoped check, the feature PR's tree
usually lacks the record.

| Option | Contributor must | CI must | Failure modes | Breaks ADR-0034 |
|---|---|---|---|---|
| (a) record in the PR tree | rebase after each lane PR merges | nothing | every feature PR blocks on lane timing | yes |
| (b) read records from `origin/<default>` at evaluation | nothing | fetch the default branch | passes only on the next run after the lane merges | no |
| (c) accept an open lane PR | nothing | discover open `memory/*` PRs | trusts unmerged, unscrubbed content | no, weakens `lane-scrub` |
| (d) keep the global fallback, name the path | nothing | nothing | observability only | no |
| (e) required only at `standard`/`regulated` | nothing | nothing | already the ratified policy | no |

**Explorer's recommendation:** wire the env (restores (e) as designed), name the path that
ran (d's useful half), and treat (b) plus a push-to-main re-trigger modelled on
`relabel-retrigger.mjs` as a separate slice, because it is a second design decision.

## Tests

- Existing: `memory-retrieval.test.mjs`; `run-check.test.mjs` T2.1 block (injects
  `ctx.body`, so it never exercised the real wiring); `ci-context-drift-guard.test.mjs`
  checks `memory-gate` maps only `DEFAULT_BRANCH`.
- Precedent to copy: `ci-context-drift-guard.test.mjs` "#130: the issue-link job supplies
  every input the portable check consumes".
- RED to add: the `memory-gate` job declares `VCS_TOKEN`, `PR_NUMBER`, `PR_BODY` (fails
  today); `run-check.mjs memory-gate` output names the path (`presence` or `retrieval`).

## Doctrine touchpoints (Tier 2, drafts only)

- `brain/core/methodology/workflow-governance.md` "Invariant 3" section says memory-gate is
  "repo-scoped and permanently satisfied"; false for GitHub `standard`/`regulated` PRs
  after the fix.
- `brain/scripts/vcs/contributor-scaffold.mjs` PR-template text already hedges ("WHEN the
  pipeline hands this gate the description"); likely no change.
- The two managed CI files are not named in AGENTS.md's Tier 2 list but have the same
  blast radius; treat edits with confirm-before-executing care.

## Orchestrator verification (2026-09-18)

- `GATE_MATRIX['memory-gate']` confirmed at `governance-tiers.mjs:170-177`.
- This repository declares `governance.tier: "lite"`, so `run-check.mjs:732`
  `mapDetectionToWarning` turns a scoped miss into a warning here. The wiring fix cannot
  turn a brain PR red; the red-wave risk applies to consumers at `standard`/`regulated`.
- The `memory-gate` job block in `governance.yml` confirmed: only `DEFAULT_BRANCH`, default
  checkout, no `fetch-depth`.

## Risks

- For `standard`/`regulated` consumers, wiring the env turns the ratified evidence on for
  real: feature PRs whose record has not reached `main` go red until a re-run after the lane
  merges.
- GitLab behaviour inferred, not observed.
- #529 warned against tightening before the writer is reliable.

## Open questions for the proposal

1. Wiring fix alone first, or together with reading records from `origin/<default>`?
2. Rollout note or grace period for `standard`/`regulated` consumers?
3. The push-to-main re-trigger: this change or a follow-up?
4. GitLab: verify against a live pipeline, or record as unverified?
5. Path naming in the output: this slice or later?

## Suggested slices

1. Env wiring + drift-guard RED test + path naming in the output + doctrine draft;
   verify the GitLab fragment (~100-150 lines).
2. Separate proposal: read from `origin/<default>` + push-to-main re-trigger.
