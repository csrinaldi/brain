# ADR-0026 — Governance Doctrine Tiers: A Declared Axis Orthogonal to the Detected Substrate Ladder

**Status**: Accepted · **amended 04/08/2026** (Amendment 1 — see below)  
**Date**: 31/07/2026 — Cristian Rinaldi

## Context

ADR-0015 established six enforcement levels (L1–L6) over observable evidence and a
four-rung substrate ladder, with one global doctrine: five `REQUIRED_JOBS`, three
`DETECTION_JOBS`, four mandatory SDD artefacts, a 400-line diff budget. That doctrine
was authored for exactly one repo shape, and two structural contradictions have since
been observed that no implementation work can resolve:

1. **#329** — `actor-check` (L5) requires the `status:approved` actor to differ from the
   PR author. #124 requires the maintainer personally to apply that label. At one
   maintainer both are correct and mutually unsatisfiable; the gate can never pass. It
   is not misfiring — it is correctly reporting a condition the repo's own operating
   model guarantees. This blocked the whole detection→prevention promotion, because the
   documented "one-line move" from `DETECTION_JOBS` to `REQUIRED_JOBS` would make the
   repo permanently unmergeable for its own maintainer.
2. **#94** — branch protection returns `403` on brain's free-tier private repo, so the
   five "required" contexts have no substrate that requires them.

A third contradiction was found while resolving Q5 and is **recorded here for the first
time**: `brain-writes-reviewed` (L6) requires "an APPROVED review from a non-author,
non-bot human." That is **as unsatisfiable at one maintainer as `actor-check`'s
distinctness rule.** The Q5 recommendation in epic #313 asserts that
`brain-writes-reviewed` "never tiers" while its shipped evidence form cannot be
satisfied at the tier that most needs it. The same defect, one level deeper, unnoticed.

All three are one root cause: **brain conflates what a substrate CAN enforce with what
a team CHOOSES to be bound by.** The rung ladder already answers the first question, by
detection, and never lies about it (`verifiable: false` marks anything backed only by a
config declaration). Nothing answers the second.

## Decision

Introduce a second governance axis: a **declared** doctrine tier, orthogonal to the
**detected** substrate rung.

| Axis | Source | Question | Values |
|---|---|---|---|
| **Rung** (ADR-0015) | detected, never declared | WHERE fail-closed can live | 1 merge · 2 release · 3 auto-correct · 4 floor |
| **Tier** (this ADR) | declared, never detected | WHICH invariants are load-bearing, and on what evidence | lite · standard · regulated |

