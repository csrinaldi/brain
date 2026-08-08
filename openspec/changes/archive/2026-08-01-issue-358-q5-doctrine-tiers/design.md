# Design: Governance Doctrine Tiers

Issue: #358 (Q5). Reads: `proposal.md`, `spec.md`. Unblocks: #329, #94, T2.1, M3.

## §0 — What is actually broken

The current doctrine is a single global constant pair:

```js
// brain/scripts/vcs/governance-checks.mjs:24,33
export const REQUIRED_JOBS  = ['issue-link', 'diff-size', 'local-checks', 'memory-gate', 'decision-gate'];
export const DETECTION_JOBS = ['phase-order', 'actor-check', 'brain-writes-reviewed'];
```

`checkContexts()` returns `REQUIRED_JOBS` verbatim, `brain:protect` arms exactly that,
and the detection→prevention flip is documented as "a one-line move" between the two
arrays. That design is correct and it is also stuck: the one-line move is *globally*
unsafe. Promoting `actor-check` deadlocks every solo repo including brain's own (#329).
Promoting `brain-writes-reviewed` deadlocks them identically — and this second
contradiction is **not recorded anywhere**, including in the Q5 recommendation, which
asserts "brain-writes-reviewed never tiers" while its shipped evidence (an APPROVED
review from a non-author human, `brain/scripts/vcs/brain-writes-reviewed.mjs`) is
exactly as unsatisfiable at n=1 as `actor-check`'s. This design surfaces it as a
first-class finding.

Two more facts frame the solution:

- **The rung ladder already solved the capability half.** `detectSubstrate` is a pure
  orchestrator over injected probes returning `{rung, enforced, reason, remedy, rungs}`;
  rungs are *detected*, never declared, and `verifiable:false` marks anything backed
  only by a config declaration. That honesty discipline is the model to copy, not
  replace.
- **The parameters are already scattered literals.** `400` exists three times
  (`diff-size.mjs:7` default, `governance.yml:126` bash comparison,
  `hooks/pre-push:59`), and no config key changes any of them. Tiering a value that
  has three independent definitions would silently apply to one of them.

## §1 — Alternatives considered and rejected

