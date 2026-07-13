### [issue-governance] governance — 2026-07-13

# Workflow Governance Layer Specification

## Purpose

Enforces brain's four load-bearing workflow invariants as far as the environment allows,
and makes compliance the path of least resistance for humans and agents alike. Three
composed layers: the **floor** (generic checks library + client-hook suite + `brain:audit`
— always-on, tool-independent); the **hard gate** (VCS adapter, additive,
capability-aware); and the **golden path** (self-gating brain verbs). Enforces the
observable OUTPUTS of each invariant. Does NOT enforce JUDGMENT — capture quality,
recognizing unlabeled decisions, and slicing coherence remain guidance.

## Epic Invariant (Non-Goal — stated)

The system MUST NOT claim to enforce judgment-level correctness. The floor enforces
OUTPUTS only. The following are explicitly out of scope for this change and are
non-goals at the enforcement layer: (a) complete or high-quality session capture,
(b) recognizing a decision that is NOT labeled `decision`, (c) slicing coherence
(only that changed lines stay ≤400). The system MUST NOT treat client hooks as a
substitute for the platform hard gate; they are the *floor*, not a *fallback*. Naming
these boundaries is part of the design.

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
| REQ-S3-1 | 3 | protectBranch returns `{enforced,reason,remedy}` | Unit (`node --test`) |
| REQ-S3-2 | 3 | GitLab impl throws "not yet implemented" | Unit (`node --test`) |
| REQ-S3-3 | 3 | Check names single-source | Unit (`node --test`) |
| REQ-S3-4 | 3 | workflow-governance.md L3 doc | File assertion |
| REQ-S3-5 | 3 | env:init references brain:protect | File assertion |
| REQ-S3-6 | 3 | Activation sequence | Manual operational acceptance |
| REQ-S3-7 | 3 | capabilities() probed, not hardcoded | Unit (`node --test`) |
| REQ-S3-8 | 3 | brain:governance status per-consumer | Integration / manual |
| REQ-S4-1 | 4 | Generic checks library — four pure functions | Unit (`node --test`) |
| REQ-S4-2 | 4 | commit-msg hook wired to library | Unit + manual install |
| REQ-S4-3 | 4 | pre-commit hook wired to library | Unit + manual install |
| REQ-S4-4 | 4 | pre-push hook wired to library | Unit + manual install |
| REQ-S4-5 | 4 | brain:audit re-verifies merged history | Unit (`node --test`) |
| REQ-S4-6 | 4 | brain:audit attributes violations | Unit + manual |
| REQ-S5-1 | 5 | brain:start gates on approved ticket | Integration (`node --test`) |
| REQ-S5-2 | 5 | brain:check runs four checks + tests + repo:check | Integration (`node --test`) |
| REQ-S5-3 | 5 | brain:save gates session summary + memory | Integration (`node --test`) |
| REQ-S5-4 | 5 | brain:ship gates invariants + opens PR | Integration (`node --test`) |
| REQ-S5-5 | 5 | brain:next state-machine guidance | Unit (`node --test`) |
| REQ-S5-6 | 5 | --no-verify prohibition (repo:check + harness hook) | Unit + file assertion |
| REQ-E-1 | epic | Bootstrap order S1→S2→S3→S4→S5 | Manual operational acceptance |
| REQ-E-2 | epic | Pre-protection branch coordination | Manual user decision |

---

## Slice 1 — Foundation ✅

### Requirement REQ-S1-1: ADR-0014 Exists and Is Indexed

`brain/project/decisions/adr-0014-workflow-governance.md` MUST exist. `brain/HOME.md`
MUST include a link to it. `npm run brain:nav` MUST report no orphans after S1 merges.

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

`brain/core/config-migrations.mjs` MUST include a migration adding `governance.ignoreList`.
The migration MUST be idempotent. Default globs MUST include `.memory/**`, `openspec/changes/**`,
and at least one lock-file pattern.

[**unit-testable**: call migration on a fixture config twice; assert key present, values match defaults, no duplicate entries on second run]

#### Scenario: Migration adds ignoreList with defaults

- GIVEN `brain.config.json` does not contain `governance.ignoreList`
- WHEN the migration runs
- THEN `brain.config.json` contains `governance.ignoreList` with `.memory/**`, `openspec/changes/**`, and at least one lock-file glob

