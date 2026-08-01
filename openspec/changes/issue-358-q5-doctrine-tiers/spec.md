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

## Requirement Index

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
| REQ-L4-2′ | Required-artefact set is tier-scoped | Unit |
| REQ-L5-1′ | Approver distinctness is evidence-tiered | Unit |
| REQ-L6-1′ | brain-writes review is evidence-tiered | Unit |

---

## The Tier Invariants

### Requirement REQ-TIER-1: Three Tiers, One Ordinal, Monotonic

`governance.tier` MUST accept exactly `"lite"`, `"standard"`, `"regulated"` and MUST
be treated as a single ordinal with `lite < standard < regulated`. Every gate
`required` at tier N MUST be `required` at every tier above N, and every tiered
parameter MUST be monotonically at-least-as-strict at every tier above N. An
unrecognized value MUST fail closed with an actionable error — never silently
degrade to a default.

The purpose is reviewability: a single ordinal makes the matrix auditable in one
table, and makes a tier upgrade a ratchet with no surprises.

#### Scenario: a gate required at lite is required at standard

- GIVEN the gate matrix
- WHEN every gate's policy is compared across the three tiers in ordinal order
- THEN no gate is `required` at a lower tier and `detection` at a higher one

#### Scenario: an unknown tier fails closed

- GIVEN `governance.tier: "enterprise"`
- WHEN any tier-reading code path resolves the tier
- THEN it exits non-zero naming the three valid values, and never resolves to `standard`

### Requirement REQ-TIER-2: A Never-Tiered Core Exists and Is Enumerated

A named subset of gates MUST be `required` at **every** tier, because relaxing them
would make brain's own claims false rather than merely weaker. The subset is
normative and MUST be enumerated in code, not inferred:

| Never-tiered gate | Why it cannot tier |
|---|---|
| `issue-link` | Without traceability there is no governance object to reason about |
| `local-checks` | A tier that lets broken code merge is not weaker governance, it is no engineering |
| `decision-gate` | Internal consistency (ADR ⇔ `HOME.md`); costs no second human and no extra artefact |
| `actor-check` | Approval must be deliberate at every tier (evidence tiers, position does not) |
| `brain-writes-reviewed` | Agent containment — if an agent can write `brain/core/**` unreviewed, "the human always leads" is void |
| `diff-size` | A reviewable slice is the precondition of review at every tier (the budget tiers, the gate does not) |

Additionally, the reviewer's `event: COMMENT` constraint (ADR-0020) MUST be
tier-independent: **no tier may grant the reviewer merge authority.** A tier that
could do so would collide with L5 and #124 (approval is a human signature).

#### Scenario: a tier cannot demote a never-tiered gate

- GIVEN any tier
- WHEN the matrix is resolved for a never-tiered gate
- THEN its policy is `required`

### Requirement REQ-TIER-3: No Tier Drops a Gate Below `detection`

A gate's policy MUST be exactly one of `required` or `detection`. There MUST be no
`off`, `disabled`, `skip`, or absent policy. `GOVERNANCE_JOBS` MUST stay
tier-independent: every job defined in the workflow runs at every tier; only its
exit policy and its branch-protection membership vary.

This is the anti-pattern guard. Tiers exist to state what a team is bound by, not to
make an inconvenient red check disappear.

#### Scenario: a lite repo still runs every job

- GIVEN `governance.tier: "lite"`
- WHEN the workflow's job set is compared to `GOVERNANCE_JOBS`
- THEN they are equal, and every job whose lite policy is `detection` exits 0 with a
  warning annotation stating the tier as the reason

### Requirement REQ-TIER-4: Tier Is Declared, Rung Is Detected, Neither Masks the Other

The tier MUST come only from `governance.tier` and MUST NEVER be inferred from
platform capability, repo visibility, plan, contributor count, or any probe.
Symmetrically, the rung MUST NEVER be read from config as a declaration of doctrine.
No code path may substitute one for the other, and no report may render a single
merged verdict that hides which axis produced it.

#### Scenario: a 403 platform does not lower the tier

- GIVEN a repo whose branch-protection probe returns `403` (rung 1 unavailable)
- WHEN the tier is resolved
- THEN it is exactly the declared value, unchanged by the probe result

### Requirement REQ-TIER-5: Satisfiability — Position Tiers Only When Evidence Cannot

If a gate belongs to the never-tiered core (REQ-TIER-2) but its evidence form is
structurally unsatisfiable at a tier's operating model, the **evidence** MUST be
tiered and the **position** MUST NOT. Position tiering is permitted only when no
satisfiable evidence form exists at that tier, or under proportionality
(REQ-TIER-7).

A gate MUST NOT be `required` at a tier whose own definition makes it structurally
impossible to satisfy. A permanently-failing gate is not enforcement — it trains
people to ignore checks.

