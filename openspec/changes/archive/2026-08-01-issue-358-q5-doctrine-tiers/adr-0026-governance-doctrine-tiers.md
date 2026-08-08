# ADR-0026 — Governance Doctrine Tiers: A Declared Axis Orthogonal to the Detected Substrate Ladder

**Status**: Accepted  
**Date**: 30/07/2026 — drafted for Cristian Rinaldi, promoted to Accepted per orchestrator instructions

## Context

ADR-0015 established six enforcement levels (L1–L6) over observable evidence and a
four-rung substrate ladder, with one global doctrine: five `REQUIRED_JOBS`, three
`DETECTION_JOBS`, four mandatory SDD artefacts, a 400-line diff budget. That doctrine
was authored for exactly one repo shape, and two structural contradictions have since
been observed that no implementation work can resolve:

1. **#329** — `actor-check` (L5) requires the `status:approved` actor to differ from the
   PR author. #124 requires the maintainer personally to apply that label. At one
   maintainer both are correct and mutually unsatisfiable; the gate can never pass.
2. **#94** — branch protection returns `403` on brain's free-tier private repo, so the
   five "required" contexts have no substrate that requires them.

A third contradiction was found while resolving Q5 and is recorded here for the first
time: `brain-writes-reviewed` (L6) requires "an APPROVED review from a non-author,
non-bot human." That is **as unsatisfiable at one maintainer as `actor-check`'s
distinctness rule.** 

All three are one root cause: **brain conflates what a substrate CAN enforce with what
a team CHOOSES to be bound by.** The rung ladder already answers the first question, by
detection. Nothing answers the second.

## Decision

Introduce a second governance axis: a **declared** doctrine tier, orthogonal to the
**detected** substrate rung.

| Axis | Source | Question | Values |
|---|---|---|---|
| **Rung** (ADR-0015) | detected, never declared | WHERE fail-closed can live | 1 merge · 2 release · 3 auto-correct · 4 floor |
| **Tier** (this ADR) | declared, never detected | WHICH invariants are load-bearing, and on what evidence | lite · standard · regulated |