#### Scenario: Migration is idempotent

- GIVEN `brain.config.json` already contains `governance.ignoreList`
- WHEN the migration runs a second time
- THEN `brain.config.json` is unchanged

---

### Requirement REQ-S1-4: Managed-Paths Specific Entries

`brain/core/managed-paths.mjs` MUST list `.github/workflows/governance.yml` and
`.github/PULL_REQUEST_TEMPLATE.md` in the managed array. It MUST NOT contain `.github/**`.

[**unit-testable**: import `managed-paths.mjs`; assert the two specific paths are present; assert no entry matches `.github/**`]

#### Scenario: Two specific paths present

- GIVEN `managed-paths.mjs` is imported
- WHEN the `managed` export is inspected
- THEN both `.github/workflows/governance.yml` and `.github/PULL_REQUEST_TEMPLATE.md` are in the array

#### Scenario: No broad .github glob

- GIVEN `managed-paths.mjs` is imported
- WHEN the `managed` export is inspected
- THEN no entry matches the glob `.github/**`

---

### Requirement REQ-S1-5: No CI and No Branch Protection After S1

After S1 merges, `main` MUST behave exactly as before.

#### Scenario: No workflow triggered after S1

- GIVEN S1 has merged to `main`
- WHEN a new PR is opened
- THEN no governance workflow check appears in GitHub Actions for that PR

---

## Slice 2 — Platform CI (Additive Adapter) ✅

> **Reframing note (v2):** S2 delivers **one additive enforcement adapter** — conditional on GitHub and the consumer's tier. It is not the universal guarantee. The floor (S4) provides tool-independent coverage. The two CI jobs remain as implemented; this section retains the S2 requirements without change.

### Requirement REQ-S2-1: issue-link Job Gate

The `governance.yml` `issue-link` job MUST fail a PR whose body lacks a
`Closes|Fixes|Resolves #N` reference (case-insensitive). It MUST also fail a PR whose
referenced issue `#N` does not carry the `status:approved` label. It MUST pass when
both conditions hold.

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

The line-count logic MUST be extractable with an injectable seam and coverable by
`node --test` using diff fixtures.

[**unit-testable** — already covered by `scripts/vcs/diff-size-count.test.mjs`]

#### Scenario: Count excludes ignore-list paths

- GIVEN a diff fixture with changes in `.memory/chunks/foo.jsonl.gz` (3 lines) and `scripts/foo.mjs` (5 lines)
- WHEN the count function runs with ignoreList `['.memory/**']`
- THEN the result is 5

#### Scenario: Count reflects additions plus deletions

- GIVEN a diff fixture with 5 added lines and 3 deleted lines in included files
- WHEN the count function runs
- THEN the result is 8

---

### Requirement REQ-S2-4: S2 PR Self-Compliance and Protection Off

The S2 PR MUST itself comply with Gates I and II. Branch protection MUST remain off after S2 merges.

#### Scenario: S2 PR passes its own gates

- GIVEN the S2 PR has an approved issue reference and is under 400 lines
- WHEN the `issue-link` and `diff-size` jobs run on the S2 PR
- THEN both jobs exit zero

#### Scenario: Branch protection off after S2

- GIVEN S2 has merged
- WHEN the GitHub branch protection settings for `main` are inspected
- THEN no protection rule requires governance checks

---

## Slice 3 — Capability-aware Adapter

### Requirement REQ-S3-1: protectBranch Returns `{enforced, reason, remedy}`

`scripts/vcs/providers/github.mjs` MUST implement `protectBranch()`. On success it MUST
return `{ enforced: true }`. On any failure (403, unsupported, etc.) it MUST return
`{ enforced: false, reason: 'tier'|'unsupported', remedy: '<string>' }`. It MUST NOT throw or crash.
The protection payload MUST require: the governance check contexts from `governance.yml`,
≥1 approving review, and `allow_force_pushes: false`.

[**unit-testable**: the `gh api` argument construction MUST be exposed via an injectable seam. Assert correct return shape for 200, 403, and other exit codes without making a live API call]

#### Scenario: Successful protection call returns enforced:true

- GIVEN the GitHub tier allows branch protection
- WHEN `protectBranch()` is called with valid args
- THEN it returns `{ enforced: true }`

#### Scenario: 403 from GitHub returns enforced:false with reason and remedy

