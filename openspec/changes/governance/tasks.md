# Tasks: Workflow Governance Layer (governance)

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~840 total across 5 PRs (~110 / ~150 / ~260 / ~200 / ~120 per slice) |
| 400-line budget risk | **Medium** — S3 and S4 each approach the budget; split S4 if checks lib + audit exceed ~350 lines |
| Chained PRs recommended | Yes |
| Suggested split | S1 → S2 → S3 → S4 → S5 (feature-branch-chain, tracker `feature/governance`) |
| Delivery strategy | feature-branch-chain |
| Chain strategy | feature-branch-chain |

Decision needed before apply: No (S3-S5 each within budget at current estimates)
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: Medium (S4 watch — 200 lines est. but may expand; split to S4a/S4b if needed)

### Chained PR Plan

| Slice | Branch | Base | ~Lines |
|-------|--------|------|--------|
| S1 | `gov/s1-foundation` | `feature/governance` | ~110 ✅ Done |
| S2 | `gov/s2-hard-gates` | `gov/s1-foundation` | ~150 ✅ Done |
| S3 | `gov/s3-protect` | `gov/s2-hard-gates` | ~260 |
| S4 | `gov/s4-floor` | `gov/s3-protect` | ~200 |
| S5 | `gov/s5-golden-path` | `gov/s4-floor` | ~120 |

**Activation gate**: `brain:protect` runs ONLY after S3 merges to tracker. Coordinate `feature/issue-11-cli-i18n` before running (REQ-E-2, operator decision, not automated). This ends the direct-merge window for all subsequent PRs.

**S4 split signal**: if the generic checks library + hook suite + `brain:audit` together exceed ~350 lines, split into `gov/s4a-checks-lib` (library + tests) and `gov/s4b-hooks-audit` (hook suite + `brain:audit`).

---

## Task type legend
**CODE-TDD** = node:test unit-testable | **FILE** = file-authoring/file assertion | **OPERATOR** = manual/live action

---

## S1 — Foundation ✅ (all tasks complete)

- [x] **S1.1** [FILE] `brain/project/decisions/adr-0014-workflow-governance.md` and `brain/HOME.md` link committed; `npm run brain:nav` → exit 0. (REQ-S1-1)
- [x] **S1.2** [FILE] `.github/PULL_REQUEST_TEMPLATE.md` with `Closes|Fixes|Resolves #N` section, 400-line + `size:exception` reference, ADR/decision checkbox. (REQ-S1-2)
- [x] **S1.3** [CODE-TDD] Tests: (a) migration adds `governance.ignoreList`; (b) second run is idempotent. (REQ-S1-3)
- [x] **S1.4** [CODE-TDD] Append `0.4.0` migration to `brain/core/config-migrations.mjs`. (REQ-S1-3)
- [x] **S1.5** [CODE-TDD] `managed-paths.test.mjs`: two specific `.github/` paths present; no `.github/**` glob. (REQ-S1-4)
- [x] **S1.6** [CODE-TDD] Add two literal `.github/` entries to `brain/core/managed-paths.mjs`. (REQ-S1-4)
- [x] **S1.7** [OPERATOR] `npm test` → green; `npm run brain:nav` → exit 0; no `governance.yml` in repo. (REQ-S1-5)

---

## S2 — Platform CI Adapter ✅ (all tasks complete)

- [x] **S2.1** [CODE-TDD] `diff-size-count.test.mjs`: `parseDiffNumstat` with `.memory/` exclusion and addition+deletion sum. (REQ-S2-3)
- [x] **S2.2** [CODE-TDD] `scripts/vcs/diff-size-count.mjs` exporting `parseDiffNumstat`. (REQ-S2-3)
- [x] **S2.3** [FILE] `.github/workflows/governance.yml` with `issue-link` and `diff-size` jobs. (REQ-S2-1, REQ-S2-2)
- [x] **S2.4** [OPERATOR] `npm test` → green; `governance.yml` YAML syntax valid. (REQ-S2-3)
- [ ] **S2.5** [OPERATOR / manual E2E] S2 PR description checklist: (a) `Closes #N` for `status:approved` issue; (b) diff after ignore-list <400; (c) both CI jobs pass; (d) protection remains off after merge. (REQ-S2-4, REQ-E-1)

---

## S3 — Capability-aware Adapter (PR #S3 → base `gov/s2-hard-gates`) ~260 lines

