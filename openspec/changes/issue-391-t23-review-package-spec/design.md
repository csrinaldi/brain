---
status: draft
issue: 391
epic: 313
slice: T2.3
---

# Design — `brain-review/2` activation condition (issue #391, slice T2.3)

Reads: `proposal.md` (this change), `openspec/changes/issue-358-q5-doctrine-tiers/{design.md,spec.md,tasks.md}`
(Q5), `brain/core/methodology/reviewer-protocol.md` §6/§13, `brain/scripts/review/{cli.mjs,verdict.mjs,
cold-boot.mjs,lib/parse-verdict.mjs,lib/schema-v2.mjs,evaluators/refuter.mjs}`.

This document delivers proposal.md's deliverable 3: **the condition under which `brain-review/2`
would be selected, and how that condition composes with `governance.tier` (Q5)**. It does not
implement the wiring — no line in `cli.mjs` changes as a result of this document. It also does not
re-litigate Q5's tier matrix; it adds the one row Q5 left open (§4 below) and flags it, as the
proposal's own risk table requires, as a **new decision**, not a citation.

---

## 1. Executive summary

`brain-review/2` (`evidence_class`, `causal_disposition`, `follow_ups`, the hard admission rule) is
fully implemented and unit-tested, but **dead code in production**: `cli.mjs:204-216` calls
`buildVerdict({...})` without ever setting `protocol`, so `verdict.mjs:30`'s default
(`protocol = 'brain-review/1'`) is what every real run ships. There is exactly one call site where
activation could happen, and today it does not read `governance.tier` at all.