- GIVEN the GitHub tier does not support branch protection (403)
- WHEN `protectBranch()` is called
- THEN it returns `{ enforced: false, reason: 'tier', remedy: '<upgrade message>' }`
- AND it does NOT throw

#### Scenario: GitHub impl builds correct API payload

- GIVEN the injectable seam is called with owner and repo params
- WHEN `protectBranch()` assembles the `gh api` arguments
- THEN the HTTP method is `PUT`
- AND the path is `/repos/{owner}/{repo}/branches/main/protection`
- AND the payload includes `required_status_checks`, `required_pull_request_reviews`, and `allow_force_pushes: false`

#### Scenario: Idempotent re-run produces no error

- GIVEN `brain:protect` has already been run once successfully
- WHEN `brain:protect` is run a second time
- THEN it exits zero with no error

---

### Requirement REQ-S3-2: GitLab protectBranch Throws "Not Yet Implemented"

`scripts/vcs/providers/gitlab.mjs` MUST implement `protectBranch()`. The implementation
MUST throw a clearly worded "not yet implemented" error.

[**unit-testable**: call `gitlab.protectBranch()` in a `node --test` test; assert the thrown error message contains "not yet implemented"]

#### Scenario: GitLab impl throws with clear message

- GIVEN `scripts/vcs/providers/gitlab.mjs` is imported
- WHEN `protectBranch()` is called
- THEN an error is thrown containing the phrase "not yet implemented"

---

### Requirement REQ-S3-3: Check Names Single-Source

The `required_status_checks` contexts in the `protectBranch` payload MUST exactly match
the job names defined in `.github/workflows/governance.yml`. No string divergence
is permitted between the two.

[**unit-testable**: a `node --test` test reads `governance.yml` job names and compares them with the contexts from `checkContexts()`; the test MUST fail on any mismatch]

#### Scenario: Contexts match workflow job names

- GIVEN `governance.yml` defines jobs `issue-link` and `diff-size`
- WHEN the `protectBranch` payload contexts are inspected
- THEN `required_status_checks.checks` contains entries whose `context` values match those job names exactly

#### Scenario: Adding a new CI job requires payload update

- GIVEN a new job is added to `governance.yml`
- WHEN the single-source test runs
- THEN the test fails until `GOVERNANCE_JOBS` is updated to include the new job

---

### Requirement REQ-S3-4: workflow-governance.md L3 Doc Exists

`brain/core/methodology/workflow-governance.md` MUST exist after S3 merges. It MUST
state the four invariants, map each to its layer (floor hook, CI adapter, audit), and
name the enforce-outputs/guide-judgment boundary explicitly.

#### Scenario: Doc exists and covers all four invariants

- GIVEN S3 has merged
- WHEN `workflow-governance.md` is read
- THEN all four invariant descriptions are present
- AND each invariant is mapped to its enforcement layer

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

[**Manual operational acceptance**: post-merge, operator runs `brain:protect` and verifies settings via `gh api GET /repos/{owner}/{repo}/branches/main/protection`]

#### Scenario: Direct push blocked after brain:protect

- GIVEN `brain:protect` has been run after S3 merges
- WHEN a non-admin direct push to `main` is attempted
- THEN GitHub rejects the push with a branch protection error

---

### Requirement REQ-S3-7: capabilities() Probed, Not Hardcoded

`scripts/vcs/providers/github.mjs` MUST export `capabilities()`. It MUST return
`{ hardEnforcement: 'available'|'unavailable'|'unknown', detail: string }`. It MUST
derive the result by probing the API (attempt + cache result), NOT by hardcoding a
platform/tier matrix.

[**unit-testable**: assert correct return shape for 200, 403, and unexpected exit codes via injectable seam]

#### Scenario: Available tier returns hardEnforcement:available

- GIVEN the API probe succeeds (200 or 404)
- WHEN `capabilities()` is called
- THEN it returns `{ hardEnforcement: 'available', detail: '...' }`

#### Scenario: 403 tier returns hardEnforcement:unavailable

- GIVEN the API probe returns 403
- WHEN `capabilities()` is called
- THEN it returns `{ hardEnforcement: 'unavailable', detail: '403 — ...' }`

#### Scenario: Unexpected response returns hardEnforcement:unknown

