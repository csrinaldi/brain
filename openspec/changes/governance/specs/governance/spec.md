# Workflow Governance Layer Specification

## Purpose

Enforces brain's four load-bearing workflow invariants server-side so neither humans
nor agents can bypass them. Enforces the observable OUTPUTS of each invariant at a PR
gate (ticket linked, size bounded, `.memory/` changed, ADR present for labeled
decisions). Does NOT enforce JUDGMENT — capture quality, recognizing unlabeled
decisions, and slicing coherence remain L3 guidance.

## Epic Non-Goal (Stated Invariant)

The system MUST NOT claim to enforce judgment-level correctness. L1 enforces
OUTPUTS only. The following are explicitly out of scope for this change and are
non-goals at the enforcement layer: (a) complete or high-quality session capture,
(b) recognizing a decision that is NOT labeled `decision`, (c) slicing coherence
(only that changed lines stay ≤400). Naming this boundary is part of the design.

## Requirement Index

| Req | Slice | Name | Testable |
|-----|-------|------|---------|
| REQ-S1-1 | 1 | ADR-0014 exists + HOME.md indexed | File assertion + `brain:nav` |
| REQ-S1-2 | 1 | PR template sections | File assertion |
| REQ-S1-3 | 1 | ignoreList config migration | Unit (`node --test`) |
| REQ-S1-4 | 1 | Managed-paths specific entries | Unit (`node --test`) |
| REQ-S1-5 | 1 | No CI / no protection after S1 | Manual operational acceptance |
| REQ-S2-1 | 2 | issue-link job gate | CI-behavior (self-governing PR + manual E2E) |
| REQ-S2-2 | 2 | diff-size job gate | CI-behavior (self-governing PR + manual E2E) |
| REQ-S2-3 | 2 | diff-size line-count calculation | Unit (`node --test`) |
| REQ-S2-4 | 2 | S2 PR self-compliance + protection off | CI-behavior + manual |
| REQ-S3-1 | 3 | branchProtect verb + GitHub impl | Unit (`node --test`, injectable seam) |
| REQ-S3-2 | 3 | GitLab impl throws "not yet implemented" | Unit (`node --test`) |
| REQ-S3-3 | 3 | Check names single-source | Unit (`node --test`) |
| REQ-S3-4 | 3 | workflow-governance.md L3 doc | File assertion |
| REQ-S3-5 | 3 | env:init references brain:protect | File assertion |
| REQ-S3-6 | 3 | Activation sequence | Manual operational acceptance |
| REQ-S4-1 | 4 | memory-gate job gate | CI-behavior |
| REQ-S4-2 | 4 | adr-gate job gate | CI-behavior |
| REQ-S4-3 | 4 | Arch-surface heuristic (WARNING only) | CI-behavior |
| REQ-E-1 | epic | Bootstrap order S1→S2→S3→S4 | Manual operational acceptance |
| REQ-E-2 | epic | Pre-protection branch coordination | Manual user decision |

---

## Slice 1 — Foundation

### Requirement REQ-S1-1: ADR-0014 Exists and Is Indexed

`brain/project/decisions/adr-0014-workflow-governance.md` MUST exist. `brain/HOME.md`
MUST include a link to it in the existing link format. `npm run brain:nav` MUST report
no orphans after S1 merges.

#### Scenario: ADR file and HOME.md link present

- GIVEN S1 has merged
- WHEN `brain/project/decisions/` is listed and `brain/HOME.md` is read
- THEN `adr-0014-workflow-governance.md` exists
- AND `brain/HOME.md` contains a link matching `[ADR-0014](project/decisions/adr-0014-workflow-governance.md)`

#### Scenario: Nav reports no orphans

- GIVEN S1 has merged
- WHEN `npm run brain:nav` runs
- THEN exit code is 0 and no orphan ADR warning is emitted

---

### Requirement REQ-S1-2: PR Template Sections

`.github/PULL_REQUEST_TEMPLATE.md` MUST exist and MUST contain: an issue-link section
referencing the `Closes|Fixes|Resolves #N` pattern; a size note referencing the
400-line budget and `size:exception`; and a decision/ADR checkbox.

#### Scenario: Template file exists with required sections

- GIVEN S1 has merged
- WHEN `.github/PULL_REQUEST_TEMPLATE.md` is read
- THEN the file is non-empty
- AND contains text matching `Closes|Fixes|Resolves`
- AND contains a reference to `400` or `size:exception`
- AND contains a checkbox or section referencing `ADR` or `decision`

---

### Requirement REQ-S1-3: ignoreList Config Migration