`governance.tier` is consumer config, defaulting to `standard` (behaviourally identical
to brain's pre-tier doctrine, so the migration is a no-op for every existing consumer).
The axes compose and neither may mask the other.

### The three tiers

| Tier | Operating model | What it buys |
|---|---|---|
| **lite** | Solo maintainer, experiment, internal tool. | Traceability, correctness, agent containment, a reviewable slice — and a *passing* approval gate. |
| **standard** | Small team (n≥2), product code with external users. | Everything in lite, plus full artefact discipline, memory capture, distinct-actor approval, and a blocking release gate. **The default.** |
| **regulated** | Audited/compliance context or high-blast-radius infrastructure. | Everything in standard, plus non-waivable constraints, a recorded verification artefact, auto-correction, and panel review. |

### Two tiering mechanisms

- **Position tiering** (`required` ⇄ `detection`) — used ONLY for proportionality:
  ceremony whose per-change cost is real and whose benefit scales with team size.
- **Evidence tiering** — the gate stays `required` at every tier; *what satisfies it*
  changes. Used for the never-tiered core when a tier's operating model makes one
  evidence form structurally unsatisfiable.

Evidence tiering resolves #329 and its undocumented twin. The gate neither stops blocking
nor stays permanently red — it blocks, on evidence a solo maintainer can actually produce.

### Never-tiered by position (`required` at every tier); evidence may tier

| Gate | lite evidence | standard evidence | regulated evidence |
|---|---|---|---|
| `issue-link` | linked issue carries the approved label | same | same |
| `local-checks` | `repo:check` + `brain:nav` + `npm test` | same | same |
| `decision-gate` | ADR ⇔ `brain/HOME.md` co-occurrence | + the `decision`-label step hard | + the ADR carries a recorded human signature |
| `diff-size` | ≤ 1000, `size:exception` honored | ≤ 400, honored | ≤ 200, **not honored** |
| `actor-check` | **distinct act** — approval event strictly after head-commit push | distinct act **+ distinct actor** | + approver authored no commit on the branch |
| `brain-writes-reviewed` | **agent-authorship exclusion** | non-author, non-bot **human** APPROVED review | + CODEOWNERS at rung 1 where the substrate allows |

### Tiered by position (proportionality)

| Gate | lite | standard | regulated |
|---|---|---|---|
| `memory-gate` | detection | required | required |
| `phase-order` | detection | required | required |
| release gate (rung 2) | detection | required | required |
| post-merge auto-revert (rung 3) | detection | detection | required |

### Doctrine parameters

| Parameter | lite | standard | regulated |
|---|---|---|---|
| `phase-order` Rule A artefacts | `spec.md` | all four | all four + verification artefact |
| diff budget | 1000 | 400 | 200 |
| `size:exception` honored | yes | yes | no |
| reviewer verdict mode | deterministic checks only | single engine | panel ≥2, consensus-gated |

### The seven tier invariants

1. **Monotonic ordinal** — `lite < standard < regulated`; nothing required at a lower
   tier is relaxed at a higher one. An unknown tier fails closed.
2. **A never-tiered core exists and is enumerated in code** — gates whose relaxation
   would make brain's claims false rather than merely weaker.
3. **No tier drops a gate below `detection`.** There is no `off`. `GOVERNANCE_JOBS`
   stays tier-independent: every job runs at every tier; only its exit policy varies.
4. **Tier is declared, rung is detected, neither masks the other.** The tier is never
   inferred from platform capability, plan, visibility, or contributor count.
5. **Satisfiability** — a gate is never `required` at a tier whose own definition makes
   it structurally impossible to satisfy. Where the core conflicts with satisfiability,
   the *evidence* tiers and the *position* does not.
6. **Waivers are themselves tiered** — `size:exception` and the `override:*` label are
   honored at lite/standard and refused at regulated. `lite` MUST pass L5/L6 on its own
   evidence form with `override:*` **unused**.
7. **Proportionality bounds relaxation** — position tiering applies only to ceremony,
   never to correctness, traceability, agent containment, or internal consistency.

### brain declares `lite`

Explicitly in `brain.config.json`, as a recorded declaration and never by default.
Evidence: one maintainer (#329), free-tier private repo → `403` (#94) → detected rung 4.
The measured effect is that `actor-check` and `brain-writes-reviewed` move from
detection (one of them permanently red) to **required and passing**, while only
`memory-gate` moves to detection. **Declaring `lite` makes brain's governance stronger, not weaker.**

### Divergence from the Q5 recommendation

Epic #313's Q5 line recommends `standard = proposal + spec`. This ADR does **not** adopt
that: it contradicts ratified REQ-L4-2. Since `standard` is the default tier, adopting
the one-liner literally would weaken the *default* doctrine. `standard` therefore keeps
all four artefacts, and `regulated` earns its delta from a recorded verification artefact
instead.

## Consequences

- **Positive**: #329 resolves with a *passing* gate rather than a documented warn.
- **Positive**: the detection→prevention promotion becomes decidable per tier.
- **Positive**: #94 decouples. The doctrine question is answered independently of which
  GitHub plan brain buys.
- **Positive**: brain becomes honest about the two axes for the first time.
- **Positive**: the concept has a fail-closed guard — a new governance job with no tier
  row turns the drift-guard test red.
- **Negative (honest residual)**: `standard` and `regulated` are **unexercised**. brain
  can only run `lite`. Their validation requires an n≥2 adopter.
- **Negative (honest residual)**: `regulated` is unsatisfiable on GitLab today — its
  rung-3 auto-revert obligation is GitHub-only (#130).
- **Negative (precondition)**: `lite`'s distinct-act evidence is **blocked on #328** (gate
  verdicts computed before the approval exists). Conversely, it is the cleanest available
  fix for #328's stale-green class.
- **Negative (precondition)**: `phase-order`'s promotion carries ADR-0015's recorded
  precondition — fail-close its uncomputable-diff branch first.

## References

- `openspec/changes/issue-358-q5-doctrine-tiers/proposal.md` — the two-axis framing.
- `openspec/changes/issue-358-q5-doctrine-tiers/spec.md` — REQ-TIER-1..11.
- `openspec/changes/issue-358-q5-doctrine-tiers/design.md` — alternatives, full matrix,
  divergence, #329 resolution, promotion verdicts, cost measurement, T2.1 scoping, M3 impact.
- ADR-0015 — the six levels and the four-rung ladder. Amended: REQ-L4-2, REQ-L5-1,
  REQ-L6-1, REQ-HONESTY-1/2 (extended to report tier alongside rung).
- Issues: #358 (Q5), #329 (blocker resolved), #94 (decoupled), #328 (precondition),
  #124 (preserved), #130 (regulated's GitLab gap), #284 (regulated's enabling work).