- GIVEN the API probe returns an unexpected exit code
- WHEN `capabilities()` is called
- THEN it returns `{ hardEnforcement: 'unknown', detail: '...' }`

---

### Requirement REQ-S3-8: brain:governance status Per-Consumer Report

`brain:governance status` (exposed as `npm run brain:governance-status`) MUST report
all three layers for the consumer's repo: hooks state (ON/OFF), platform hard-gate state
(available/unavailable + remedy if unavailable), and `brain:audit` state (ON). The
report MUST clearly distinguish universal from conditional layers.

[**Integration / manual**: verify output format; assert the three layers appear in the output]

#### Scenario: Report shows hooks ON and adapter unavailable with remedy

- GIVEN a consumer repo on GitHub Free private
- WHEN `brain:governance status` runs
- THEN the output shows hooks as ON (universal)
- AND shows brain:audit as ON (universal)
- AND shows platform hard gate as unavailable with a remedy message

---

## Slice 4 — The Floor (Tool-Independent Guarantee)

### Requirement REQ-S4-1: Generic Checks Library — Four Pure Functions

`scripts/governance/checks/` MUST export four pure functions over git/PR data:
`diffSize(rawNumstat, ignoreList)`, `issueLink(body)`, `adrPresence(changedFiles)`,
`memoryPresence(changedFiles)`. Each MUST return `{ pass: boolean, reason?: string }`.
Each MUST be unit-testable in isolation, independently of CI or the hook environment.

[**unit-testable**: test each function with fixture inputs covering pass and fail cases]

#### Scenario: diffSize returns pass:false for oversized diff

- GIVEN a raw numstat with 401+ lines after ignore-list
- WHEN `diffSize(rawNumstat, ignoreList)` is called
- THEN it returns `{ pass: false, reason: '...' }`

#### Scenario: diffSize returns pass:true with size:exception label (via caller)

- GIVEN the caller has already checked for the `size:exception` label and short-circuits
- WHEN `diffSize()` is not called (exempt path)
- THEN the caller exits pass:true without calling the function

#### Scenario: issueLink returns pass:false for body with no Closes reference

- GIVEN a PR body with no `Closes|Fixes|Resolves #N`
- WHEN `issueLink(body)` is called
- THEN it returns `{ pass: false, reason: 'No issue reference found' }`

#### Scenario: adrPresence returns pass:false for decision PR missing ADR file

- GIVEN a changed-files list with no `brain/project/decisions/adr-NNNN-*.md` entry
- WHEN `adrPresence(changedFiles)` is called
- THEN it returns `{ pass: false, reason: 'No ADR file found' }`

#### Scenario: memoryPresence returns pass:false when no .memory/ file changed

- GIVEN a changed-files list with no `.memory/` path
- WHEN `memoryPresence(changedFiles)` is called
- THEN it returns `{ pass: false, reason: 'No .memory/ changes found' }`

#### Scenario: All four functions are side-effect free

- GIVEN any valid or invalid fixture input
- WHEN any of the four functions is called
- THEN no file is written, no process is spawned, and no global state is mutated

---

### Requirement REQ-S4-2: commit-msg Hook Wired to Library

`scripts/hooks/commit-msg` MUST exist, be installed via `core.hooksPath`, and enforce:
(a) conventional commit format (`type(scope)?: message`), (b) ticket reference (`#N`)
required for non-merge non-initial commits. On minimal environments (no node) it MUST
exit 0 non-blocking.

[**unit-testable**: test the commit-msg validation logic with fixture messages; manual install verification]

#### Scenario: Non-conventional commit message is rejected

- GIVEN a commit message "fixed the bug" (no type prefix)
- WHEN the commit-msg hook runs
- THEN it exits non-zero with a clear error message

#### Scenario: Conventional commit without ticket ref is rejected (non-exempt)

- GIVEN a commit message "feat: add new feature" with no `#N` reference
- WHEN the commit-msg hook runs (and the commit is not a merge commit)
- THEN it exits non-zero

#### Scenario: Valid conventional commit with ticket ref passes

- GIVEN a commit message "feat(governance): add floor checks #42"
- WHEN the commit-msg hook runs
- THEN it exits zero

#### Scenario: No node available — hook does not block

- GIVEN node is not available in the environment
- WHEN the commit-msg hook is triggered
- THEN it exits zero

