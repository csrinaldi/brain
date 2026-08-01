# Proposal: Governance Doctrine Tiers (lite / standard / regulated)

Issue: #358 — Q5 architecture decision. Epic: #313. Unblocks: #329, #94, T2.1, M3.

## Intent

brain ships exactly ONE doctrine today: five `REQUIRED_JOBS`, three `DETECTION_JOBS`,
four mandatory SDD artefacts, a hardcoded 400-line diff budget, a single-engine
reviewer. That doctrine was authored for one repo shape and it already produces two
structural contradictions that no amount of implementation work can fix:

1. **#329** — `actor-check` (L5) demands two distinct humans; #124 demands the
   maintainer personally applies `status:approved`. At n=1 maintainer both are
   correct and mutually unsatisfiable. The gate can never pass.
2. **#94** — rung 1 (branch protection) is `403` on brain's free-tier-private repo,
   so the five "required" contexts have no substrate that requires them.

Both are the same defect: **brain conflates what a substrate CAN enforce with what a
team CHOOSES to be bound by.** The substrate ladder (rungs 1–4, ADR-0015) already
answers the first question, by detection. Nothing answers the second.

Q5 introduces that missing axis: a declared `governance.tier` selecting the doctrine
the repo is bound by, composing with — never masking — the detected rung.

## The load-bearing distinction

| Axis | Source | Question it answers | Values |
|---|---|---|---|
| **Rung** (ADR-0015) | **detected**, never declared | WHERE fail-closed can live | 1 merge · 2 release · 3 auto-correct · 4 floor |
| **Tier** (this change) | **declared**, never detected | WHICH invariants are load-bearing, and on what evidence | lite · standard · regulated |

They are orthogonal and they compose. A `lite` repo at rung 1 hard-blocks a small
gate set. A `regulated` repo at rung 4 loudly detects a large one. Neither axis may
overwrite the other's report — that is the honesty contract (REQ-HONESTY-1/2)
extended to two dimensions.

## Scope

### In Scope

- Three tiers with a normative, reviewable gate-distribution matrix (design §2).
- Seven tier invariants that keep the concept from decaying into config soup (spec).
- **Two tiering mechanisms**, distinguished on purpose: *position* tiering
  (`required` ⇄ `detection`) and *evidence* tiering (which evidence form satisfies a
  gate that must hold at every tier). The second is the one that resolves #329.
- `governance.tier` config key + `config-migrations.mjs` entry at `0.9.0`,
  defaulting to `standard` (a no-op for every existing consumer).
- A new pure module `brain/scripts/vcs/governance-tiers.mjs` owning the matrix, with
  a drift-guard test: every job in `GOVERNANCE_JOBS` MUST have a matrix row for all
  three tiers, fail-closed on an unmapped gate.
- `checkContexts(tier)` / `requiredJobs(tier)` derived from the matrix; `brain:protect`
  arms the tier's set; `brain:governance-status` reports tier × rung as a cross-product.
- The #329 resolution recommendation, the gate-promotion unblock, T2.1 gate-scoping
  guidance, and M3 reviewer-gate impact (design §4–§7).
- ADR draft in `brain-drafts/` (Tier 2 / ADR-0013 — the agent drafts, the human signs).

### Out of Scope

- Implementing the tiered evidence forms for `actor-check` / `brain-writes-reviewed`.
  This change specifies them; #329 and a follow-up implement them.
- Fixing #328 (stale verdicts). It is a **precondition** for `actor-check`'s lite
  evidence form, not part of this change.
- Building the regulated tier's panel reviewer (#284) or the verify-record artefact.
- Promoting any job. This change makes promotion *decidable per tier*; the list moves
  are separate, precondition-gated slices.
- A fourth tier. Three is the minimum covering the observed adopter shapes; a fourth
  would be speculative at zero external adopters.

## Capabilities

### New Capabilities

- `governance-tiers` — the declared doctrine axis: tier definitions, the gate
  distribution matrix, the seven tier invariants, and the tier × rung honesty report.

### Modified Capabilities

