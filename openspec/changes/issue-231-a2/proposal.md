# Proposal — GitLab Governance Pipeline (slice A2)

> **Status:** planned · **Issue:** #231 (awaiting `status:approved`)
> **Depends on:** #193/#196 A0+A1 (ci-context seam, merged into `feature/v2.0.0`). GitLab context
> support (`loadGitlabContext`) is ALREADY COMPLETE in A1.
> **Contract:** [spec.md](spec.md) · [design.md](design.md) · [tasks.md](tasks.md).
> **ADR draft:** [brain-drafts/adr-0018-gitlab-governance-pipeline.md](brain-drafts/adr-0018-gitlab-governance-pipeline.md).

## Context

ADR-0016 introduced `ci-context.mjs` as the single normalization seam between the CI environment and
every governance gate. A1 extracted the GitHub reader and BUILT the GitLab reader: `loadGitlabContext`
(`ci-context.mjs:120-153`) already reads `CI_MERGE_REQUEST_IID` / `CI_MERGE_REQUEST_DIFF_BASE_SHA` /
`CI_COMMIT_SHA` and fetches MR body + labels + author in one proxy-aware API call
(`defaultFetchMr:92-118`). What does NOT yet exist is the GitLab **pipeline** that invokes the eight
governance jobs. Today only GitHub has a workflow (`.github/workflows/governance.yml`), and two of its
eight jobs — `issue-link` (L28-81) and `diff-size` (L84-113) — are pure bash reading the
`github.event` payload; they never touch `ci-context`.

A2 ships the GitLab governance pipeline: a brain-owned, opt-in pipeline fragment plus the Node wiring
that lets ALL eight jobs run on GitLab through the one seam — with NO logic duplicated from the pure
evaluators.

## What this slice ships (CODE + fixtures + artifacts)

1. **B1 — the shipped pipeline fragment.** `brain/scripts/ci/gitlab-governance.yml` defines the eight
   governance jobs. Consumers opt in via `include: { local: '...' }` from their OWN root
   `.gitlab-ci.yml`; brain NEVER manages or clobbers the consumer root. The fragment is added to
   `managed-paths.mjs` as a literal (NOT root `.gitlab-ci.yml`).
2. **B2 — Node entrypoints for `issue-link` and `diff-size` (THE GOTCHA).** GitLab has no
   `CI_MERGE_REQUEST_DESCRIPTION` predefined var and its `CI_MERGE_REQUEST_LABELS` freeze at pipeline
   creation (forbidden — ADR-0016:45). The MR body + FRESH labels are available ONLY via
   `loadGitlabContext()`. So the two GitHub-bash jobs cannot be bash on GitLab. `run-check.mjs` gains
   `issue-link` and `diff-size` cases that feed the EXISTING pure evaluators
   (`checks/issue-link.mjs`, `checks/diff-size.mjs` — unit-tested but never CLI-wired) from
   `loadContext()`. All eight GitLab jobs route through Node. No logic duplication.
3. **B3 — `governance.approvedLabel` config (additive migration).** New additive `config-migrations.mjs`
   entry: `governance.approvedLabel` default `status:approved`, provider-resolved to the scoped
   `status::approved` on GitLab. Replaces the three hardcoded `status:approved` reads
   (`governance.yml:78`, `actor-check.mjs:150`, `brain-start.mjs:67`). **This edit touches
   `brain/core/config-migrations.mjs`, engaging the L6 `brain-writes-reviewed` gate** — a task boundary,
   flagged in tasks.md.
4. **B4 — exit-code → GitLab mapping.** REQUIRED jobs are normal jobs (fail-closed, block merge);
   DETECTION jobs carry `allow_failure: true` (Amendment 3 degrade-to-warn). Never flatten the two
   classes into one.
5. **B5 — drift-guard extension.** Extend `ci-context-drift-guard.test.mjs` to string-slice the new
   GitLab YAML (NO `yaml` npm dep — zero-deps policy) and assert its job-name set equals
   `GOVERNANCE_JOBS` and that `allow_failure: true` is present iff the job is a DETECTION job.

## PLAN-DEVIATION (recorded)

`PLAN-adapters-v3.md §2` (background only — "not a source of truth") couples A2 with A3 ("A2+A3"). That
coupling assumed the GitLab demo needs provider verbs (`mrCreate`/`prView`). It does NOT: the demo needs
only `ci-context` + the pipeline. `prView`/`mrCreate` remain A3 stubs (`gitlab.mjs:53`, `:195`) and are
out of scope here; the approved-ISSUE-label lookup uses the ALREADY-implemented `issueView`
(`gitlab.mjs:41`) or an equivalent proxy-aware fetch. **A2 ships ALONE; A3 is a sibling with its own
checkpoint.**

## CP-A2 is SPLIT (kickoff correction)

- **CP-A2a (acceptance for THIS slice):** code + fixtures + drift-guard, ENTIRELY fixture-tested — no
  live GitLab. The SCIT endpoint is obsolete/inaccessible; per the migrate-v1 code-vs-execution
  precedent, code correctness is proven against fixtures. Hard stop, PR-as-review.
- **CP-A2b (DEFERRED):** e2e proof (a real MR blocked by REQUIRED / passing when clean) is deferred
  until the human restores GitLab access and provides a new endpoint.

## Out of scope

- A3 provider verbs (`mrCreate`/`prView` real implementations) — sibling slice.
- Managing the consumer's root `.gitlab-ci.yml` (LOCAL, never touched — the `include:` line is the
  consumer's one-time adoption cost; see ADR draft).
- CP-A2b live e2e (deferred until access + endpoint restored).
- Converting GitHub's `issue-link`/`diff-size` jobs wholesale to Node (only the approved-label read
  moves to config; see design.md).

## Acceptance criteria (CP-A2a — hard stop, PR-as-review, Part of #231)

- [ ] B1: `brain/scripts/ci/gitlab-governance.yml` defines all eight jobs; added to `managed` in
      `managed-paths.mjs` as a literal; consumer opts in via `include: local:`.
- [ ] B2: `run-check.mjs` runs `issue-link` and `diff-size` via the pure evaluators fed by
      `loadContext()`; `size:exception` and the referenced-issue label read use FRESH `ctx.labels`, never
      the frozen `CI_MERGE_REQUEST_LABELS`.
- [ ] B3: `governance.approvedLabel` additive migration added; the three hardcoded reads replaced with
      the config lookup; provider-resolved (`status:approved` GitHub, `status::approved` GitLab).
- [ ] B4: REQUIRED jobs block; DETECTION jobs carry `allow_failure: true`. Classes never flattened.
- [ ] B5: drift-guard parses the GitLab YAML (string-slice, no `yaml` dep) and asserts job-set ==
      `GOVERNANCE_JOBS` + `allow_failure` iff DETECTION.
- [ ] Guardrails: consume only `ci-context` (pure evaluators UNCHANGED); never hardcode a proxy; every
      changed CLI string has en + es i18n; docs English (ADR-0009).
- [ ] `npm test`, `brain:repo:check`, `brain:nav` green. STOP at CP-A2a (fixture-tested; CP-A2b
      deferred).