---

### Requirement REQ-S4-3: pre-commit Hook Wired to Library

`scripts/hooks/pre-commit` MUST exist, be installed via `core.hooksPath`, and:
(a) run `repo:check` (prohibited-reference engine), (b) block a direct commit to `main` or `master`.
On minimal environments (no node) it MUST exit 0 non-blocking.

[**unit-testable**: test the direct-commit guard logic; repo:check call can be stubbed]

#### Scenario: Direct commit to main is blocked

- GIVEN the current branch is `main`
- WHEN the pre-commit hook runs
- THEN it exits non-zero with a message explaining the prohibition

#### Scenario: Commit to feature branch passes pre-commit

- GIVEN the current branch is `feature/issue-42-my-feature`
- WHEN the pre-commit hook runs (no prohibited refs in staged files)
- THEN it exits zero

#### Scenario: Prohibited reference in staged file is blocked

- GIVEN a staged file contains `--no-verify` (a prohibited ref)
- WHEN the pre-commit hook runs repo:check
- THEN it exits non-zero citing the prohibited reference

---

### Requirement REQ-S4-4: pre-push Hook Wired to Library

`scripts/hooks/pre-push` MUST run the four generic checks (diffSize, issueLink,
adrPresence, memoryPresence) against the commits being pushed. It MUST already
materialize memory before the check (existing behavior). It MUST exit non-zero and
advise how to fix or label-exempt when any check fails. Emergency bypass via
`git push --no-verify` MUST remain possible (caught by `brain:audit`).

[**unit-testable**: existing `pre-push.test.mjs` extended with check-invocation tests]

#### Scenario: Push with oversized diff is blocked

- GIVEN commits being pushed include 401+ changed lines after ignore-list
- WHEN the pre-push hook runs
- THEN it exits non-zero with a diff-size message

#### Scenario: Push with no .memory/ changes is blocked

- GIVEN commits being pushed include no `.memory/` file changes
- WHEN the pre-push hook runs
- THEN it exits non-zero with a memory-gate message

#### Scenario: Push passes when all four checks pass

- GIVEN commits with valid size, issue link, and .memory/ changes
- WHEN the pre-push hook runs
- THEN it exits zero

---

### Requirement REQ-S4-5: brain:audit Re-Verifies Merged History

`scripts/brain-audit.mjs` MUST accept an audit range (--since or --from SHA), iterate
merge commits in that range via `git log`, run the four generic checks against each
merge's diff, and report `[PASS|FAIL] <sha> <short-msg> — <failed invariants>`.
It MUST exit non-zero if any violation is found.

[**unit-testable**: test with a git fixture repository containing known-good and known-bad merges]

#### Scenario: Audit detects oversized merge

- GIVEN a merge commit with 401+ changed lines after ignore-list
- WHEN `brain:audit` is run over the range including that merge
- THEN the report shows FAIL for that SHA citing diff-size
- AND the command exits non-zero

#### Scenario: Audit passes over compliant history

- GIVEN a merge commit where all four invariants pass
- WHEN `brain:audit` is run over the range including that merge
- THEN the report shows PASS for that SHA
- AND the command exits zero

#### Scenario: Audit runs after hook bypass

- GIVEN a merge commit introduced via `git push --no-verify` bypassing the pre-push hook
- WHEN `brain:audit` is run
- THEN the violation is still detected and attributed to that SHA

---

### Requirement REQ-S4-6: brain:audit Attributes Violations

`brain:audit` MUST include the commit SHA and short commit message in every FAIL report
line. This attribution makes violations visible and non-repudiable.

#### Scenario: FAIL report includes SHA and message

- GIVEN a merge commit with a hook-bypassed diff-size violation
- WHEN `brain:audit` runs
- THEN the output line is `[FAIL] <sha> <short-msg> — diff-size: 450 lines > 400`

---

## Slice 5 — The Golden Path

### Requirement REQ-S5-1: brain:start Gates on Approved Ticket

`brain:start <issue>` MUST verify the issue exists and carries `status:approved` via
the VCS adapter before creating a branch or worktree. It MUST refuse and exit non-zero
if the issue does not exist or lacks `status:approved`. On success it MUST create the
branch and print the next recommended step.

[**unit-testable**: stub VCS adapter; assert refusal on missing/unapproved issue; assert branch creation on approved issue]

