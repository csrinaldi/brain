## Verification Report

**Change**: issue-358-q5-doctrine-tiers (Q5, governance doctrine tiers) — Phases 1-3 only
**Version**: spec.md as read on disk (no version header)
**Mode**: Standard (no Strict TDD marker found for this change; ran `node --test`)

### Completeness
| Metric | Value |
|--------|-------|
| Phase 1 tasks | 4/4 complete |
| Phase 2 tasks | 4/4 complete |
| Phase 3 tasks | 6/6 complete |
| Phase 4/5/6 tasks | correctly left unchecked (out of scope, blocked on #328) |

### Build & Tests Execution
**Build**: N/A (no build step; pure Node ESM)

**Tests**: `node --test "brain/scripts/**/*.test.mjs"` → 2211 passed / 3 failed / 0 skipped (2214 total)
```text
npm test
...
# tests 2214
# pass 2211
# fail 3
```
The 3 failures are **pre-existing and unrelated** to this change:
- `brain/scripts/harness/backends/antigravity.drift.test.mjs` — AGENTS.md compilation drift, unrelated to governance tiers, `workflow-governance.md` untouched by this diff.
- `brain/scripts/memory/cli.backfill-issue.test.mjs` (×2) — belongs to a different, untracked in-progress change (`backfill-issue`/`issue-extraction`), not part of Q5.

Isolated re-run of every Q5-touched test file: **287/287 passed, 0 failed**
(`governance-tiers.test.mjs`, `governance-checks.test.mjs`, `run-check.test.mjs`,
`diff-size.test.mjs`, `phase-order-check.test.mjs`, `actor-check.test.mjs`,
`brain-writes-reviewed.test.mjs`, `brain-protect.test.mjs`,
`brain-governance-status.test.mjs`, `brain-config.test.mjs`).

**Coverage**: not measured (no coverage tool configured in this repo) — Not available

### Spec Compliance Matrix
| Requirement | Scenario | Test | Result |
|---|---|---|---|
| REQ-TIER-1 | Monotonicity + unknown-tier fail-closed | `governance-tiers.test.mjs` | ✅ COMPLIANT |
| REQ-TIER-2 | Never-tiered core required at every tier | `governance-tiers.test.mjs` | ✅ COMPLIANT |
| REQ-TIER-3 | No policy outside {required, detection} | `governance-tiers.test.mjs` | ✅ COMPLIANT |
| REQ-TIER-4 | Tier declared / rung detected, no substitution | `brain-governance-status.test.mjs` | ✅ COMPLIANT |
| REQ-TIER-5 | Satisfiability (lite evidence forms) | design-only for phases 1-3 (Phase 4 blocked) | ➖ N/A this batch |
| REQ-TIER-6 | Waivers tiered (`size:exception`, `override:*`) | `run-check.test.mjs` (diff-size), `actor-check.test.mjs`, `brain-writes-reviewed.test.mjs` | ⚠️ PARTIAL — see CRITICAL-1 below (honored unconditionally in `merge-walk.mjs`'s audit path) |
| REQ-TIER-7 | Position-tiered ∩ never-tiered = ∅ | `governance-tiers.test.mjs` | ✅ COMPLIANT |
| REQ-TIER-8 | Matrix totality / drift-guard | `governance-tiers.test.mjs` | ✅ COMPLIANT |
| REQ-TIER-9 | One source for policy + budget | `governance-checks.test.mjs`, `run-check.test.mjs` for the CI/hook path | ❌ **UNTESTED / actually FALSE repo-wide** — see CRITICAL-1 |
| REQ-TIER-10 | Default `standard`, no-op migration | `brain-config.test.mjs`, `governance-tiers.test.mjs` | ✅ COMPLIANT |
| REQ-TIER-11 | Tier × rung cross-product report | `brain-governance-status.test.mjs` | ✅ COMPLIANT |
| REQ-L4-2′ | Tier-scoped artefact set | `phase-order-check.test.mjs` | ✅ COMPLIANT |
| REQ-L5-1′ / REQ-L6-1′ | Evidence tiering | N/A — Phase 4, correctly not started (blocked on #328) | ➖ Deferred, confirmed untouched |

**Compliance summary**: 10/12 in-scope scenarios compliant, 1 partial/false, 1 correctly deferred.

### Correctness (Static Evidence)
| Requirement | Status | Notes |
|---|---|---|
| Phase 1 tier module | ✅ Implemented | `governance-tiers.mjs` exports all required symbols, pure, no I/O at import |
| Phase 2 consumer surfaces | ✅ Implemented | `checkContexts`/`requiredJobs` single-sourced; `mapDetectionToWarning` exported+tested, deliberately unwired (documented) |
| Phase 3 tiered parameters (CI path) | ✅ Implemented | `governance.yml`/`pre-push` correctly route through `run-check.mjs`/`governance-tiers.mjs` CLI printer, zero literal `400` remaining in those two files |
| Phase 3 tiered parameters (audit path) | ❌ Not implemented | `brain/scripts/lib/merge-walk.mjs` (consumed by `brain-audit.mjs`, wired into `release.yml` rung-2 gate and `governance-postmerge.yml` rung-3 auto-revert) calls `diffSize(numstat, ignoreList)` with **no budget argument**, silently using the module-level `DEFAULT_BUDGET = 400` — and honors `size:exception` (`ln()`/`shouldSkipSize`) **unconditionally**, with no tier awareness at all |
| Override tier-scoping | ✅ Implemented | `actor-check.mjs`/`brain-writes-reviewed.mjs` correctly gate `override:*` on `tierParams(tier).honorOverride`, tested at `regulated` |
| `PENDING_PROMOTION` staging | ✅ Matches deviation #1 | `requiredJobs()` filters `actor-check`/`brain-writes-reviewed`/`phase-order`; `requiredJobs('standard')` still equals pre-tier `REQUIRED_JOBS` exactly (tested) |
| `mapDetectionToWarning` unwired | ✅ Matches deviation #2 | Exported, tested, explicitly deferred to T2.1 per design §6 |
| `decision-gate` evidence tags | ✅ Matches deviation #3 | Matrix carries the target evidence tags; `adr-presence.mjs` untouched (git-confirmed) |

### Coherence (Design)
| Decision | Followed? | Notes |
|---|---|---|
| §2 gate matrix (verbatim) | ✅ Yes | `GATE_MATRIX` in `governance-tiers.mjs` matches design §2.A/§2.B row-for-row |
| §8 implementation seam (one module, no I/O at import, CLI printer) | ✅ Yes | Confirmed by reading the file; CLI guard is the only I/O path |
| §9 residual risk: "diff-size.mjs default / workflow bash / pre-push hook" literals must be reduced to one source | ⚠️ Partially followed | The two CI-facing literals were removed; `diff-size.mjs`'s own default parameter was kept and is silently consumed, untiered, by two other call sites (`merge-walk.mjs`, `brain-check.mjs`) that were never touched — see CRITICAL-1 |
| §7 M3 reviewer impact ("tier-independent... unaffected in either direction") | ⚠️ Noted, not actioned | `brain/scripts/review/evaluators/tranche.mjs` (`LINE_BUDGET = 400`) and `checkpoint.mjs` (`/\d+\s*\/\s*400\b/`) are additional untiered 400 literals in M3 reviewer code — design's own framing arguably excuses these, but they are undocumented as a deviation and match REQ-TIER-9's literal scenario text exactly (see WARNING-1) |

### Issues Found

**CRITICAL**:
1. **REQ-TIER-9 is not actually satisfied repo-wide, and its own spec scenario is untested.** The scenario "budget has exactly one definition ... WHEN it is searched for a diff-budget literal outside the tier module THEN none is found" has no covering test anywhere in the suite, and manual verification shows it is currently **false**: `brain/scripts/governance/checks/diff-size.mjs` still defines `const DEFAULT_BUDGET = 400` and a default parameter, silently consumed (with no tier resolution at all) by `brain/scripts/lib/merge-walk.mjs:308` and `brain/scripts/brain-check.mjs:85`. `merge-walk.mjs` is not a side path — it is `brain-audit.mjs`'s core evaluator, wired into `release.yml`'s pre-tag rung-2 gate and `governance-postmerge.yml`'s rung-3 auto-revert. A `lite`-tier repo (declared budget 1000, e.g. brain itself) merging 401–1000 changed lines would be flagged as a `diffSize` failure by this path and could trigger a post-merge revert or block a release — directly contradicting its own declared tier. The same path also honors `size:exception` (`ln()`) **unconditionally**, so a `regulated`-tier repo's post-merge audit would still honor a waiver REQ-TIER-6 says it must refuse. Neither `merge-walk.mjs` nor `brain-check.mjs` were touched by this change (confirmed via `git status --porcelain`), and this gap is not among the three documented deviations.
   - **Remediation**: either (a) thread `tierParams(resolveTier(config))` into `merge-walk.mjs`'s and `brain-check.mjs`'s `diffSize(...)` calls and `ln()`/`shouldSkipSize()` calls, or (b) if this is deliberately deferred to a later phase (e.g. paired with rung-3 wiring in Phase 5), add it to `design.md §9`/`tasks.md` as an explicit, ratified deviation the way the other three are documented, and narrow REQ-TIER-9's scenario text to scope it to the CI/hook consumer surfaces only.

2. **Zero commits exist for Phases 1-3.** `git status --porcelain` shows every file listed in the task checklist (`governance-tiers.mjs`, `governance-checks.mjs`, `run-check.mjs`, `phase-order-check.mjs`, `actor-check.mjs`, `brain-writes-reviewed.mjs`, `brain-protect.mjs`, `brain-governance-status.mjs`, `config-migrations.mjs`, `.github/workflows/governance.yml`, `brain/scripts/hooks/pre-push`, plus test files) as **modified or untracked in the working tree** — none of it is committed on the current branch (`docs/issue-391-t23-review-package-spec`, which is itself an unrelated change). The tasks.md "Commits follow work-unit structure" cross-phase check cannot be satisfied: there is no work-unit commit history at all for this implementation, which blocks safe hand-off to `sdd-archive`/PR creation.
   - **Remediation**: commit Phases 1-3 as reviewable work-unit(s) (per the cached delivery/chain strategy) before archiving.

**WARNING**:
1. Two additional untiered `400`-line-budget literals exist outside the tier module, in M3 reviewer evaluator code that predates and is untouched by this change: `brain/scripts/review/evaluators/tranche.mjs:33` (`const LINE_BUDGET = 400`) and `brain/scripts/review/evaluators/checkpoint.mjs:24` (`BUDGET_CLAIM_RE = /(\d+)\s*\/\s*400\b/`). Design §7 frames M3 reviewer-gate work as "tier-independent... unaffected by this decision in either direction," which may justify leaving these alone, but that framing is not recorded as a deviation anywhere in `tasks.md`/`design.md §9`, and REQ-TIER-9's literal scenario text does not carve out an M3 exception. Recommend either an explicit deviation note or a follow-up task.
2. `brain-protect.mjs`'s one-line wiring `checkContexts(resolveTier(config))` (Phase 2) has no dedicated test exercising a non-`standard` tier through `main()`/the arm path — both halves (`resolveTier`, `checkContexts`) are well-tested in isolation, but the composition itself is untested. Low risk given the one-line nature, but not required by `tasks.md` either, so this is a nice-to-have rather than a task-completeness gap.

**SUGGESTION**: None beyond the above.

### Verdict
**FAIL** — two CRITICAL findings: REQ-TIER-9 is not fully satisfied for the rung-2/rung-3 audit enforcement path (a genuine, untested spec gap, not one of the three pre-documented deviations), and no commits exist yet for the Phase 1-3 implementation. All in-scope Phase 1-3 code that WAS reviewed is correct, well-tested (287/287 passing on the touched surfaces), and faithfully implements the ratified matrix; the three explicitly pre-documented deviations (PENDING_PROMOTION staging, `mapDetectionToWarning` not yet wired, `decision-gate` evidence-tag divergence) are all confirmed intentional and correctly scoped.
