---
status: tasked
issue: 1106
---

# Archive Sweep PR Authentication — Delta Spec

> **Revised** after the coordinator's rework instruction: opening the PR moves off
> `gh pr create` in workflow bash and onto the VCS port (`getVcs().mrCreate`), called
> from `sweep.mjs --open-pr`. The workflow keeps only what is unavoidably
> GitHub-Actions-specific (the secrets check, minting the App token, pushing the
> branch). Every requirement below is revised to the ported shape; nothing about the
> credential decision (mint a GitHub App token, degrade explicitly when unavailable)
> changed — only WHERE the PR-open call lives.

## Requirements

### Requirement: the sweep opens its PR through the VCS port, never `gh pr create` in workflow bash

Opening the `auto-archive/<date>` PR/MR MUST go through `getVcs().mrCreate` (called
from `sweep.mjs --open-pr`), never a `gh pr create` invocation in the workflow's bash.
This keeps `sweep.mjs` provider-agnostic (vcs-contract.md, issue #239) — the identical
code path works on a GitLab consumer's fork of this workflow, which a GitHub-CLI-shaped
bash call could never be.

#### Scenario: App configured and minted
- **WHEN** `BRAIN_SWEEP_APP_ID` and `BRAIN_SWEEP_APP_PRIVATE_KEY` are set and the mint
  succeeds
- **THEN** the workflow pushes the `auto-archive/<date>` branch authenticated as the
  App, then invokes `sweep.mjs --open-pr`, which calls `getVcs({ identity: token
  }).mrCreate(...)` and the PR is opened authenticated as the App

#### Scenario: App secrets absent
- **WHEN** `BRAIN_SWEEP_APP_ID` or `BRAIN_SWEEP_APP_PRIVATE_KEY` is unset
- **THEN** the workflow archives and pushes the branch with `GITHUB_TOKEN`; `sweep.mjs
  --open-pr` receives no token, calls `mrCreate` zero times, exits 2 (skipped); and the
  job does not fail because of the missing secret

#### Scenario: App secrets present but the mint fails
- **WHEN** both secrets are set but `actions/create-github-app-token` does not produce a
  token
- **THEN** the workflow still archives and pushes the branch; `sweep.mjs --open-pr`
  again receives no token and exits 2 (skipped); the alarm distinguishes this as a real
  failure (not a missing-secret degrade)

#### Scenario: mrCreate itself fails
- **WHEN** a token is available but `mrCreate` returns `{ url: null, error }` (a bad
  token, a rejected request)
- **THEN** `sweep.mjs --open-pr` exits 1 (failed); the workflow treats this as a real
  push/PR failure — alarm filed, the orphan branch deleted — the same as before this
  change, never a silent success

### Requirement: the PR targets the repository's actual default branch, never a hardcoded `main`

`sweep.mjs --open-pr`'s `--base` argument MUST be the repository's actual default
branch (read from `github.event.repository.default_branch` in the workflow, falling
back to `main` only when that is unset), never a literal `main` baked into the bash or
the node call.

#### Scenario: base is threaded through, not hardcoded
- **WHEN** the workflow invokes `sweep.mjs --open-pr`
- **THEN** the `--base` value passed is `$default_branch` (resolved from
  `DEFAULT_BRANCH`), matching the same value the alarm's compare link already uses

### Requirement: a missing App secret never fails the job

The token-mint step MUST be skipped, not failed, when the two App secrets are absent.

#### Scenario: mint step is skipped when unconfigured
- **WHEN** the secrets-check step reports the App is not configured
- **THEN** the mint step (`archive-app-token`) does not run, and its outcome is
  `skipped`, never `failure`

### Requirement: the degraded path keeps the pushed branch and reports a compare link

When the App is unavailable (unconfigured or mint failure) but the archive + push
succeeded, the branch MUST be kept (never deleted) and the alarm MUST carry a compare
link a human can use to open the PR by hand.

#### Scenario: degraded success is reported with a compare link, branch survives
- **WHEN** the App is unavailable and `git push origin <branch>` succeeds
- **THEN** an alarm is filed on the shared `governance:archive-sweep-failed` label, its
  body contains `https://github.com/<owner>/<repo>/compare/<default>...auto-archive/<date>`,
  and the pushed branch still exists on the remote afterward

### Requirement: the alarm path is unaffected by App availability

Every alarm this step can file (missing App, mint failure, push failure, selector
failure) MUST use the existing `GITHUB_TOKEN`-authenticated `alarm.mjs` path — the same
credential the alarm used before this change, so the alarm still fires even when the App
token is exactly what is broken.

#### Scenario: alarm fires under GITHUB_TOKEN regardless of App state
- **WHEN** any sweep failure path is reached (App unavailable, or a real push/PR
  failure)
- **THEN** `alarm.mjs` runs with `GH_TOKEN` bound to `github.token`, unchanged from
  before this proposal

### Requirement: the mint action is pinned by full commit SHA

`actions/create-github-app-token` MUST be referenced by its full 40-hex-character commit
SHA, never a floating tag, with the corresponding version recorded in a trailing comment.

#### Scenario: pin is a full SHA with a version comment
- **WHEN** the workflow YAML is read
- **THEN** the `uses:` line for the mint action matches
  `actions/create-github-app-token@<40-hex-sha> # v<major>.<minor>.<patch>`

### Requirement: no `secrets.*` context is read directly in a step `if:`

Every conditional that depends on the App secrets' presence MUST read a prior step's
mapped env/output, never `secrets.*` inline inside an `if:` expression.

#### Scenario: secrets are mapped through env before being branched on
- **WHEN** any step's `if:` condition is inspected
- **THEN** it contains no `secrets.<NAME>` reference; the secrets-check step maps the
  two secrets into its own `env:` and exposes only a boolean `configured` output

### Requirement: the sweep step never reddens the job

Regardless of App availability, the sweep step's own exit code MUST stay 0 on every path
already covered by the pre-existing design (D5) — a housekeeping/credential problem must
never fail the post-merge job.

#### Scenario: App unavailable does not redden the job
- **WHEN** the App is unavailable (unconfigured or mint failure)
- **THEN** the `sweep` step still exits 0
