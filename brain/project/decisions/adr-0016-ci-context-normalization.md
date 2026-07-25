# ADR-0016 — CI Context Normalization: One Seam Over Provider-Specific Pipeline Evidence

**Status**: Accepted
**Date**: 07/02/2026 — Cristian Rinaldi

## Context

ADR-0015 shipped six governance levels (L1–L6) as generic Node scripts over git/PR
evidence, each split into a pure evaluator and a thin `gh`/git wrapper. Each wrapper reads
its CI context **ad hoc**: directly from `process.env.*` and via its own `gh` calls. The
reading of "which PR is this, its base/head SHA, labels, body, author" is **duplicated
across five files**:

- `brain/scripts/vcs/providers/github.mjs` — `prView()` (L126–139), the only `gh pr view` reader.
- `brain/scripts/vcs/actor-check.mjs` (L219–223) — `PR_AUTHOR`, `PR_BODY`, `BASE_BRANCH`, `GITHUB_REPOSITORY`.
- `brain/scripts/vcs/brain-writes-reviewed.mjs` (L213–216) — `BASE_SHA`, `HEAD_SHA`, `PR_NUMBER`, `GITHUB_REPOSITORY`, `PR_AUTHOR`.
- `brain/scripts/vcs/phase-order-check.mjs` (L372–373) — `BASE_SHA`, `HEAD_SHA`.
- `brain/scripts/governance/run-check.mjs` (L36–37) — `BASE_SHA`, `HEAD_SHA`.

This hard-codes GitHub Actions' variable names and payload shape into every gate. Adding a
second provider (GitLab CI) would mean editing all five files and threading
`CI_MERGE_REQUEST_*` variables through each — an N×M change surface — and it invites a gate
to quietly branch on provider-specific context, eroding ADR-0015's Epic Invariant ("every
gate inspects evidence, never the producing tool").

## Decision

Introduce **one normalization seam** — `brain/scripts/vcs/ci-context.mjs` — between the CI
environment and every governance gate. It exposes exactly two functions:

- `detectCi() -> 'github' | 'gitlab' | 'local' | 'unknown'` — provider detection from env
  markers (`GITHUB_ACTIONS`, `GITLAB_CI`), with `'unknown'` (unsupported CI) kept distinct
  from `'local'` (no CI).
- `loadContext() -> { provider, prNumber, baseSha, headSha, sourceBranch, targetBranch,
labels[], body, author, isMergeRequest }` — one normalized object, identical in shape
  across all providers. Every field is value-or-`null`; for `labels` / `body`, `[]` / `''`
  mean genuinely empty and `null` means uncomputable (the fetch failed) — the two MUST be
  distinguished. The function never throws.

The GitHub reader is **extracted, not rewritten** — the existing env/`gh` logic moves
behind the seam unchanged. The GitLab reader maps `CI_MERGE_REQUEST_IID`,
`CI_MERGE_REQUEST_DIFF_BASE_SHA`, and `CI_COMMIT_SHA` from env, and fetches the MR
description, **labels, and author** with **one** API call authenticated by `VCS_TOKEN`,
honoring the standard `HTTP(S)_PROXY` environment (never a hard-coded proxy).
`CI_MERGE_REQUEST_LABELS` is **not** used — it freezes at pipeline creation (see the
paragraph below).

`author` is sourced from the PR/MR **API payload** in **both** providers —
`author.username` from that same one GitLab MR call, and `author.login` from
`gh pr view --json author` on GitHub — **never from an environment variable**. Pipeline env
(`GITLAB_USER_LOGIN`, `CI_MERGE_REQUEST_ASSIGNEES`, a workflow-set `PR_AUTHOR`) identifies
the pipeline trigger or an assignee, not the MR author, and diverges on re-runs and foreign
pushes. This costs no extra request — the author rides the payload the seam already fetches.

**One deliberate behavior change — the single exception to "extract, don't rewrite":** today
`prView()` returns `labels: [], body: ''` on _any_ failure, conflating "none" with "couldn't
fetch". The seam distinguishes `null` (uncomputable) from `[]` / `''` (empty), so a failed
label/description fetch fails the consuming **REQUIRED** gates closed instead of silently
passing them. The GitLab MR call carries `body`, `author`, and `labels` together; its failure
yields `null`, never a fallback to the stale `CI_MERGE_REQUEST_LABELS`.

### Fail-closed vs. degrade, by gate type

The seam signals an uncomputable field as `null` — never a fabricated default — and each
gate applies the policy fixed by its ADR-0015 class:

| Class                                                                                   | On a needed field being `null`                              |
| --------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| **REQUIRED_JOBS** consumers (`issue-link`, `diff-size`, `memory-gate`, `decision-gate`) | **FAIL CLOSED** — never exit 0                              |
| **DETECTION_JOBS** (`phase-order`, `actor-check`, `brain-writes-reviewed`)              | **DEGRADE to `warn` + documented reason** — exit 0, visibly |

