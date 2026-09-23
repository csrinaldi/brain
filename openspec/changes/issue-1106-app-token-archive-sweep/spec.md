---
status: tasked
issue: 1106
---

# Archive Sweep PR Authentication — Delta Spec

## Requirements

### Requirement: the sweep never calls `gh pr create` with GITHUB_TOKEN

`gh pr create` in the `sweep` step of `governance-postmerge.yml` MUST only ever be
invoked with a minted GitHub App installation token, never with `GITHUB_TOKEN` /
`github.token`.

#### Scenario: App configured and minted
- **WHEN** `BRAIN_SWEEP_APP_ID` and `BRAIN_SWEEP_APP_PRIVATE_KEY` are set and the mint
  succeeds
- **THEN** the sweep pushes the `auto-archive/<date>` branch and calls `gh pr create`
  authenticated with the minted App token

#### Scenario: App secrets absent
- **WHEN** `BRAIN_SWEEP_APP_ID` or `BRAIN_SWEEP_APP_PRIVATE_KEY` is unset
- **THEN** the sweep archives and pushes the branch with `GITHUB_TOKEN`, never calls
  `gh pr create`, and the job does not fail because of the missing secret

#### Scenario: App secrets present but the mint fails
- **WHEN** both secrets are set but `actions/create-github-app-token` does not produce a
  token
- **THEN** the sweep still archives and pushes the branch, never calls `gh pr create`
  with `GITHUB_TOKEN`, and files an alarm distinguishing this as a real failure (not a
  missing-secret degrade)

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