#### Scenario: distinct-actor is unsatisfiable at n=1 but the gate still blocks

- GIVEN `governance.tier: "lite"`, whose operating model is a single maintainer
- WHEN `actor-check` resolves its policy and evidence
- THEN the policy is `required` AND the evidence form is distinct **act**, not
  distinct actor
- AND a solo maintainer who applies `status:approved` as a separately-timestamped
  action after the head commit was pushed gets a PASS, not a fail and not a bare warn

#### Scenario: L6 has a satisfiable form at n=1

- GIVEN `governance.tier: "lite"` and a PR touching `brain/core/**`
- WHEN `brain-writes-reviewed` resolves its evidence form
- THEN it is agent-authorship exclusion (no bot/agent identity authored the change),
  which a solo human maintainer satisfies
- AND the policy is still `required`

### Requirement REQ-TIER-6: Waivers Are Themselves Tiered

Skip/exception labels MUST be resolved through the tier, not honored unconditionally.
`size:exception` MUST be honored at `lite` and `standard` and MUST NOT be honored at
`regulated`. A label whose honoring is tier-dependent MUST report, in its verdict,
that the tier refused it — never fail silently as if the label were absent.

The pre-existing allow-listed `override:*` label (honored today by both
`actor-check` and `brain-writes-reviewed` via `governance.approvalActors`) MUST also
be tier-scoped: honored at `lite` and `standard`, refused at `regulated`. It MUST NOT
become the mechanism by which `lite` satisfies L5/L6 — an override is a *bypass*, and
a tier whose gates pass only by bypass has no doctrine. `lite` MUST pass on its own
evidence form (REQ-L5-1′ / REQ-L6-1′) with `override:*` unused.

A tier whose constraints the team can waive at will is a preference, not a doctrine.

#### Scenario: regulated cannot self-waive its budget

- GIVEN `governance.tier: "regulated"` and a PR of 260 changed lines carrying `size:exception`
- WHEN `diff-size` runs
- THEN it fails, and the message states that `size:exception` is not honored at the
  `regulated` tier and the change must be sliced

#### Scenario: lite passes L6 on evidence, not on override

- GIVEN `governance.tier: "lite"`, a `brain/core/**` change authored by the human
  maintainer, and NO `override:*` label on the PR
- WHEN `brain-writes-reviewed` runs
- THEN it passes on agent-authorship exclusion, and the verdict does not mention an override

### Requirement REQ-TIER-7: Proportionality Bounds What a Lower Tier May Relax

Position tiering under proportionality is permitted ONLY for gates whose cost is
per-change ceremony and whose benefit scales with team size. It MUST NOT be applied
to gates protecting correctness, traceability, agent containment, or internal
consistency (i.e. the REQ-TIER-2 core).

#### Scenario: proportionality cannot reach a correctness gate

- GIVEN the matrix
- WHEN each position-tiered gate is checked against the never-tiered core
- THEN the two sets are disjoint

### Requirement REQ-TIER-8: The Matrix Is Total — Fail Closed on an Unmapped Gate

A drift-guard test MUST assert that every name in `GOVERNANCE_JOBS` has a matrix row
resolving both a policy and an evidence form for all three tiers, and that every
matrix row names a job the workflow defines. Adding a governance job without a tier
decision MUST turn the test red.

#### Scenario: a new job with no tier row fails the build

- GIVEN a new job name added to `GOVERNANCE_JOBS` with no matrix row
- WHEN the drift-guard test runs
- THEN it fails naming the unmapped gate and the three tiers it must be decided for

### Requirement REQ-TIER-9: One Source Derives Both Consumer Surfaces

Each gate's exit policy AND branch protection's required-context list MUST derive
from the SAME resolution function. Neither surface may carry an independent copy of
the matrix, and no tiered parameter (notably the diff budget) may exist as a second
literal in shell, YAML, or a hook.

The existing duplicated `400` literals (`diff-size.mjs` default, the workflow's bash
comparison, the pre-push hook) MUST be reduced to the single tiered source — under
tiering a duplicated budget is not merely a drift risk, it is actively wrong.

#### Scenario: budget has exactly one definition

- GIVEN the repo
- WHEN it is searched for a diff-budget literal outside the tier module
- THEN none is found

### Requirement REQ-TIER-10: `governance.tier` Defaults to `standard`

A `config-migrations.mjs` entry MUST add `governance.tier` with the default
`"standard"`, and `buildDefaultConfig()` MUST produce it. `standard` MUST be
behaviourally equivalent to brain's pre-tier doctrine, so the migration is a no-op
for every existing consumer. A default of `lite` is forbidden: it would silently
weaken governance on upgrade.

