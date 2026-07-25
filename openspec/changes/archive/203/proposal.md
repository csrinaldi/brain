# Proposal — Fix `checkContexts()` workflow-name prefix bug (issue #203)

> **Status:** Implementation
> **Relates to:** `brain/scripts/vcs/governance-checks.mjs`, `brain/scripts/brain-protect.mjs`,
> ADR-0014 (workflow-governance), the governance change (S3, `openspec/changes/governance/`).

## Context

`checkContexts()` prefixed each required job name with `"{WORKFLOW_NAME} / "` (e.g.
`"governance / issue-link"`), on the mistaken assumption that GitHub names a check-run
`"{workflow.name} / {job.name}"`. In reality GitHub Actions names a check-run after the
job's own `name:` field ALONE — the workflow name is a UI grouping label, never part of
the check-run's identity that branch protection matches contexts against.

The result: `brain:protect` armed required status-check contexts
(`"governance / issue-link"`, etc.) that no check-run could ever satisfy, silently
hard-blocking every PR to a protected branch even with all governance checks green.
Confirmed on PR #202 — a human re-armed the live branches by hand as a stopgap. This
slice fixes the tooling only; it does not touch the already-repaired live branch
protection settings.

## What this slice builds

1. `checkContexts()` returns bare job names (`REQUIRED_JOBS` unprefixed) — the literal
   check-run names GitHub actually reports.
2. A static drift-guard unit test that parses `.github/workflows/governance.yml` and
   asserts `checkContexts()` equals the YAML's REQUIRED job `name:` fields exactly —
   mirroring the existing `GOVERNANCE_JOBS` ↔ YAML drift-guard.
3. `brain:protect` arm-and-verify hardening: after the branch-protection PUT succeeds,
   best-effort query the branch's latest-commit check-runs and WARN (never fail) on any
   required context with no matching run. Zero runs collapses to a single
   "unverifiable" note (a freshly protected branch legitimately has none yet).
4. Removal of the now-dead `WORKFLOW_NAME` constant (no other legitimate consumer found).

## Out of scope

- Re-arming the live branch protection (already done by hand as a stopgap).
- GitLab's equivalent verification (GitLab has no directly analogous check-run listing
  API used here; `checkRuns` is a GitHub-only, non-contract verb).
- Any change to which jobs are REQUIRED vs DETECTION.
