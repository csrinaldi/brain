# Proposal — CI Context Normalization (design-only, slice A0)

> **Status:** Design-only · Stops at checkpoint **CP-A0** for external review · **Relates to:** [ADR-0015](../../../brain/project/decisions/adr-0015-governance-v3-substrate-ladder.md) (the six-level ladder + Epic Invariant this seam must preserve), [ADR-0014](../../../brain/project/decisions/adr-0014-workflow-governance.md) (400-line budget + `governance.ignoreList`), [ADR-0009](../../../brain/project/decisions/adr-0009-documentation-language-policy.md) (docs English), [governance-checks.mjs](../../../brain/scripts/vcs/governance-checks.mjs) (`REQUIRED_JOBS` / `DETECTION_JOBS`), [diff-size-count.mjs](../../../brain/scripts/vcs/diff-size-count.mjs) (reads `governance.ignoreList` directly). ADR draft: [adr-0016-ci-context-normalization.md](brain-drafts/adr-0016-ci-context-normalization.md) (DRAFT — human-promote later).

> **Design-only invariant (load-bearing).** This slice writes **no code** — only the boundary design, the delta spec, and an ADR draft. No `brain/scripts/vcs/ci-context.mjs` is created here (that is slice A1). No wrapper is refactored, no `.gitlab-ci.yml` is added, no provider verbs are touched. The single non-doc deliverable — aligning `brain.config.json`'s `governance.ignoreList` with ADR-0014 — is already applied by the orchestrator (see Deliverable 5 below).

## Context

The governance gates (ADR-0015's L1–L6) each read their CI context **ad hoc**: every
gate reaches directly into `process.env.*` and issues its own `gh` calls. The reading
of "what PR is this, what is its base/head SHA, its labels, its body, its author" is
**duplicated across five files** with no shared seam:

- `brain/scripts/vcs/providers/github.mjs` — `prView()` (L126–139): `gh pr view <n> --json number,labels,body`.
- `brain/scripts/vcs/actor-check.mjs` (L219–223): `PR_AUTHOR`, `PR_BODY`, `BASE_BRANCH`, `GITHUB_REPOSITORY` + `gh api .../events` for label history.
- `brain/scripts/vcs/brain-writes-reviewed.mjs` (L213–216): `BASE_SHA`, `HEAD_SHA`, `PR_NUMBER`, `GITHUB_REPOSITORY`, `PR_AUTHOR` + `gh api .../reviews`.
- `brain/scripts/vcs/phase-order-check.mjs` (L372–373): `BASE_SHA`, `HEAD_SHA`.
- `brain/scripts/governance/run-check.mjs` (L36–37): `BASE_SHA`, `HEAD_SHA` for `git diff --name-only`.

This works for a single provider (GitHub Actions) but hard-codes GitHub's env var names
and payload shape into every gate. Adding GitLab CI would mean editing all five files
and threading `CI_MERGE_REQUEST_*` variables through each — an N×M change surface, and a
standing risk that a gate quietly branches on provider-specific context in a way that
violates ADR-0015's Epic Invariant ("every gate inspects evidence, never the producing
tool").

The "Adapter & Gap Completion Plan (v3)" answers this with **one normalization seam** —
a single module, `brain/scripts/vcs/ci-context.mjs`, that detects the CI provider and
returns one normalized context object. Every pure governance evaluator then consumes
only that object and never touches `process.env` or a provider payload again.

**A0 is the design slice.** It fixes the boundary of that module (contract, provider
mappings, degrade policy) and states the invariant that proves the boundary is correct —
**without writing the module**. It stops at CP-A0 so the boundary can be reviewed before
any code depends on it.

## What to build (this slice)

1. **`design.md`** — the module contract: `detectCi()`, `loadContext()`, the GitHub
   source (extract the existing env/`gh` logic, do not rewrite it), the GitLab source
   (`CI_MERGE_REQUEST_*` + one API call via `VCS_TOKEN`, proxy from standard
   `HTTP(S)_PROXY`), the fail-closed/degrade policy by gate type, and the central
   invariant ("pure evaluators do not change").
2. **`specs/ci-context/spec.md`** — delta requirements: the fields `loadContext()`
   guarantees per provider; missing-variable behavior by gate type
   (REQUIRED → fail-closed, DETECTION → warn + documented reason); the
   "pure evaluators unchanged" invariant as a testable requirement.
3. **`tasks.md`** — the design authoring tasks (checked, since done) plus the
   already-done config alignment and the ADR-draft task.
4. **ADR draft** — `brain-drafts/adr-0016-ci-context-normalization.md` (Tier-2 draft;
   a human promotes it to `brain/project/decisions/` per the consolidation protocol —
   ADR-0015 L6 / ADR-0013 flow). Not an accepted ADR yet.
5. **Config alignment (already applied by orchestrator).** `brain.config.json`'s
   `governance.ignoreList` was drifting by omitting `.memory/**`, which ADR-0014 lists
   as an ignore-list default; `.memory/**` has been added. `diff-size-count.mjs` reads
   `config.governance.ignoreList` directly with no augmentation (verified L69), so this
   alignment is the whole fix for brain's own repo. **No further config edit is in
   scope for A0.**

## Out of scope (non-goals)

- **No `ci-context.mjs` code.** The module is designed here, implemented in **slice A1**.
- **No wrapper refactor.** Rewiring the five gates onto the seam is slice A1's job.
- **No GitLab CI file, no provider verbs, no `protectBranch` parity.** Slices A2/A3.
- **No drift-guard test** for the seam (e.g. a test asserting no gate reads `process.env`
  directly once A1 lands) — noted as an open question, not built here.
- **No consumer-facing config change** beyond brain's own `brain.config.json`
  (Deliverable 5). See design.md "Open questions" for the canonical-default finding.
- **No writes to `brain/`.** The ADR stays in `brain-drafts/` until a human promotes it.

## Acceptance criteria

This is a design slice; acceptance is **artifact completeness**, not passing tests.

- [x] `design.md` specifies `detectCi()` and `loadContext()` contracts and cites the
  exact GitHub-context source files/functions being extracted (not rewritten).
- [x] `design.md` maps GitHub and GitLab sources to each normalized field, and states
  the corporate-proxy rule (standard `HTTP(S)_PROXY`, never hard-coded).
- [x] `design.md` states the central invariant — pure evaluators do not change — and
  ties it to ADR-0015's Epic Invariant.
- [x] `specs/ci-context/spec.md` captures per-provider field guarantees, the
  missing-variable behavior by gate type, and the invariant as a testable requirement.
- [x] `tasks.md` has ≥1 checked item (required by L4 phase-order — `tasks.md` must have
  a checked item before code lands).
- [x] ADR draft carries the DRAFT status note and does not touch `brain/`.
- [x] This change is itself under the 400-line budget and links its issue — the plan's
  first MR must not trip a gate.

## Risks

- **Seam under-specified for A1.** If a field or degrade rule is left ambiguous here,
  A1 re-litigates it during implementation. Mitigated by pinning the full field table
  and the by-gate-type degrade matrix in the spec.
- **Invariant not testable.** "Evaluators unchanged" is only load-bearing if A1 can
  prove it. The spec states it as an assertion A1 must cover (evaluator signatures and
  fixtures unchanged; only wrappers gain the seam) — see design.md Decision 4.
- **GitLab MR-description API call is a new dependency.** One network call (behind the
  corporate proxy) is introduced to the DETECTION path in A1. Designed to degrade to
  warn on failure, never fail a required gate — pinned in the spec.