#### Scenario: upgrading a consumer changes no verdict

- GIVEN a consumer config at a pre-`0.9.0` schemaVersion
- WHEN the migration applies and every gate resolves at the resulting tier
- THEN each gate's policy and parameters equal its pre-tier behaviour

### Requirement REQ-TIER-11: `brain:governance-status` Reports the Tier × Rung Cross-Product

The report MUST print the declared tier and the detected rung as separate, labelled
facts, and MUST render, per gate, the composition of the two: a gate that is
`required` by doctrine on a substrate that cannot block MUST be surfaced as
"required by doctrine, detection-only in substrate" — never as armed, and never
silently omitted.

This extends REQ-HONESTY-1/2 from one dimension to two. It is the primary output
surface of this change: the first time brain's own report is true about both axes.

#### Scenario: doctrine outruns substrate

- GIVEN `governance.tier: "standard"` and a detected rung of 4
- WHEN the report prints
- THEN it states tier `standard` (declared) and rung 4 (detected) separately
- AND each `required` gate is rendered as required-by-doctrine / detection-in-substrate
- AND the remedy to climb the rung is still printed

---

## Modified `governance-v3` Requirements

### Requirement REQ-L4-2′: Required-Artefact Set Is Tier-Scoped

REQ-L4-2 (`spec.md` AND `design.md` MUST exist) holds at `standard` and `regulated`.
At `lite`, `phase-order` Rule A MUST require `spec.md` only. `regulated` MUST
additionally require a recorded verification artefact.

`REQUIRED_ARTIFACTS` in `sdd-layout.mjs` stays the canonical scaffold set at every
tier — the tier scopes what the **gate** demands, never what the scaffold produces.

#### Scenario: lite lands implementation with spec.md only

- GIVEN `governance.tier: "lite"` and a PR with implementation code and a change dir
  containing `spec.md` and `tasks.md` with one checked item
- WHEN `phase-order` runs
- THEN Rule A passes

#### Scenario: standard still demands design.md

- GIVEN `governance.tier: "standard"` and the same PR without `design.md`
- WHEN `phase-order` runs
- THEN Rule A fails naming the missing artefact

### Requirement REQ-L5-1′: Approver Distinctness Is Evidence-Tiered

`actor-check` is `required` at every tier. Its evidence form is:

| Tier | Evidence that satisfies REQ-L5-1 |
|---|---|
| `lite` | **Distinct act** — the `status:approved` label-add event exists and is strictly later than the push of the PR's head commit |
| `standard` | Distinct act **and** distinct actor (approver ≠ PR author ≠ issue author) |
| `regulated` | Distinct act, distinct actor, and the approver authored **no commit** on the branch |

The label-add event MUST be read as evidence, never assumed. If it cannot be read,
the gate fails closed (an unreadable approval is not an approval).

#### Scenario: a solo maintainer passes at lite

- GIVEN `governance.tier: "lite"`, a PR authored by `alice`, head commit pushed at T0,
  and `status:approved` applied by `alice` at T0+5min
- WHEN `actor-check` runs
- THEN it passes, and the verdict names the distinct-act evidence and the tier

#### Scenario: the same repo at standard fails

- GIVEN the same PR with `governance.tier: "standard"`
- WHEN `actor-check` runs
- THEN it fails, naming self-approval and stating that the `standard` tier requires a
  second distinct human

#### Scenario: approval before the code is not an approval

- GIVEN `governance.tier: "lite"` and `status:approved` applied BEFORE the head commit was pushed
- WHEN `actor-check` runs
- THEN it fails — the act did not follow the thing it approves

### Requirement REQ-L6-1′: brain-writes Review Is Evidence-Tiered

`brain-writes-reviewed` is `required` at every tier. Its evidence form is:

| Tier | Evidence that satisfies REQ-L6 |
|---|---|
| `lite` | No bot/agent identity authored the `brain/core/**` or `brain/project/**` change (agent-authorship exclusion) |
| `standard` | An APPROVED review from a non-author, non-bot human |
| `regulated` | The `standard` evidence, plus CODEOWNERS armed as the rung-1 enhancement where the substrate allows it |

The agent-identity set MUST be resolved from `governance.reviewActors`, the key
`brain-writes-reviewed` already reads — no new identity list.

#### Scenario: a solo human's brain/core edit passes at lite

- GIVEN `governance.tier: "lite"` and a `brain/core/**` change authored by the human maintainer
- WHEN `brain-writes-reviewed` runs
- THEN it passes on agent-authorship exclusion

#### Scenario: an agent-authored brain/core edit fails at every tier

- GIVEN any tier and a `brain/core/**` change whose author is in `governance.reviewActors`
- WHEN `brain-writes-reviewed` runs
- THEN it fails — agent containment does not tier
