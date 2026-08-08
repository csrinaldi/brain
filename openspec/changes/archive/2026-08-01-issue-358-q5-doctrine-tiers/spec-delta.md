# Spec Delta: Governance Doctrine Tiers

Issue: #358 (Q5). Capability: `governance-tiers` (new) · `governance-v3` (modified).

## Purpose

Introduce a **declared** doctrine axis (`governance.tier`) orthogonal to the
**detected** substrate axis (rungs 1–4, ADR-0015). The tier selects which invariants
are load-bearing and on what evidence; the rung selects where fail-closed can live.
This spec states WHAT must be true; the matrix rationale, resolution recommendations,
and implementation seams are design-level (`design.md`).

## Epic Invariant (Non-Goal — stated)

Tiers MUST NOT be a mechanism for reducing what is *observed*. A lower tier reduces
what **blocks** and relaxes **ceremony parameters**; it never reduces what **runs**,
never silences a signal, and never lets a tier claim a guarantee its rung cannot
provide. Tiers are a statement about the team's operating model, not a volume knob on
the truth.

## New Capability: governance-tiers

### Requirement Index

| Req | Name | Testable |
|---|---|---|
| REQ-TIER-1 | Three tiers, one ordinal, monotonic | Unit (`node --test`) |
| REQ-TIER-2 | A never-tiered core exists and is enumerated | Unit + file assertion |
| REQ-TIER-3 | No tier drops a gate below `detection` | Unit |
| REQ-TIER-4 | Tier is declared, rung is detected, neither masks the other | Unit + integration |
| REQ-TIER-5 | Satisfiability: position tiers only when evidence cannot | Unit |
| REQ-TIER-6 | Waivers are themselves tiered | Unit |
| REQ-TIER-7 | Proportionality bounds what a lower tier may relax | File assertion (matrix review) |
| REQ-TIER-8 | The matrix is total — every job has a row for every tier | Unit (drift-guard, fail-closed) |
| REQ-TIER-9 | One source derives both consumer surfaces | Unit + file assertion |
| REQ-TIER-10 | `governance.tier` defaults to `standard` | Unit |
| REQ-TIER-11 | `brain:governance-status` reports the tier × rung cross-product | Unit (print logic) |

(See `openspec/specs/governance-tiers/spec.md` for full requirement details)

## Modified Capability: governance-v3

### Modified Requirements

#### REQ-L4-2 (modified): Required-Artefact Set Is Tier-Scoped

REQ-L4-2 (`spec.md` AND `design.md` MUST exist) holds at `standard` and `regulated`.
At `lite`, `phase-order` Rule A MUST require `spec.md` only. `regulated` MUST
additionally require a recorded verification artefact.

| Tier | Artefact requirement |
|---|---|
| lite | spec.md or specs/*/spec.md |
| standard | all four (proposal + spec + design + tasks) |
| regulated | all four + recorded verification artefact |

#### REQ-L5-1 (modified to REQ-L5-1'): Approver Distinctness Is Evidence-Tiered

`actor-check` is `required` at every tier. Its evidence form is:

| Tier | Evidence that satisfies REQ-L5-1 |
|---|---|
| lite | **Distinct act** — the `status:approved` label-add event exists and is strictly later than the push of the PR's head commit |
| standard | Distinct act **and** distinct actor (approver ≠ PR author ≠ issue author) |
| regulated | Distinct act, distinct actor, and the approver authored **no commit** on the branch |

The label-add event MUST be read as evidence, never assumed. If it cannot be read,
the gate fails closed (an unreadable approval is not an approval).

#### REQ-L6-1 (modified to REQ-L6-1'): brain-writes Review Is Evidence-Tiered

`brain-writes-reviewed` is `required` at every tier. Its evidence form is:

| Tier | Evidence that satisfies REQ-L6 |
|---|---|
| lite | No bot/agent identity authored the `brain/core/**` or `brain/project/**` change (agent-authorship exclusion) |
| standard | An APPROVED review from a non-author, non-bot human |
| regulated | The `standard` evidence, plus CODEOWNERS armed as the rung-1 enhancement where the substrate allows it |

The agent-identity set MUST be resolved from `governance.reviewActors`, the key
`brain-writes-reviewed` already reads — no new identity list.

### Extended Requirements

#### REQ-HONESTY-1/2 (extended): Tier × Rung Cross-Product Reporting

`brain:governance-status` MUST print the declared tier and the detected rung as separate,
labelled facts, and MUST render, per gate, the composition of the two: a gate that is
`required` by doctrine on a substrate that cannot block MUST be surfaced as
"required by doctrine, detection-only in substrate" — never as armed, and never
silently omitted.

## Notes

This spec delta defines new capability `governance-tiers` and modifies `governance-v3`
requirements REQ-L4-2, REQ-L5-1, REQ-L6-1, and REQ-HONESTY-1/2. The tier-scoped
requirements are implemented in Phases 1-3 (completed and verified). The evidence-form
implementations (Phase 4) are blocked on issue #328.
