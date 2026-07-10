# Tasks — GitLab Governance Pipeline (A2, #231)

> GitLab governance pipeline over the `ci-context` seam. Strict TDD (RED → GREEN) for every code task.
> Pure evaluators stay UNCHANGED (ADR-0016 boundary). Consume only `ci-context`; never hardcode a
> proxy; en + es i18n for every changed CLI string; docs English (ADR-0009).
> Acceptance = CP-A2a (fixture-tested, hard stop, PR-as-review, Part of #231). CP-A2b (live e2e) DEFERRED.

## Review Workload Forecast
| Field | Value |
|-------|-------|
| Estimated changed lines | ~230–360 (YAML fragment + two run-check cases + config migration + resolver + 3 read-site swaps + drift-guard) |
| Decision needed before apply | No |
| Chained PRs recommended | No |
| 400-line budget risk | Medium (config-migrations touch + YAML fragment are the drivers) |
| Delivery | Standalone PR-as-review into `feature/v2.0.0`, Part of #231 |

## Phase 1: `governance.approvedLabel` config + resolver (RED → GREEN)
> **TASK BOUNDARY — brain/core touch:** task 1.2 edits `brain/core/config-migrations.mjs`, engaging the
> L6 `brain-writes-reviewed` gate (human review of the merge, distinct from author). Expected PASS+warn
> — the fourth slice to touch this file. Do NOT be surprised by the gate; it is the established path.
- [ ] 1.1 Test (RED): `resolveApprovedLabel(config, 'github')` → `status:approved`;
      `resolveApprovedLabel(config, 'gitlab')` → scoped `status::approved`; a consumer-set value wins.
- [ ] 1.2 GREEN: add the additive `governance.approvedLabel` entry to `config-migrations.mjs` (default
      `status:approved`) at version **`0.7.0`** (RULED — version numbers are content-identifiers, NEVER
      reused; the `0.6.0` gap C4 left by removing the never-shipped dualWrite entry is honest record of a
      retirement, not a slot to refill). Create `approved-label.mjs` with `resolveApprovedLabel` + a CLI
      printer.
- [ ] 1.3 Test (RED): `actor-check.mjs` and `brain-start.mjs` pass with NO literal `'status:approved'`
      (they read the resolved value).
- [ ] 1.4 GREEN: replace the hardcoded reads at `actor-check.mjs:150` and `brain-start.mjs:67` with the
      resolver. i18n (en + es) for any changed CLI string.

## Phase 2: run-check `issue-link` + `diff-size` cases (THE GOTCHA) (RED → GREEN)
- [ ] 2.1 Test (RED): `run-check.mjs issue-link` with an injected `ctx` (`body` contains `Part of #N`,
      referenced issue carries the approved label) PASSES via `issueLink(ctx.body)` + approved-label
      verification, using FRESH `ctx.labels` — no `CI_MERGE_REQUEST_LABELS` read.
- [ ] 2.2 Test (RED — REQUIRED fail-closed): `run-check.mjs issue-link` with `ctx.body = null` exits
      non-zero (never exit 0).
- [ ] 2.3 Test (RED): `run-check.mjs diff-size` reads `size:exception` from `ctx.labels` (fresh) and
      skips; over-budget without the label fails.
- [ ] 2.4 GREEN: add `issue-link` + `diff-size` cases to `run-check.mjs`, feeding the EXISTING pure
      evaluators from `loadContext()`. Pure evaluators (`checks/issue-link.mjs`, `checks/diff-size.mjs`)
      UNCHANGED. Injectable fetch/git deps so tests never hit the network or real git.
- [ ] 2.5 i18n (en + es) for every added/changed CLI string.
- [ ] 2.6 Test (RED — **behavior parity**, per the CP-A2a ruling; name parity in Phase 4 is NOT enough):
      a fixture table asserts the Node `issue-link`/`diff-size` cases return the SAME verdict as the
      GitHub bash paths for identical inputs — body with/without a ref, referenced issue approved/not,
      diff over/under budget, `size:exception` present/absent. Same inputs → same verdicts.

## Phase 3: the shipped GitLab pipeline fragment + managed-paths (RED → GREEN)
- [ ] 3.1 Test (RED): `managed-paths.mjs` `managed[]` contains the literal
      `brain/scripts/ci/gitlab-governance.yml` and NO root `.gitlab-ci.yml` entry.
- [ ] 3.2 GREEN: add the literal to `managed[]` in `managed-paths.mjs`.
- [ ] 3.3 Create `brain/scripts/ci/gitlab-governance.yml`: eight jobs, each running
      `node brain/scripts/governance/run-check.mjs <job>` (or the existing Node entrypoint). REQUIRED
      jobs normal; DETECTION jobs carry `allow_failure: true` (Decision 3 — never flatten).

## Phase 4: drift-guard extension (RED → GREEN)
- [ ] 4.1 Test (RED): the drift-guard string-slices `gitlab-governance.yml` (NO `yaml` npm dep) and
      asserts its job-name set == `GOVERNANCE_JOBS`.
- [ ] 4.2 Test (RED): the drift-guard asserts `allow_failure: true` present iff the job ∈
      `DETECTION_JOBS` (REQUIRED job with `allow_failure` → red; DETECTION job without → red).
- [ ] 4.3 GREEN: extend `ci-context-drift-guard.test.mjs` with the two assertions using the existing
      string-slice technique.

## Phase 5: GitHub parity for the approved-label read + baseline
- [ ] 5.1 GREEN: `.github/workflows/governance.yml` `issue-link` bash sources the approved label from the
      `approved-label.mjs` CLI (replace the literal `status:approved` grep at :78). GitHub's
      `issue-link`/`diff-size` otherwise stay bash (only the label read moves to config).
- [ ] 5.2 `npm test` green · `brain:repo:check` · `brain:nav`.
- [ ] 5.3 `memory:share` run before push. No `decision` label unless a new promoted decision arises
      (the ADR draft stays a DRAFT — human promotes it; ADR-0013 flow).
- [ ] 5.4 STOP at CP-A2a (fixture-tested; live e2e is CP-A2b, deferred). Declare in the PR body that
      CP-A2a is fixture-only (SCIT endpoint obsolete; migrate-v1 code-vs-execution precedent) and CP-A2b
      is deferred pending restored GitLab access + a new endpoint.

## Open questions
- ~~Migration version number~~ **RESOLVED (human ruling): `0.7.0`.** Version numbers are
  content-identifiers, NEVER reused — a reused `0.6.0` would name two indistinguishable states (this repo
  ran under `0.6.0`-dualWrite during the cutover window; that archaeology needs the number to mean ONE
  thing). The `0.6.0` gap IS the honest, log-visible mark of a retirement. DOCTRINE: retire-by-deletion
  includes the version slot; the migration sequence is monotonic-forever.
- CP-A2b live-e2e endpoint: blocked on the human (restored GitLab access + a new endpoint); not decidable here.

## Out of scope
- A3 provider verbs (`mrCreate`/`prView` real impls) — sibling slice · managing the consumer root
  `.gitlab-ci.yml` (LOCAL) · converting GitHub `issue-link`/`diff-size` wholesale to Node · CP-A2b live
  e2e (deferred).
