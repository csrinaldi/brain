# ADR-0018 — GitLab Governance Pipeline: `include:local` Opt-In + Uniform Node Entrypoints

**Status**: DRAFT (proposed alongside slice A2 / issue #231 — human promotes per ADR-0013)
**Date**: 07/10/2026 — draft, pending review

> This is a DRAFT ADR. It records the architectural decisions of slice A2 for human review. It is NOT
> promoted until a maintainer moves it to `brain/project/decisions/` and sets Status: Accepted. No
> `decision` label is claimed by the A2 PR on the strength of this draft alone.

## Context

ADR-0016 quarantined all provider-specific CI reading behind one seam, `ci-context.mjs`. Slice A1 built
the GitLab CONTEXT reader (`loadGitlabContext`): it maps `CI_MERGE_REQUEST_IID`,
`CI_MERGE_REQUEST_DIFF_BASE_SHA`, `CI_COMMIT_SHA` from env and fetches the MR description, fresh labels,
and author in **one** proxy-aware API call authenticated by `VCS_TOKEN`. It deliberately does NOT read
`CI_MERGE_REQUEST_LABELS`, which GitLab freezes at pipeline creation (ADR-0016).

What is still missing is the GitLab **pipeline** — the file that actually invokes the eight governance
jobs on a GitLab runner. Only GitHub has one (`.github/workflows/governance.yml`). Two of its eight jobs,
`issue-link` and `diff-size`, are pure bash reading the `github.event` payload, which on GitHub carries a
fresh body and fresh labels for free. On GitLab there is no equivalent payload: **no
`CI_MERGE_REQUEST_DESCRIPTION` predefined variable exists**, and the only label variable freezes at
pipeline creation. The MR body and fresh labels are reachable only through `loadGitlabContext()`. So the
GitLab pipeline is not a mechanical translation of the GitHub YAML — it forces a wiring decision.

Two further forces bear on this slice:
- Brain owns `.github/workflows/governance.yml` and ships it to consumers (managed-paths). GitLab has no
  per-workflow directory: a project has exactly ONE root pipeline file, `.gitlab-ci.yml`, which the
  consumer typically already owns and populates. Brain cannot own that file without clobbering the
  consumer's CI.
- `status:approved` is hardcoded in three places (`governance.yml`, `actor-check.mjs`,
  `brain-start.mjs`). GitLab scoped labels use a different separator (`status::approved`), so a
  provider-blind literal cannot serve both.

## Decision

### 1. Ship a fragment; the consumer opts in with `include: local:`. Brain never owns the root.

Brain ships `brain/scripts/ci/gitlab-governance.yml` and registers it as a LITERAL managed path. The
consumer's root `.gitlab-ci.yml` stays LOCAL — brain never creates, manages, or overwrites it. Adoption
is a single line the consumer adds to their own root file:

```yaml
include:
  - local: 'brain/scripts/ci/gitlab-governance.yml'
```

Rejected: shipping a root `.gitlab-ci.yml` (would clobber the consumer's single pipeline file, violating
ADR-0003 core-is-read-only); installer-merging the consumer's YAML (no zero-dep YAML writer; deep-merge
of arbitrary pipelines is fragile).

**Honest residual (F1 inherits this).** The `include:` line is a one-time, manual adoption cost, and
brain CANNOT verify the consumer added it — the shipped fragment is inert until included. A consumer who
upgrades brain but never edits their root pipeline gets NO GitLab governance and no error. This is the
deliberate price of never clobbering the consumer root; it is documented, not hidden, and belongs in the
F1 adoption checklist rather than being papered over with a root-file takeover.

### 2. Route ALL eight GitLab jobs through Node entrypoints (the scope-shaping decision).

Because the MR body and fresh labels live only behind `loadGitlabContext()`, `issue-link` and `diff-size`
cannot be bash on GitLab. `run-check.mjs` — already the Node runner for `memory-gate` and `decision-gate`
— gains `issue-link` and `diff-size` cases that call the ALREADY-EXISTING pure evaluators
(`checks/issue-link.mjs#issueLink`, `checks/diff-size.mjs#diffSize`, unit-tested but never CLI-wired) fed
by `loadContext()`. Every GitLab job therefore runs `node run-check.mjs <job>` (or its sibling Node
entrypoint). This reuses the pure evaluators, duplicates no decision logic, and is uniformly
fixture-testable. It also means **A2 is not "just a YAML"** — the load-bearing work is the Node wiring
that makes the seam usable end-to-end on GitLab. GitHub keeps its working bash for these two jobs; only
the approved-label read migrates to config.

Fresh labels are non-negotiable here: `size:exception` (diff-size) and the referenced-issue approved
label are read from `ctx.labels`, NEVER from the frozen `CI_MERGE_REQUEST_LABELS`.

### 3. Map the ADR-0015 class to GitLab exit semantics — never flatten.