Q5 (#358) already answered the *strategic* question, in a section (§7) that does not mention T2.3
or #391 by name but is unambiguous about the shape of the answer: `/2` and `refuter.mjs` are
reframed from "nice-to-have" to **"regulated's enabling work"** — the panel-≥2 consensus mode a
`regulated` tier exists to run. Q5 also settles that the reviewer verdict itself is **never a
required gate at any tier** (§2.B, §7) — only its *protocol version* is a tiered parameter, not its
presence as a blocking check.

This design's job is narrower than Q5's: turn "regulated's enabling work" into a precise, reviewable
answer to four questions the proposal poses — where does selection happen, what input drives it,
can `/1` and `/2` coexist, and does a lower tier *forbid* `/2` or merely *not require* it. All four
have concrete answers below, and all four are activation-condition decisions, not restatements of
already-ratified doctrine.

**Load-bearing caveat, surfaced by this design, not by Q5 or the proposal:** the tier axis this
design ties `/2` to (`governance.tier`, `governance-tiers.mjs`) **does not exist in code yet**. Q5's
own `tasks.md` shows the module (`TIERS`, `GATE_MATRIX`, `resolveTier`, `tierParams`) unchecked, and
three HUMAN GATE items (ratify `standard`'s artefact set, ratify brain's own tier, promote ADR-0026)
still open. This design specifies the tie-in against Q5's *design*, correctly — but the tie-in
cannot be wired until Q5's implementation lands. That sequencing is recorded in §7.

---

## 2. Architectural overview

### 2.1 How `cli.mjs` works today (verified, `brain/scripts/review/cli.mjs:90-243`)

```
main(deps)
  ├─ gatherIdentity()                         → identity.handle
  ├─ gatherColdBoot({ project, number, ... }) → boot.{headSha, prView, doctrine.{records,priorVerdicts}}
  │     doctrine.priorVerdicts = reviews.map(parseVerdict).filter(Boolean)   (cold-boot.mjs:116)
  ├─ deriveMode({ labels, changedFiles })      → 'tranche' | 'checkpoint' | 'ruling'
  ├─ evaluate{Tranche,Checkpoint,Ruling}(...)  → evalResult.{conclusion, gates, findings, conditions}
  ├─ buildVerdict({                                             ◄── cli.mjs:204-216
  │     headSha, conclusion, priorRevCount, gates, findings,    ***`protocol` never passed***
  │     conditions, pin, escalate
  │   })                                       → verdict   (verdict.mjs:30 defaults protocol='brain-review/1')
  ├─ renderVerdict(verdict)                    → rendered YAML block (verdict.mjs:86-131)
  └─ postVerdict({ ..., renderedBody })        → poster.mjs (COMMENT-only, ADR-0020)
```

`buildVerdict`'s signature (`verdict.mjs:27-38`) already accepts `protocol` as a keyword argument
with a default. **The activation point is one call site, one added property.** No new function,
no new module is required to make `/2` selectable — only to decide *when* `cli.mjs` passes
`protocol: 'brain-review/2'` instead of relying on the default.

### 2.2 Where `/2` activation would happen

```
loadBrainConfig()                                          cli.mjs:104 (already called —
  └─ .project?.slug                    ← read today          only .project?.slug is read)
  └─ .governance?.tier                 ← NOT read today, would feed the decision

                    ┌─────────────────────────────────────────┐
                    │  resolveReviewProtocol(tier)             │  ← NEW pure function,
                    │    'lite'      → 'brain-review/1'        │    proposed home: Q5's
                    │    'standard'  → 'brain-review/1'        │    governance-tiers.mjs,
                    │    'regulated' → 'brain-review/2'        │    as tierParams(tier).reviewProtocol
                    └─────────────────────────────────────────┘
                                      │
                                      ▼
   buildVerdict({ ...existing args..., protocol: resolveReviewProtocol(tier) })   ← cli.mjs:204-216
```

`governance.tier` is the **only** input this design ties to the decision. No second input (mode,
provider, PR labels, rung) participates — see §3 for why.

### 2.3 How `governance.tier` flows to the decision point (proposed, not yet wired)

```
brain.config.json  ──►  loadBrainConfig()  ──►  resolveTier(config)  ──►  resolveReviewProtocol(tier)
 governance.tier         (existing, cli.mjs:104)   (Q5, governance-       (this design's new function,
 (Q5 schema key,                                    tiers.mjs — NOT YET    §3)
  not yet read by                                   IMPLEMENTED, Q5
  cli.mjs)                                           tasks.md unchecked)
```

The chain has a broken link today: `resolveTier` does not exist. This design specifies the seam on
the far side of that gap so that when Q5's module lands, wiring `/2` is the one-line change shown
in §2.2 — not a redesign.

---

## 3. Protocol version selection logic

**Q3.1 — At what point does `cli.mjs` decide between `/1` and `/2`?**
At the `buildVerdict(...)` call, `cli.mjs:204-216`, immediately before rendering. This is the single
existing seam where a `protocol` value is consumed (`verdict.mjs:30`) and the single place any
mode's `evalResult` (tranche, checkpoint, or ruling — all three feed the same `buildVerdict` call)
converges before a verdict is constructed. No evaluator needs to know about protocol version; only
the builder does.

**Q3.2 — What input(s) drive the decision? `governance.tier` alone, or + something else?**
`governance.tier` alone. Rejected candidates and why:

| Candidate second input | Why rejected |
|---|---|
| PR mode (`tranche`/`checkpoint`/`ruling`) | Orthogonal axis — mode is *what* is being reviewed (a diff tranche vs. a checkpoint vs. an issue fork), protocol version is *how strictly* a finding is admitted. Coupling them would mean a `regulated` repo's ruling mode silently reverts to `/1`, which contradicts Q5 §7's framing of `/2` as the tier's enabling mechanism. |
| VCS provider (GitHub/GitLab) | `parse-verdict.mjs` and `verdict.mjs` are already provider-agnostic; introducing a provider fork here would be a second axis with no doctrine basis. |
| Explicit CLI flag (`--protocol`) | Considered and rejected as the *primary* mechanism (see §6) — it would make `/2` a per-run operator choice instead of a per-repo doctrine declaration, breaking REQ-TIER-4's "tier is declared, never inferred, and nothing else substitutes for it" discipline once §4's row exists. A flag MAY still exist as a manual override for testing, mirroring `--mode`'s existing escape hatch (`cli.mjs:27,30,154`), but it is not the input the *tier tie-in* reads. |
| `evalResult.findings` content (e.g. "if any finding carries `causal_disposition`, use `/2`") | Inverts cause and effect: evaluators do not populate `evidence_class`/`causal_disposition` today (verified — only `refuter.mjs:11` reads `evidence_class`, nothing in `evaluators/{tranche,checkpoint,ruling}.mjs` writes it). Selecting protocol from a field nothing sets yet would make `/1` the permanent de facto outcome regardless of tier. See §7 gap. |

**Q3.3 — Can both coexist (backward compatibility)?**
Yes, already, verified in the tree, not a decision this design makes:

- `parse-verdict.mjs:43` — `if (proto !== 'brain-review/1' && proto !== 'brain-review/2') return null;`
  accepts either protocol string in the same guard.
- `cold-boot.mjs:116` — `reviews.map(r => parseVerdict(r)).filter(Boolean)` calls the same parser
  regardless of which protocol prior comments used; a thread with mixed `/1` and `/2` verdicts (a
  tier changed mid-PR, or a repo migrated tiers) loads correctly on both sides.
- `verdict.mjs:39` (`head_sha` mandatory) and the `rev >= 3` bound (`verdict.mjs:58`) are
  protocol-independent — they read `priorRevCount`, not `protocol`.

No parser change, no cold-boot change is required by this design.

**Q3.4 — Does `lite`/`standard` FORBID `/2`, or just not REQUIRE it?**
**Not require — never forbid.** This mirrors the evidence-tiering discipline Q5 already applies to
`actor-check`/`brain-writes-reviewed` (Q5 spec.md REQ-L5-1′/REQ-L6-1′): a lower tier's evidence form
is the *floor* a team must clear, never a *ceiling* on what it may run. `parse-verdict.mjs` and
`cold-boot.mjs` accepting both protocols unconditionally (§3.3) is exactly what makes "never forbid"
free — nothing downstream cares whether a `lite` repo's operator opted into `/2` voluntarily. The
tier only decides the *default* `resolveReviewProtocol(tier)` returns when nothing overrides it.

---

## 4. `brain-review/1` vs `/2` behavior contract

### 4.1 Guaranteed identical in both versions

| Guarantee | Evidence |
|---|---|
| `head_sha` mandatory; no headless verdict | `verdict.mjs:39`, protocol-independent |
| `evidence:` mandatory per finding; uncited blocker → `correction` | `verdict.mjs:18-22` (`processFindings`), runs before protocol branches |
| `rev >= 3` + `REVISE` → forced `STOP` + `escalate: human` | `verdict.mjs:58-60`, reads `priorRevCount`/`conclusion`, not `protocol` |
| `gates: { required, detection }` shape | `verdict.mjs:74`, identical rendering (`verdict.mjs:94-96`) |
| Reviewer never merges/approves — COMMENT-only | poster.mjs / ADR-0020, orthogonal to protocol entirely |
| Parseable by `parse-verdict.mjs` and loadable by `cold-boot.mjs` | §3.3 |

### 4.2 What changes when `/2` is active

| Behavior | `/1` | `/2` |
|---|---|---|
| Admission rule | Any finding with `evidence:` (+`cites:` if blocker) blocks | Same, **plus**: findings with `causal_disposition: pre-existing \| base-only` are routed to `follow_ups[]` instead of blocking (`verdict.mjs:46-56`) |
| `REVISE`-to-`APPROVE` softening | Not possible | If `findings.length > 0` but every finding was routed out of `candidateFindings` (all pre-existing/base-only) and `conclusion === 'REVISE'`, the verdict becomes `APPROVE` (`verdict.mjs:65-66`) — a finding existed, but nothing *causal* blocks |
| `causal_disposition: 'unknown'` | Field not read | Forces `escalate: 'human'` and `verdict: 'STOP'` regardless of conclusion (`verdict.mjs:48-49,63-64`) — uncertainty about causality is never silently admitted or silently dropped |
| Rendered fields | `id`, `severity`, `evidence`, `cites` | Adds `evidence_class`, `causal_disposition` per finding when present (`verdict.mjs:108-109,120-121`); adds a `follow_ups:` block when non-empty (`verdict.mjs:113-123`) |
| Schema validation | None beyond the four scalar fields | `schema-v2.mjs`'s `validateSchemaV2` enforces `evidence_class ∈ {deterministic, inferential, insufficient}` and `causal_disposition ∈ {introduced, behavior-activated, worsened, pre-existing, base-only, unknown}` |

### 4.3 What `cold-boot.mjs` depends on that must work in both

`cold-boot.mjs:116`'s `priorVerdicts` load depends on exactly three fields surviving the round trip:
`head_sha` (staleness anchor, §8), `rev` (anti-loop bound), and `verdict` (APPROVE/REVISE/STOP,
consumed by the anti-loop lock and board reconciliation, per the proposal's Current State section).
None of these three are protocol-gated in `parse-verdict.mjs` (lines 45-55 read them unconditionally
before the `/2`-only `result.protocol` and `result.findings` branches at lines 56-58, 70-74). This is
the compatibility guarantee the proposal's risk table calls "Low" risk — verified, not assumed.

### 4.4 `parse-verdict.mjs`'s existing compat story

Already dual-protocol by construction (§3.3), and additionally: it only *attaches* `protocol` and
`findings` to its return value when they parse (`parse-verdict.mjs:56-58,70-74`) — a `/1` block
simply never populates those keys, so every `/1`-only consumer (the anti-loop lock, the rev bound)
reads the same shape it always has. **No compatibility shim is needed; the parser was already built
for both protocols before either was tied to a tier.**

---

## 5. Tier matrix for the reviewer gate (draft — surfaces the tie-in, does not ratify it)

This extends Q5 design.md §2.B's row (`reviewer verdict recorded | M3 | — | D | D`) and §7's table
with the one axis Q5 left unstated: **which protocol version is the tier's default.**

| Tier | Reviewer gate required? | Reviewer gate detection? | Default protocol | Why |
|---|---|---|---|---|
| `lite` | No (never a `required` job at any tier — Q5 §7) | Not even `detection` — Q5 §2.B lists `—` for `lite`, i.e. the gate is not part of `lite`'s governance surface at all | `brain-review/1` | Single-engine deterministic checks match `lite`'s operating model (Q5 §2.C: "reviewer verdict mode: deterministic checks only" at `lite`) |
| `standard` | No | Yes (`D`) | `brain-review/1` | Q5 §2.C: "single engine" — one reviewer pass, no panel; `/2`'s causal-admission/follow-up split earns its cost when consensus across a panel needs a shared causality vocabulary, which `standard` does not run |
| `regulated` | No | Yes (`D`) | `brain-review/2` | Q5 §2.C: "panel ≥2, consensus-gated" — Q5 §7 explicitly reframes `/2` + `refuter.mjs` as "regulated's enabling work"; a panel cannot converge on which findings block without a shared, machine-checkable causal-disposition vocabulary, which is exactly what `/2` formalizes |

**Note, as the proposal's own risk table requires:** Q5's #358 matrix (design.md §2.B, §2.C, spec.md)
does not itself state a "default protocol" column — it names `/2`/`refuter.mjs` as regulated's
enabling work in prose (§7) but never adds a matrix row for protocol version. The table above is
this design's synthesis of that prose into a matrix cell, **not a fact `#358` already decided in
tabular form.** It requires the same ratification scrutiny Q5's own §3 divergence got (see §6).

---

## 6. Activation sequence — how the three artifacts compose

| Artifact | Answers | Status after T2.3 |
|---|---|---|
| `openspec/specs/vcs-pr-reviews-contract/spec.md` (deliverable 1) | **WHAT** shape `prReviews` returns (GitHub `{state,author,body}`; GitLab dual-endpoint notes-vs-approvals split) | New formal spec |
| `reviewer-protocol.md` §6/adjacent (deliverable 2) | **WHAT** shape `brain-review/2` is (`evidence_class`, `causal_disposition`, `follow_ups`, the admission rule) and which of §6/§13 is current | Doctrine amended |
| This document (deliverable 3) | **HOW** and **WHERE** `/2` gets selected, and **WHY** via `governance.tier` | Design surfaced, condition stated — **not implemented** |

The three are independent and additive, and deliberately ordered this way: deliverables 1 and 2
document facts already true in the tree (no new decision, per the proposal's Design Considerations).
This document is the one place T2.3 makes a *new* claim — that protocol selection should be a
function of `governance.tier` — and it is scoped as a design doc precisely so that claim gets
reviewed as a claim, not smuggled in as a spec restatement.

---

## 7. Design rationale

**Why tie to `governance.tier` and not something else?** Because Q5 already established the
vocabulary for "how strict is this repo's doctrine" (`lite`/`standard`/`regulated`), and the
reviewer's causal-admission strictness is the same kind of axis — a statement about how much
process ceremony a team's operating model can bear, not a fact about a given PR. Introducing a
second, parallel axis (e.g. a standalone `reviewer.protocolVersion` config key) would violate Q5's
own REQ-TIER-9 discipline (one source derives every tiered surface) the moment both keys need to
agree, and would re-create exactly the kind of scattered-literal problem Q5's §0 diagnosed for the
`400`-line budget.

**Why is `/2` not the default at any tier below `regulated`?** Two independent reasons converge:

1. *Cost proportionality* (Q5 §2.C's own framing) — `/2`'s admission rule and `follow_ups` routing
   exist to let a **panel** converge on causally-graded findings; a single-engine `standard` review
   has no panel to converge, so the extra schema ceremony buys nothing `standard` needs.
2. *Findings-population gap* (this design's own finding, §3.2's rejected-candidate row) — no
   evaluator in `brain/scripts/review/evaluators/` populates `evidence_class`/`causal_disposition`
   today; only `refuter.mjs` (issue #284's refuter role) reads `evidence_class`, and #284 is
   explicitly out of scope for T2.3. Defaulting `/2` anywhere it is not backed by a finding-producer
   that actually sets those fields would silently degrade every finding to `causal_disposition:
   unknown` → forced `STOP`/`escalate:human` (`verdict.mjs:48-49,63-64`) on every real finding. That
   is a correctness trap, not a doctrine choice — it is the concrete reason activation must stay
   conditional rather than a global default flip.

**Why is activation conditional/explicit rather than proposed as a `cli.mjs` change directly?**
Because the tie-in itself is new (§5's note) and the finding-population gap (above) means flipping
the default today would be **unsafe**, not merely premature. The proposal's own risk table names
this precisely: "a careless follow-up flips the default without re-litigating the tier tie-in" —
mitigated by this document stating the *condition*, explicitly leaving the *wiring* (and the
prerequisite finding-population work) to a separate, reviewable change (§8).

**Alternatives considered:**

| Alternative | Why rejected |
|---|---|
| Flip `/2` default globally now (delete the `protocol='brain-review/1'` default in `verdict.mjs:30`) | Every finding lacks `evidence_class`/`causal_disposition` today (see above) → `unknown` → forced escalate on every real PR. Silent regression to "reviewer always escalates." |
| `--protocol` CLI flag as the *sole* mechanism | Makes protocol version an operator choice per invocation rather than a repo-level doctrine declaration; breaks the same "declared, not inferred, nothing else substitutes" discipline Q5 built for tier itself (REQ-TIER-4). May still exist as a manual override (mirrors `--mode`), but cannot be the tier tie-in's primary input. |
| A new standalone `reviewer.protocolVersion` config key, independent of `governance.tier` | Second axis serving one gate — same shape Q5's own §1 rejected for `governance.soloMaintainer`. Two config keys that must agree is a drift risk with no compensating flexibility gain. |
| Infer protocol version from whether `refuter.mjs` is wired into the mode evaluators | Couples an activation *condition* to an implementation *detail* of #284, which is explicitly out of scope; also inverts Q5's declared-not-inferred principle the same way probing rung from substrate was rejected for tier itself (REQ-TIER-4). |

---

## 8. Known gaps and follow-ups (explicitly out of this document's scope)

1. **`cli.mjs` wiring itself** — adding `resolveReviewProtocol(tier)` and passing its result into the
   `buildVerdict(...)` call at `cli.mjs:204-216`. Deliberately deferred per the proposal's Scope
   section; this document specifies the condition, a follow-up implements it.
2. **Q5's `governance-tiers.mjs` does not exist yet** (§1's caveat). `resolveTier`, `TIERS`,
   `tierParams` are all unchecked in Q5's `tasks.md`. This design's proposed home for
   `resolveReviewProtocol` — as a `tierParams(tier).reviewProtocol` entry — is a **dependency**, not
   a citation: T2.3's activation condition cannot be wired before Q5's implementation phase lands,
   and whoever wires it should extend `tierParams` rather than hand-roll a second resolver.
3. **The findings-population gap (§7).** No evaluator sets `evidence_class`/`causal_disposition`
   except `refuter.mjs`. Activating `/2` at `regulated` is only safe once `regulated`'s evaluation
   path actually runs a finding-producer that populates those fields — which is #284's refuter role,
   explicitly out of scope for T2.3 (per proposal Scope: "Any change to the refuter role or further
   causal-admission behavior (#284) beyond what is already shipped"). **This means `regulated`
   requiring `/2` and `regulated` requiring the refuter's panel mode are the same prerequisite**, not
   two independent follow-ups — a future change wiring `/2` at `regulated` must also confirm
   `refuter.mjs` is in the evaluation path, or it inherits gap #2 above at runtime.
4. **§5's tier matrix is a synthesis, not a ratified fact.** It requires the same explicit human
   ratification Q5's own §3 divergence required before being treated as settled doctrine (flagged
   per the proposal's risk table).
5. **Q5 itself is not closed.** Three HUMAN GATE items remain open in Q5's `tasks.md` (ratify
   `standard`'s artefact set, ratify brain's own tier as `lite`, promote ADR-0026). This design's
   tie-in is written against Q5's *design.md/spec.md* content, which is stable regardless of those
   gates, but the tier axis itself is not yet load-bearing in production until Q5 ships.

## 9. Implementation notes for the follow-up wiring task

- Extend `governance-tiers.mjs`'s `tierParams(tier)` return shape with `reviewProtocol:
  'brain-review/1' | 'brain-review/2'` once that module exists — do not create a parallel resolver.
- The one-line change in `cli.mjs` is adding `protocol: tierParams(resolveTier(config)).reviewProtocol,`
  to the `buildVerdict({...})` call at `cli.mjs:204-216`; `config` is already loaded at `cli.mjs:104`
  via `loadBrainConfig()` (currently only `.project?.slug` is read from it).
- No change is required to `parse-verdict.mjs`, `cold-boot.mjs`, `schema-v2.mjs`, or `verdict.mjs` —
  all four already handle both protocols (§3.3, §4.3, §4.4).
- Before flipping `regulated`'s default live, confirm `refuter.mjs` (or an equivalent finding-producer)
  is wired into whichever evaluator runs at `regulated`, per gap §8.3 — otherwise every finding
  defaults to `causal_disposition: unknown` and every `regulated` review escalates to a human by
  construction, which is a correctness regression dressed as a tier upgrade.
- A `--protocol` manual override flag (mirroring `--mode`, `cli.mjs:27,30`) may be added for local
  testing; it must not become the tier tie-in's primary input (§7, rejected alternatives).
