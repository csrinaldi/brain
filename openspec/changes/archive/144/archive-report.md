---
status: archived
issue: 144
---

# Archive Report — Governance v3: harness-agnostic fail-closed loop enforcement (issue #144)

**Archived:** 2026-07-02
**Change:** `issue-144-governance-v3`
**Verdict:** PASS WITH WARNINGS — archived (0 CRITICAL issues)

---

## SDD Artifact Audit Trail

All planning, specification, design, implementation, and verification artifacts have been
created, reviewed, and are recorded here together with full observation IDs for
traceability.

| Artifact | Engram ID | Topic Key | Status |
|----------|-----------|-----------|--------|
| Proposal | #319 | `sdd/issue-144-governance-v3/proposal` | Complete |
| Specification | #320 | `sdd/issue-144-governance-v3/spec` | Complete (20 REQs + REQ-L6-2) |
| Design | #321 | `sdd/issue-144-governance-v3/design` | Complete (§0–§10) |
| Tasks | #322 | `sdd/issue-144-governance-v3/tasks` | 95/100 checked; 5 `[Manual]` deferred (see Open Follow-ups) |
| Apply Progress | #323 | `sdd/issue-144-governance-v3/apply-progress` | Complete — merged to main (PR #166) |
| Verify Report | #326 | `sdd/issue-144-governance-v3/verify-report` | PASS WITH WARNINGS |

---

## Change Summary

**What:** Six enforcement levels (L1–L6) making brain's load-bearing workflow discipline
fail-closed over **observable evidence** (git/CI/VCS-adapter state), never a harness's
prompts — plus a capability-aware **substrate degradation ladder** so every gate enforces
at the highest rung a project's platform allows and degrades gracefully (never crashes,
never lies about which guarantee is active).

### Levels delivered

| Level | What it does | Key artifacts |
|---|---|---|
| **L1** | CI runs `repo:check` + `brain:nav` + `npm test` on every PR (previously only in bypassable `pre-push` hook) | `local-checks` job in `governance.yml`; added to `REQUIRED_JOBS` |
| **L2** | `brain:audit` fail-closed at the release/tag path (rung 2) + scheduled/post-merge auto-revert (rung 3) | `.github/workflows/release.yml`, `.github/workflows/governance-postmerge.yml` |
| **L3** | `memory-gate` + `decision-gate` jobs wired from previously-untested pure check functions | `brain/scripts/governance/run-check.mjs`; jobs in `governance.yml` + `REQUIRED_JOBS` |
| **L4** | Harness-agnostic SDD phase-order gate — generic over `openspec/changes/**` file state + git blame (Rules A/B/C) | `brain/scripts/vcs/phase-order-check.mjs`; `DETECTION_JOBS` (detection-first) |
| **L5** | Human-approval actor check — compares the actor who applied `status:approved` against PR author AND issue author | `brain/scripts/vcs/actor-check.mjs`; `DETECTION_JOBS` |
| **L6** | Evidence-based brain-writes review check (primary) + CODEOWNERS as an optional rung-1 enhancement | `brain/scripts/vcs/brain-writes-reviewed.mjs`, `.github/CODEOWNERS`; `DETECTION_JOBS` |

### Substrate ladder (core architectural contribution)

A capability-aware detector (`brain/scripts/vcs/substrate.mjs`) generalizes
`brain-protect.mjs`'s `{enforced, reason, remedy}` pattern to all of governance, reporting
the highest **armed** rung:

| Rung | Guarantee | Mechanism |
|---|---|---|
| 1 — Prevention at merge | bad state never enters `main` | branch protection / self-hosted `pre-receive` |
| 2 — Prevention at release | bad state may enter `main` but is never released | release/tag path runs `brain:audit` fail-closed |
| 3 — Auto-correction | bad state does not persist | post-merge `brain:audit` CI opens an auto-revert PR |
| 4 — Floor: detection + loud signal | nothing hidden | `brain:audit` + `brain:governance-status` |

`brain:governance-status` was extended to print the active rung + remedy, with a
prominent, non-buried warning when the highest armed rung is 4 (detection-only). A
`REQUIRED_JOBS`/`DETECTION_JOBS` split in `governance-checks.mjs` lets a gate run and
report before it is required at merge — promotion is a one-line list move (with one
documented exception, see Open Follow-ups).

