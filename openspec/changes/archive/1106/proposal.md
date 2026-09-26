---
status: approved
issue: 1106
---

# Proposal: mint a GitHub App token for the archive sweep's PR

## Problem

The post-merge archive sweep (#557, merged as #1104) archives closed change folders and
tries to open its `auto-archive/<date>` PR with the workflow's own `GITHUB_TOKEN`. Live run
`35889559962` on `3e46288a` failed: `GitHub Actions is not permitted to create or approve
pull requests`.

Enabling that repository setting would not fix it either. Events caused by `GITHUB_TOKEN`
start no new workflow runs (except `workflow_dispatch`/`repository_dispatch`). A PR the
sweep opened would never run `governance.yml`, its required checks would stay pending
forever, and it could never merge. The failure path behaved as designed — alarm #1105
filed, orphan branch deleted, nothing reported as success — but every green merge repeats
the run and the alarm, and nothing is ever archived.

## Decision (maintainer-chosen)

Push and open the PR with a **GitHub App installation token**, minted inside the job via
`actions/create-github-app-token`, pinned by full commit SHA. Two repository secrets
(`BRAIN_SWEEP_APP_ID`, `BRAIN_SWEEP_APP_PRIVATE_KEY`) hold the App's identity; the App
carries `Contents: read/write` and `Pull requests: read/write` on this repository only.

The minted token authenticates BOTH the `git push` and the `gh pr create` — the PR's
author and its `pull_request` event both belong to the App, so `governance.yml` actually
runs on it and it can merge like any other PR.

The workflow (`.github/workflows/governance-postmerge.yml`) is managed and ships to every
brain consumer (`brain/core/managed-paths.mjs`). A consumer who has not configured the App
secrets must still get a correct, non-broken sweep: it archives and pushes the branch
(`GITHUB_TOKEN` can push — `contents: write` already grants that), it never calls
`gh pr create` with a token that cannot create pull requests, and it files the existing
alarm with a compare link so a human can open the PR by hand. A missing secret is a
configuration gap, not a workflow bug, and must never fail the job.

## Non-goals

- The `auto-revert/*` step has the identical problem and is explicitly out of scope
  (tracked separately, per the issue).
- No change to which PRs are eligible for the sweep, the backlog cap, same-day
  idempotency, or the archive selection logic (`sweep.mjs`) — this proposal only changes
  WHO authenticates the push/PR, not WHAT is archived.
- No change to `--base main` in `gh pr create` (pre-existing, unrelated to this defect).

## Impact

- `.github/workflows/governance-postmerge.yml` — the `sweep` step gains two upstream
  steps (`archive-app-secrets`, `archive-app-token`) and its push/PR logic branches on App
  token availability.
- Every consumer of brain's managed workflows inherits this on their next `brain:upgrade`.
  Consumers who want the sweep to open its own PRs must configure the two secrets and the
  App; consumers who don't will keep getting a correctly-degraded sweep (archived, pushed,
  alarmed with a compare link) instead of a silently-failing one.
