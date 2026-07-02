# Governance v3 — Harness-Agnostic Fail-Closed Loop Enforcement Specification

## Purpose

Move brain's load-bearing workflow discipline — the SDD phase order, human approval,
and Tier-2 "no agent writes to `brain/`" — from harness prompts (`gentle-ai`'s
`SKILL.md` files) into fail-closed gates over **observable evidence** (file state, git
blame, PR/issue actor, merged diff) wired into `.github/workflows/governance.yml` and
`GOVERNANCE_JOBS` (`brain/scripts/vcs/governance-checks.mjs`). Every gate is
**capability-aware**: it detects the substrate it runs on and enforces at the highest
rung available (merge-time prevention → release-time prevention → post-merge
auto-correction → detection-only), degrading gracefully and never lying about which
guarantee is active. This spec covers WHAT must be true after the change; HOW each
gate is implemented (script internals, YAML job bodies, revert-PR mechanics) is
design-level.

## Epic Invariant (Non-Goal — stated)

The system MUST NOT claim to enforce judgment-level correctness. It enforces the
**outcome** of the governed process (phases happened, in order, with artifacts;
approval was applied by a human; brain-core writes were reviewed) — never the
**producing tool**, and never review quality, slice quality, or whether a session
capture is complete. `--no-verify` client-side blocking is a pre-existing, bounded,
harness-specific exception, not a new mechanism; `brain:audit` (L2) is its
harness-agnostic backstop.

## Requirement Index