- [x] **S3.1** [CODE-TDD RED] `scripts/vcs/governance-checks.test.mjs`: (a) drift-guard — parse `governance.yml` job names, assert set equals `GOVERNANCE_JOBS`; (b) `checkContexts()` returns `['governance / issue-link', 'governance / diff-size']`. (REQ-S3-3)
- [x] **S3.2** [CODE-TDD GREEN] `scripts/vcs/governance-checks.mjs` exporting `WORKFLOW_NAME`, `GOVERNANCE_JOBS = ['issue-link', 'diff-size']`, `checkContexts()`. (REQ-S3-3)
- [x] **S3.3** [CODE-TDD RED] `scripts/vcs/providers.test.mjs` — `protectBranch` tests via `setSpawn` seam: (a) returns `{enforced:true}` on exit 0; (b) returns `{enforced:false, reason:'tier', remedy:'...'}` on exit 403; (c) returns `{enforced:false, reason:'unsupported', ...}` on other non-zero; (d) never throws. Assert payload `required_status_checks.strict=true`, `allow_force_pushes=false`, `required_pull_request_reviews.required_approving_review_count=1`. (REQ-S3-1)
- [x] **S3.4** [CODE-TDD GREEN] Implement `protectBranch({ project, branch, checks, requiredReviews })` in `scripts/vcs/providers/github.mjs` returning `{enforced, reason?, remedy?}`. (REQ-S3-1)
- [x] **S3.5** [CODE-TDD RED] `capabilities()` tests: (a) 200/404 → `{hardEnforcement:'available'}`; (b) 403 → `{hardEnforcement:'unavailable'}`; (c) other → `{hardEnforcement:'unknown'}`. (REQ-S3-7)
- [x] **S3.6** [CODE-TDD GREEN] Implement `capabilities()` in `scripts/vcs/providers/github.mjs` via API probe + cache. (REQ-S3-7)
- [x] **S3.7** [CODE-TDD RED+GREEN] Test + stub: `gitlab.capabilities()` returns `{hardEnforcement:'unknown', detail:'...'}` (does NOT throw). (REQ-S3-2)
- [x] **S3.8** [FILE] `scripts/brain-protect.mjs`: updated to handle `{enforced, reason?, remedy?}` — prints success on `true`, prints reason+remedy on `false` and exits 0 (known outcome); exits 1 only for config/module errors. (REQ-S3-1)
- [x] **S3.9** [FILE] `scripts/brain-governance-status.mjs`: reads config, calls `capabilities()`, reports hooks (ON, universal), brain:audit (ON, universal), platform (available/unavailable + remedy). CLI-guarded (side-effect-free on import). (REQ-S3-8)
- [x] **S3.10** [FILE] `package.json` scripts: `"brain:protect"` (pre-existing) + `"brain:governance-status"` added. (REQ-S3-1, REQ-S3-8)
- [ ] **S3.11** [FILE] `brain/core/methodology/vcs-contract.md`: add `protectBranch` → `{enforced, reason?, remedy?}` and `capabilities()` → `{hardEnforcement, detail}` to verb table; note GitLab deferred. (REQ-S3-1, REQ-S3-7)
- [ ] **S3.12** [FILE] `brain/core/methodology/workflow-governance.md`: four invariants, each mapped to its layer (floor hook, CI adapter, audit); enforce-outputs/guide-judgment boundary; lockout recovery; activation sequence. (REQ-S3-4)
- [ ] **S3.13** [FILE] `scripts/bootstrap.sh` (`env:init`): add output directing operator to run `npm run brain:protect` as a one-time admin action (NOT per-developer). (REQ-S3-5)
- [ ] **S3.14** [OPERATOR] `npm test` → green (drift-guard, protectBranch, capabilities, GitLab stub tests all pass). (REQ-S3-1, REQ-S3-2, REQ-S3-3, REQ-S3-7)
- [ ] **S3.15** [OPERATOR — pre-activation] Inspect `feature/issue-11-cli-i18n`; decide: merge, rebase into compliance, or document exception. Record decision in S3 PR description. (REQ-E-2)
- [ ] **S3.16** [OPERATOR — activation] After S3 merges to tracker: run `npm run brain:protect`; verify via `gh api GET .../branches/main/protection`; confirm a non-admin direct push is rejected. (REQ-S3-6)