`brain/core/config-migrations.mjs` MUST include a migration that adds the
`governance.ignoreList` key to `brain.config.json`. The migration MUST be idempotent.
Default globs MUST include `.memory/**`, `openspec/changes/**`, and at least one
lock-file pattern.

[**unit-testable**: call migration on a fixture config twice; assert key present, values
match defaults, no duplicate entries on second run]

#### Scenario: Migration adds ignoreList with defaults

- GIVEN `brain.config.json` does not contain `governance.ignoreList`
- WHEN the migration runs
- THEN `brain.config.json` contains `governance.ignoreList` with `.memory/**`,
  `openspec/changes/**`, and at least one lock-file glob

#### Scenario: Migration is idempotent

- GIVEN `brain.config.json` already contains `governance.ignoreList`
- WHEN the migration runs a second time
- THEN `brain.config.json` is unchanged (no duplicate entries, same values)

---

### Requirement REQ-S1-4: Managed-Paths Specific Entries

`brain/core/managed-paths.mjs` MUST list `.github/workflows/governance.yml` and
`.github/PULL_REQUEST_TEMPLATE.md` in the managed array. It MUST NOT contain
`.github/**` as a managed glob (to avoid clobbering consumer-owned GitHub files).

[**unit-testable**: import `managed-paths.mjs`; assert the two specific paths are
present; assert no entry in `managed` matches the glob `.github/**`]

#### Scenario: Two specific paths present

- GIVEN `managed-paths.mjs` is imported
- WHEN the `managed` export is inspected
- THEN `.github/workflows/governance.yml` is in the array
- AND `.github/PULL_REQUEST_TEMPLATE.md` is in the array

#### Scenario: No broad .github glob

- GIVEN `managed-paths.mjs` is imported
- WHEN the `managed` export is inspected
- THEN no entry matches the glob `.github/**`

---

### Requirement REQ-S1-5: No CI and No Branch Protection After S1

After S1 merges, `main` MUST behave exactly as before: no GitHub Actions workflow runs
on PRs and branch protection MUST remain off.

[**Manual operational acceptance**: verify no workflow run appears in the Actions tab
after S1 merge; verify a direct push to `main` still succeeds]

#### Scenario: No workflow triggered after S1

- GIVEN S1 has merged to `main`
- WHEN a new PR is opened
- THEN no governance workflow check appears in GitHub Actions for that PR

---

## Slice 2 — Hard Gates I and II

### Requirement REQ-S2-1: issue-link Job Gate

The `governance.yml` `issue-link` job MUST fail a PR whose body lacks a
`Closes|Fixes|Resolves #N` reference (case-insensitive). It MUST also fail a PR whose
referenced issue `#N` does not carry the `status:approved` label. It MUST pass when
both conditions hold.

[**CI-behavior**: verified by the S2 self-governing PR (live) and a documented manual
E2E checklist in the S2 PR description]

#### Scenario: Missing issue reference fails

- GIVEN a PR whose body contains no `Closes|Fixes|Resolves #N` pattern
- WHEN the `issue-link` job runs
- THEN the job exits non-zero

#### Scenario: Unapproved issue fails

- GIVEN a PR body contains `Closes #42` but issue #42 does not have `status:approved`
- WHEN the `issue-link` job runs
- THEN the job exits non-zero

#### Scenario: Approved issue reference passes

- GIVEN a PR body contains `Closes #42` and issue #42 has `status:approved`
- WHEN the `issue-link` job runs
- THEN the job exits zero

---

### Requirement REQ-S2-2: diff-size Job Gate

The `governance.yml` `diff-size` job MUST fail a PR whose changed-line count
(additions + deletions, after excluding `governance.ignoreList` globs) exceeds 400
without a `size:exception` PR label. It MUST pass when the count is ≤400 or the label
is present.

[**CI-behavior**: verified by the S2 self-governing PR and documented manual E2E]

#### Scenario: Oversized PR without exception fails

- GIVEN a PR with 401+ changed lines after ignore-list exclusion and no `size:exception` label
- WHEN the `diff-size` job runs
- THEN the job exits non-zero

#### Scenario: Ignore-list globs excluded from count

- GIVEN a PR with 200 lines changed in real files and 300 lines changed under `.memory/**`
- WHEN the `diff-size` job runs (ignoreList includes `.memory/**`)
- THEN the counted lines are 200 and the job exits zero

#### Scenario: Exception label passes oversized PR

- GIVEN a PR with 500 changed lines after ignore-list and a `size:exception` label
- WHEN the `diff-size` job runs
- THEN the job exits zero

---

