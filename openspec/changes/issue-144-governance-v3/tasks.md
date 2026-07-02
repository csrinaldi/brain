---
status: archived
issue: 144
---

# Tasks — Governance v3: harness-agnostic fail-closed loop enforcement (issue 144)

Delivery strategy: `ask-on-risk`. Chain strategy: `feature-branch-chain` — PR1 targets
the `issue-144-governance-v3` tracker branch; each subsequent slice PR targets the
previous slice's branch (focused diffs); only the tracker branch merges to `main`.

---

## Review Workload Forecast

This is a 6-level change touching a shared registry, one new detector module, four new
gate scripts (pure-evaluator + thin-wrapper pairs), two new CI workflows, one file
distribution entry, and an ADR draft. **Single-PR delivery is not viable** — estimated
total diff is well over 400 lines even excluding tests (which `governance.ignoreList`
already excludes: `**/*.test.mjs`, `openspec/changes/**`). Chained PRs required.

| Slice (PR) | Code (`.mjs`, budget-relevant) | Test (`*.test.mjs`, **excluded**) | Workflow YAML (budget-relevant) | Config/docs | Budget-relevant total | 400-line risk |
|---|---|---|---|---|---|---|
| PR1 — L1 + registry refactor | ~40 | ~90 | ~35 | 0 | ~75 | Low |
| PR2a — substrate detector core | ~220 | ~260 | 0 | 0 | ~220 | Low–Medium |
| PR2b — governance-status extension | ~70 | ~90 | 0 | 0 | ~70 | Low |
| PR3 — L3 memory-gate + decision-gate | ~90 | ~110 | ~25 | 0 | ~115 | Low |
| PR4a — L4 pure evaluator (Rules A/B/C) | ~260 | ~340 | 0 | 0 | ~260 | **Medium** (largest single slice — watch during apply, split Rule B into its own commit/PR if it overshoots) |
| PR4b — L4 wrapper + CLI + DETECTION_JOBS wiring + hardening | ~130 | ~150 | ~15 | 0 | ~145 | Low |
| PR5 — L5 actor-check | ~140 | ~180 | ~20 | 0 | ~160 | Low |
| PR6a — L6 brain-writes-reviewed evaluator | ~130 | ~170 | ~20 | 0 | ~150 | Low |
| PR6b — CODEOWNERS + managed-paths entry | ~5 | ~30 | 0 | ~15 | ~20 | Low |
| PR7 — L2 release + post-merge workflows | 0 | ~60 | ~50 | 0 | ~50 | Low |
| PR8 — ADR draft (brain-drafts, under `openspec/changes/**`) | 0 | 0 | 0 | ~120 (excluded — `openspec/changes/**` is in `governance.ignoreList`) | ~0 | Low |

**400-line budget risk**: no slice is forecast to exceed budget. PR4a is the tallest
(~260 budget-relevant lines) — if the actual Rule A/B/C implementation grows past
~350 during apply, split Rule B (monotonic status) into its own follow-up commit
inside the same PR4a branch before opening the PR, or into a PR4a-2 slice.

**Chained PRs recommended: Yes.**
**Decision needed before apply: Yes** — this note itself satisfies that gate; the
slice plan below is the answer. No further stop is needed unless actual line counts
during `sdd-apply` diverge materially from this forecast.

### Slice / PR plan (feature-branch-chain)

```
tracker: issue-144-governance-v3
  └─ PR1  L1 CI job + REQUIRED_JOBS/DETECTION_JOBS registry refactor
       └─ PR2a  substrate detector core (brain/scripts/vcs/substrate.mjs)
            └─ PR2b  brain-governance-status.mjs extension (rung + remedy report)
                 └─ PR3  L3 memory-gate + decision-gate jobs
                      └─ PR4a  L4 pure evaluator (evaluatePhaseOrder — Rules A/B/C)
                           └─ PR4b  L4 git wrapper + CLI + DETECTION_JOBS wiring + hardening run
                                └─ PR5  L5 actor-check.mjs
                                     └─ PR6a  L6 brain-writes-reviewed.mjs
                                          └─ PR6b  CODEOWNERS + managed-paths.mjs entry
                                               └─ PR7  L2 release.yml + governance-postmerge.yml
                                                    └─ PR8  ADR draft (brain-drafts/, human moves later)
```

Each PR is independently green (`npm test` + `repo:check` + `brain:nav` pass on that
branch alone). Every slice keeps the drift-guard test green — `GOVERNANCE_JOBS`
(the union) and `.github/workflows/governance.yml` job names are updated in the
**same commit** whenever a job is added.