Sequential: S3.1 → S3.2; S3.3 → S3.4; S3.5 → S3.6; S3.7 self-contained; S3.8 after S3.2+S3.4; S3.9 after S3.6; S3.10-S3.13 parallel after S3.8-S3.9; S3.15 and S3.16 are post-merge operator steps.

---

## S4 — The Floor (PR #S4 → base `gov/s3-protect`) ~200 lines

> **If this slice exceeds ~350 lines:** split into `gov/s4a-checks-lib` (S4.1–S4.4 + tests) and `gov/s4b-hooks-audit` (S4.5–S4.9). The two halves compose; S4a has no activation step.

- [ ] **S4.1** [CODE-TDD RED] `scripts/governance/checks/diff-size.test.mjs`: test `diffSize(rawNumstat, ignoreList)` — fixture with `.memory/` excluded (→ pass within budget), 401-line fixture (→ fail), binary files → 0. Reuse `parseDiffNumstat` from `diff-size-count.mjs` as the implementation. (REQ-S4-1)
- [ ] **S4.2** [CODE-TDD RED] `scripts/governance/checks/issue-link.test.mjs`: (a) body with `Closes #42` → pass; (b) body with no reference → fail; (c) case-insensitive `FIXES #7` → pass. (REQ-S4-1)
- [ ] **S4.3** [CODE-TDD RED] `scripts/governance/checks/adr-presence.test.mjs`: (a) changedFiles includes `brain/project/decisions/adr-0042-foo.md` and `brain/HOME.md` → pass; (b) missing ADR file → fail; (c) missing HOME.md → fail. (REQ-S4-1)
- [ ] **S4.4** [CODE-TDD RED] `scripts/governance/checks/memory-presence.test.mjs`: (a) changedFiles includes `.memory/chunks/foo.jsonl.gz` → pass; (b) no `.memory/` file → fail. (REQ-S4-1)
- [ ] **S4.5** [CODE-TDD GREEN] Create the four check modules in `scripts/governance/checks/`: `diff-size.mjs` (re-exports `parseDiffNumstat`), `issue-link.mjs`, `adr-presence.mjs`, `memory-presence.mjs`. Each returns `{ pass: boolean, reason?: string }`. (REQ-S4-1)
- [ ] **S4.6** [FILE] Create `scripts/hooks/commit-msg`: validate conventional commit format + ticket ref (`#N` required for non-merge commits); no-node guard (exit 0 if node unavailable). (REQ-S4-2)
- [ ] **S4.7** [FILE] Create `scripts/hooks/pre-commit`: run `npm run repo:check`; block direct commit to `main`/`master` by reading current branch via `git rev-parse --abbrev-ref HEAD`; no-node guard. (REQ-S4-3)
- [ ] **S4.8** [FILE] Extend `scripts/hooks/pre-push`: wire calls to `diffSize`, `issueLink`, `adrPresence`, `memoryPresence` from `scripts/governance/checks/` against the pushed range (`git log $remote_sha..$local_sha`); exit non-zero on any failure with clear remedy message. Memory materialization (existing) stays; runs before check calls. (REQ-S4-4)
- [ ] **S4.9** [CODE-TDD + FILE] `scripts/brain-audit.mjs` + test: (a) iterate merge commits in audit range via `git log --merges`; (b) run four checks per merge; (c) emit `[PASS|FAIL] <sha> <short-msg> — <failed invariants>`; (d) exit non-zero on any FAIL. Test with a git fixture repository (bare init + synthetic merges). Add `"brain:audit": "node scripts/brain-audit.mjs"` to `package.json` scripts. (REQ-S4-5, REQ-S4-6)
- [ ] **S4.10** [OPERATOR] `npm test` → green (all check unit tests + audit test pass). (REQ-S4-1 through REQ-S4-6)
- [ ] **S4.11** [OPERATOR / manual] Verify hook suite fires correctly: create a test commit with a bad message → `commit-msg` blocks; attempt direct commit to `main` → `pre-commit` blocks; attempt push without `.memory/` changes → `pre-push` blocks. (REQ-S4-2, REQ-S4-3, REQ-S4-4)

Sequential: S4.1-S4.4 (RED tests) are parallel; S4.5 (GREEN) after all four REDs; S4.6-S4.8 parallel after S4.5; S4.9 after S4.5; S4.10 after all code tasks; S4.11 after S4.10.

---

## S5 — The Golden Path (PR #S5 → base `gov/s4-floor`) ~120 lines

