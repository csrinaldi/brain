# Checkpoint Report — CP-A2a

> **Change:** `issue-231-a2` · **Slice:** A2 (GitLab governance pipeline) · **Branch (final tranche):** `feat/issue-231-a2-pr3` (base `feature/v2.0.0`)
> **Issue:** #231 (`status:approved`). **Depends on:** A1 (ci-context.mjs, in tree).
> **Status: STOPPED at CP-A2a, PRE-MERGE.** Delivered as a 3-PR sequential chain (budget split). **The verdict is issued HERE, on the accumulated tree** (PR-1 + PR-2 already merged; this is PR-3).
> **CP-A2a = fixture-only** (SCIT GitLab endpoint obsolete). **CP-A2b (live e2e) is DEFERRED** to restored access + a new endpoint.

## 0. Scope
Bring the GitHub governance pipeline to GitLab over the `ci-context` seam. Mirror `GOVERNANCE_JOBS` 1:1; the pure evaluators change only where a ruled correctness fix required it (M1). One slice, one design, one checkpoint — delivered in 3 tranches by the 400 budget.

## 1. The chain (all Part of #231, sequential, no new issues)
| PR | Tranche | Counted | Status |
|----|---------|---------|--------|
| #232 | planning + Phase 1 — `approvedLabel` config + resolver | 171 | merged |
| #233 | Phase 2 + addendum — run-check gotcha + base-branch | 303 | merged |
| **#234 (this)** | Phases 3–5 + CP-A2a review fix | ~2xx | **PR-as-review** |

## 2. What was built
- **Phase 1** (`660b950`): `resolveApprovedLabel(config, provider)` (`:`↔`::` per provider, override wins, null-safe) + additive config migration at **`0.7.0`** (NOT the C4-freed `0.6.0` — monotonic-forever doctrine) + 3 hardcoded-label reads replaced.
- **Phase 2** (`dc78d27`): `run-check.mjs` gains `issue-link` + `diff-size` cases fed by `loadContext()` (THE GOTCHA — GitLab has no MR-description var, frozen labels). Pure evaluators fed, not rewritten.
- **Phase 2 addendum** (`46fdea1`): `ctx.defaultBranch` seam field + `requiresClosingKeyword(ctx)` wrapper conditional; **fail-closed on null, never assumes `'main'`**; parity row `Part of #N + base==default → FAIL`.
- **Phases 3–5** (`f332c41`): `brain/scripts/ci/gitlab-governance.yml` (8 jobs, REQUIRED normal / DETECTION `allow_failure: true`, `merge_request_event`-scoped, VCS_TOKEN/proxy as CI vars), added to `managed-paths.mjs` (literal); drift-guard extended over BOTH YAMLs (job-set parity + `allow_failure`-iff-DETECTION, mutation-verified); GitHub bash sources the approved label from the resolver CLI.
- **CP-A2a review fix** (`2ef6bdd`): M1+m2+m4 (below).

## 3. The parity story — verified whole (the cohesion argument's real value)
Routing GitLab's `issue-link`/`diff-size` through Node `run-check.mjs` reproduces GitHub bash's verdicts. The behavior-parity table (`run-check.test.mjs`) encodes GitHub bash's truth table and proves the Node path matches row-for-row across: reference presence, approved/not, over/under budget, `size:exception`, base-branch conditionality, AND — added at CP-A2a — the closing-keyword **vocabulary** dimension (all 9 forms).

**Documented divergences (explicit, not faked parity):**
- **base≠main GitHub-bash-hardcode:** the GitHub bash still compares `BASE_BRANCH == 'main'` literally; the Node path uses the real `ctx.defaultBranch`. A GitHub consumer with default≠main inherits old bash behavior — pre-existing, out of scope, follow-up recorded.
- **m3 — actor-check `gh`-hardcoded on GitLab:** the DETECTION actor-check fetches labeled events via `gh`, which can't talk to GitLab → degrades to `warn` (safe, never false-pass). The A2/A3 boundary the decoupling drew — belongs to A3 (provider verbs) + CP-A2b.

## 4. Fresh adversarial review (opus, clean context, over the full a38d5df..HEAD tree)
No BLOCKER. Verified clean: fail-closed-on-null (non-tautological), `defaultBranch` sourced only inside the seam, drift-guard `allow_failure`-iff-DETECTION has teeth, resolver, migration 0.7.0 chain-coherent, no real-git-coupled A2 test. Findings, all resolved:
- **M1 (MAJOR, FIXED):** closing-keyword vocabulary divergence — `issueLink()` accepted only `closes|fixes|resolves` while GitHub bash + actor-check accept all 9 forms, so `Fixed #42` diverged (fail-closed direction). **Ruled: widen + unify** — one shared `CLOSING_RE`/`CHAIN_RE` in `checks/issue-ref-patterns.mjs`, imported by all three sites (issue-link, run-check, actor-check); zero duplicate regexes. The pure-evaluator touch is a ruled correctness fix (REQ-CIC-4 protects against refactor-drift, not against ruled fixes — the evaluator accepted FEWER forms than platforms honor). Precedent recorded in design.md.
- **m2 (MINOR, FIXED):** issue-number extraction precedence aligned to bash (slice → Part-of first; default → closing).
- **m4 (MINOR, FIXED):** drift-guard `PIPELINE_ENV_PATTERN` extended with `DEFAULT_BRANCH`/`CI_DEFAULT_BRANCH` (the #204 wiring-lesson: the guard covers its own new vars).

## 5. Budget & baseline
Each tranche < 400 counted. `npm test` → **1132 pass, 0 fail**. `repo:check` + `brain:nav` clean. `brain/core/` touched only by the ruled Phase 1 migration + Phase 3 managed-paths literal (both PASS+warn under L6, established path).

## 6. Doctrines pinned this slice
- **Migration versions are content-identifiers — monotonic-forever;** retire-by-deletion includes the version slot (the `0.6.0` gap is honest record).
- **Never a second parser** — one shared closing/chain regex constant, three importers (the hasher/§4-grammar precedent), applied to M1.
- **Chained PRs** — sequential tranches against the feature branch (no tracker branch); split by budget; one slice/design/checkpoint (re-captured as a pattern record).

## 7. Next
On CP-A2a APPROVE + merge of this final tranche: A2 is done (fixture-tested). Follow-ups, own slices: **CP-A2b** (live e2e — needs restored GitLab access + a new endpoint); **A3** (GitLab provider verbs — closes m3's actor-check gap); the GitHub-bash-default-branch unification; plus the standing Track-C leftovers.

---
**Awaiting the external CP-A2a verdict** on the accumulated tree. PR-as-review, `Part of #231`. The merge keystroke is the human's, only with APPROVE.