- `governance-v3`:
  - **REQ-L4-2** (spec.md AND design.md required) becomes tier-scoped — it holds at
    `standard`/`regulated`; `lite` requires `spec.md` only.
  - **REQ-L5-1** (approver distinct from author) becomes tier-scoped by *evidence*:
    `lite` satisfies it by distinct **act**, `standard`/`regulated` by distinct act
    **and** distinct actor.
  - **REQ-L6-1/2** becomes tier-scoped by *evidence*: `lite` satisfies L6 by
    agent-authorship exclusion, `standard`/`regulated` by a non-author human review.
  - **REQ-HONESTY-1/2** extend to report the declared tier alongside the detected rung.
  - The `REQUIRED_JOBS` / `DETECTION_JOBS` two-bucket registry generalizes from two
    constants to a `(gate × tier) → policy` function. `GOVERNANCE_JOBS` stays
    tier-independent — every job always runs; only its exit policy and its
    branch-protection membership vary.

## Approach

Model the matrix as data in one pure module, derive both consumer surfaces
(each job's exit policy, and branch protection's required contexts) from that single
function, and forbid by test any gate without a tier row. This is the exact pattern
`governance-checks.mjs` already established for two buckets — generalized, not replaced.

Reject the alternatives considered in design §1: a `governance.soloMaintainer`
boolean (a self-serve escape hatch, and a second axis for one gate), per-gate
overrides (config soup with no reviewable shape), and a tier that can turn a gate
OFF (turns tiers into a way to make red checks disappear — the credibility erosion
#329 explicitly warns against).

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `brain/scripts/vcs/governance-tiers.mjs` | **New** | Matrix, invariants, `resolveGatePolicy`, `resolveGateEvidence`, `tierParams` |
| `brain/scripts/vcs/governance-checks.mjs` | Modified | `checkContexts(tier)` / `requiredJobs(tier)` derived from the matrix |
| `brain/core/config-migrations.mjs` | Modified | `0.9.0` adds `governance.tier: "standard"` |
| `brain.config.json` | Modified | brain declares `"tier": "lite"` explicitly (a recorded declaration, not the default) |
| `brain/scripts/brain-governance-status.mjs` | Modified | Report tier × rung cross-product |
| `brain/scripts/brain-protect.mjs` | Modified | Arm `checkContexts(tier)` |
| `brain/scripts/governance/checks/diff-size.mjs` | Modified | Budget from `tierParams(tier)`, retiring the hardcoded `400` |
| `.github/workflows/governance.yml` · `hooks/pre-push` | Modified | Retire the duplicated `400` literals (drift risk that tiering makes actively wrong) |
| `brain/scripts/vcs/phase-order-check.mjs` | Modified | Rule A artefact set from `tierParams(tier).artefacts` |
| `brain/scripts/vcs/actor-check.mjs` · `brain-writes-reviewed.mjs` | Modified | Evidence form from `resolveGateEvidence` |
| `brain/project/decisions/adr-0026-*` | **New (draft)** | ADR draft in `brain-drafts/`, awaiting human promotion |

## Risks

| Risk | Severity | Mitigation |
|---|---|---|
| The epic's one-line recommendation for `standard` (`proposal+spec`) contradicts ratified **REQ-L4-2** (which exists precisely because `proposal+tasks` was insufficient) | **High** — a silent weakening of the default tier | Design §3 recommends `standard` keeps all four artefacts and gives `regulated` a verify-record delta instead. Flagged for explicit human ratification; the epic-literal alternative is recorded. |
| The epic asserts `brain-writes-reviewed` "never tiers", but its evidence (non-author human review) is **as unsatisfiable at n=1 as `actor-check`'s** — the same #329 contradiction, one level deeper, unnoticed | **High** | Resolved by evidence tiering (design §2.A): position never tiers, evidence does. |
| Tiers become a way to dodge red checks | High | TIER-INV-3: no tier may drop a gate below `detection`. There is no `off`. |
| Declaring brain `lite` downgrades brain's own reported enforcement | Medium | Measured in design §5: with evidence tiering the only real loss is `memory-gate`, which is already a repo-global constant (documented in `workflow-governance.md`). |
| Tier default weakens existing consumers on upgrade | Medium | Default is `standard`, which is byte-equivalent to today's behavior. |
| Adding a gate without a tier decision | Medium | Drift-guard test fails closed on an unmapped gate. |
| `standard`/`regulated` are unproven — brain itself can only exercise `lite` | Medium (honest residual) | Stated, not hidden. Validation requires an n≥2 adopter; recorded in the ADR's consequences. |