`governance.tier` is consumer config, defaulting to `standard` (behaviourally identical
to brain's pre-tier doctrine, so the migration is a no-op for every existing consumer).
The axes compose and neither may mask the other:
`brain:governance-status` reports both separately and renders their cross-product per
gate — a gate required by doctrine on a substrate that cannot block is surfaced as
"required by doctrine, detection-only in substrate", never as armed.

### The three tiers

| Tier | Operating model | What it buys |
|---|---|---|
| **lite** | Solo maintainer, experiment, internal tool. A bad merge is reversible by the person who made it. Two-human constraints are unsatisfiable by construction. | Traceability, correctness, agent containment, a reviewable slice — and a *passing* approval gate. |
| **standard** | Small team (n≥2), product code with external users. A bad merge is real but bounded. | Everything in lite, plus full artefact discipline, memory capture, distinct-actor approval, and a blocking release gate. **The default.** |
| **regulated** | Audited/compliance context or high-blast-radius infrastructure. A bad merge has external, sometimes legal cost. | Everything in standard, plus non-waivable constraints, a recorded verification artefact, auto-correction, and panel review. |

Three, not two: two tiers leave nowhere to put the constraints brain deliberately does
*not* impose on a normal team but which are the entire reason an audited shop would
adopt a governance layer. Three, not four: each tier costs a maintained matrix column,
docs, and a test axis, and at zero external adopters a fourth is speculative.

### Two tiering mechanisms — the load-bearing distinction

- **Position tiering** (`required` ⇄ `detection`) — used ONLY for proportionality:
  ceremony whose per-change cost is real and whose benefit scales with team size.
- **Evidence tiering** — the gate stays `required` at every tier; *what satisfies it*
  changes. Used when a gate belongs to the never-tiered core but one evidence form is
  structurally unsatisfiable at a tier's operating model.

Evidence tiering is what resolves #329 and its undocumented twin. It is strictly better
than the two options #329 itself proposed: the gate neither stops blocking nor stays
permanently red — it blocks, on evidence a solo maintainer can actually produce.

### Never-tiered by position (`required` at every tier); evidence may tier

| Gate | lite evidence | standard evidence | regulated evidence |
|---|---|---|---|
| `issue-link` | linked issue carries the approved label | same | same |
| `local-checks` | `repo:check` + `brain:nav` + `npm test` | same | same |
| `decision-gate` | ADR ⇔ `brain/HOME.md` co-occurrence | + the `decision`-label step hard | + the ADR carries a recorded human signature |
| `diff-size` | ≤ 1000, `size:exception` honored | ≤ 400, honored | ≤ 200, **not honored** |
| `actor-check` | **distinct act over foreign commits** (Amendment 1, #418) — the approval event is strictly later than the latest *foreign* commit: one authored by anyone other than the approver or a registered `governance.reviewActors` identity. Commits by the approver or a verified reviewer identity never re-arm an existing approval. An author that cannot be resolved to an account counts as **foreign** (fail closed). With no foreign commit on the branch, any approval event satisfies the evidence. | distinct act **+ distinct actor** — unchanged: the approval postdates the head-commit push | + the approver authored no commit on the branch — unchanged |
| `brain-writes-reviewed` | **agent-authorship exclusion** — no `governance.reviewActors` identity authored the `brain/**` change | non-author, non-bot **human** APPROVED review | + CODEOWNERS armed at rung 1 where the substrate allows |

The reviewer's `event: COMMENT` constraint (ADR-0020) is likewise never-tiered: **no
tier may grant the reviewer merge authority**, which would collide with L5 and #124.

### Tiered by position (proportionality)

| Gate | lite | standard | regulated |
|---|---|---|---|
| `memory-gate` | detection | required | required |
| `phase-order` | detection | required | required |
| release gate (rung 2) | detection | required | required |
| post-merge auto-revert (rung 3) | detection | detection | required |
| reviewer verdict recorded | — | detection | detection (panel ≥2) |

### Doctrine parameters

| Parameter | lite | standard | regulated |
|---|---|---|---|
| `phase-order` Rule A artefacts | `spec.md` | all four | all four + recorded verification artefact |
| diff budget | 1000 | 400 | 200 |
| `size:exception` honored | yes | yes | no |
| reviewer verdict mode | deterministic checks only | single engine | panel ≥2, consensus-gated |

### The seven tier invariants

1. **Monotonic ordinal** — `lite < standard < regulated`; nothing required at a lower
   tier is relaxed at a higher one. An unknown tier fails closed.
2. **A never-tiered core exists and is enumerated in code** — gates whose relaxation
   would make brain's claims false rather than merely weaker.
3. **No tier drops a gate below `detection`.** There is no `off`. `GOVERNANCE_JOBS`
   stays tier-independent: every job runs at every tier; only its exit policy and its
   branch-protection membership vary. This is the anti-pattern guard — tiers must never
   become a way to make an inconvenient red check disappear.
4. **Tier is declared, rung is detected, neither masks the other.** The tier is never
   inferred from platform capability, plan, visibility, or contributor count.
5. **Satisfiability** — a gate is never `required` at a tier whose own definition makes
   it structurally impossible to satisfy. Where the core conflicts with satisfiability,
   the *evidence* tiers and the *position* does not.
6. **Waivers are themselves tiered** — `size:exception` and the pre-existing
   allow-listed `override:*` label are honored at lite/standard and refused at
   regulated. A doctrine whose constraints the team can waive at will is a preference.
   Critically, `lite` MUST pass L5/L6 on its own evidence form with `override:*`
   **unused**: an override is a bypass, and a tier whose gates pass only by bypass has
   no doctrine.
7. **Proportionality bounds relaxation** — position tiering applies only to ceremony,
   never to correctness, traceability, agent containment, or internal consistency.

### brain declares `lite`

Explicitly in `brain.config.json`, as a recorded declaration and never by default.
Evidence: one maintainer (#329), free-tier private repo → `403` (#94) → detected rung 4.
The measured effect is that `actor-check` and `brain-writes-reviewed` move from
detection (one of them permanently red) to **required and passing**, while only
`memory-gate` moves to detection — and `memory-gate`'s check is already documented as
repo-global, identical for every merge in a window. **Declaring `lite` makes brain's
governance stronger, not weaker.**

### Divergence from the Q5 recommendation (requires ratification at promotion)

Epic #313's Q5 line recommends `standard = proposal + spec`. This ADR does **not** adopt
that: it contradicts ratified REQ-L4-2 (*"requires `spec.md` AND `design.md`, not just
`proposal.md` + `tasks.md`"*), a requirement that exists because `proposal + tasks` was
measured as insufficient. Since `standard` is the default tier, adopting the one-liner
literally would weaken the *default* doctrine as a side effect of a change whose purpose
is to make it more honest. `standard` therefore keeps all four artefacts, and
`regulated` earns its delta from a recorded verification artefact instead. The
compromise position, if preferred, is `standard = proposal + spec + design`.

## Consequences

- **Positive**: #329 resolves with a *passing* gate rather than a documented warn — the
  outcome its own acceptance criteria hoped for but did not expect.
- **Positive**: the detection→prevention promotion becomes decidable. `actor-check` and
  `brain-writes-reviewed` can be promoted at every tier (with tiered evidence);
  `phase-order` at standard/regulated only. The blocked global question dissolves into
  three per-tier answers.
- **Positive**: #94 decouples. The doctrine question is answered independently of which
  GitHub plan brain buys; brain can stay at rung 4 with a truthful, non-red report.
- **Positive**: brain becomes honest about the two axes for the first time. Today it
  runs a standard-shaped doctrine at rung 4 while one of its gates can never pass.
- **Positive**: `#284` (reviewer v2 refuter) is reframed from a nice-to-have into
  `regulated`'s enabling work.
- **Positive**: the concept has a fail-closed guard — a new governance job with no tier
  row turns the drift-guard test red, so adding a gate forces a tier decision.
- **Negative (honest residual)**: `standard` and `regulated` are **unexercised**. brain
  can only run `lite`. Their validation requires an n≥2 adopter; until then they are
  specified and tested, not proven.
- **Negative (honest residual)**: `regulated` is unsatisfiable on GitLab today — its
  rung-3 auto-revert obligation is GitHub-only (#130).
- **Negative (precondition)**: `lite`'s distinct-act evidence is a timestamp comparison
  and therefore **blocked on #328** (gate verdicts computed before the approval exists).
  Conversely, it is the cleanest available fix for #328's stale-green class: the check
  can no longer pass without observing an event that postdates the code.
  **[Amended by Amendment 1 (#418) — the comparison target moved from the head commit
  to the latest *foreign* commit at `lite`. The stale-green property is retained against
  every actor whose work the approver has not seen.]**
- **Negative (precondition, easy to skip)**: `phase-order`'s promotion still carries
  ADR-0015's recorded precondition — fail-close its uncomputable-diff branch first, or
  a false positive becomes a hard block.
- **Negative (pre-existing, now load-bearing)**: the `override:*` allowlist is read
  from `governance.approvalActors` — the same key that grants an identity the right to
  apply `status:approved`. The code's own comments flag this dual-semantics smell.
  Tier-scoping the override makes the overload load-bearing; splitting the key into a
  dedicated `governance.overrideLabels` should be considered in the same slice.
- **Negative (pre-existing, now load-bearing)**: `decision-gate`'s shipped check
  (unconditional ADR ⇔ `brain/HOME.md` co-occurrence) does not match its documentation
  (label-conditional with a heuristic second step). The `standard` evidence row above
  describes the documented behaviour. This divergence must be resolved before that row
  means anything.
- **Negative**: three tiers is three matrix columns to maintain, three docs paths, and a
  test axis on every tiered gate. Accepted as the cost of not shipping one doctrine that
  fits nobody.

## Amendment 1 — `lite` distinct-act re-arms only on foreign commits (issue #418)

**Signed**: 04/08/2026 — Cristian Rinaldi

The original `lite` evidence compared the approval event against the head-commit push.
Measured cost (#418, during #396): five pushes required five re-applications of
`status:approved`, and each fresh signature certified nothing the approver did not
already know — at `lite` the approver is *allowed* to be the author, so the check
degrades from "did someone slip work past the reviewer" to "did you keep working on
your own branch". The cost scales linearly with iteration count; the security value at
n=1 is near zero. It also structurally blocks the automated review loop (#409): every
agent fix-push would demand a fresh human signature, defeating the automation it gates.

Amended rule at `lite`: a push **re-arms** the approval requirement only when its author
is *foreign* — neither the approver nor a registered `governance.reviewActors` identity.
Uncomputable authorship is foreign (fail closed). The stale-green property #328 fixed is
retained against every actor whose work the approver has not seen: any third-party push
still invalidates the approval.

`standard` and `regulated` are untouched. There the approver is never the author, so
"did the code change after approval?" genuinely asks *did someone slip work past the
reviewer* — a property worth its cost.

**Precondition, satisfied:** #413 (PR #424) — the reviewer identity is now verified
against the token. The `reviewActors` exemption is only safe with a verifiable
identity; before #413 anyone holding any token could *declare* themselves the bot.

### Accepted losses, recorded rather than implied

1. **The n=1 "final state" look is gone.** A solo maintainer can approve once and keep
   pushing. This is the point of the amendment, and it is a real loss — the old rule did
   force a glance at the final state. Judged near-zero value against linear cost.
2. **A `reviewActors` identity can push after approval without re-arming.** Bounded
   three ways: the identity is verifiable (#413), it is registered by the owner in
   config (an L6-only key that never grants approval, per the L5/L6 separation), and
   `brain-writes-reviewed` still fails any `brain/**` change authored by a reviewer
   identity at every tier. Residual: for non-`brain/**` paths the bot could land
   post-approval content that no human re-signed. The recorded retreat position, if that
   residual proves unacceptable, is to drop the `reviewActors` exemption and keep only
   the approver exemption.

### Honest residuals

- **GitLab gets no relief.** `prCommits()` on GitLab cannot resolve commit authors to
  accounts (`login: null`, the documented residual) — every author is uncomputable ⇒
  foreign ⇒ the behaviour on GitLab is exactly the pre-amendment one. Honest and safe,
  but unequal across providers until the GL authorship residual is solved.
- **Unattributed authors get no relief either.** Commits authored as
  `Claude <noreply@anthropic.com>` (this repo's own agent-session convention) do not
  resolve to the approver's account ⇒ foreign ⇒ re-arm. The amendment relieves exactly
  the commits attributed to the approver's account or to a registered reviewer identity.
  The operator-side remedy is to attribute session commits to an account in one of the
  two exempt sets; the fail-closed default is correct without it.
- **The exemption set is config.** Whoever can edit `governance.reviewActors` can mint a
  non-re-arming identity. The trust model is unchanged — that key already gates L6 — but
  this amendment raises what the key buys.

### Alternatives rejected

- **Approval scoped to PR creation rather than head** — stable, but drops the "you
  approved the final state" property at *every* tier.
- **Content-scoped re-arming** (docs/test-only commits do not re-arm) — fragile, gameable.
- **Document the cost and accept it** — viable only while every push is human; #409's
  automated reviewer loop ends that.

## References

- `openspec/changes/issue-358-q5-doctrine-tiers/proposal.md` — the two-axis framing.
- `openspec/changes/issue-358-q5-doctrine-tiers/spec.md` — REQ-TIER-1..11 and the
  tier-scoped REQ-L4-2′ / REQ-L5-1′ / REQ-L6-1′.
- `openspec/changes/issue-358-q5-doctrine-tiers/design.md` — §1 rejected alternatives,
  §2 the full matrix, §3 the divergence, §4 the #329 resolution and promotion verdicts,
  §5 the measured cost of brain declaring `lite`, §6 T2.1 scoping, §7 M3 impact,
  §8 the implementation seam.
- `openspec/changes/issue-418-lite-distinct-act-rearm/` — Amendment 1's proposal, spec
  (REQ-418-1..7), design, and the signed draft in `brain-drafts/`.
- [ADR-0015](adr-0015-governance-v3-substrate-ladder.md) — the six levels and the
  four-rung ladder this ADR adds a second, orthogonal axis to. **Amended**: REQ-L4-2
  (artefact set tier-scoped), REQ-L5-1 (evidence tiered), REQ-L6-1 (evidence tiered),
  REQ-HONESTY-1/2 (extended to report tier alongside rung). The
  `REQUIRED_JOBS`/`DETECTION_JOBS` two-bucket registry is generalized to a
  `(gate × tier) → policy` function; `GOVERNANCE_JOBS` is unchanged.
- [ADR-0014](adr-0014-workflow-governance.md) — the enforce-outputs / guide-judgment
  boundary. Preserved: `regulated` enforces the review *artefact*, never the tool.
- [ADR-0020](adr-0020-reviewer-port-verbs-and-two-key-split.md) — `event: COMMENT` and
  the `reviewActors`/`approvalActors` split. Both preserved; `event: COMMENT` is added
  to the never-tiered core, and `reviewActors` is reused as `lite`'s L6 identity set —
  and, under Amendment 1, as `lite`'s non-re-arming push identity set.
- [ADR-0013](adr-0013-auto-adr-onboarding.md) — the Tier-2 draft → human-review →
  promotion flow this ADR itself follows.
- Issues: #358 (Q5), #329 (the blocker resolved), #94 (decoupled), #328 (precondition),
  #124 (preserved), #130 (regulated's GitLab gap), #284 (regulated's enabling work),
  #317 (tier-independent, lands first), #313 (epic), **#418 (Amendment 1)**,
  **#413 (Amendment 1's precondition)**.