### Requirement REQ-S2-3: diff-size Line-Count Calculation

The line-count logic used by `diff-size` MUST be extractable with an injectable seam
and coverable by `node --test` using diff fixtures, independently of the CI environment.

[**unit-testable**: test the count function with fixture diffs including ignore-list
entries; verify exclusion logic without a live GitHub Actions context]

#### Scenario: Count excludes ignore-list paths

- GIVEN a diff fixture with changes in `.memory/chunks/foo.jsonl.gz` (3 lines) and
  `scripts/foo.mjs` (5 lines)
- WHEN the count function runs with ignoreList `['.memory/**']`
- THEN the result is 5

#### Scenario: Count reflects additions plus deletions

- GIVEN a diff fixture with 5 added lines and 3 deleted lines in included files
- WHEN the count function runs
- THEN the result is 8

---

### Requirement REQ-S2-4: S2 PR Self-Compliance and Protection Off

The S2 PR MUST itself comply with Gates I and II (carry an approved issue, stay under
400 changed lines after ignore-list). Branch protection MUST remain off after S2 merges.

[**CI-behavior**: the S2 PR is the first live self-governing PR. **Manual**: verify no
branch protection rule exists in GitHub repo settings after S2 merge]

#### Scenario: S2 PR passes its own gates

- GIVEN the S2 PR has an approved issue reference and is under 400 lines (ignore-list applied)
- WHEN the `issue-link` and `diff-size` jobs run on the S2 PR
- THEN both jobs exit zero

#### Scenario: Branch protection off after S2

- GIVEN S2 has merged
- WHEN the GitHub branch protection settings for `main` are inspected
- THEN no protection rule requires governance checks

---

## Slice 3 — brain:protect and Activation

### Requirement REQ-S3-1: branchProtect Verb — GitHub Implementation

`brain/core/methodology/vcs-contract.md` MUST document a `branchProtect` verb.
`scripts/vcs/providers/github.mjs` MUST implement it using `gh api -X PUT
/repos/{owner}/{repo}/branches/main/protection`, idempotently. The protection payload
MUST require: the governance check contexts from `governance.yml`, ≥1 approving review,
and `allow_force_pushes: false`.

[**unit-testable**: the `gh api` argument construction MUST be exposed via an injectable
seam. A `node --test` test asserts the correct HTTP method, URL, and required payload
fields without making a live API call]

#### Scenario: branchProtect documented in vcs-contract

- GIVEN `vcs-contract.md` is read
- WHEN the document is searched for `branchProtect`
- THEN the verb is present with at least a description of its effect

#### Scenario: GitHub impl builds correct API payload

- GIVEN the injectable seam is called with owner and repo params
- WHEN `branchProtect` assembles the `gh api` arguments
- THEN the HTTP method is `PUT`
- AND the path is `/repos/{owner}/{repo}/branches/main/protection`
- AND the payload includes `required_status_checks`, `required_pull_request_reviews`,
  and `allow_force_pushes: false`

#### Scenario: Idempotent re-run produces no error

- GIVEN `brain:protect` has already been run once successfully
- WHEN `brain:protect` is run a second time
- THEN it exits zero with no error

---

### Requirement REQ-S3-2: GitLab branchProtect Throws "Not Yet Implemented"

`scripts/vcs/providers/gitlab.mjs` MUST implement the `branchProtect` verb. The
implementation MUST throw a clearly worded "not yet implemented" error and MUST NOT
silently succeed or produce a partial side effect.

[**unit-testable**: call `gitlab.branchProtect()` in a `node --test` test; assert the
thrown error message contains "not yet implemented"]

#### Scenario: GitLab impl throws with clear message

- GIVEN `scripts/vcs/providers/gitlab.mjs` is imported
- WHEN `branchProtect()` is called
- THEN an error is thrown
- AND the error message contains the phrase "not yet implemented"

---

### Requirement REQ-S3-3: Check Names Single-Source

The `required_status_checks` contexts in the `branchProtect` payload MUST exactly match
the job names defined in `.github/workflows/governance.yml`. No string divergence is
permitted between the two files.

[**unit-testable**: a `node --test` test reads `governance.yml` job names and compares
them with the contexts array used by `branchProtect`; the test MUST fail on any
mismatch, making check-name sync a CI-enforced invariant]

#### Scenario: Contexts match workflow job names

- GIVEN `governance.yml` defines jobs `issue-link` and `diff-size`
- WHEN the `branchProtect` payload contexts are inspected
- THEN `required_status_checks.checks` contains entries whose `context` values match those job names exactly

#### Scenario: Adding a new job requires payload update