#### Scenario: Unapproved issue causes refusal

- GIVEN issue #42 exists but lacks `status:approved`
- WHEN `brain:start 42` is run
- THEN the command exits non-zero with a message citing the missing label

#### Scenario: Non-existent issue causes refusal

- GIVEN issue #99 does not exist
- WHEN `brain:start 99` is run
- THEN the command exits non-zero with a "not found" message

#### Scenario: Approved issue creates branch

- GIVEN issue #42 has `status:approved`
- WHEN `brain:start 42` is run
- THEN a branch `feature/issue-42-*` is created and the command exits zero

---

### Requirement REQ-S5-2: brain:check Runs Four Checks + Tests + repo:check

`brain:check` MUST run: all four generic checks (against the current branch diff vs.
base), `npm test`, and `npm run repo:check`. It MUST aggregate results and exit non-zero
if any component fails. It MUST be fast (skip heavy checks if `--fast` flag is passed).

[**unit-testable**: stub subprocess calls; assert all three components are invoked; assert exit-zero only when all pass]

#### Scenario: All components pass — exits zero

- GIVEN the diff is within size, issue is linked, tests pass, and no prohibited refs
- WHEN `brain:check` runs
- THEN it exits zero

#### Scenario: Any component failure causes exit non-zero

- GIVEN tests fail
- WHEN `brain:check` runs
- THEN it exits non-zero reporting the failed component

---

### Requirement REQ-S5-3: brain:save Gates Session Summary + Memory

`brain:save` MUST: (a) call `memory:share` to materialize memory, (b) verify that
`.memory/` now has uncommitted changes (i.e., new observations exist), (c) commit the
`.memory/` changes. It MUST exit non-zero if no new memory was materialized.

[**unit-testable**: stub memory:share and git commands; assert exit non-zero when no .memory/ changes appear]

#### Scenario: No new memory causes refusal

- GIVEN `memory:share` runs but produces no new .memory/ changes
- WHEN `brain:save` runs
- THEN it exits non-zero with a message asking the user to capture a session summary

#### Scenario: New memory present — commits and exits zero

- GIVEN `memory:share` produces new .memory/ changes
- WHEN `brain:save` runs
- THEN the .memory/ changes are committed and the command exits zero

---

### Requirement REQ-S5-4: brain:ship Gates Invariants + Opens PR

`brain:ship` MUST: (a) re-run `brain:check` (all four invariant checks), (b) refuse and
exit non-zero if any check fails, (c) on success, open a PR via the VCS adapter with
the PR template, `Closes #<issue>` in the body, and correct labels. The PR body MUST
include the `Closes #N` reference so the `issue-link` CI gate can parse it.

[**unit-testable**: stub check runner and VCS adapter; assert refusal on failing checks; assert correct PR body on success]

#### Scenario: Failing check causes refusal

- GIVEN `brain:check` returns a failing result for diff-size
- WHEN `brain:ship` runs
- THEN it exits non-zero without opening a PR

#### Scenario: All checks pass — opens PR with correct body

- GIVEN all four checks pass
- WHEN `brain:ship` runs
- THEN a PR is opened with `Closes #<issue>` in the body and exits zero

---

### Requirement REQ-S5-5: brain:next State-Machine Guidance

`brain:next` MUST derive the current workflow state from (git branch, open PRs via VCS
adapter, `.memory/` changes, brain.config.json) and emit the single next recommended
command. It MUST cover at minimum: no branch → `brain:start`; checks failing →
`brain:check`; no memory materialized → `brain:save`; checks+memory pass, no open PR
→ `brain:ship`; open PR exists → status message.

[**unit-testable**: test each state transition with fixture inputs; assert correct command emitted for each state]

#### Scenario: No branch exists → recommends brain:start

- GIVEN no feature branch is checked out
- WHEN `brain:next` runs
- THEN output contains `brain:start <issue>`

#### Scenario: Branch with failing checks → recommends brain:check

- GIVEN feature branch checked out, last check run failed
- WHEN `brain:next` runs
- THEN output contains `brain:check`

#### Scenario: All pass, no open PR → recommends brain:ship

- GIVEN checks pass, .memory/ committed, no open PR
- WHEN `brain:next` runs
- THEN output contains `brain:ship`

---