| Alternative | Why rejected |
|---|---|
| **`governance.soloMaintainer: true`** (#329 option 1 as literally written) | A self-serve escape hatch: any repo can set it to dodge `actor-check` while still claiming full doctrine. It is also a second axis serving one gate, and it makes team size a *declaration* when the whole point of the rung ladder was that structural facts get detected. Tier subsumes it honestly: `lite` is the tier whose operating model is n=1, and it says so about the doctrine, not about the people. |
| **Per-gate overrides** (`governance.gates.actorCheck: "warn"`) | Maximum flexibility, zero reviewability. There is no table a reviewer can read to know what a repo is bound by, and every combination is a supported configuration to test. Config soup. |
| **A tier may set a gate to `off`** | Turns tiers into a way to make red checks disappear — precisely the credibility erosion #329 warns about in its own option 3. Forbidden by REQ-TIER-3. |
| **Two tiers (lite / standard)** | Leaves nowhere to put constraints brain deliberately does *not* want to impose on a normal team (non-waivable budget, full artefact trail, panel review) but which are the entire reason an audited shop would adopt a governance layer. |
| **Four or more tiers** | Each tier costs a maintained matrix column, docs, and a test axis. At zero external adopters a fourth is speculative. Three is the minimum covering the observed shapes; REQ-TIER-1's ordinal makes adding one later additive. |
| **Infer the tier from the substrate** (403 ⇒ lite) | Collapses the two axes back into one and re-creates the exact defect: doctrine strength stops being a choice and platform billing starts deciding what the team is bound by. Forbidden by REQ-TIER-4. |

## §2 — The gate distribution matrix

Two distinct tiering mechanisms, deliberately separated. Getting this split right is
the whole decision.

- **Position tiering** — `required` ⇄ `detection`. Used only for proportionality
  (REQ-TIER-7): ceremony whose cost is per-change and whose benefit scales with team size.
- **Evidence tiering** — the gate is `required` at every tier; *what satisfies it*
  changes. Used for the never-tiered core (REQ-TIER-2) when a tier's operating model
  makes one evidence form structurally unsatisfiable (REQ-TIER-5).

### §2.A — Never-tiered by position (`required` at all three tiers); evidence may tier

| Gate | Level | lite evidence | standard evidence | regulated evidence |
|---|---|---|---|---|
| `issue-link` | inv 1 | linked issue carries `governance.approvedLabel` | same | same |
| `local-checks` | L1 | `repo:check` + `brain:nav` + `npm test` | same | same |
| `decision-gate` | L3 | ADR ⇔ `brain/HOME.md` co-occurrence | same, plus the `decision`-label step hard | same, plus the ADR carries a recorded human signature |
| `diff-size` | inv 2 | ≤ **1000**, `size:exception` honored | ≤ **400**, honored | ≤ **200**, **not** honored |
| `actor-check` | L5 | **distinct act** — approval event strictly after the head-commit push | distinct act **+ distinct actor** | distinct act + approver authored **no commit** on the branch |
| `brain-writes-reviewed` | L6 | **agent-authorship exclusion** — no `governance.reviewActors` identity authored the `brain/**` change | non-author, non-bot **human** APPROVED review | standard evidence + CODEOWNERS armed at rung 1 where the substrate allows |

`actor-check` and `brain-writes-reviewed` are the two rows that resolve #329 and its
undocumented twin. Note what evidence tiering buys: **the gate stays green-able and
meaningful at every tier**, which is strictly better than #329's own options 1 and 3
(both of which end in a gate that either does not block or is permanently red).

### §2.B — Tiered by position (proportionality)

| Gate | Level | lite | standard | regulated | Why the delta is proportionality, not safety |
|---|---|---|---|---|---|
| `memory-gate` | L3 | **D** | R | R | Capture discipline is a *team-continuity* property. A solo maintainer's continuity risk is their own to carry. |
| `phase-order` | L4 | **D** | R | R | Artefact ceremony. The artefact *set* is also tiered (§3). |
| release gate (rung 2) | L2 | **D** | R | R | Requires the repo to control its own release path; a lite experiment may have no release. |
| post-merge auto-revert (rung 3) | L2 | **D** | **D** | R | A regulated tier must *auto-correct*, not merely report. This is `regulated`'s one exclusive rung obligation. |
| reviewer verdict recorded | M3 | — | **D** | **D** | Never `required` at any tier — see §7. |

`D` = runs, reports, exits 0 with a warning annotation naming the tier as the reason
(REQ-TIER-3). Never absent, never silent.

### §2.C — Doctrine parameters (not CI jobs)

| Parameter | lite | standard | regulated |
|---|---|---|---|
| `phase-order` Rule A artefact set | `spec.md` | all four (`proposal`/`spec`/`design`/`tasks`) | all four + recorded verification artefact |
| diff budget | 1000 | 400 | 200 |
| `size:exception` honored | yes | yes | **no** |
| `skip:memory-gate` honored | n/a (`memory-gate` is D) | yes | **no** |
| `override:*` honored (L5/L6 bypass) | yes | yes | **no** |
| reviewer verdict mode | deterministic checks only | single engine | **panel ≥2**, consensus-gated |
| approval evidence | distinct act | distinct act + actor | + no-commit-on-branch |

**The `override:*` trap.** `actor-check` and `brain-writes-reviewed` already ship an
allow-listed `override:*` label escape hatch (`brain-writes-reviewed.mjs:93-97,250` —
honored only when the label is BOTH present and listed in `governance.approvalActors`).
It is the reason #329 has not deadlocked the repo in practice. It must NOT become
`lite`'s answer: an override is a *bypass*, and a tier whose gates pass only by bypass
has exactly the credibility problem #329's option 3 was rejected for. `lite` passes on
its own evidence form with `override:*` unused; `regulated` refuses the label entirely.
The override survives as what it is — a logged emergency valve, not a tier.

## §3 — Deliberate divergence from the Q5 one-liner (needs human ratification)

Issue #358's recommendation reads: *"lite (spec, 1000 budget, deterministic), standard
(proposal+spec, 400 budget, single engine), regulated (all 4 artefacts, 200 budget,
panel ≥2)."*

The matrix above matches it on every axis **except one**: `standard`'s artefact set.

**The problem.** `proposal + spec` for `standard` directly contradicts ratified
**REQ-L4-2**, whose text is *"Gate requires `spec.md` AND `design.md` to exist, not
just `proposal.md` + `tasks.md`"*. That requirement exists precisely because
`proposal + tasks` was measured as insufficient. Since `standard` is the default tier
(REQ-TIER-10), adopting the one-liner literally would make the *default* doctrine
weaker than today's shipped behaviour, and it would do so as a side effect of a
change whose stated purpose is to make the doctrine *more* honest. That is exactly
the silent-weakening class this decision is supposed to close.

**Recommendation.** `standard` keeps all four artefacts (today's Rule A, unchanged),
and `regulated` earns its delta from a **recorded verification artefact** instead —
proof that the spec was checked against the implementation, which is the artefact an
external auditor actually asks for. This also gives `regulated` a non-cosmetic
artefact obligation rather than a number tweak.

## §4 — #329 resolution recommendation

**Resolve #329 as option 1 ∧ option 2, implemented as evidence tiering on
`governance.tier` — not as a `soloMaintainer` boolean.**

Mapping to #329's four options:

| #329 option | Verdict |
|---|---|
| 1 — make the constraint tier-aware | **Adopted in substance**, rejected in form. The tier-awareness is real; the `governance.soloMaintainer` flag is not the vehicle (§1). And the degradation is *not* to `warn` — the gate keeps blocking, on satisfiable evidence. |
| 2 — replace "distinct actor" with "distinct act" | **Adopted, as `lite`'s evidence form** — and kept *additive* at higher tiers, not a replacement. #329 is right that the intent being protected is deliberateness, not headcount; that intent is satisfiable at n=1. |
| 3 — accept and document | **Rejected as written.** A permanently-red check trains people to ignore checks (#329's own argument). But note its honest residue survives: nothing is hidden, the verdict states the tier and the evidence form it used. |
| 4 — require two maintainers | **Rejected as a product decision** — that is precisely what `standard` says. `lite` exists so that `standard` is not the only way to adopt brain. |

**Hard precondition: #328 must land first.** `lite`'s distinct-act evidence is a
timestamp comparison between the `status:approved` label-add event and the head
commit's push. #328 is exactly the bug that gate verdicts are computed before the
approval exists — so without #328 the new evidence form reads a timestamp that is not
yet there and fails closed on every PR. Sequence: **#328 → implement REQ-L5-1′ →
promote.** Conversely, this evidence form is the cleanest available fix for #328's
*stale-green* class, because the check can no longer pass without observing an event
that postdates the code.

### §4.1 — The gate-promotion unblock (what #329 was actually blocking)

The blocked decision was: *may `DETECTION_JOBS` be promoted to `REQUIRED_JOBS`?*
Under tiers it stops being one global question:

| Job | Promotion verdict | Precondition |
|---|---|---|
| `actor-check` | **Promote to `required` at all three tiers**, with tiered evidence | #328 fixed; REQ-L5-1′ implemented |
| `brain-writes-reviewed` | **Promote to `required` at all three tiers**, with tiered evidence | REQ-L6-1′ implemented (lite evidence form) |
| `phase-order` | **Promote at `standard`/`regulated`; stays `detection` at `lite`** | ADR-0015's own recorded precondition: fail-close `phase-order`'s uncomputable-diff branch first (it currently degrades to warn/exit 0). Skipping this converts a false positive into a hard block. |

`REQUIRED_JOBS` stops being a constant and becomes `requiredJobs(tier)` derived from
the matrix. `GOVERNANCE_JOBS` stays a tier-independent union so the existing
drift-guard against `governance.yml` keeps working unchanged — the workflow defines
every job at every tier (REQ-TIER-3).

**#94 also unblocks**, in a way worth naming: the tier decision does not make branch
protection reachable on a free-tier private repo, but it removes the reason the tier
question was entangled with the plan question. #94 becomes a narrow, honest choice
about which *rung* brain buys, with the doctrine question already answered
independently. brain can stay at rung 4 and still have a truthful, non-red report.

## §5 — brain's own tier, and the honest cost of declaring it

brain declares **`lite`**, explicitly in `brain.config.json` (a recorded declaration,
never the default). The evidence: one maintainer (#329), free-tier private repo →
`403` on branch protection (#94) → detected rung 4. It structurally cannot arm rung 1
nor satisfy `standard`'s distinct-actor evidence.

Measured cost of that declaration, gate by gate — this is the number that decides
whether `lite` is respectable or a wasteland:

| Gate | brain today | brain at `lite` | Real change |
|---|---|---|---|
| `issue-link` | R | R | none |
| `local-checks` | R | R | none |
| `decision-gate` | R | R | none |
| `diff-size` | R @400 | R @1000 | budget loosens; brain may prefer to keep 400 by declaring `standard`-equivalent — but see below |
| `actor-check` | D — fails, or passes only via `override:*` | **R, passing on evidence** | **strict improvement** |
| `brain-writes-reviewed` | D — same bypass dependency | **R, passing on evidence** | **strict improvement** |
| `phase-order` | D | D | none |
| `memory-gate` | R | **D** | the only genuine loss |

The only real loss is `memory-gate`, and `workflow-governance.md` already documents
that its check is repo-global (`memoryPresence` at HEAD), identical for every merge in
a window — a constant masquerading as a per-merge gate. Demoting a constant to
detection loses close to nothing measurable. Meanwhile two gates go from
detection (one of them permanently red) to *passing and blocking*. **Declaring `lite`
makes brain's governance stronger, not weaker** — which is the sanity check that the
matrix is honest rather than a rationalization.

## §6 — T2.1 gate-scoping guidance (the unblock)

T2.1 ("memory retrieval", an M3 precondition) has **no GitHub issue** — it exists only
inside #313's body, sourced from an uncommitted planning doc. Its blocking dependency
on Q5 was: *does memory retrieval need to know which tier requires what?*

**Answer: T2.1 may start now.** Four rules, and none of them require the tier matrix
to be implemented first — they require only that `memory-gate`'s position stops moving
under T2.1, which this decision fixes.

1. **T2.1 does not change `memory-gate`'s required-ness.** It changes the check's
   *precision*, not its position. `memory-gate` is `D` at `lite` and `R` at
   `standard`/`regulated` before and after T2.1. Build against that, not against
   today's global `R`.
2. **Retrieval itself is never tiered.** Retrieval is a *read* capability with no
   enforcement semantics. What tiers is what the gate **asserts over the retrieved
   set**.
3. **T2.1 MUST land `issue`-field population, or the standard-tier assertion is a
   landmine.** `brain-metrics` already measures memory-record `issue`-field coverage
   and labels it *"adoption pending"* — near 0% across brain's own history. Promoting
   `memory-gate` to a per-change assertion at `standard` before coverage is measurably
   non-zero would red every PR in every repo.
4. **T2.1 ships the per-change check as `detection`-capable with a tier parameter.**
   The flip to `required` at `standard` is a separate one-line matrix move, gated on
   measured non-zero coverage. Do not couple T2.1's merge to that flip.

## §7 — M3 reviewer-gate impact

| Concern | Tier impact |
|---|---|
| **#317 (`prReviews` strips `body`)** | **Tier-independent, and it lands first.** `priorVerdicts` is always empty at *every* tier, so anti-loop, the rev≥3 bound, and board reconciliation are inert everywhere. Tiers do not help — it is a seam bug. |
| **#284 (reviewer v2: refuter + causal admission)** | **Reframed by this decision.** Under tiers they become **`regulated`'s enabling work** — the panel-≥2 consensus mode. #284 stops being a nice-to-have and becomes the reason the top tier exists. |
| **Reviewer merge authority** | **Never tiered.** `event: COMMENT` (ADR-0020) is a REQ-TIER-2 member. No tier may make the reviewer an approver. |
| **Reviewer as a governance job** | **Never `required`, at any tier.** At `standard`/`regulated` the reviewer verdict is `detection`. |
| **How does `regulated` enforce panel review, then?** | By enforcing the **artefact**, not the tool: the recorded verification artefact (§2.C) must exist. This is ADR-0014's enforce-outputs / guide-judgment boundary applied unchanged. |

## §8 — Implementation seam

New pure module `brain/scripts/vcs/governance-tiers.mjs` — no I/O at import, mirroring
`substrate.mjs`'s discipline:

```js
export const TIERS = Object.freeze(['lite', 'standard', 'regulated']);      // ordinal
export const NEVER_TIERED = Object.freeze([...]);                            // REQ-TIER-2
export const GATE_MATRIX = Object.freeze({ /* gate → { lite, standard, regulated } */ });

export function resolveTier(config)                  // fail-closed on unknown (REQ-TIER-1)
export function resolveGatePolicy(gate, tier)        // 'required' | 'detection'
export function resolveGateEvidence(gate, tier)      // the evidence-form tag
export function tierParams(tier)                     // { diffBudget, artefacts, honorSizeException, ... }
export function requiredJobs(tier)                   // derived, replaces the REQUIRED_JOBS constant
```

Wiring, one call site per surface:

| Surface | Change |
|---|---|
| `governance-checks.mjs` | `checkContexts(tier)` → `requiredJobs(tier)`. `GOVERNANCE_JOBS` stays the tier-independent union; existing drift-guard untouched. |
| `run-check.mjs` / each checker | Map `detection` → exit 0 + `::warning::` naming the tier. One helper, not per-job logic. |
| `brain-protect.mjs` | Arm `checkContexts(resolveTier(config))`. |
| `brain-governance-status.mjs` | Print `tier <t> (declared) · rung <n> (detected)` and the per-gate cross-product (REQ-TIER-11). |
| `diff-size.mjs` | `budget = tierParams(tier).diffBudget`; **delete** the `400` in `governance.yml:126` and `hooks/pre-push:59` (REQ-TIER-9). |
| `phase-order-check.mjs` | Rule A artefact set from `tierParams(tier).artefacts`. |
| `actor-check.mjs` · `brain-writes-reviewed.mjs` | Branch on `resolveGateEvidence(...)`. |
| `config-migrations.mjs` | `0.9.0` entry: `governance.tier: "standard"` (the top migration today is `0.8.0`). |
| `brain.config.json` | brain sets `"tier": "lite"` explicitly. |

Both consumer surfaces derive from `resolveGatePolicy` (REQ-TIER-9) — the exit policy
and the branch-protection list cannot disagree by construction.

## §9 — Open risks and honest residuals

- [ ] **`standard` and `regulated` are unexercised.** brain can only run `lite`.
      Validation needs an n≥2 adopter. Stated in the ADR's consequences, not hidden.
- [ ] **§3's divergence from the Q5 one-liner needs explicit human ratification**
      before the matrix is treated as settled.
- [ ] **#328 is a hard precondition** for REQ-L5-1′. Do not implement the lite
      evidence form before it.
- [ ] **`phase-order`'s uncomputable-diff branch must fail closed** before promotion
      at `standard` — ADR-0015 records this precondition explicitly and flags it as
      easy to skip.
- [ ] **`skip:memory-gate` is honored by no code.** Its tier column specifies a label
      that must first be made real, or be removed from the docs.
- [ ] **`decision-gate`'s shipped check does not match its documentation.**
      `adr-presence.mjs` is an unconditional ADR ⇔ `HOME.md` co-occurrence check;
      `workflow-governance.md` describes it as label-conditional with a heuristic
      second step.
- [ ] **`override:*`'s allowlist is read from `governance.approvalActors`** — the same
      key that authorizes applying `status:approved`. The code comments already flag
      this dual-semantics smell; tier-scoping the override makes it load-bearing.
      Consider splitting into a dedicated `governance.overrideLabels`.
- [ ] **Regulated's rung-3 obligation is GitHub-only.** Post-merge auto-revert has no
      GitLab implementation (#130). A regulated GitLab adopter cannot satisfy its own
      tier today — record it in `KNOWN-LIMITATIONS.md`.