- GIVEN a new job `memory-gate` is added to `governance.yml`
- WHEN the single-source test runs
- THEN the test fails until `branchProtect` payload is updated to include `memory-gate`

---

### Requirement REQ-S3-4: workflow-governance.md L3 Doc Exists

`brain/core/methodology/workflow-governance.md` MUST exist after S3 merges. It MUST
state the four invariants and map each one to its gate (L1 CI job name and skip label
if applicable).

#### Scenario: Doc exists and covers all four invariants

- GIVEN S3 has merged
- WHEN `workflow-governance.md` is read
- THEN all four invariant descriptions are present
- AND each invariant is mapped to its gate (CI job name or protection rule)

---

### Requirement REQ-S3-5: env:init References brain:protect

`env:init` output or its documentation MUST direct the operator to run `brain:protect`
as a one-time admin setup action. It MUST NOT imply this is a per-developer step.

#### Scenario: env:init output references brain:protect as admin action

- GIVEN S3 has merged and `npm run env:init` is run in a consumer repo
- WHEN the output is read
- THEN it includes a reference to `brain:protect` framed as a one-time admin action

---

### Requirement REQ-S3-6: Activation Sequence

After S3 merges and the operator runs `brain:protect`, `main` MUST be protected
requiring the governance checks + ≥1 approving review + no direct push. A subsequent
non-admin direct push to `main` MUST be rejected by GitHub.

[**Manual operational acceptance**: the S3 PR is the first fully-gated PR (governed by
the S2 CI in `main`). Post-merge, the operator runs `brain:protect` and verifies
settings via `gh api GET /repos/{owner}/{repo}/branches/main/protection`. The self-
hosting activation sequence (S2 non-blocking → S3 activates) is manually verified, not
covered by `node --test`]

#### Scenario: Direct push blocked after brain:protect

- GIVEN `brain:protect` has been run after S3 merges
- WHEN a non-admin direct push to `main` is attempted
- THEN GitHub rejects the push with a branch protection error

#### Scenario: PR with failing governance check cannot merge

- GIVEN `brain:protect` has been run
- WHEN a PR is opened and the `issue-link` check fails
- THEN the Merge button is blocked on GitHub until the check passes

---

## Slice 4 — Gates III and IV

### Requirement REQ-S4-1: memory-gate Job Gate

The `governance.yml` `memory-gate` job MUST fail a PR whose diff contains no files
under `.memory/`. A PR labeled `skip:memory-gate` MUST be exempted and pass regardless
of `.memory/` diff content.

[**CI-behavior**: verified by live PRs under full governance (post-activation). This
gate is the `.memory/`-changed PROXY — it proves `memory:share` ran, NOT that capture
was complete or good (see G3)]

#### Scenario: PR with no .memory/ change fails

- GIVEN a PR whose diff contains no files under `.memory/`
- WHEN the `memory-gate` job runs
- THEN the job exits non-zero

#### Scenario: skip:memory-gate label exempts the PR

- GIVEN a PR with no `.memory/` changes and a `skip:memory-gate` label
- WHEN the `memory-gate` job runs
- THEN the job exits zero

#### Scenario: PR touching .memory/ passes

- GIVEN a PR whose diff includes at least one new or modified file under `.memory/`
- WHEN the `memory-gate` job runs
- THEN the job exits zero

---

### Requirement REQ-S4-2: adr-gate Job Gate

The `governance.yml` `adr-gate` job MUST be label-conditional: it MUST only evaluate
PRs carrying the `decision` label. For such PRs, it MUST fail when the diff does not
include both a `brain/project/decisions/adr-NNNN-*.md` file AND a `brain/HOME.md`
change. It MUST pass when both are present.

[**CI-behavior**: verified by live PRs under full governance]

#### Scenario: decision-labeled PR missing ADR file fails

- GIVEN a PR labeled `decision` whose diff contains no `brain/project/decisions/adr-NNNN-*.md` file
- WHEN the `adr-gate` job runs
- THEN the job exits non-zero

#### Scenario: decision-labeled PR missing HOME.md update fails

- GIVEN a PR labeled `decision` whose diff includes an ADR file but no `brain/HOME.md` change
- WHEN the `adr-gate` job runs
- THEN the job exits non-zero

#### Scenario: decision-labeled PR with both passes

- GIVEN a PR labeled `decision` whose diff includes an `adr-NNNN-*.md` file and a `brain/HOME.md` change
- WHEN the `adr-gate` job runs
- THEN the job exits zero

#### Scenario: Unlabeled PR is not evaluated

- GIVEN a PR with no `decision` label
- WHEN the `adr-gate` job runs
- THEN the job exits zero without checking for ADR files