---

## Delivery: 11-Slice Chain + Epic Merge

Delivered via `feature-branch-chain` strategy per the tasks.md Review Workload Forecast
(single-PR was not viable — estimated diff well over the 400-line budget).

| Slice | PR | Scope |
|---|---|---|
| PR1 | #145 | L1 CI job + `REQUIRED_JOBS`/`DETECTION_JOBS` registry refactor |
| PR2a | #146 | Substrate detector core (`substrate.mjs`) |
| PR2b | #147 | `brain-governance-status.mjs` extension (rung + remedy report) |
| PR3 | #156 | L3 `memory-gate` + `decision-gate` jobs |
| PR4a | #157 | L4 pure evaluator (`evaluatePhaseOrder` — Rules A/B/C) |
| PR4b | #158 | L4 git wrapper + CLI + `DETECTION_JOBS` wiring + hardening |
| PR5 | #159 | L5 `actor-check.mjs` |
| PR6a | #160 | L6 `brain-writes-reviewed.mjs` evidence evaluator |
| PR6b | #161 | CODEOWNERS + `managed-paths.mjs` entry |
| PR7 | #162 | L2 `release.yml` + `governance-postmerge.yml` |
| PR8 | #163 | ADR-0015 draft (`brain-drafts/`, pending human promotion) |
| **Epic** | **#166** | Integration merge → `main`; closes issue **#144** |