---

## PR1 — L1 CI job + registry refactor (REQ-L1-1, REQ-L3-3, design §7)

- [x] [RED] `governance-checks.test.mjs`: assert `REQUIRED_JOBS` and `DETECTION_JOBS` are exported arrays, `GOVERNANCE_JOBS` equals their union, and `checkContexts()` derives contexts from `REQUIRED_JOBS` only — REQ-L3-3
- [x] [GREEN] `governance-checks.mjs`: split `GOVERNANCE_JOBS` into `REQUIRED_JOBS = ['issue-link', 'diff-size']` + `DETECTION_JOBS = []`; `GOVERNANCE_JOBS = [...REQUIRED_JOBS, ...DETECTION_JOBS]`; `checkContexts()` maps `REQUIRED_JOBS` only — design §7
- [x] [RED] `governance-checks.test.mjs`: add drift-guard sub-test — YAML job names (full set) still equal `GOVERNANCE_JOBS` after the refactor (regression guard for the split itself) — REQ-L3-3
- [x] [GREEN] confirm drift-guard passes unchanged post-refactor (no YAML change needed yet)
- [x] [RED] `governance-checks.test.mjs`: assert `local-checks` is present in both `REQUIRED_JOBS` and the parsed `governance.yml` job names — REQ-L1-1
- [x] [GREEN] `.github/workflows/governance.yml`: add `local-checks` job running `npm run repo:check`, `npm run brain:nav`, `npm test` on the existing `pull_request` trigger; add `'local-checks'` to `REQUIRED_JOBS` in the same commit — REQ-L1-1
- [ ] [Manual] REQ-L1-1 CI-behavior acceptance: this very PR is the self-governing verification — confirm `local-checks` trips on a deliberately broken commit and clears once fixed (deferred: requires this PR to actually be opened and observed in CI — see deviation note)

## PR2a — Substrate detector core (REQ-LADDER-1, REQ-LADDER-2, design §1)