---

### Requirement REQ-S4-3: Architectural-Surface Heuristic Warning

The `governance.yml` heuristic step MUST emit a WARNING message for PRs touching
architectural surfaces (adapters, config schema, new `package.json` deps, new top-level
modules) that carry neither a `decision` label nor an ADR file in the diff. This step
MUST exit 0 under all conditions — it is never a hard block.

[**CI-behavior**: verified by live PRs. The architectural surface is defined by
file-path patterns (implementation decision); heuristics MUST NOT hard-fail]

#### Scenario: Arch-surface PR without decision label emits warning

- GIVEN a PR touching `scripts/vcs/providers/` with no `decision` label and no ADR file in the diff
- WHEN the heuristic step runs
- THEN the step prints a WARNING message to stdout or stderr
- AND exits zero

#### Scenario: Arch-surface PR with decision label and ADR skips warning

- GIVEN a PR touching `scripts/vcs/providers/` with a `decision` label and an ADR file in the diff
- WHEN the heuristic step runs
- THEN no warning is emitted
- AND the step exits zero

---

## Epic Requirements

### Requirement REQ-E-1: Self-Hosting Bootstrap Order

The slice delivery order S1 → S2 → S3 → S4 MUST be maintained. No slice MAY be
blocked by a governance gate that does not yet exist. Running `brain:protect` after S3
merges MUST be an explicit operator action, not automatic.

[**Manual operational acceptance**: the PR chain itself verifies the sequence — each
slice passes whatever gates are active when it merges. The S2→S3 activation seam is an
intentional bootstrap window, not a defect]

#### Scenario: S2 PR does not require CI that does not yet exist

- GIVEN `governance.yml` is being introduced in S2 for the first time
- WHEN the S2 PR is merged
- THEN no required status check blocked the merge (branch protection is off at S2 time)

#### Scenario: S3 PR is the first gated PR

- GIVEN S2 has merged and `governance.yml` is live in `main`
- WHEN the S3 PR is opened
- THEN the `issue-link` and `diff-size` CI jobs run and their results appear in the PR

---

### Requirement REQ-E-2: Pre-Protection Branch Coordination

Before `brain:protect` is run, the open `feature/issue-11-cli-i18n` branch (which
predates governance compliance) MUST be explicitly coordinated — either brought into
compliance or merged — as a USER decision. This coordination MUST NOT be automated.

[**Manual user decision**: the operator verifies branch status before running
`brain:protect`; no script enforces this — it is an explicit human coordination step]

#### Scenario: Operator addresses pre-existing branch before activation

- GIVEN `feature/issue-11-cli-i18n` exists and predates governance
- WHEN the operator is about to run `brain:protect`
- THEN the operator has explicitly addressed the branch (merged, rebased into compliance,
  or documented an exception)

---

## Gaps and Assumptions

| # | Gap / Assumption |
|---|-----------------|
| G1 | **CI-behavior requirements (REQ-S2-1, REQ-S2-2, REQ-S2-4, REQ-S4-1, REQ-S4-2, REQ-S4-3)** cannot be covered by `node --test`. Verification strategy: (a) the S2 PR is a live self-governing PR that proves Gates I+II on real input; (b) each slice PR description includes a numbered manual E2E checklist mapping 1:1 to the slice acceptance criteria; (c) S4 gates are verified by the first post-activation governed PRs. |
| G2 | **Architectural-surface pattern set (REQ-S4-3)**: the exact file-path patterns defining "architectural surfaces" are deferred to design. The spec requires a WARNING and exit 0; the pattern set is an implementation decision. |
| G3 | **Invariant-3 honest residual (REQ-S4-1)**: the `.memory/`-changed proxy proves `memory:share` ran, NOT that capture was complete or good. The full `session_summary`-in-`.memory/` check is Phase 2, contingent on (a) confirmed engram JSONL record shape and (b) a `session/{issue}` topic_key convention. This is a stated, intentional weakening. |
| G4 | **Bootstrap activation window (REQ-E-1, REQ-S3-6)**: between S2 merging and `brain:protect` running, `governance.yml` is live but non-blocking. This is an intentional seam, not a defect. The window duration is bounded by the operator running `brain:protect` immediately after S3 merges. |
| G5 | **Lockout risk during S3 rollback**: if protection is on and CI is red, all merges are blocked. Mitigation: repo-admin override is available (logged); `gh api -X DELETE /repos/{owner}/{repo}/branches/main/protection` disables protection in one call. This is a known operational risk documented in the rollback plan, not a spec gap. |