Amendment 3 of ADR-0016 fixes exit policy by class: REQUIRED gates fail closed (uncomputable ⇒ non-zero);
DETECTION gates degrade to warn (uncomputable ⇒ warn + exit 0; a real finding ⇒ exit 1, visible). The
GitLab pipeline maps the CLASS: REQUIRED jobs are normal (a non-zero exit blocks the MR); DETECTION jobs
carry `allow_failure: true` (a real finding shows red but does not block). The two classes must never be
flattened — an `allow_failure` on a REQUIRED job silently un-gates it, the exact fail-open the ladder
exists to prevent. A drift-guard test asserts `allow_failure: true` is present iff the job is a DETECTION
job, and that the job set equals `GOVERNANCE_JOBS`.

### 4. `governance.approvedLabel` — additive config, provider-resolved.

Add an ADDITIVE `config-migrations.mjs` entry: `governance.approvedLabel`, default `status:approved`. A
resolver returns the provider-appropriate form — `status:approved` on GitHub, the scoped
`status::approved` on GitLab. The three hardcoded reads are replaced by this lookup; the GitHub
`issue-link` bash sources the label from a small node CLI rather than growing a bash config-parser. The
migration is additive-only (consistent with all prior entries; `mergeDefaults` cannot remove a key) and
idempotent. This edit touches `brain/core/config-migrations.mjs`, so the L6 `brain-writes-reviewed` gate
engages — expected PASS+warn, the established path for brain/core edits.

## Never do

- **Never ship or manage the consumer's root `.gitlab-ci.yml`.** Brain owns only the fragment; the root
  is the consumer's, opted in via `include: local:`.
- **Never make `issue-link`/`diff-size` bash on GitLab.** There is no fresh body/label source in GitLab
  env; both MUST run through Node fed by `ci-context`.
- **Never read `CI_MERGE_REQUEST_LABELS`.** It freezes at pipeline creation; fresh labels come from
  `loadGitlabContext()` (ADR-0016).
- **Never give a REQUIRED job `allow_failure: true`, and never omit it from a DETECTION job.** The class
  mapping is load-bearing; the drift-guard enforces it.
- **Never hard-code a proxy.** The MR fetch honors standard `HTTP(S)_PROXY` (ADR-0016).
- **Never change a pure evaluator to wire GitLab.** If an evaluator must change, the wiring is wrong —
  A2 is a gathering/pipeline slice, not an evaluator change.
- **Never hardcode `status:approved`.** It comes from `governance.approvedLabel`, provider-resolved.

## Consequences

- **Positive**: adding GitLab governance is a fragment + Node wiring, not an N×M edit; the seam and pure
  evaluators are unchanged, so the Epic Invariant (ADR-0015) holds structurally.
- **Positive**: `issue-link`/`diff-size` gain a tested Node path GitHub can later adopt, retiring bash
  duplication if desired.
- **Positive**: the REQUIRED/DETECTION split survives the provider boundary intact, enforced by the
  drift-guard.
- **Negative (honest residual)**: the `include: local:` line is a manual, unverifiable adoption step;
  an un-included fragment silently yields no GitLab governance (Decision 1).
- **Negative (honest residual)**: `issue-link`/`diff-size` on the REQUIRED path now depend on the MR API
  fetch succeeding (through the proxy) — a fetch failure fails those gates closed, correct but it means
  CI must reach the API for a GitLab MR to pass (inherited from ADR-0016's GitLab residual).
- **Scope**: CP-A2a (this slice) is fixture-tested only — the SCIT endpoint is obsolete/inaccessible, so
  correctness is proven against fixtures (migrate-v1 code-vs-execution precedent). CP-A2b (a real MR
  blocked/passing) is deferred until GitLab access + a new endpoint are restored.

## References

- `openspec/changes/issue-231-a2/proposal.md` — the A2 slice this ADR records.
- `openspec/changes/issue-231-a2/design.md` — decisions, file map, and the migration-version open question.
- `openspec/changes/issue-231-a2/spec.md` — REQ-A2-1..5.
- [ADR-0016](../../../brain/project/decisions/adr-0016-ci-context-normalization.md) — the ci-context
  seam, the GitLab reader, `CI_MERGE_REQUEST_LABELS` prohibition, and Amendment 3 (REQUIRED/DETECTION
  exit policy) this pipeline maps to GitLab.
- [ADR-0015](../../../brain/project/decisions/adr-0015-governance-v3-substrate-ladder.md) — the
  REQUIRED_JOBS / DETECTION_JOBS split and the Epic Invariant.
- [ADR-0013](../../../brain/project/decisions/adr-0013-auto-adr-onboarding.md) — the draft → human-review
  → promotion flow this draft follows.
- [ADR-0009](../../../brain/project/decisions/adr-0009-documentation-language-policy.md) —
  documentation-language policy (this ADR is English).