**Landing note (recorded in apply-progress #323):** the chained `gh pr edit --base`
retarget-to-tracker step failed silently mid-chain (stderr redirected to `/dev/null`), so
each slice PR merged into its original parent branch rather than the tracker. No work was
lost — the PR8 tip branch (`feat/issue-144-s8-adr-draft`, commit `48bfefd`) held the
complete, clean linear stack, and epic PR #166 (tip → `main`) was opened in place of the
polluted tracker. All 11 slice PRs show `MERGED` with intact per-slice review history. One
merge conflict (`managed-paths.test.mjs`, both sides added tests) was resolved by keeping
both blocks. Final merge commit `11ac00f`; `main` synced to `a15db33`.

**Test suite:** 772/772 green post-merge (761 from this change + 11 pre-existing from
main's #137/#154), no regressions from the concurrent `brain:*` namespace rename (#137).

---

## Fresh-Review Fail-Open Fixes

Three fail-open gaps were caught and closed during the fresh-review cycle before this
change was considered complete (recorded in design.md and apply-progress):

1. **Rule C multi-dir bypass (L4, PR4a).** The evaluator originally gated Rule C on
   `touched.length === 1`; any diff touching 2+ `openspec/changes/**` dirs (e.g. a
   bystander checkbox bump in an unrelated dir) silently bypassed the rule entirely —
   worse than the zero-touched-dir case, which correctly warns. Fixed to evaluate
   **per-dir**, so every touched dir with `checkedTasks === 0` produces its own fail
   finding.
2. **Actor-check pagination + issue-author gap (L5, PR5).** `gh api` does not
   auto-paginate and the Events API is oldest-first, so an unpaginated fetch on an issue
   with >~30 events would silently drop newer `labeled` events (including a late
   self-applied `status:approved`) — a fail-open. Fixed with `--paginate`. Also closed a
   gap where the approving actor was compared only against the PR author, not the issue
   author — REQ-L5-1 requires both, since they can be different people.
3. **L2 empty-ranges on scheduled/tag triggers.** The release-gate's naive
   `origin/main..HEAD` range collapses to empty on a tag push (brain tags after merging to
   `main`, so `origin/main` is at/ahead of the tagged commit) and the post-merge job's
   `github.event.before` does not exist on `schedule` events, both of which would make the
   audit silently no-op. Fixed: release-gate audits from the previous release tag;
   post-merge branches on `event_name` and falls back to the latest tag on `schedule`.

Additionally, `decision-gate` (`run-check.mjs`) was confirmed fail-closed on an
uncomputable diff — verified explicitly during `sdd-verify`.

---

## Spec Addition During Implementation

**REQ-L6-2** was added mid-chain (fresh-review finding on PR6a, tracked as a follow-up
item in tasks.md, closed before verify/archive): the original spec (REQ-L6-1) only had
scenarios for the CODEOWNERS file-assertion (PR6b); the evidence-based
`evaluateBrainWritesReviewed` check (design §6.1 — the **primary** L6 enforcement
mechanism, since CODEOWNERS is platform-specific and rung-1-dependent) had no spec
requirement at all. REQ-L6-2 was added with 6 scenarios (non-brain-exempt,
self-approval-fail, bot-only-fail, human-pass, missing-evidence-warn, admin-override-pass)
and confirmed fully covered by `brain-writes-reviewed.test.mjs` at verify time.

---

## Verification Results (from `sdd/issue-144-governance-v3/verify-report` #326)

**Verdict: PASS WITH WARNINGS. 0 CRITICAL issues.**

Ran on branch `feat/issue-144-s8-adr-draft` (tip of the 11-PR chain, full implementation
in working tree): `npm test` 761/761 pass, `npm run repo:check` pass, `npm run brain:nav`
pass. All 20+1 requirements (L1–L6, LADDER, HONESTY, NEUTRALITY) map to an implementing
artifact AND a passing test. Detection-only jobs (`phase-order`, `actor-check`,
`brain-writes-reviewed`) confirmed correctly excluded from `checkContexts()` by an
explicit test. Drift-guard (REQ-L3-3) green.

### WARNINGS (non-blocking, carried forward as follow-ups below)
1. REQ-NEUTRALITY-1/2 automated regression coverage is inconsistent — only
   `phase-order-check.test.mjs` has an explicit source-scan test asserting no
   `.claude`/`SKILL.md` string literal. `actor-check.mjs`, `brain-writes-reviewed.mjs`,
   `substrate.mjs`, and `run-check.mjs` pass manual review (confirmed clean) but have no
   automated guard against a future accidental harness-coupling regression.
2. `governance-postmerge.yml` (rung 3 auto-revert) has no idempotency guard — a cron
   backstop re-run before a prior auto-revert PR merges would hit an existing
   branch/PR and fail loudly. Not a spec violation, but an undocumented operational rough
   edge.
3. The 5 remaining unchecked `[Manual]` tasks in tasks.md are live-GitHub-interaction
   acceptance items (PR open/observe, branch-protection arming, dry-run against fixture
   branches), correctly tagged "Integration / manual E2E", not satisfiable by local
   read-only verification.

### SUGGESTIONS (non-blocking)
1. `extractIssueNumber` in `actor-check.mjs` duplicates `governance.yml`'s bash regex
   logic (documented as "mirrors" but not flagged as a maintenance-drift risk in design's
   Gaps table); no cross-validation test exists.
2. `CODEOWNERS` ships with placeholder `@<human-reviewer-team>` (Gap G7, intentional and
   documented) — operator follow-up, not a defect.

---

## Task Completion Gate — Documented Exception

**95/100 tasks checked.** The 5 remaining unchecked items are all `[Manual]` acceptance
tasks that require live GitHub interaction on already-merged PRs (CI-behavior
acceptance, branch-protection-armed review-panel confirmation, release/post-merge
workflow dry-runs against fixture branches). They are correctly categorized in tasks.md
as "Integration / manual E2E" — a testable type that cannot be satisfied by local
read-only `sdd-verify`/`sdd-archive` execution, and `verify-report` (#326, WARNING 3)
independently confirms this categorization and explicitly marks them non-blocking.

This is an **intentional partial archive**, explicitly authorized by the orchestrator
for this archive pass (change is merged to `main` via epic PR #166, issue #144 is
closed, and 0 CRITICAL issues exist). Per the Strict-vs-OpenSpec Archive Policy, this
exception is recorded here rather than silently overridden. The 5 items remain visible
as open follow-ups below for whoever eventually performs the live-GitHub acceptance
pass; they do not represent incomplete code, tests, or design — only outstanding manual
observation steps.

---

## Specs Sync

**Main specs:** `openspec/specs/` is empty (only `.gitkeep`) — this repo does not use a
promoted main-specs directory (confirmed against the `issue-138-session-start` precedent).
This change introduced new capabilities (L1–L6 governance gates + substrate ladder), not
an enhancement to an existing tracked spec.

**Delta spec** (`openspec/changes/issue-144-governance-v3/specs/governance-v3/spec.md`):
contains the full specification (20 requirements + REQ-L6-2). No sync/merge step
performed — following this repo's convention for brand-new capabilities (same as
issue-138), it remains in the change folder as the canonical audit trail and source of
truth for the governance-v3 capability going forward.

---

## Archive Filesystem

**Convention followed:** this repo archives completed changes **in place** within
`openspec/changes/`, matching the `issue-138-session-start` precedent — changes are
**not** moved to a separate `archive/` subdirectory (no such directory exists in this
repo), and there is no promoted main-specs directory to merge into. Status is tracked via
YAML frontmatter (`status: archived`).

**Updated frontmatter:**
- `openspec/changes/issue-144-governance-v3/proposal.md`: `status: draft` → `status: archived`
- `openspec/changes/issue-144-governance-v3/design.md`: `status: draft` → `status: archived`
- `openspec/changes/issue-144-governance-v3/tasks.md`: `status: draft` → `status: archived`
- `specs/governance-v3/spec.md` has no frontmatter (unaffected, matches spec convention)
- Archive report: `openspec/changes/issue-144-governance-v3/archive-report.md` (this file, new)

**Not done (intentionally, no repo convention calls for it):**
- No move to `openspec/changes/archive/YYYY-MM-DD-{change-name}/` — no such directory
  exists in this repo.
- No merge into `openspec/specs/{domain}/spec.md` — the main-specs directory is empty by
  convention; new-capability delta specs stay in the change folder (see Specs Sync).
- No edits to code, tests, or workflow files — archive is docs/bookkeeping only, as
  instructed.

---

## Open Follow-ups (tracked, not archive blockers)

1. **Issue #164** — automated neutrality source-scan tests for `actor-check.mjs`,
   `brain-writes-reviewed.mjs`, `substrate.mjs`, `run-check.mjs` (only
   `phase-order-check.mjs` has one today).
2. **Issue #165** — `governance-postmerge.yml` post-merge auto-revert idempotency (no
   guard against a cron re-run racing a not-yet-merged prior auto-revert PR).
3. **Deferred `[Manual]` tasks (5 items across PR1, PR3, PR4b, PR6b, PR7)** — live-GitHub
   acceptance observations (CI-behavior confirmation, branch-protection-armed
   review-panel check, release/post-merge workflow dry-runs). PR3's manual item was
   partially satisfied live (memory-gate/decision-gate pass path observed green in CI on
   PR #156); the rest remain open.
4. **`phase-order` promotion precondition (design §7, PR4b Manual note).** Promoting
   `phase-order` from `DETECTION_JOBS` to `REQUIRED_JOBS` is **not** a code-free flip like
   the other detection gates: its wrapper deliberately degrades an uncomputable diff
   (missing `BASE_SHA`/`HEAD_SHA`, git failure) to `warn`/exit 0 while detection-only.
   Promoting it verbatim would make a required gate silently fail-open. The wrapper's
   uncomputable-diff branch must first be switched to fail-closed (mirroring
   `run-check.mjs`'s `decision-gate`) before promotion.

None of these block this archive: 0 CRITICAL issues, epic PR #166 is merged to `main`,
and issue #144 is closed.

---

## SDD Cycle Complete

The change has been:
1. Proposed (proposal.md)
2. Specified (spec.md — 20 requirements + REQ-L6-2 added mid-chain)
3. Designed (design.md §0–§10)
4. Tasked (tasks.md — 100 items across 11 chained-PR slices)
5. Implemented (11 slice PRs + epic PR #166, merged to `main`, issue #144 closed)
6. Verified (PASS WITH WARNINGS; 0 CRITICAL; #326)
7. Archived (this report; frontmatter updated to `status: archived`; 5 `[Manual]`
   acceptance items and 2 tracked issues carried forward as open follow-ups, not
   blockers)

**Ready for the next change.**

---

**Archived by:** sdd-archive executor
**Repository:** brain
**Artifact store:** hybrid (file + engram)
