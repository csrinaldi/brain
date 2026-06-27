# Tasks: Workflow Governance Layer (governance)

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~540 total across 4 PRs (~110 / ~150 / ~220 / ~60 per slice) |
| 400-line budget risk | Low |
| Chained PRs recommended | Yes |
| Suggested split | S1 → S2 → S3 → S4 (feature-branch-chain, tracker `feature/governance`) |
| Delivery strategy | feature-branch-chain |
| Chain strategy | feature-branch-chain |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: Low

### Chained PR Plan

| Slice | Branch | Base | ~Lines |
|-------|--------|------|--------|
| S1 | `gov/s1-foundation` | `feature/governance` | ~110 |
| S2 | `gov/s2-hard-gates` | `gov/s1-foundation` | ~150 |
| S3 | `gov/s3-protect` | `gov/s2-hard-gates` | ~220 |
| S4 | `gov/s4-gates-iv` | `gov/s3-protect` | ~60 |

**Activation gate**: `brain:protect` runs ONLY after S3 merges to tracker. Coordinate `feature/issue-11-cli-i18n` before running (REQ-E-2, operator decision, not automated). This ends the direct-merge window for all subsequent PRs.

---

## Task type legend
**CODE-TDD** = node:test unit-testable | **YAML** = workflow authoring | **FILE** = file-authoring/file assertion | **OPERATOR** = manual/live action

---

## S1 — Foundation (PR #S1 → base `feature/governance`) ~110 lines

- [ ] **S1.1** [FILE] Verify `brain/project/decisions/adr-0014-workflow-governance.md` and `brain/HOME.md` link `[ADR-0014](project/decisions/adr-0014-workflow-governance.md)` are committed on S1 branch; run `npm run brain:nav` → exit 0. (REQ-S1-1)
- [ ] **S1.2** [FILE] Create `.github/PULL_REQUEST_TEMPLATE.md` containing: `Closes|Fixes|Resolves #N` section, 400-line budget + `size:exception` reference, ADR/decision checkbox. (REQ-S1-2)
- [ ] **S1.3** [CODE-TDD RED] Add two test cases to `scripts/lib/installer.test.mjs`: (a) fixture config missing `governance.ignoreList` → migration adds it with `.memory/**`, `openspec/changes/**`, lock-file globs; (b) second run is a no-op (idempotent). (REQ-S1-3)
- [ ] **S1.4** [CODE-TDD GREEN] Append `0.4.0` migration to `brain/core/config-migrations.mjs`: additive defaults `{ governance: { ignoreList: ['.memory/**','openspec/changes/**','package-lock.json','pnpm-lock.yaml','yarn.lock'] } }`. (REQ-S1-3)
- [ ] **S1.5** [CODE-TDD RED] Create `scripts/lib/managed-paths.test.mjs`: assert `managed` contains `.github/workflows/governance.yml` and `.github/PULL_REQUEST_TEMPLATE.md`; assert no entry matches `.github/**` glob. (REQ-S1-4)
- [ ] **S1.6** [CODE-TDD GREEN] Add the two literal `.github/` entries to `managed` array in `brain/core/managed-paths.mjs`. Do not add `.github/**`. (REQ-S1-4)
- [ ] **S1.7** [OPERATOR] `npm test` → green; `npm run brain:nav` → exit 0; confirm no `governance.yml` in repo (no CI yet). (REQ-S1-5)

Sequential: S1.3 → S1.4; S1.5 → S1.6. S1.1, S1.2, and the two TDD pairs are parallel tracks.

---

## S2 — Hard Gates I+II (PR #S2 → base `gov/s1-foundation`) ~150 lines