- [ ] **S5.1** [CODE-TDD RED+GREEN] `scripts/brain-start.mjs` + test: (a) call `issueView()` via VCS adapter; (b) assert `status:approved` label → create branch via `branchCreate`; (c) exit non-zero with clear message if not approved or not found. Add `"brain:start": "node scripts/brain-start.mjs"` to `package.json`. (REQ-S5-1)
- [ ] **S5.2** [CODE-TDD RED+GREEN] `scripts/brain-check.mjs` + test: spawn `diffSize`, `issueLink`, `adrPresence`, `memoryPresence` against current branch diff vs. base; spawn `npm test`; spawn `npm run repo:check`; aggregate; exit non-zero if any fails. Add `"brain:check": "node scripts/brain-check.mjs"` to `package.json`. (REQ-S5-2)
- [ ] **S5.3** [CODE-TDD RED+GREEN] `scripts/brain-save.mjs` + test: (a) call `memory:share`; (b) detect new `.memory/` uncommitted changes via `git status --porcelain`; (c) if none → exit non-zero with prompt to capture session summary; (d) commit `.memory/` with message `chore(memory): sync .memory [brain:save]`. Add `"brain:save": "node scripts/brain-save.mjs"` to `package.json`. (REQ-S5-3)
- [ ] **S5.4** [CODE-TDD RED+GREEN] `scripts/brain-ship.mjs` + test: (a) call `brain:check` subprocess; (b) exit non-zero if any check fails; (c) call `mrCreate` via VCS adapter with template + `Closes #<issue>` body + labels; (d) print PR URL on success. Add `"brain:ship": "node scripts/brain-ship.mjs"` to `package.json`. (REQ-S5-4)
- [ ] **S5.5** [CODE-TDD RED+GREEN] `scripts/brain-next.mjs` + test: derive state from (git branch, open PRs via VCS adapter stub, `.memory/` status, brain.config.json); emit correct next command for each state: no-branch → `brain:start`; checks-failing → `brain:check`; no-memory → `brain:save`; checks+memory done → `brain:ship`; open-PR → status message. Add `"brain:next": "node scripts/brain-next.mjs"` to `package.json`. (REQ-S5-5)
- [ ] **S5.6** [FILE + CODE-TDD] Add `--no-verify` and `git commit -n` to the prohibited-refs list in `brain/core/check-config.json` (or the config file used by `repo:check`). Add unit test asserting `repo:check` exits non-zero on a fixture file containing `--no-verify`. (REQ-S5-6)
- [ ] **S5.7** [FILE] Create/extend `.claude/settings.json` (or the applicable Claude Code harness config) with a PreToolUse hook rule blocking Bash commands matching `--no-verify|git commit -n`. Add this path to managed paths if it should travel with brain. (REQ-S5-6)
- [ ] **S5.8** [OPERATOR] `npm test` → green (all S5 tests pass). (REQ-S5-1 through REQ-S5-6)
- [ ] **S5.9** [OPERATOR / manual E2E] S5 PR checklist: (a) `brain:start` refuses an unapproved issue; (b) `brain:check` exits non-zero on a bad diff; (c) `brain:save` refuses with no new memory; (d) `brain:ship` refuses if checks fail; (e) `brain:next` emits the correct next step from each state; (f) `repo:check` flags a file containing `--no-verify`. (REQ-S5-1 through REQ-S5-6)

Sequential: S5.1-S5.5 are independent and can be authored in parallel; S5.6 → S5.7 sequential (policy before harness); S5.8 after all code tasks.

---

## Closure Checklist

- [ ] `npm test` green on all 5 slice branches (no regressions)
- [ ] `npm run brain:nav` exit 0 (ADR-0014 indexed, no orphans)
- [ ] Drift-guard test passing (`GOVERNANCE_JOBS === YAML job names`)
- [ ] `brain:protect` run confirmed; protection verified via `gh api GET` (REQ-S3-6)
- [ ] `brain:governance status` reports all three layers correctly for the current consumer
- [ ] `brain:audit` run over recent merged history — no undetected violations
- [ ] `brain:next` returns correct guidance from each workflow state
- [ ] `feature/issue-11-cli-i18n` coordination documented before activation (REQ-E-2)
- [ ] Epic invariant confirmed: no floor check exits non-zero when it should be a warning
- [ ] `--no-verify` does NOT appear in any brain script file (`repo:check` confirms)