> The full `REQUIRED_JOBS` constant (`governance-checks.mjs` L27) is `['issue-link',
'diff-size', 'local-checks', 'memory-gate', 'decision-gate']`; `local-checks` is REQUIRED
> but consumes no pipeline context, so it is not a `ci-context` consumer. ADR-0015.md L74
> still shows the pre-`local-checks` four — a doc/code drift noted for follow-up.

This mirrors the verified precedent: `run-check.mjs` fails closed on an uncomputable diff;
`phase-order-check.mjs` / `actor-check.mjs` / `brain-writes-reviewed.mjs` degrade to warn.
A REQUIRED gate must NEVER silently exit 0 on missing context — the exact failure the
ladder exists to prevent.

### The boundary is correct iff evaluators do not change

Introducing the seam MUST NOT alter any pure evaluator (`evaluateActor`, the phase-order
rule, `adrPresence`, `memoryPresence`, `diffSize`, `issueLink`). Those take plain arguments,
not the environment; the seam only centralizes how the thin wrappers gather those
arguments. The evaluators consuming one identical context object regardless of
`github`/`gitlab`/`local` is the observable proof that the boundary holds — and it
_strengthens_ ADR-0015's Epic Invariant: after this change the only provider-aware code is
`ci-context.mjs`, which normalizes the provider **away** before any evaluator sees the data.

### Scope

This ADR is drafted alongside the **design-only** slice A0, which fixes this contract
without writing code. The module is implemented in slice A1 (wrapper rewiring); GitLab CI
wiring and provider verbs follow in A2/A3.

## Never do

- **Never let a governance gate read `process.env` provider context directly once the seam
  exists.** All pipeline context flows through `ci-context.mjs`; a direct read re-introduces
  the provider coupling this ADR removes.
- **Never fabricate a default for a missing context field.** An uncomputable field is
  `null`, so the gate can apply its fail-closed/degrade policy; a fabricated default turns a
  REQUIRED gate into a silent fail-open.
- **Never source the MR/PR `author` from an environment variable.** It comes from the API
  payload (`author.username` / `author.login`) in both providers — pipeline env identifies
  the trigger or an assignee, not the author, and diverges on re-runs and foreign pushes.
- **Never let a REQUIRED gate exit 0 on uncomputable context.** REQUIRED fails closed;
  only DETECTION degrades to warn.
- **Never hard-code a proxy host.** The corporate proxy is read from standard
  `HTTP_PROXY` / `HTTPS_PROXY` / `NO_PROXY`.
- **Never change a pure evaluator to accommodate the seam.** If an evaluator must change,
  the boundary is wrong — the seam is a gathering refactor, not a behavior change.
- **Never let a gate branch on `provider`.** The normalized object exists precisely so no
  evaluator needs to know which provider produced the run (ADR-0015 Epic Invariant).

## Consequences

- **Positive**: adding a provider becomes a single-file change (`ci-context.mjs`), not an
  N×M edit across every gate.
- **Positive**: the Epic Invariant is enforced structurally — provider-aware code is
  quarantined to one module and normalized away before evaluators run.
- **Positive**: the GitHub path is preserved byte-for-byte (extraction, not rewrite), so
  A1 carries no behavior-change risk for the existing provider.
- **Positive**: the seam closes a pre-existing latent fail-open — `prView()`'s
  `[]` / `''`-on-failure conflated "no labels" with "couldn't fetch labels", which could let
  `decision-gate` (and other REQUIRED gates reading `labels` / `body`) pass without
  evaluating. The seam distinguishes `null` and fails those gates closed.
- **Negative (honest residual)**: the GitLab MR API call is on a **REQUIRED** path (its
  `body` / `labels` feed `issue-link` / `diff-size` / `memory-gate` / `decision-gate`), so a
  fetch failure fails those gates **closed** — correct, but it means CI must reach the API
  (through the corporate proxy) for a GitLab MR to pass, not merely for a warning.
- **Negative (honest residual)**: without a drift-guard test (deferred to A1), a future gate
  could bypass the seam and read `process.env` directly, silently re-coupling to a provider.

## References

- `openspec/changes/issue-193-ci-context-design/proposal.md` — the A0 slice this ADR records.
- `openspec/changes/issue-193-ci-context-design/design.md` — the full field mapping,
  extraction citations, and the by-gate-type degrade matrix.
- `openspec/changes/issue-193-ci-context-design/specs/ci-context/spec.md` — REQ-CIC-1..5.
- [ADR-0015](adr-0015-governance-v3-substrate-ladder.md) —
  the six-level ladder, the `REQUIRED_JOBS` / `DETECTION_JOBS` split, and the Epic Invariant
  this seam preserves and strengthens.
- [ADR-0014](adr-0014-workflow-governance.md) — the
  enforce-outputs / guide-judgment boundary and the 400-line budget + `governance.ignoreList`.
- [ADR-0013](adr-0013-auto-adr-onboarding.md) — the
  draft → human-review → promotion flow this draft itself follows.
- [ADR-0009](adr-0009-documentation-language-policy.md) —
  documentation-language policy (this ADR is English).