- [ ] **S2.1** [CODE-TDD RED] Create `scripts/vcs/diff-size-count.test.mjs`: test `parseDiffNumstat(rawNumstat, ignoreList)` — fixture with `.memory/` (3 lines) + `scripts/foo.mjs` (5 lines) + ignoreList `['.memory/**']` → 5; fixture with +5 added/-3 deleted in included files → 8. (REQ-S2-3)
- [ ] **S2.2** [CODE-TDD GREEN] Create `scripts/vcs/diff-size-count.mjs` exporting `parseDiffNumstat(raw, ignoreList)`: parse `git diff --numstat` output string, apply minimatch glob exclusions, return additions+deletions. (REQ-S2-3)
- [ ] **S2.3** [YAML] Create `.github/workflows/governance.yml` with `issue-link` job (parse PR body for `Closes|Fixes|Resolves #N`, verify `status:approved` label via `gh api`) and `diff-size` job (read ignoreList from `brain.config.json` via `jq`, call `node scripts/vcs/diff-size-count.mjs`, fail >400 without `size:exception`). Apply all YAML/bash gotchas from design: `run: |`, `set -euo pipefail`, `|| true` on grep no-match, single-quoted git pathspec, `join()` label flatten, `pull_request` trigger. (REQ-S2-1, REQ-S2-2)
- [ ] **S2.4** [OPERATOR] `npm test` → green; validate `governance.yml` YAML syntax. (REQ-S2-3)
- [ ] **S2.5** [OPERATOR / manual E2E] S2 PR description must include numbered checklist: (a) PR body has `Closes #N` for a `status:approved` issue; (b) diff after ignore-list <400 lines; (c) both CI jobs pass; (d) branch protection remains off after merge. (REQ-S2-4, REQ-E-1)

Sequential: S2.1 → S2.2. S2.3 can be authored in parallel. S2.4 after S2.1-S2.3.

---

## S3 — brain:protect + Activation (PR #S3 → base `gov/s2-hard-gates`) ~220 lines

- [ ] **S3.1** [CODE-TDD RED] Create `scripts/vcs/governance-checks.test.mjs`: (a) drift-guard — parse `governance.yml` job `name:` fields, assert set equals `GOVERNANCE_JOBS` from module (hard correctness dep — fail closed on drift); (b) `checkContexts()` returns `['governance / issue-link', 'governance / diff-size']`. (REQ-S3-3)
- [ ] **S3.2** [CODE-TDD GREEN] Create `scripts/vcs/governance-checks.mjs` exporting `WORKFLOW_NAME = 'governance'`, `GOVERNANCE_JOBS = ['issue-link', 'diff-size']` (S2-state; S4 extends), `checkContexts()`. (REQ-S3-3)
- [ ] **S3.3** [CODE-TDD RED] Add `branchProtect` tests to `scripts/vcs/providers.test.mjs` via `setSpawn` seam: assert `gh api -X PUT repos/{project}/branches/main/protection` called; assert payload `required_status_checks.strict=true`, `allow_force_pushes=false`, `required_pull_request_reviews.required_approving_review_count=1`, `restrictions=null`; assert returns `{ protected: true }`. (REQ-S3-1)
- [ ] **S3.4** [CODE-TDD GREEN] Implement `branchProtect({ project, branch='main', checks, requiredReviews=1 })` in `scripts/vcs/providers/github.mjs` using `run('gh', ['api','-X','PUT', ...], { input: JSON.stringify(payload) })`; place alongside `issueView`. (REQ-S3-1)
- [ ] **S3.5** [CODE-TDD RED+GREEN] Add test to `scripts/vcs/providers.test.mjs`: `gitlab.branchProtect()` throws error containing "not yet implemented". Add stub to `scripts/vcs/providers/gitlab.mjs`. (REQ-S3-2)
- [ ] **S3.6** [FILE] Create `scripts/brain-protect.mjs`: reads `vcs.provider` + `project` from `brain.config.json`, imports `checkContexts` from `governance-checks.mjs`, dispatches to provider `branchProtect({ project, checks: checkContexts() })`, prints result. (REQ-S3-1)
- [ ] **S3.7** [FILE] Add `"brain:protect": "node scripts/brain-protect.mjs"` to `package.json` scripts. (REQ-S3-5)
- [ ] **S3.8** [FILE] Update `brain/core/methodology/vcs-contract.md`: add `branchProtect` row `({ project, branch, checks, requiredReviews }) -> { protected }` to verb table; note GitLab deferred to Phase 3. (REQ-S3-1)
- [ ] **S3.9** [FILE] Create `brain/core/methodology/workflow-governance.md`: four invariants each mapped to gate (CI job name + skip label); enforce-outputs/guide-judgment boundary explicitly named; lockout recovery (`gh api -X DELETE .../protection`) and S3 rollback dual-surface (revert files AND disable protection). (REQ-S3-4)
- [ ] **S3.10** [FILE] Update `scripts/bootstrap.sh` (`env:init` target): add output directing operator to run `npm run brain:protect` as a one-time admin action, NOT a per-developer step. (REQ-S3-5)
- [ ] **S3.11** [OPERATOR] `npm test` → green (drift-guard, branchProtect, GitLab stub tests all pass). (REQ-S3-1, REQ-S3-2, REQ-S3-3)
- [ ] **S3.12** [OPERATOR — pre-activation] Inspect `feature/issue-11-cli-i18n`; decide: merge, rebase into compliance, or document exception. Record decision in S3 PR description. (REQ-E-2)
- [ ] **S3.13** [OPERATOR — activation] After S3 merges to tracker: run `npm run brain:protect`; verify via `gh api GET /repos/{project}/branches/main/protection` that status-checks, PR reviews, and `allow_force_pushes:false` are configured; confirm a non-admin direct push is rejected. (REQ-S3-6)