### Requirement REQ-S5-6: --no-verify Prohibition

`--no-verify` and `git commit -n` MUST be added to the prohibited-reference list used
by `repo:check`. A harness PreToolUse hook (in the sanctioned Claude Code harness
config) MUST block any Bash command containing `--no-verify`. brain's own scripts MUST
NOT contain either pattern (enforced by the same `repo:check` run).

[**unit-testable**: assert the prohibited-ref entries exist in check-config; assert repo:check fails on a file containing `--no-verify`; file assertion for harness config]

#### Scenario: repo:check fails on file containing --no-verify

- GIVEN a file in the repo contains the string `--no-verify` (not in a comment or docs)
- WHEN `npm run repo:check` runs
- THEN it exits non-zero citing the prohibited reference

#### Scenario: Harness config blocks --no-verify Bash commands

- GIVEN the sanctioned Claude Code harness config is in place
- WHEN the agent attempts to run `git push --no-verify`
- THEN the PreToolUse hook blocks the command before execution

#### Scenario: brain's own scripts do not contain --no-verify

- GIVEN S5 has merged
- WHEN `npm run repo:check` runs on the brain repo
- THEN no violation is reported for `--no-verify` in brain's own scripts

---

## Epic Requirements

### Requirement REQ-E-1: Self-Hosting Bootstrap Order

The slice delivery order S1 → S2 → S3 → S4 → S5 MUST be maintained. No slice MAY be
blocked by a governance gate that does not yet exist. Running `brain:protect` after S3
merges MUST be an explicit operator action, not automatic.

#### Scenario: S3 PR is the first gated PR

- GIVEN S2 has merged and `governance.yml` is live in `main`
- WHEN the S3 PR is opened
- THEN the `issue-link` and `diff-size` CI jobs run and their results appear in the PR

#### Scenario: S4 and S5 run under full adapter governance

- GIVEN S3 has merged and `brain:protect` has been run
- WHEN the S4 and S5 PRs are opened
- THEN all active governance checks apply

---

### Requirement REQ-E-2: Pre-Protection Branch Coordination

Before `brain:protect` is run, the open `feature/issue-11-cli-i18n` branch MUST be
explicitly coordinated — either brought into compliance or merged — as a USER decision.
This coordination MUST NOT be automated.

#### Scenario: Operator addresses pre-existing branch before activation

- GIVEN `feature/issue-11-cli-i18n` exists and predates governance
- WHEN the operator is about to run `brain:protect`
- THEN the operator has explicitly addressed the branch and recorded the decision

---

## Gaps and Assumptions

| # | Gap / Assumption |
|---|-----------------|
| G1 | **CI-behavior requirements (REQ-S2-1, REQ-S2-2, REQ-S2-4)** cannot be covered by `node --test`. Verification: (a) the S2 PR is a live self-governing PR proving Gates I+II on real input; (b) each slice PR description includes a numbered manual E2E checklist mapping to acceptance criteria. |
| G2 | **Architectural-surface pattern set**: the `decision-gate` heuristic from v1-S4 is removed from the CI layer (moved to the floor). Its file-path patterns are an implementation decision for the `adrPresence` check in S4. |
| G3 | **Invariant-3 honest residual (REQ-S4-4)**: `memoryPresence` proves `memory:share` ran (`.memory/` changed), NOT that a `session_summary` was written nor that it was good. The full check is Phase 3, contingent on: (a) confirmed engram JSONL record shape, (b) `session/{issue}` topic_key convention. |
| G4 | **Bootstrap activation window (REQ-E-1, REQ-S3-6)**: between S2 merging and `brain:protect` running, `governance.yml` is live but non-blocking. Intentional seam, not a defect. |
| G5 | **Lockout risk during S3 rollback**: if protection is on and CI is red, all merges block. Mitigation: repo-admin override (`enforce_admins:false`) + `gh api -X DELETE .../protection` disables in one call. Documented operational risk. |
| G6 | **brain:next state derivation**: the canonical state representation (git branch + open PRs + .memory/ + brain.config) is an implementation decision for S5. The spec requires the correct command per state; the state model is design-level. |
| G7 | **Harness PreToolUse hook format**: the exact `.claude/settings.json` (or equivalent) schema for blocking Bash commands is harness-specific. The requirement is tool-independent (the policy); the harness config is implementation. |