| Req | Level | Name | Testable |
|---|---|---|---|
| REQ-L1-1 | L1 | CI runs `repo:check` + `brain:nav` + `npm test` author-agnostically | CI-behavior (self-governing PR) |
| REQ-L2-1 | L2 | `brain:audit` fails closed on the release/tag path (rung 2) | Integration / manual E2E |
| REQ-L2-2 | L2 | `brain:audit` runs scheduled + post-merge; failure opens auto-revert PR or blocks tag (rung 3) | Integration / manual E2E |
| REQ-L3-1 | L3 | `memory-gate` job exists and is registered in `GOVERNANCE_JOBS` | Unit (`node --test`) + CI-behavior |
| REQ-L3-2 | L3 | `decision-gate` job exists and is registered in `GOVERNANCE_JOBS` | Unit (`node --test`) + CI-behavior |
| REQ-L3-3 | L3 | Drift-guard test keeps `GOVERNANCE_JOBS` and `governance.yml` in sync after L3–L5 land | Unit (`node --test`) |
| REQ-L4-1 | L4 | Phase-order checker is a generic script over `openspec/changes/**` file state + `git blame`, sibling to `check-refs.mjs`, not embedded in any `SKILL.md` | Unit (`node --test`) + file assertion |
| REQ-L4-2 | L4 | Gate requires `spec.md` AND `design.md` to exist, not just `proposal.md` + `tasks.md` | Unit (`node --test`) |
| REQ-L4-3 | L4 | Gate rejects backward/non-monotonic phase-status transitions | Unit (`node --test`) |
| REQ-L4-4 | L4 | Gate rejects code changes outside `openspec/changes/**` when `tasks.md` has zero checked items | Unit (`node --test`) |
| REQ-L4-5 | L4 | Gate ships as detection-only until it reports zero false positives over existing `openspec/changes/**` history | Integration / manual acceptance |
| REQ-L5-1 | L5 | Actor who applied `status:approved` MUST differ from the PR/issue author | Unit (`node --test`) + CI-behavior |
| REQ-L5-2 | L5 | Bot/admin/re-label edge cases do not misfire as self-approval | Unit (`node --test`) |
| REQ-L6-1 | L6 | CODEOWNERS requires human review on `brain/core/**` and `brain/project/**` edits | File assertion + CI-behavior |
| REQ-L6-2 | L6 | Evidence check: a PR touching brain/core/** or brain/project/** must have an APPROVED review from a non-author human (not the PR author, not a bot) | Unit + CI-behavior (detection) |
| REQ-LADDER-1 | Ladder | Every new gate returns `{enforced, reason, remedy}` and never crashes | Unit (`node --test`) |
| REQ-LADDER-2 | Ladder | Every new gate detects the substrate and runs at the highest available rung, no dual code path | Integration / manual acceptance |
| REQ-HONESTY-1 | Honesty | `brain:governance-status` reports the active rung and the remedy to climb higher | Integration / manual |
| REQ-HONESTY-2 | Honesty | A detection-only (rung-4) project is surfaced as release-blocking-visible, never silent | Integration / manual |
| REQ-NEUTRALITY-1 | Neutrality | Every gate inspects evidence (file state, git-blame, PR actor, diff), never the producing tool | File assertion (code review of gate implementations) |
| REQ-NEUTRALITY-2 | Neutrality | No mechanism added by v3 requires a specific harness | File assertion |

---

## Level 1 — CI Runs the Local-Only Checks

### Requirement REQ-L1-1: `repo:check` + `brain:nav` + `npm test` Run in CI, Author-Agnostically

`.github/workflows/governance.yml` MUST add a job (or extend an existing one) that runs
`npm run repo:check`, `npm run brain:nav`, and `npm test` on every `pull_request` event
covered by the workflow's trigger (`opened, synchronize, reopened, edited, labeled,
unlabeled`). The job MUST fail the PR when any of the three commands exits non-zero.
This closes the gap that today these three commands run only in
`brain/scripts/hooks/pre-push` (bypassable via `git push --no-verify`), so a PR from a
contributor without the hook installed, or one that bypassed it, was previously
ungated.

[**CI-behavior**: verified by a self-governing PR — the L1 PR itself must trip and then
clear this job]

#### Scenario: PR with a prohibited reference fails CI

- GIVEN a PR introduces a file containing a pattern matched by `brain/project/check-refs-rules.mjs` (or a structural `check-refs.mjs` violation)
- WHEN the L1 governance job runs
- THEN `repo:check` exits non-zero and the job fails

#### Scenario: PR with a broken brain-nav link fails CI

- GIVEN a PR removes a file referenced elsewhere in `brain/HOME.md` or leaves an orphaned doc
- WHEN the L1 governance job runs
- THEN `brain:nav` exits non-zero and the job fails

#### Scenario: PR with a failing test fails CI

- GIVEN a PR introduces or modifies code such that `npm test` exits non-zero
- WHEN the L1 governance job runs
- THEN the job fails

#### Scenario: Bypassed local hook is still caught in CI

- GIVEN a contributor pushed with `git push --no-verify`, skipping `pre-push`
- WHEN the PR is opened or synchronized
- THEN the L1 governance job runs `repo:check` + `brain:nav` + `npm test` regardless of the bypass and fails if any of them would have failed locally

---

## Level 2 — `brain:audit` Wired to Release and Post-Merge

### Requirement REQ-L2-1: `brain:audit` Fails Closed at the Release/Tag Path (Rung 2)

The project's release/publish/tag script MUST invoke `brain-audit.mjs` (or an
equivalent invocation over the range being released) and MUST fail closed — abort the
release — when `brain-audit.mjs` exits non-zero. This MUST hold regardless of whether
branch protection (rung 1) is available, since rung 2 requires only that the project
controls its own release path.

[**Integration / manual E2E**: verified by a fixture release script invoked against a
git history containing a known audit violation, and by a real dry-run against brain's
own release path]

#### Scenario: Release aborts on audit failure

- GIVEN the range being released contains a merge commit that fails one of `brain-audit.mjs`'s checks (e.g. `diffSize`, `issueLink`, `adrPresence`, `memoryPresence`)
- WHEN the release/tag script runs
- THEN `brain-audit.mjs` exits non-zero and the release script aborts before publishing or tagging

#### Scenario: Release proceeds when the audited range is clean

- GIVEN every merge commit in the range being released passes all `brain-audit.mjs` checks
- WHEN the release/tag script runs
- THEN `brain-audit.mjs` exits zero and the release proceeds

#### Scenario: Rung 2 holds on a substrate with no branch protection

- GIVEN branch protection on `main` is unavailable (e.g. GitHub free-tier private, `403` on the protection API)
- WHEN a release is attempted with a violation in the audited range
- THEN the release still fails closed via the release-path `brain:audit` gate

---

### Requirement REQ-L2-2: `brain:audit` Runs Scheduled + Post-Merge, Auto-Correcting on Failure (Rung 3)

A CI trigger (scheduled, e.g. daily/cron, AND on every push to `main`) MUST invoke
`brain-audit.mjs` over recent history. On failure, the workflow MUST either (a) open an
automated revert PR targeting the offending merge commit, or (b) block the next tag/
release from being cut (fail-closed on the release path per REQ-L2-1) until the
violation is resolved. Every failure MUST be attributed to the offending commit SHA and
subject line (already produced by `brain-audit.mjs`'s `[FAIL] <sha7> <subject> —
<check>: <reason>` output format).

[**Integration / manual E2E**: verified against a fixture branch with a deliberately
introduced post-merge violation]

#### Scenario: Scheduled audit catches drift introduced outside CI

- GIVEN a merge landed on `main` through a path that bypassed PR-time checks (e.g. an admin override or a repo without branch protection)
- WHEN the scheduled `brain:audit` CI job runs
- THEN the violating commit is reported `[FAIL] <sha7> <subject> — <check>: <reason>` and the job exits non-zero

#### Scenario: Post-merge failure opens an auto-revert PR

- GIVEN a push to `main` introduces a merge commit that fails `brain-audit.mjs`
- WHEN the post-merge CI job runs
- THEN an automated PR reverting that merge commit is opened (or the next release is blocked per REQ-L2-1) and the failure is attributed to the SHA

#### Scenario: Clean history reports no action

- GIVEN no merge commit in the scheduled/post-merge audit range fails any check
- WHEN the scheduled or post-merge job runs
- THEN it exits zero and no revert PR is opened

---

## Level 3 — `memory-gate` and `decision-gate` Jobs

### Requirement REQ-L3-1: `memory-gate` Job Exists and Is Registered

`.github/workflows/governance.yml` MUST add a `memory-gate` job that runs the existing
`memoryPresence` pure check (`brain/scripts/governance/checks/memory-presence.mjs`)
against the PR's changed files, and fails the PR when the check returns
`{ pass: false }`. `memory-gate` MUST be added to `GOVERNANCE_JOBS` in
`brain/scripts/vcs/governance-checks.mjs`.

[**unit-testable**: `memoryPresence` is already pure and tested; the job wiring is
covered by the drift-guard test plus a CI-behavior scenario]

#### Scenario: PR with no `.memory/` changes fails memory-gate

- GIVEN a PR's changed-files list contains no path under `.memory/`
- WHEN the `memory-gate` job runs
- THEN it exits non-zero

#### Scenario: PR with `.memory/` changes passes memory-gate

- GIVEN a PR's changed-files list contains at least one path under `.memory/`
- WHEN the `memory-gate` job runs
- THEN it exits zero

---

### Requirement REQ-L3-2: `decision-gate` Job Exists and Is Registered

`.github/workflows/governance.yml` MUST add a `decision-gate` job that runs the
existing `adrPresence` pure check (`brain/scripts/governance/checks/adr-presence.mjs`)
against the PR's changed files, gated to PRs whose diff touches an
architectural-surface path pattern (the pattern set is an implementation decision —
see design), and fails when `adrPresence` returns `{ pass: false }` for a PR that
matches. `decision-gate` MUST be added to `GOVERNANCE_JOBS`.

[**unit-testable**: `adrPresence` is already pure and tested; the surface-pattern
matching and job wiring are covered by unit tests plus a CI-behavior scenario]

#### Scenario: Architectural-surface PR without an ADR fails decision-gate

- GIVEN a PR's diff matches the architectural-surface pattern set and no `brain/project/decisions/adr-NNNN-*.md` file is present in the changed files
- WHEN the `decision-gate` job runs
- THEN it exits non-zero

#### Scenario: Non-architectural PR is not required to add an ADR

- GIVEN a PR's diff does not match the architectural-surface pattern set
- WHEN the `decision-gate` job runs
- THEN it exits zero regardless of ADR presence

---

### Requirement REQ-L3-3: Drift-Guard Stays Green After L3–L5 Additions

The existing drift-guard test in `governance-checks.test.mjs` (which parses
`governance.yml` job `name:` fields and asserts the set equals `GOVERNANCE_JOBS`) MUST
continue to pass after `memory-gate`, `decision-gate`, the L4 phase-order job, and the
L5 actor-check job are added to both `governance.yml` and `GOVERNANCE_JOBS` in the same
commit.

#### Scenario: New job added to both YAML and constant — drift-guard passes

- GIVEN `memory-gate` (or any new L3–L5 job) is added to `governance.yml` and to `GOVERNANCE_JOBS` in the same commit
- WHEN the drift-guard test runs
- THEN it passes

#### Scenario: New job added to YAML only — drift-guard fails

- GIVEN a new job name is added to `governance.yml` but not to `GOVERNANCE_JOBS`
- WHEN the drift-guard test runs
- THEN it fails, citing the mismatch

---

## Level 4 — SDD Phase-Order Gate (the linchpin)

### Requirement REQ-L4-1: Phase-Order Checker Is a Generic In-Repo Script, Not a Harness Prompt

A new script (e.g. `brain/scripts/vcs/phase-order-check.mjs`), sibling to
`brain/scripts/check-refs.mjs`, MUST exist. It MUST derive its verdict purely from
`openspec/changes/**` file state and `git blame`/`git log` history — it MUST NOT read
or depend on any harness-specific file (`SKILL.md`, `.claude/**`, or equivalent). It
MUST be invokable standalone (CLI) and MUST be wired as a job in `governance.yml`,
registered in `GOVERNANCE_JOBS`.

[**unit-testable**: run against fixture `openspec/changes/**` directory trees; assert
pass/fail independent of any harness marker file]

#### Scenario: Checker runs and produces a verdict with no harness files present

- GIVEN a fixture repo tree with `openspec/changes/**` content but no `SKILL.md` or `.claude/**` files anywhere
- WHEN `phase-order-check.mjs` runs
- THEN it produces a pass/fail verdict identical to running it against the same tree with harness files present

#### Scenario: Checker is invokable outside CI

- GIVEN a developer runs `node brain/scripts/vcs/phase-order-check.mjs` locally
- WHEN the command completes
- THEN it exits 0 or 1 and prints the same verdict format used by the CI job

---

### Requirement REQ-L4-2: `spec.md` AND `design.md` Existence Required

For every active (non-archived) directory under `openspec/changes/`, the checker MUST
assert both a spec artifact and `design.md` exist, extending `check-refs.mjs`'s
existing S-1 check (which today asserts only `proposal.md` and `tasks.md`,
`check-refs.mjs:96-112`). The checker MUST recognize a spec artifact at either
`spec.md` (top-level) or `specs/<domain>/spec.md` (subdirectory) — both conventions
are observed in the existing `openspec/changes/**` history (e.g.
`issue-121-adopt-existing-repo/spec.md` vs.
`issue-138-session-start/specs/session-start/spec.md`) — see Gaps G1.

[**unit-testable**: fixture directories with each combination of present/absent
`proposal.md`/`spec.md`/`specs/*/spec.md`/`design.md`/`tasks.md`]

#### Scenario: Missing design.md fails the gate

- GIVEN an active change directory has `proposal.md`, a spec artifact, and `tasks.md`, but no `design.md`
- WHEN the checker runs
- THEN it reports a violation for that change and exits non-zero

#### Scenario: Missing spec artifact (either convention) fails the gate

- GIVEN an active change directory has `proposal.md`, `design.md`, and `tasks.md`, but neither `spec.md` nor any `specs/*/spec.md`
- WHEN the checker runs
- THEN it reports a violation for that change and exits non-zero

#### Scenario: All four artifacts present, either spec convention, passes

- GIVEN an active change directory has `proposal.md`, `design.md`, `tasks.md`, and a spec artifact in either recognized location
- WHEN the checker runs
- THEN it reports no violation for that change

---

### Requirement REQ-L4-3: Monotonic Status Transitions

The checker MUST track each change directory's phase-status signal across its git
history and MUST fail when a later commit reflects an earlier phase than a prior
commit (e.g. a change with `design.md` already committed later loses `design.md`, or
an artifact's `status:` frontmatter regresses from a later value to an earlier one in
the accepted phase order draft → proposed → spec'd → designed → tasked → applied →
verified → archived). The exact source-of-truth signal (frontmatter `status:` field
vs. artifact presence/absence over time vs. a combination) is a design-level decision
— see Gaps G2, which flags that frontmatter `status:` is not reliably updated in
today's history.

[**unit-testable**: fixture git histories with monotonic and non-monotonic artifact/
status sequences]

#### Scenario: Backward artifact removal fails the gate

- GIVEN a change directory's git history shows `design.md` present at commit A and absent at a later commit B on the same change
- WHEN the checker runs over that history
- THEN it reports a non-monotonic transition violation

#### Scenario: Forward-only progression passes

- GIVEN a change directory's git history shows artifacts added in order (proposal → spec → design → tasks) with none removed
- WHEN the checker runs over that history
- THEN it reports no non-monotonicity violation

---

### Requirement REQ-L4-4: No Code Outside `openspec/changes/**` Without a Checked Task

The checker MUST inspect the PR's (or commit range's) changed-file list. If any changed
file falls outside `openspec/changes/**`, the checker MUST assert that the change's
`tasks.md` contains at least one checked item (a Markdown checkbox `- [x]`). If
`tasks.md` has zero checked items and code outside `openspec/changes/**` changed, the
checker MUST fail.

[**unit-testable**: fixture diffs with code-only changes, `openspec/**`-only changes,
and mixed changes, crossed with `tasks.md` fixtures having 0 vs. ≥1 checked items]

#### Scenario: Code change with zero checked tasks fails the gate

- GIVEN a PR changes a file outside `openspec/changes/**` and the referenced change's `tasks.md` has no checked (`- [x]`) items
- WHEN the checker runs
- THEN it reports a violation and exits non-zero

#### Scenario: Code change with at least one checked task passes

- GIVEN a PR changes a file outside `openspec/changes/**` and the referenced change's `tasks.md` has at least one checked item
- WHEN the checker runs
- THEN it reports no violation for this rule

#### Scenario: Openspec-only change with zero checked tasks passes

- GIVEN a PR changes only files under `openspec/changes/**` and `tasks.md` has zero checked items
- WHEN the checker runs
- THEN it reports no violation for this rule (no code was touched, so the checked-task requirement does not apply)

---

### Requirement REQ-L4-5: Ships as Detection Until Zero False Positives Over Existing History

Before the L4 job is promoted from detection-only (report but do not fail the PR) to
required (fail the PR), it MUST be run over the entirety of the existing
`openspec/changes/**` git history and MUST report zero false-positive violations, OR
every reported violation MUST be an explicitly accepted pre-v3 exception (e.g. a
baseline/grandfather cutover analogous to `brain-audit`'s `governance.auditBaseline`).
Real pre-existing directories illustrate the range the checker must handle without
false-failing: `installer-versionado/`, `vcs-adapter/`, and `cli-i18n/` carry
`proposal.md` + `tasks.md` + `design.md` but no spec artifact at all (pre-dating even
the spec.md convention); `issue-138-session-start/` carries the full modern artifact
set (`proposal.md`, `design.md`, `specs/session-start/spec.md`, `tasks.md`) yet its
`design.md`/`tasks.md` frontmatter still reads `status: draft` — see Gaps G2, G3.

[**Manual operational acceptance**: run the checker against the full
`openspec/changes/**` history pre-promotion; the run log is the acceptance artifact]

#### Scenario: Pre-v3 legacy changes do not fail a detection-only run

- GIVEN `openspec/changes/installer-versionado/` (or an equivalent pre-v3 directory with no spec artifact) predates the L4 baseline cutover
- WHEN the checker runs in detection mode over history including that directory
- THEN it reports the directory as a known/exempted pre-baseline case, not a blocking failure

#### Scenario: Checker is required only after a documented zero-false-positive run

- GIVEN the checker has not yet been run to completion over the existing `openspec/changes/**` history
- WHEN a PR is opened
- THEN the L4 job runs in report-only mode and does not fail the PR on its own findings

---

## Level 5 — Human-Approval Actor Check

### Requirement REQ-L5-1: `status:approved` Actor Must Differ From the Author

A new job MUST call `gh api repos/{repo}/issues/{n}/events` (the same permission
already granted — `permissions: issues: read`, `governance.yml:19`) for the issue
referenced by the PR (resolved the same way `issue-link` resolves it), find the actor
who applied the `status:approved` label, and compare that actor's login against the
PR author and the issue author. The job MUST fail when the `status:approved` actor
equals the PR author or the issue author.

[**unit-testable**: fixture `gh api` events payloads with self-applied and
human-applied labels, injected via the same seam pattern used by `protectBranch()`]

#### Scenario: Self-applied approval fails the gate

- GIVEN the issue referenced by the PR was labeled `status:approved` by the same actor who authored the PR
- WHEN the L5 job runs
- THEN it exits non-zero citing self-approval

#### Scenario: Human-applied approval passes the gate

- GIVEN the issue referenced by the PR was labeled `status:approved` by an actor different from the PR author and the issue author
- WHEN the L5 job runs
- THEN it exits zero

---

### Requirement REQ-L5-2: Bot/Admin/Re-Label Edge Cases Documented and Handled

The actor-check MUST NOT misread a legitimate human approval that was applied via
automation (e.g. a bot account acting on a human's explicit instruction, or a repo
admin re-labeling after a discussion) as self-approval, when that scenario is
explicitly documented as an accepted case. Any such exception MUST be an explicit,
narrow rule (e.g. an allow-listed approver identity), not a blanket bypass.

[**unit-testable**: fixture events payloads for bot-applied labels and admin
re-labeling, with and without the documented exception configured]

#### Scenario: Undocumented bot-applied approval still fails

- GIVEN `status:approved` was applied by a bot account not on the explicit allow-list
- WHEN the L5 job runs
- THEN it exits non-zero — automation is not a substitute for a human decision by default

#### Scenario: Allow-listed human-triggered automation passes

- GIVEN `status:approved` was applied by an actor explicitly documented as a human-triggered automation identity, and that actor differs from the PR/issue author
- WHEN the L5 job runs
- THEN it exits zero

---

## Level 6 — CODEOWNERS for `brain/core` and `brain/project`

### Requirement REQ-L6-1: CODEOWNERS Gates Core/Project Edits Behind Human Review

A `CODEOWNERS` file MUST exist at the repo root (or `.github/CODEOWNERS`) and MUST
assign one or more human reviewers (never a bot/agent identity) to `brain/core/**` and
`brain/project/**`. `CODEOWNERS` MUST be added to the managed-path distribution list
per ADR-0014's managed-path model, as a specific entry — never a broad `.github/**`
glob (the same discipline already applied to `governance.yml` and
`PULL_REQUEST_TEMPLATE.md` in `brain/core/managed-paths.mjs`).

This requirement is the **optional rung-1 enhancement**: it depends on a platform that
supports required code-owner review and on branch protection being armed (rung 1). It
is not the primary L6 enforcement mechanism — see REQ-L6-2, which enforces L6 by
evidence regardless of platform or branch-protection state (design §6.1, §6.2).

[**File assertion**: `CODEOWNERS` exists and its rule lines match `brain/core/**` and
`brain/project/**`; **CI-behavior**: a PR touching `brain/core/**` shows a required
human-review requirement in the PR's review panel — verified once branch protection or
required-reviewers is active]

#### Scenario: CODEOWNERS file lists brain/core and brain/project

- GIVEN `CODEOWNERS` is read
- THEN it contains a rule matching `brain/core/**` and a rule matching `brain/project/**`, each assigned to a human reviewer identity

#### Scenario: PR touching brain/core requires a CODEOWNERS review

- GIVEN branch protection or required-reviewers is active and `CODEOWNERS` is in place
- WHEN a PR modifies a file under `brain/core/**`
- THEN GitHub requires an approving review from the assigned CODEOWNERS reviewer before merge is allowed

#### Scenario: CODEOWNERS entry is specific, not a broad .github glob

- GIVEN `brain/core/managed-paths.mjs` is inspected after CODEOWNERS ships
- THEN it lists `CODEOWNERS` (or `.github/CODEOWNERS`) as a specific managed entry, and no entry matches the broad glob `.github/**`

---

### Requirement REQ-L6-2: Evidence-Based Human Review on Brain-Writes (Primary L6 Mechanism)

A PR whose changed files include at least one path under `brain/core/**` or
`brain/project/**` MUST have at least one `APPROVED` review from a human reviewer who
is neither the PR author nor a bot-allow-listed identity, before that PR's brain-writes
are considered reviewed. This check MUST derive its verdict exclusively from PR review
evidence (state, reviewer login) — never from CODEOWNERS assignment or branch-
protection configuration — so it enforces identically on any VCS platform, including
one with no CODEOWNERS support and no branch protection armed. This is the **PRIMARY,
platform-agnostic L6 enforcement mechanism** (design §6.1); REQ-L6-1's `CODEOWNERS`
file is an OPTIONAL rung-1 enhancement layered on top where the platform and branch
protection support required code-owner review (design §6.2). Missing or unavailable
review evidence MUST degrade to a warning, never a false failure, per
REQ-LADDER-1/REQ-NEUTRALITY-1.

[**Unit-testable**: `evaluateBrainWritesReviewed` fixtures covering touch/no-touch,
self-approval, bot-only approval, human approval, missing evidence, and admin override;
**CI-behavior (detection)**: the `brain-writes-reviewed` job runs on every PR and
reports (does not yet block) the verdict while in `DETECTION_JOBS`]

#### Scenario: Non-brain PR is exempt

- GIVEN a PR's changed files contain no path under `brain/core/**` or `brain/project/**`
- WHEN the `brain-writes-reviewed` check runs
- THEN it reports `pass` — no Tier-2 review requirement applies

#### Scenario: Self-approval only fails the check

- GIVEN a PR touches `brain/core/**` or `brain/project/**` and the only `APPROVED` reviewer is the PR author
- WHEN the `brain-writes-reviewed` check runs
- THEN it reports `fail`, enforcing "no agent writes to `brain/`" (Tier-2)

#### Scenario: Bot-only approval fails the check

- GIVEN a PR touches `brain/core/**` or `brain/project/**` and the only `APPROVED` reviewer is a bot-allow-listed identity (no non-author human approver)
- WHEN the `brain-writes-reviewed` check runs
- THEN it reports `fail`

#### Scenario: Human review present passes the check

- GIVEN a PR touches `brain/core/**` or `brain/project/**` and at least one `APPROVED` reviewer is neither the PR author nor bot-allow-listed
- WHEN the `brain-writes-reviewed` check runs
- THEN it reports `pass`

#### Scenario: Missing review evidence warns, never fails

- GIVEN a PR touches `brain/core/**` or `brain/project/**` and there are no reviews, zero `APPROVED` reviews, or the reviews API is unavailable
- WHEN the `brain-writes-reviewed` check runs
- THEN it reports `warn` and never `fail` — missing evidence MUST NOT be treated as a violation

#### Scenario: Admin override passes, logged

- GIVEN a PR touches `brain/core/**` or `brain/project/**` and carries an allow-listed `override:*` label
- WHEN the `brain-writes-reviewed` check runs
- THEN it reports `pass` and the override is logged in the reason string

---

## Cross-Cutting — Substrate Ladder (Capability-Aware)

### Requirement REQ-LADDER-1: Every New Gate Returns `{enforced, reason, remedy}` and Never Crashes

Every gate introduced by this change (L2 release-path wiring, L2/L3 CI jobs, L4, L5,
L6) that depends on substrate capability (branch protection, required reviewers, a
controlled release path) MUST report its outcome using the same shape
`protectBranch()` already establishes: `{ enforced: boolean, reason?: string, remedy?:
string }`. No gate MAY throw an unhandled exception or crash the calling script on a
missing capability; unavailable capability MUST degrade to `{ enforced: false, reason,
remedy }`.

[**unit-testable**: inject an unavailable-capability condition (e.g. no CODEOWNERS
support, no protection API access) for each gate; assert the return shape and absence
of a thrown error]

#### Scenario: Missing capability degrades to `{enforced:false}`, no crash

- GIVEN a gate depends on a substrate capability that is unavailable (e.g. `CODEOWNERS`-enforced review requires a plan tier the repo does not have)
- WHEN the gate runs
- THEN it returns `{ enforced: false, reason: '<capability>', remedy: '<string>' }` and does not throw

#### Scenario: Available capability returns `{enforced:true}`

- GIVEN the required substrate capability is available
- WHEN the gate runs
- THEN it returns `{ enforced: true }`

---

### Requirement REQ-LADDER-2: Highest Available Rung Applied, No Dual Code Path

Each gate MUST run and report identically as detection when a higher rung is
unavailable, and as enforcing when a higher rung becomes available — the same check
logic and check context, not a separate implementation per rung. The rung applied MUST
be the highest one the current substrate allows (per the four-rung table in the
proposal), evaluated at run time, not hardcoded per project.

[**Manual operational acceptance**: the same gate's behavior is observed pre- and
post-`brain:protect` activation, showing report-only vs. blocking behavior from the
identical check logic]

#### Scenario: Gate behaves as detection before rung 1 is available

- GIVEN branch protection is not active on `main`
- WHEN a gate (e.g. L4 phase-order) reports a violation
- THEN the PR check reports the failure but does not block merge (rung 1 absent)

#### Scenario: Same gate becomes enforcing once rung 1 is armed

- GIVEN the operator has run `brain:protect` and the gate's check context is now a required status check
- WHEN the same gate reports the same violation
- THEN the PR is blocked from merging, using the identical underlying check logic

---

## Cross-Cutting — Honest Reporting

### Requirement REQ-HONESTY-1: `brain:governance-status` Reports Active Rung and Remedy

`brain-governance-status.mjs` MUST be extended to report, in addition to the existing
per-layer state, the **active substrate rung** (1–4, per the ladder table) for the
consumer repo and the **remedy** to reach the next rung up. The reported rung MUST be
derived from actual capability probes (as `capabilities()` already does for branch
protection), never hardcoded.

[**Integration / manual**: run `npm run brain:governance-status` against fixtures
representing each rung; assert the reported rung and remedy text]

#### Scenario: Rung 2 repo reports rung 2 with a remedy to reach rung 1

- GIVEN a repo has no branch protection but has a release/tag script wired to `brain:audit` fail-closed
- WHEN `brain:governance-status` runs
- THEN it reports the active rung as 2 and includes a remedy describing how to reach rung 1 (branch protection / self-hosted pre-receive)

#### Scenario: Rung 1 repo reports rung 1 with no remedy needed

- GIVEN branch protection is active and required checks include all governance jobs
- WHEN `brain:governance-status` runs
- THEN it reports the active rung as 1

---

### Requirement REQ-HONESTY-2: Detection-Only State Is Release-Blocking-Visible, Never Silent

When a project's substrate provides none of rung 1 (merge protection), rung 2
(controlled release path wired to fail-closed `brain:audit`), or rung 3 (auto-
correcting post-merge CI), `brain:governance-status` MUST report the active rung as 4
(detection only) in a way that is prominent and unmissable — not buried in normal
output — and this detection-only state MUST itself be surfaced as a release-blocking
concern (e.g. a loud warning that a release script can be configured to require
acknowledging), so a rendered check is never mistaken for an enforced guarantee.

[**Integration / manual**: run against a fixture with no release-path wiring and no
protection access; assert the rung-4 warning is prominent]

#### Scenario: Rung-4-only project surfaces a loud warning

- GIVEN a project has no branch protection, no release-path `brain:audit` wiring, and no post-merge auto-correction
- WHEN `brain:governance-status` runs
- THEN the output prominently reports rung 4 (detection only) and states that no enforcing guarantee is currently active

#### Scenario: Rung-4 state is never reported as a passing/neutral status

- GIVEN the same rung-4-only project
- WHEN any governance summary (status command or release-path pre-flight) is generated
- THEN the detection-only state is never rendered as equivalent to an enforcing rung — it is visually/textually distinguished as the weakest state

---

## Cross-Cutting — Harness Neutrality

### Requirement REQ-NEUTRALITY-1: Gates Inspect Evidence, Never the Producing Tool

Every gate introduced by this change (L1–L6) MUST derive its verdict exclusively from
one or more of: file state under version control, `git blame`/`git log` history, PR/
issue metadata via the VCS adapter (actor, labels, body, base/head refs), and the
merged diff. No gate implementation MAY branch on which harness, agent, or tool
produced a commit, file, or label.

[**File assertion**: code review of each new gate script/job confirms no harness-
identifying condition (e.g. no check for a `Co-Authored-By: Claude` trailer, no
`.claude/**` file read, no user-agent/tool-name field)]

#### Scenario: Gate implementation contains no harness-identifying branch

- GIVEN any of the L1–L6 gate scripts or job steps is read
- THEN it contains no conditional logic keyed on harness identity, tool name, or agent-specific commit trailer

#### Scenario: Identical evidence from different harnesses produces identical verdicts

- GIVEN two PRs with byte-identical `openspec/changes/**` file state, git-blame history, and PR metadata, produced by two different harnesses (or by a human with no harness)
- WHEN any L1–L6 gate runs against each
- THEN both PRs receive the same verdict

---

### Requirement REQ-NEUTRALITY-2: No New Mechanism Requires a Specific Harness

None of the mechanisms added by this change (CI jobs, `brain:audit` release/post-merge
wiring, the phase-order script, the actor-check job, `CODEOWNERS`) MAY require a
specific harness to be present or running. The only harness-specific element in
brain's governance surface remains the pre-existing `--no-verify` PreToolUse hook
(Claude-Code-specific), which this change does not extend or replicate elsewhere; its
backstop (`brain:audit`, L2) is harness-agnostic.

[**File assertion**: none of the new files/jobs reference `.claude/**`,
`SKILL.md`, or any harness-specific config path]

#### Scenario: New gates run identically with no harness installed

- GIVEN a repo with none of `gentle-ai`'s `SKILL.md` files or `.claude/**` config present
- WHEN any L1–L6 CI job runs
- THEN it runs to completion and produces a verdict, with no missing-harness error

#### Scenario: Phase discipline is enforced without any SKILL.md present

- GIVEN the L4 phase-order rule as previously encoded only in a `gentle-ai` `SKILL.md`
- WHEN the same rule is evaluated via `phase-order-check.mjs` on a repo with no `gentle-ai` installation
- THEN the rule is still enforced, sourced entirely from `openspec/changes/**` file state and git history

---

## Gaps and Assumptions

| # | Gap / Assumption |
|---|---|
| G1 | **Spec-artifact location ambiguity.** Existing `openspec/changes/**` history uses two conventions for the spec artifact: top-level `spec.md` (`issue-121-adopt-existing-repo/spec.md`) and `specs/<domain>/spec.md` (`governance/`, `auto-adrs/`, `feature-working-memory/`, `managed-paths-namespace/`, `issue-138-session-start/`). REQ-L4-2 requires the checker to accept either. Whether v3 should also standardize on one going forward is a design/tooling decision, not a spec-level requirement. |
| G2 | **`status:` frontmatter reliability.** Observed directly: `issue-138-session-start/design.md` and `tasks.md` both carry `status: draft` in frontmatter despite the change appearing structurally complete (all four artifacts present, tasks presumably executed). If REQ-L4-3's monotonic-transition check sources its signal from frontmatter `status:` alone, it will likely misfire against real history. The source-of-truth signal (frontmatter vs. artifact-presence timeline vs. a hybrid) is left to design, with this finding flagged as a concrete risk to resolve there. |
| G3 | **Pre-v3 legacy changes with no spec artifact at all.** `installer-versionado/`, `vcs-adapter/`, and `cli-i18n/` carry `proposal.md` + `design.md` + `tasks.md` but no spec artifact under either convention. These pre-date even the two-convention spec.md pattern. REQ-L4-5 requires a baseline/grandfather mechanism (analogous to `brain-audit`'s `governance.auditBaseline`) before the L4 job can be promoted to required; the exact cutover mechanism is a design decision. |
| G4 | **Architectural-surface pattern set for `decision-gate` (REQ-L3-2).** Which file-path patterns count as "architectural surface" (triggering the ADR-presence requirement) is an implementation decision, inherited unresolved from the v1/v2 `decision-gate` heuristic per `openspec/changes/governance/specs/governance/spec.md` G2. |
| G5 | **Auto-revert vs. release-block choice for REQ-L2-2.** The proposal offers "opens an auto-revert PR **or** blocks the tag" as alternatives for rung 3. Which one (or both, selected how) is a design-level decision; this spec requires only that one of the two failure-handling behaviors is present and that the failure is attributed to the offending SHA. |
| G6 | **Bot/admin allow-list mechanism for REQ-L5-2.** The proposal names "bot accounts, admin overrides, and re-labeling" as edge cases needing explicit handling but does not specify the allow-list's storage location or format. Left to design. |
| G7 | **CODEOWNERS reviewer identity.** REQ-L6-1 requires a human reviewer assignment but the proposal does not name who. Left to the operator/design as a per-consumer configuration concern, analogous to `brain.config.json`'s `project.slug`. |
| G8 | **Rung 3 vs. rung 2 precedence when both are available.** The ladder table implies rungs stack (a project may have both a fail-closed release path and post-merge auto-correction). `brain:governance-status`'s "active rung" report (REQ-HONESTY-1) is defined as the **highest** rung reached; the spec does not require rung 3 to imply rung 2 is also wired — a project could have rung 3 (post-merge CI) without rung 2 (no controlled release path), an edge case left to design to classify correctly. |