Sequential: S3.1 → S3.2; S3.3 → S3.4; S3.5 self-contained; S3.6 after S3.2+S3.4; S3.7-S3.10 parallel after S3.6; S3.12 and S3.13 are post-merge operator steps.

---

## S4 — Gates III+IV (PR #S4 → base `gov/s3-protect`) ~60 lines

- [ ] **S4.1** [CODE-TDD + YAML — atomic commit] Update `GOVERNANCE_JOBS` in `scripts/vcs/governance-checks.mjs` to `['issue-link','diff-size','memory-gate','decision-gate']`; update drift-guard expectations in `governance-checks.test.mjs`; add `memory-gate` and `decision-gate` jobs to `.github/workflows/governance.yml` in the same commit (drift-guard test is red until YAML and constant match). (REQ-S4-1, REQ-S4-2, REQ-S3-3)
- [ ] **S4.2** [YAML] `memory-gate` job body: `git diff --name-only $BASE_SHA...$HEAD_SHA -- '.memory/'`; empty output → non-zero exit; `skip:memory-gate` label → exit 0 early. (REQ-S4-1)
- [ ] **S4.3** [YAML] `decision-gate` job — step 1 (hard): if `decision` label present, require `brain/project/decisions/adr-[0-9]{4}-*.md` AND `brain/HOME.md` in diff, else exit non-zero. Step 2 (heuristic): check arch surfaces (`scripts/.*/providers/`, `brain/core/`, `config-migrations.mjs`, `package.json`) with no ADR → emit `::warning::`, always `exit 0`. (REQ-S4-2, REQ-S4-3)
- [ ] **S4.4** [OPERATOR] `npm test` → green; drift-guard confirms 4 YAML job names === `GOVERNANCE_JOBS`. (REQ-S3-3)
- [ ] **S4.5** [OPERATOR / manual E2E] S4 PR description checklist: (a) all 4 CI jobs pass under active governance; (b) verify `skip:memory-gate` label exempts memory-gate; (c) verify `decision` label + no ADR fails decision-gate; (d) verify arch-surface heuristic emits warning but does not block. (REQ-S4-1, REQ-S4-2, REQ-S4-3, REQ-E-1)

S4.1 must be one atomic commit (GOVERNANCE_JOBS + test expectations + YAML jobs together). S4.2 and S4.3 are part of that same commit.

---

## Closure Checklist

- [ ] `npm test` green on all 4 slice branches (no regressions introduced)
- [ ] `npm run brain:nav` exit 0 (ADR-0014 indexed, no orphans)
- [ ] Drift-guard test passing (`GOVERNANCE_JOBS` === YAML job names on S4 branch)
- [ ] `brain:protect` run confirmed; protection verified via `gh api GET` (REQ-S3-6)
- [ ] `feature/issue-11-cli-i18n` coordination documented before activation (REQ-E-2)
- [ ] Epic invariant confirmed: no arch-surface heuristic step uses `exit 1` — all `exit 0` (REQ-E-1 + non-goal)
