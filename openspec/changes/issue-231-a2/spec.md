# Spec Delta — GitLab Governance Pipeline (slice A2)

> Ships the GitLab governance pipeline: a brain-owned opt-in fragment, Node entrypoints so all eight
> jobs run through the `ci-context` seam, a provider-resolved `governance.approvedLabel` config, the
> REQUIRED/DETECTION exit-code mapping, and a drift-guard over the new YAML. See [design.md](design.md).

## REQ-A2-1: Brain ships an opt-in GitLab pipeline fragment; the consumer root is never managed (B1)

Brain MUST ship `brain/scripts/ci/gitlab-governance.yml` defining the eight governance jobs. It MUST be
registered in `managed-paths.mjs` `managed[]` as a LITERAL path (not root `.gitlab-ci.yml`). The consumer
root `.gitlab-ci.yml` MUST remain LOCAL — brain never creates, manages, or clobbers it. Adoption is a
single `include: { local: 'brain/scripts/ci/gitlab-governance.yml' }` line the consumer adds themselves.

#### Scenario: the fragment is managed, the consumer root is not

- GIVEN `managed-paths.mjs`
- WHEN its `managed` and `local` sets are read
- THEN `brain/scripts/ci/gitlab-governance.yml` is in `managed[]` and no root `.gitlab-ci.yml` entry
  appears in `managed[]`

#### Scenario: every governance job is defined in the fragment

- GIVEN `brain/scripts/ci/gitlab-governance.yml`
- WHEN its job names are extracted
- THEN they equal `GOVERNANCE_JOBS` (`governance-checks.mjs:42`) — the eight REQUIRED ∪ DETECTION jobs

## REQ-A2-2: `issue-link` and `diff-size` run through Node fed by `ci-context`, never bash-on-GitLab (B2)

GitLab exposes no `CI_MERGE_REQUEST_DESCRIPTION` var and its `CI_MERGE_REQUEST_LABELS` freeze at pipeline
creation, so the MR body + fresh labels are available ONLY via `loadGitlabContext()`. `run-check.mjs`
MUST expose `issue-link` and `diff-size` cases that call the EXISTING pure evaluators
(`checks/issue-link.mjs#issueLink`, `checks/diff-size.mjs#diffSize`) with inputs from `loadContext()`.
The pure evaluators MUST NOT change. `size:exception` (diff-size) and the referenced-issue approved-label
read MUST come from `ctx.labels` (fresh), NEVER from `CI_MERGE_REQUEST_LABELS`.

#### Scenario: issue-link evaluates the MR body from ci-context

- GIVEN a GitLab MR whose description contains `Part of #231` and a referenced issue carrying the
  approved label
- WHEN `run-check.mjs issue-link` runs with a `ctx` from `loadContext()`
- THEN `issueLink(ctx.body)` passes and the approved-label verification passes, using fresh `ctx.labels`

#### Scenario: diff-size honors size:exception from fresh labels, not frozen env

- GIVEN a GitLab MR labeled `size:exception` after pipeline creation
- WHEN `run-check.mjs diff-size` runs
- THEN the gate reads `size:exception` from `ctx.labels` and skips, never consulting
  `CI_MERGE_REQUEST_LABELS`

#### Scenario: a needed context field being null fails the REQUIRED gate closed

- GIVEN `ctx.body` is `null` (uncomputable — MR fetch failed) for the REQUIRED `issue-link` job
- WHEN `run-check.mjs issue-link` runs
- THEN it exits non-zero (fail-closed), never exit 0 (ADR-0016 REQUIRED policy)

## REQ-A2-3: `governance.approvedLabel` is config-driven and provider-resolved (B3)

An additive `config-migrations.mjs` entry MUST introduce `governance.approvedLabel` with default
`status:approved`. A resolver MUST return the provider-appropriate form: `status:approved` on GitHub and
the scoped `status::approved` on GitLab. The three hardcoded `status:approved` reads
(`governance.yml:78`, `actor-check.mjs:150`, `brain-start.mjs:67`) MUST be replaced with this lookup. The
migration is ADDITIVE (never overwrites a consumer-set value) and idempotent.

#### Scenario: the approved label resolves per provider

- GIVEN a config with default `governance.approvedLabel`
- WHEN the resolver runs for `provider = 'gitlab'`
- THEN it yields the scoped `status::approved`; for `provider = 'github'` it yields `status:approved`

#### Scenario: no runtime code hardcodes status:approved after this slice

- GIVEN the repo after A2
- WHEN `actor-check.mjs`, `brain-start.mjs`, and the issue-link path are inspected
- THEN none compares against a literal `'status:approved'`; each reads the resolved config value

## REQ-A2-4: REQUIRED fail-closed, DETECTION `allow_failure` — the two classes never flatten (B4)

In `gitlab-governance.yml`, each REQUIRED job (`issue-link`, `diff-size`, `local-checks`, `memory-gate`,
`decision-gate`) MUST be a normal job (a non-zero exit blocks merge). Each DETECTION job (`phase-order`,
`actor-check`, `brain-writes-reviewed`) MUST carry `allow_failure: true` so a real finding is visible but
non-blocking (Amendment 3). No REQUIRED job may carry `allow_failure`; no DETECTION job may omit it.

#### Scenario: classification matches the registry

- GIVEN `gitlab-governance.yml`
- WHEN each job's `allow_failure` flag is read
- THEN `allow_failure: true` is present for every job in `DETECTION_JOBS` and absent for every job in
  `REQUIRED_JOBS`

## REQ-A2-5: The drift-guard covers the GitLab YAML with zero npm deps (B5)

`ci-context-drift-guard.test.mjs` MUST parse `gitlab-governance.yml` by string-slicing (the same
technique it already uses for `governance.yml` — NO `yaml` npm dependency) and assert: (a) the job-name
set equals `GOVERNANCE_JOBS`; (b) `allow_failure: true` appears iff the job is in `DETECTION_JOBS`.

#### Scenario: adding a job without updating the registry turns the guard red

- GIVEN a job added to `gitlab-governance.yml` but not to `REQUIRED_JOBS`/`DETECTION_JOBS`
- WHEN the drift-guard runs
- THEN it fails, reporting the job-set mismatch against `GOVERNANCE_JOBS`

#### Scenario: mis-classifying a REQUIRED job as allow_failure turns the guard red

- GIVEN a REQUIRED job carrying `allow_failure: true` in the GitLab YAML
- WHEN the drift-guard runs
- THEN it fails, reporting the classification mismatch