- [x] [RED] `substrate.test.mjs`: `detectSubstrate()` with no probes/config returns `{ rung: 4, enforced: false, reason, remedy, rungs }` (floor fallback) — REQ-LADDER-1
- [x] [GREEN] scaffold `brain/scripts/vcs/substrate.mjs`: `detectSubstrate({ config, vcs, env, probes })` with rung-4 default
- [x] [RED] `substrate.test.mjs`: rung 3 armed when the post-merge-workflow probe (`.github/workflows/governance-postmerge.yml` presence, or `env.GITHUB_ACTIONS === 'true'`) returns true
- [x] [GREEN] implement rung-3 probe + selection
- [x] [RED] `substrate.test.mjs`: rung 2 armed when the release-gate probe (`.github/workflows/release.yml` presence, or `config.governance.releaseGate === true`) returns true
- [x] [GREEN] implement rung-2 probe + selection
- [x] [RED] `substrate.test.mjs`: rung 1 — `200` + required contexts present → armed; `404` → available-but-unset (not armed); `403`/tier-locked message → not armed; `config.vcs.selfHostedPreReceive === true` → armed via self-hosted floor
- [x] [GREEN] implement the finer branch-protection read (beyond `capabilities()`'s available/unavailable) — design §1 "why finer than capabilities()"
- [x] [RED] `substrate.test.mjs`: `rungs[1].gates.brainWritesReviewed` shape — GitHub needs branch protection `require_code_owner_reviews` **and** `.github/CODEOWNERS`; GitLab needs Premium+; Bitbucket → unavailable — per-provider L6 rung-1 sub-probe
- [x] [GREEN] implement `gates.brainWritesReviewed` per-provider sub-probe
- [x] [RED] `substrate.test.mjs`: any probe throwing degrades to the next-lower rung (never propagates) — probe-throws-never-crashes case
- [x] [GREEN] wrap every probe call in try/catch degrade-on-throw
- [x] [RED] `substrate.test.mjs`: highest-armed-rung selection across combinations (all armed → 1; only rung 3 → 3; none → 4)
- [x] [GREEN] finalize rung-selection algorithm + `rungs` per-rung `{available, active, reason, remedy}` output shape — REQ-LADDER-1, REQ-LADDER-2

## PR2b — `brain-governance-status.mjs` extension (REQ-HONESTY-1, REQ-HONESTY-2)

- [x] [RED] `brain-governance-status.test.mjs`: rung-4-only fixture prints a prominent `RUNG 4 — DETECTION ONLY, no enforcing guarantee` block, not buried in normal output — REQ-HONESTY-2
- [x] [GREEN] wire `detectSubstrate()` into `reportGovernanceStatus()`; add the prominent rung-4 warning block
- [x] [RED] `brain-governance-status.test.mjs`: rung-2 fixture reports active rung 2 and includes remedy text to reach rung 1 — REQ-HONESTY-1
- [x] [GREEN] print rung + remedy for rungs 2/3
- [x] [RED] `brain-governance-status.test.mjs`: rung-1 fixture reports active rung 1 with no remedy line
- [x] [GREEN] suppress remedy output when already at rung 1
- [x] [RED] `brain-governance-status.test.mjs`: L6 sub-status line — when `rungs[1].gates.brainWritesReviewed.active === false`, print "brain-writes-reviewed enforced at evidence rung; CODEOWNERS rung-1 enhancement unavailable: `<reason>`"
- [x] [GREEN] implement the L6 sub-status line — REQ-HONESTY-1

## PR3 — L3 `memory-gate` + `decision-gate` jobs (REQ-L3-1, REQ-L3-2, REQ-L3-3)

- [x] [RED] `run-check.test.mjs`: `memory-gate` subcommand computes chunk-observation input (reusing `readChunkObservations` from `lib/chunk-reader.mjs`), calls `memoryPresence`, exits 1 on `{pass:false}`, 0 on `{pass:true}` — REQ-L3-1
- [x] [GREEN] scaffold `brain/scripts/governance/run-check.mjs` with the `memory-gate` branch
- [x] [RED] `run-check.test.mjs`: `decision-gate` subcommand computes `git diff --name-only $BASE_SHA...$HEAD_SHA`, matches the architectural-surface pattern set (see Micro-decisions), calls `adrPresence`, exits 1 only when the diff matches the pattern set and no ADR file is present — REQ-L3-2
- [x] [GREEN] implement the `decision-gate` branch + architectural-surface pattern constant
- [x] [RED] `governance-checks.test.mjs`: assert `memory-gate` and `decision-gate` are present in both `REQUIRED_JOBS` and the parsed `governance.yml` job names — REQ-L3-3
- [x] [GREEN] add `memory-gate` and `decision-gate` jobs to `.github/workflows/governance.yml` (composed like `issue-link`); add both names to `REQUIRED_JOBS` in the same commit
- [x] [Manual] REQ-L3-1/REQ-L3-2 CI-behavior acceptance: confirm on this PR that a `.memory/`-touching commit passes `memory-gate` and an architectural-surface commit without an ADR fails `decision-gate` (deferred: requires this PR to actually be opened and observed in CI) — **DONE on PR #156**: `memory-gate` observed green in CI (pass path); `decision-gate` observed green in CI (this PR touches no ADR/HOME.md → correct pass). Fail path (architectural change without ADR → red) verified out-of-CI by fresh-review live non-mocked CLI + the 11 `run-check.test.mjs` unit tests, not as a red check on this PR.

## PR4a — L4 pure evaluator `evaluatePhaseOrder` (REQ-L4-1, REQ-L4-2, REQ-L4-3, REQ-L4-4, design §2)

- [x] [RED] `phase-order-check.test.mjs`: Rule C — `impl` non-empty and exactly one `touched` dir with `checkedTasks === 0` → `fail` finding "implementation code present but tasks.md has no checked item" — REQ-L4-4
- [x] [GREEN] implement Rule C fail branch in `evaluatePhaseOrder`
- [x] [RED] `phase-order-check.test.mjs`: Rule C — `impl` non-empty but no `touched` dir (unattributable) → `warn`, never `fail`
- [x] [GREEN] implement Rule C warn branch
- [x] [RED] `phase-order-check.test.mjs`: Rule C — `impl` non-empty and `touched` dir has ≥1 checked task → no violation
- [x] [GREEN] confirm Rule C pass branch
- [x] [RED] `phase-order-check.test.mjs`: Rule A — gated on Rule C; `touched` change missing `hasDesign` or lacking a spec artifact under **either** `spec.md` or `specs/*/spec.md` → `fail` "implementation without spec.md/design.md" — REQ-L4-2
- [x] [GREEN] implement Rule A, gated on Rule C seeing `impl` code, with dual spec-convention detection (Gap G1)
- [x] [RED] `phase-order-check.test.mjs`: Rule A — planning-only PR (`impl` empty) is never subjected to Rule A even with incomplete artifacts (protects this very change's own missing `spec.md` — design §10-A)
- [x] [GREEN] confirm the Rule-A/Rule-C gating explicitly (assert no false-positive on planning-only diffs)
- [x] [RED] `phase-order-check.test.mjs`: Rule B — `statusAfter` earlier than `statusBefore` on the ladder `draft < proposed < spec < designed < tasked < applying < verified < archived` → `fail` (backward phase jump) — REQ-L4-3
- [x] [GREEN] implement Rule B ladder comparison
- [x] [RED] `phase-order-check.test.mjs`: Rule B — unknown/custom status, unchanged status, or absent frontmatter → pass (no-op); forward-only progression → pass
- [x] [GREEN] implement Rule B no-op branches (dormant guard on today's `status: draft`-only convention)
- [x] [RED] `phase-order-check.test.mjs`: aggregation — `level` is `fail` if any rule fails, else `warn` if any rule warns, else `pass`; `findings` collects every rule's output
- [x] [GREEN] implement `{ level, findings }` aggregation — REQ-L4-1

## PR4b — L4 wrapper + CLI + `DETECTION_JOBS` wiring + hardening (REQ-L4-1, REQ-L4-5)

- [x] [RED] `phase-order-check.test.mjs`: wrapper happy path — `mkdtemp` + `git init` fixture repo with complete artifacts and a checked task; CLI exits 0 and prints the pass verdict
- [x] [GREEN] implement the git I/O wrapper (`git diff --name-only`, `readdirSync`/`existsSync` artifact flags, `- [x]` count, `git show BASE:path` for `statusBefore`) + CLI entrypoint in `brain/scripts/vcs/phase-order-check.mjs`
- [x] [RED] `phase-order-check.test.mjs`: wrapper fail path — fixture repo with `impl` change and zero checked tasks; CLI exits 1 with the expected verdict format
- [x] [GREEN] confirm wrapper fail-path output format matches the CI job's expectations — REQ-L4-1
- [x] [RED] `phase-order-check.test.mjs`: identical verdict with vs. without `SKILL.md`/`.claude/**` files present in the fixture tree — REQ-L4-1, REQ-NEUTRALITY-1
- [x] [GREEN] confirm no harness-path reads exist; add a source-scan regression test asserting `phase-order-check.mjs` contains no `.claude` or `SKILL.md` string literal — REQ-NEUTRALITY-2
- [x] [GREEN] wire the `phase-order` job into `governance.yml`; add `'phase-order'` to `DETECTION_JOBS` (not `REQUIRED_JOBS`) in `governance-checks.mjs`, same commit — drift-guard (full-set) stays green
- [x] [RED] `phase-order-check.test.mjs`: pre-v3 legacy dirs with no spec artifact at all (fixture modeled on `installer-versionado/`, `vcs-adapter/`, `cli-i18n/`) are reported as known/exempted, not `fail`, in detection mode
- [x] [GREEN] implement the baseline/grandfather allowlist consumed by the wrapper (see Micro-decisions) — REQ-L4-5
- [ ] [Manual] REQ-L4-5 operational acceptance: run `phase-order-check.mjs` over the full `openspec/changes/**` history (including `issue-138-session-start/`'s stale `status: draft` frontmatter — Gap G2); record the run log as the zero-false-positive acceptance artifact. Promotion (`DETECTION_JOBS` → `REQUIRED_JOBS`) is an explicit follow-up, not part of this PR — **precondition**: promoting `phase-order` first requires switching its wrapper's uncomputable-diff branch from `warn` to fail-closed (mirroring `run-check.mjs`'s `decision-gate`), else the required gate is fail-open on an uncomputable diff (see design §7)

## PR5 — L5 human-approval actor check (REQ-L5-1, REQ-L5-2)

- [x] [RED] `actor-check.test.mjs`: `evaluateActor` — actor `=== author`, not allow-listed, no admin override → `fail` (self-approval) — REQ-L5-1
- [x] [GREEN] scaffold `brain/scripts/vcs/actor-check.mjs` with the core comparison
- [x] [RED] `actor-check.test.mjs`: actor in `botAllowlist` → `pass`
- [x] [GREEN] implement `botAllowlist` branch — REQ-L5-2
- [x] [RED] `actor-check.test.mjs`: `adminOverride` (allow-listed `override:*` label) → `pass`, logged
- [x] [GREEN] implement `adminOverride` branch — REQ-L5-2
- [x] [RED] `actor-check.test.mjs`: no `labeled` event found for `status:approved` → `warn` + `pass` (never fail on missing evidence)
- [x] [GREEN] implement missing-event branch
- [x] [RED] `actor-check.test.mjs`: re-labeling — most recent `labeled` event's actor wins
- [x] [GREEN] implement "most recent event" selection
- [x] [RED] `actor-check.test.mjs`: `gh api` failure in the wrapper → `warn` + `pass`, never throws
- [x] [GREEN] implement the gh wrapper (issue-number resolution reused from `issue-link`) with try/catch degrade
- [x] [GREEN] wire the `actor-check` job into `governance.yml` (reuses `permissions: issues: read`); add `'actor-check'` to `DETECTION_JOBS` in `governance-checks.mjs`, same commit — REQ-L5-1

## PR6a — L6 `brain-writes-reviewed` evaluator (REQ-L6-1 evidence path, design §6.1)

- [x] [RED] `brain-writes-reviewed.test.mjs`: no `brain/core/**` or `brain/project/**` touched → `pass` (no Tier-2 requirement)
- [x] [GREEN] scaffold `brain/scripts/vcs/brain-writes-reviewed.mjs` with the `touchesBrain` guard
- [x] [RED] `brain-writes-reviewed.test.mjs`: at least one approver `≠ author`, not bot-allow-listed → `pass`
- [x] [GREEN] implement approvers dedup + comparison
- [x] [RED] `brain-writes-reviewed.test.mjs`: only self-approval (author is sole approver) → `fail` — enforces Tier-2 "no agent writes to `brain/`"
- [x] [GREEN] implement the fail branch
- [x] [RED] `brain-writes-reviewed.test.mjs`: `adminOverride` label → `pass`, logged (reuse actor-check's pattern)
- [x] [GREEN] implement `adminOverride` branch
- [x] [RED] `brain-writes-reviewed.test.mjs`: no reviews API / zero reviews yet → `warn` + `pass`, never crashes on a missing/unsupported reviews API
- [x] [GREEN] implement the warn branch
- [x] [GREEN] wire the `brain-writes-reviewed` job into `governance.yml` (fetches reviews via `gh api repos/{repo}/pulls/{n}/reviews`, normalized by the VCS adapter); add `'brain-writes-reviewed'` to `DETECTION_JOBS` in `governance-checks.mjs`, same commit — REQ-L6-1
- [x] [Follow-up — before sdd-verify/archive] **Spec traceability gap (fresh-review PR6a #5)**: REQ-L6-1 (spec.md:446-475) + scenarios describe ONLY the CODEOWNERS file-assertion (PR6b); the evidence-based `evaluateBrainWritesReviewed` check (design §6.1, the PRIMARY L6 mechanism) has NO spec requirement/scenario. Add **REQ-L6-2** (or amend REQ-L6-1) with scenarios for the evidence-based check before verify/archive — same pattern as PR5's design §5 amendment. Non-blocking for PR6a merge (code correct, tested, detection-only). → closed by REQ-L6-2

## PR6b — CODEOWNERS optional rung-1 enhancement (REQ-L6-1 file assertion, design §6.2)

- [x] [RED] file-assertion test: `.github/CODEOWNERS` exists and contains a rule matching `brain/core/**` and a rule matching `brain/project/**`, each assigned a human reviewer identity — REQ-L6-1
- [x] [GREEN] create `.github/CODEOWNERS` with the two rules (see Micro-decisions for the placeholder reviewer identity)
- [x] [RED] `managed-paths.test.mjs`-style assertion: `managed` in `brain/core/managed-paths.mjs` contains the exact literal `'.github/CODEOWNERS'` and no entry matches the broad glob `.github/**`
- [x] [GREEN] add `'.github/CODEOWNERS'` to `managed` in `brain/core/managed-paths.mjs` — REQ-L6-1
- [ ] [Manual] REQ-L6-1 CI-behavior acceptance: once branch protection + `require_code_owner_reviews` is armed, confirm a PR touching `brain/core/**` shows a required human-review requirement in the GitHub review panel

## PR7 — L2 release-gate (rung 2) + post-merge auto-revert (rung 3) (REQ-L2-1, REQ-L2-2)

- [x] [GREEN] create `.github/workflows/release.yml`: `on: push: tags: ['v*']`, `permissions: { contents: read }`, single job invoking `node brain/scripts/brain-audit.mjs origin/main..HEAD` — fails closed on non-zero exit, `brain-audit.mjs` unchanged — design §3
- [x] [RED] structural test asserting `release.yml` references `brain-audit.mjs` and triggers on `tags: ['v*']` (drift-guard-style YAML-content assertion)
- [x] [GREEN] confirm the test passes against the file created above — REQ-L2-1
- [x] [GREEN] create `.github/workflows/governance-postmerge.yml`: `on: push: branches:[main]` + daily cron, `permissions: { contents: write, pull-requests: write }`, runs `brain-audit.mjs` over `github.event.before..github.sha`; on failure, `git revert -m 1 --no-edit`, push `auto-revert/<sha7>`, `gh pr create` with `size:exception` label and a `Part of #144` body — design §3
- [x] [RED] structural test asserting `governance-postmerge.yml` references `brain-audit.mjs`, declares `contents: write` and `pull-requests: write`, and is a **separate file** from `governance.yml` (read-only PR gate isolation — design §10-B)
- [x] [GREEN] confirm the test passes against the file created above — REQ-L2-2
- [ ] [Manual] REQ-L2-1/REQ-L2-2 integration/E2E acceptance: dry-run `release.yml` against a fixture branch with a known audit violation (aborts) and a clean range (proceeds); dry-run `governance-postmerge.yml` against a fixture branch with a deliberate post-merge violation (opens the auto-revert PR); record as acceptance evidence

## PR8 — ADR draft (Tier-2 constraint) (documentation only)

- [x] [GREEN] draft the ADR at `openspec/changes/issue-144-governance-v3/brain-drafts/adr-0015-governance-v3-substrate-ladder.md` recording: the six levels (L1–L6), the four-rung substrate ladder, the `REQUIRED_JOBS`/`DETECTION_JOBS` detection→prevention flip, and the Epic Invariant non-goal (never claims judgment-level correctness)
- [ ] [Manual] note in the PR body: this draft is **not** written to `brain/project/decisions/` directly — Tier-2 managed path; a human copies/renames it into `brain/project/decisions/adr-00xx-*.md` after review, per the Tier-2 "no agent writes to `brain/`" constraint this very change enforces

---

## Micro-decisions

- **L1 job name**: `local-checks` (runs `repo:check` + `brain:nav` + `npm test` in one job, composed like `issue-link`/`diff-size`).
- **Registry refactor shape**: `REQUIRED_JOBS` + `DETECTION_JOBS`, `GOVERNANCE_JOBS` as their union — per design §7, resolves proposal wording gap G-E. `checkContexts()` (consumed by `brain:protect`) reads `REQUIRED_JOBS` only.
- **Architectural-surface pattern set (decision-gate, Gap G4)**: reuse the existing heuristic from `openspec/changes/governance/specs/governance/spec.md` (v1/v2 `decision-gate`) rather than inventing a new pattern set in this change — carry the same glob list forward verbatim; do not expand scope.
- **L4 baseline/grandfather list (REQ-L4-5, Gap G3)**: hardcode the initial exemption list (`installer-versionado/`, `vcs-adapter/`, `cli-i18n/`) as a small constant in `phase-order-check.mjs`, analogous to `brain-audit.mjs`'s `governance.auditBaseline` — not `brain.config.json`-driven yet; promote to config-driven only if a second consumer needs it.
- **L4 status-ladder signal (REQ-L4-3, Gap G2)**: source Rule B from frontmatter `status:` only (per design §2), accepting it as a dormant guard on today's `status: draft`-only convention. Do not attempt to reconstruct a status timeline from artifact presence/absence — that risk is explicitly deferred per Gap G2.
- **L5/L6 bot/admin allow-list storage (Gap G6)**: `config.governance.approvalActors` in `brain.config.json` (array of login strings); `adminOverride` recognized via an allow-listed `override:*` PR/issue label, not a separate config key.
- **CODEOWNERS reviewer identity (Gap G7)**: ship with a placeholder `@<human-reviewer-team>` per design §6.2; the operator (this repo: csrinaldi) fills in the real identity post-merge — not blocking for this change to ship.
- **Rung 2/3 auto-revert vs. release-block (Gap G5)**: implement **auto-revert PR** (not tag-block) for rung 3, per design §3's concrete YAML — the spec permits either; auto-revert was chosen because it self-heals `main` without waiting for the next release.
- **PR4a size risk**: if `evaluatePhaseOrder`'s three-rule implementation exceeds ~350 budget-relevant lines during apply, split Rule B (monotonic status) into its own commit/PR before opening PR4a, per the Review Workload Forecast note.
