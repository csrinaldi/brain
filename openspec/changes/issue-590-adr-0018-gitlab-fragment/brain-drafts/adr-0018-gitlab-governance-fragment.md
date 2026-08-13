# ADR-0018 — The GitLab governance surface is an opt-in fragment, not a pipeline

> **Tier 2 draft.** Written by an agent for #590; promoted with
> `npm run brain:promote -- openspec/changes/issue-590-adr-0018-gitlab-fragment/brain-drafts/adr-0018-gitlab-governance-fragment.md`.
> The commit is the signature (ADR-0028) and it is not the agent's to make.

## Context

This ADR is written **after** the mechanism it records, which is the wrong order and the
reason it exists.

Slice A2 (issue #231, 2026-07) shipped the GitLab governance surface and drafted an ADR-0018
alongside it. The draft was never promoted. The mechanism shipped anyway, and five live sites
then cited `ADR-0018` as though it had been: the root `.gitlab-ci.yml`, the managed fragment
`brain/scripts/ci/gitlab-governance.yml`, `run-check.test.mjs:255` and `:282`, and
`workflow-auth.mjs:415`. `gitlab-governance.yml` names the state exactly — *"ADR-0018 draft"* —
and everything downstream dropped the qualifier. Measured on `main` @ `51bbcaa`: no
`brain/project/decisions/adr-0018-*.md`, no `ADR-0018` line in `brain/HOME.md`, numbering
running `0016 → 0017 → gap → 0019`.

What made that worth a decision record rather than a cleanup is what sits on the gap. The
fragment is a **managed path** — it travels to consumers on `brain:upgrade`. This repo dogfoods
it: the root `.gitlab-ci.yml` opts brain in via the one line the missing ADR is said to
sanction. `workflow-auth.mjs` audits it. Two tests pin its shape and cite the absent record in
their reasoning. Every other axis in this repo has the ADR precede the mechanism; this one had
code, tests, a managed path and a dogfood, and no readable decision.

**This document is re-derived from the tree, not promoted from the 2026-07-10 draft.** That
draft is an input. Where the two disagree, the tree won and the divergence is recorded at the
end.

## Decision

### 1. Brain ships a fragment. The consumer owns the root file. Adoption is one line.

GitLab gives a project exactly ONE root pipeline file, `.gitlab-ci.yml`, and the consumer
usually already owns and populates it. Brain cannot write that file without clobbering whatever
else the consumer runs.

So brain ships `brain/scripts/ci/gitlab-governance.yml` and the consumer opts in themselves:

```yaml
include:
  - local: 'brain/scripts/ci/gitlab-governance.yml'
```

The fragment is registered in `brain/core/managed-paths.mjs` as an **exact literal** with
`STRATEGY.REFUSE`, sitting deliberately above the `brain/scripts/**` COPY glob — the resolver
must give the literal priority or that row is dead text. The consumer's root `.gitlab-ci.yml`
is not managed at all, at any strategy.

This is the asymmetry with GitHub, where `.github/workflows/governance.yml` is a
brain-owned managed file: GitHub has a per-workflow directory, GitLab has one root.

### 2. Every job that needs merge-request context runs through a Node entry point.

GitLab exposes **no `CI_MERGE_REQUEST_DESCRIPTION` variable**, and `CI_MERGE_REQUEST_LABELS`
**freezes at pipeline creation** (ADR-0016). The MR body and fresh labels are reachable only
through `loadGitlabContext()`, which fetches body, labels and author in one proxy-aware API
call authenticated by `VCS_TOKEN`.

So the two jobs GitHub implements as bash reading `github.event` cannot be bash here. Seven of
the eight jobs invoke a Node entry point fed by `loadContext()`:

| job | entry point |
|---|---|
| `issue-link` · `diff-size` · `memory-gate` · `decision-gate` | `brain/scripts/governance/run-check.mjs <job>` |
| `phase-order` | `brain/scripts/vcs/phase-order-check.mjs` |
| `actor-check` | `brain/scripts/vcs/actor-check.mjs` |
| `brain-writes-reviewed` | `brain/scripts/vcs/brain-writes-reviewed.mjs` |

The eighth, `local-checks`, runs `npm run repo:check && npm run brain:nav && npm test`. It is
the exception **because it reads no MR context at all** — it is the local gate run in CI, and
routing it through `loadContext()` would buy nothing and add an API dependency to a job that
has none.

The Node entry points call the ALREADY-EXISTING pure evaluators. Wiring a provider must never
change an evaluator: if one has to change, the wiring is wrong.

### 3. The REQUIRED/DETECTION class is carried by `allow_failure`, and is never flattened.

A REQUIRED job is a normal GitLab job — non-zero exit blocks the MR. A DETECTION job carries
`allow_failure: true` — a real finding is visible in red but does not block.

`ci-context-drift-guard.test.mjs` asserts this **as an iff**, per job: `allow_failure: true` is
present exactly when the job is in `DETECTION_JOBS`, and the fragment's job-name set equals
`GOVERNANCE_JOBS`. An `allow_failure` on a REQUIRED job silently un-gates it — the exact
fail-open the ladder exists to prevent — and a missing one on a DETECTION job turns a warning
into a blocker.

**Measured today: no job in the fragment carries `allow_failure`.** All three occurrences of
the string are in the header comment. That is correct and it is not permanent: `DETECTION_JOBS`
is `GOVERNANCE_JOBS` minus `requiredJobs('standard')`, and #358 Phase 5 promoted every gate to
`required` at `standard`, so the set is currently empty. The rule is the iff, not the current
emptiness.

**Note what this class mapping is NOT.** `DETECTION_JOBS` is resolved at the `standard` tier,
and the fragment is a static file — it cannot re-resolve per consumer tier. A consumer
declaring `lite` gets `phase-order` and `memory-gate` as blocking GitLab jobs even though
`TIER_PARAMS` calls them `detection` at that tier. The tier-awareness lives in the checks, not
in this YAML.

### 4. The approved-issue label is config-resolved, never a literal.

GitLab scoped labels use `::` where GitHub uses `:`, so a provider-blind literal cannot serve
both. `governance.approvedLabel` is an additive `brain.config.json` entry (default
`status:approved`); `resolveApprovedLabel(config, provider)` returns the plain form on GitHub
and maps the first `:` to `::` on GitLab, passing an already-scoped override through unchanged.
A tiny CLI printer sits beside the resolver so a non-Node caller can source the value without
growing a bash config parser.

### 5. The runner image is pinned ONCE, in `default:`, and never per job.

`default: image: node:22`. Every job inherits it. `node:20` fails `local-checks` — 
`node --test "brain/scripts/**/*.test.mjs"` needs the glob expansion that landed in Node 21 —
and this was found by running the pipeline on a real GitLab runner (issue #231 CP-A2b
live-validation finding #13), not by reading it.

A per-job `image:` line is forbidden rather than discouraged: it would let one job drift back
to an older Node while the other seven stayed pinned. The drift guard fails on a missing or
downgraded `default:` pin AND on any reintroduced per-job override.

### 6. The fragment runs on merge-request pipelines only.

`.governance_mr_rules` gates every job on `$CI_PIPELINE_SOURCE == "merge_request_event"`. These
checks read MR-specific context that does not exist on a branch-push pipeline; running them
there would fail closed for the wrong reason. It mirrors `on: pull_request` in the GitHub
workflow.

`CI_DEFAULT_BRANCH` is read directly from GitLab's predefined variables by
`loadGitlabContext()` — the fragment maps nothing, and the drift guard forbids it from ever
assigning that variable. (GitHub Actions needs the opposite: an explicit `env:` mapping of
`github.event.repository.default_branch`.)

### 7. The fragment's credential audit is provider-shaped, and deliberately not the GitHub one.

`auditGitlabPipelineAuth` in `workflow-auth.mjs` is a **separate** implementation from
`auditWorkflowAuth`, and #558's proposal to unify them is refused here on measurement: GitLab
injects project CI/CD variables into every job's environment automatically, so `VCS_TOKEN` is
legitimately absent from this YAML. `auditWorkflowAuth`'s central rule — a port-reaching step
must declare its credential in its own `env:` — is a GitHub Actions rule, and applying it here
produces seven false alarms on a correct file. A guard that cries wolf gets switched off.

It asserts the two properties that ARE applicable:

1. **No provider-foreign credential.** `GH_TOKEN`/`GITHUB_TOKEN` in a GitLab pipeline is a
   credential the provider never reads.
2. **Every entry point it invokes exists on disk.** Nobody runs this pipeline in brain's own
   CI, so a renamed script breaks it silently and stays broken until a consumer hits it. The
   GitHub side is protected by its jobs actually running; this side has only that assertion.

## Never do

- **Never ship, manage or overwrite the consumer's root `.gitlab-ci.yml`.** Brain owns the
  fragment; adoption is the consumer's `include: local:` line.
- **Never implement `issue-link` or `diff-size` as bash on GitLab.** There is no fresh
  body/label source in the environment.
- **Never read `CI_MERGE_REQUEST_LABELS`.** It freezes at pipeline creation.
- **Never give a REQUIRED job `allow_failure: true`, and never omit it from a DETECTION job.**
- **Never add a per-job `image:`.** One pin, in `default:`.
- **Never hardcode a token or a proxy host** in this file or any brain source.
- **Never hardcode the approved label.** It comes from `governance.approvedLabel`.
- **Never change a pure evaluator to make a provider work.**

## Consequences

**The fragment is inert until included, and brain cannot tell.** A consumer who upgrades brain
and never edits their root pipeline gets no GitLab governance and no error. This is the price
of never clobbering the consumer's root, and it is the residual this ADR is least happy about.
It belongs in the adoption checklist; nothing enforces it.

**`issue-link` and `diff-size` depend on the MR API fetch.** A fetch failure fails those
REQUIRED gates closed — correct, but it means CI must reach the API for a GitLab MR to pass.

**GitHub is the only provider exercised in brain's own CI.** This fragment's correctness rests
on fixture tests, the drift guard, the entry-point-existence audit, and one live validation run
against the public gitlab.com mirror (CP-A2b) — not on continuous execution. The archived
CP-A2a checkpoint report still describes CP-A2b as deferred; the fragment header records a
finding from it. Both are on the record; the second is the later fact.

**The class mapping is static while the tier is not** (Decision 3's note). A consumer at `lite`
gets `standard`-tier blocking on GitLab.

## What this ADR does not decide

- Whether the GitLab jobs should re-resolve their class per declared tier. That is a real gap,
  named above, and it wants its own ticket.
- Whether GitHub should migrate `issue-link`/`diff-size` to the same Node path. The Node path
  exists and is tested; adopting it is a separate decision.
- Anything about GitLab provider verbs (`glab`), which are ADR-0008's surface.

## Where this differs from the unpromoted 2026-07-10 draft

Recorded because #590 requires the difference between "what was proposed" and "what shipped" to
be visible rather than quietly reconciled.

| the draft said | the tree says |
|---|---|
| "Route ALL eight GitLab jobs through Node entrypoints" | Seven. `local-checks` runs npm scripts and needs no MR context (Decision 2). |
| DETECTION jobs carry `allow_failure: true`, naming three of them | No job carries it. #358 Phase 5 promoted all gates to `required` at `standard`, emptying the set (Decision 3). |
| — | The `default: image: node:22` single pin, from a live-runner finding (Decision 5). |
| — | `merge_request_event`-only scoping and the `CI_DEFAULT_BRANCH` no-override rule (Decision 6). |
| — | The GitLab-specific credential audit and why it is not the GitHub one (Decision 7). |
| `governance.approvedLabel` as a proposed additive migration | Shipped, with the `::` mapping and the CLI printer (Decision 4). |

## References

- `brain/scripts/ci/gitlab-governance.yml` — the fragment · root `.gitlab-ci.yml` — the dogfood
- `brain/core/managed-paths.mjs` — the literal + `STRATEGY.REFUSE` row
- `brain/scripts/vcs/ci-context-drift-guard.test.mjs` — the job-set, `allow_failure` iff, image-pin and `CI_DEFAULT_BRANCH` guards
- `brain/scripts/governance/approved-label.mjs` · `brain/scripts/vcs/lib/workflow-auth.mjs`
- [ADR-0016](adr-0016-ci-context-normalization.md) — the `ci-context` seam, the `CI_MERGE_REQUEST_LABELS` prohibition, and the REQUIRED/DETECTION exit policy this maps to GitLab
- [ADR-0015](adr-0015-governance-v3-substrate-ladder.md) — the REQUIRED/DETECTION split
- [ADR-0026](adr-0026-governance-doctrine-tiers.md) — the declared tier axis Decision 3's note is about
- [ADR-0003](adr-0003-split-core-project-self-hosting.md) — core is read-only downstream, which is why the consumer root stays local
- Issue #231 slice A2 (the change that shipped this) · issue #590 (the missing record)
