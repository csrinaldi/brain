---
status: draft
issue: 552
---

# Spec — the ruling #552 asks for, and the precondition it exposed

#552 asks one question: **is there a finding worth making that brain cannot
currently observe?** — with three answers on offer: (a) a reasoning evaluator,
(b) a narrow deterministic-but-uncertain producer, or neither. Its own
recommendation was *neither, until (a) has a reason to exist that is not "a fork
is unreachable"*.

Two things changed since it was written on 2026-08-11. One supplies the missing
reason. The other says the work cannot start where the ticket assumed it would.

---

## Ruling — (a), and NOT built here, because the refuter it would rest on was not real

**A reasoning evaluator is worth building — it buys findings four measured
reviews' worth of defects show no mechanical check can reach — and it may not
ship until the refuter can actually run, because an unchallengeable reasoned
blocker is worse than no reasoner at all.**

### The reason #552 was waiting for now exists, measured

The ticket asked for a reason that is not "a fork is unreachable". Four cold
reviews run by hand during 2026-08-15 supplied it. A sample, each a real defect
that reached a PR and none of them reachable by a status rollup, a
`git diff --numstat`, a regex over a body, or a base re-run:

| finding | why no deterministic check sees it |
|---|---|
| the negative control can **cause** the provider lockout it then misdiagnoses (#604 F1) | a claim about a causal loop between the check and its environment |
| `--dry-run=true` silently **disabled** dry-run (#670 G1) | the parser is correct; the semantics are inverted |
| a refusal message that diagnoses the **wrong path** (#675 M1) | the verdict is right and the stated cause is invented |

Three of those are in the reviewer's own machinery. That is the reason, and it
is stronger than the one the ticket declined to accept: not *a fork is
unreachable* but *this class of defect is reaching main today, and something
already reads for it — by hand, out of band, with the artefact thrown away*.

### And the safety net it rests on did not exist. Measured.

`cli.mjs:499` passes `runner: deps.refuterRunner ?? null`, and `refuterRunner`
is a **test-side injection** — there is no production wiring. So
`evaluateRefuter` ran with `runner === null` on every real verdict, and its
early return folded two different states into one:

```
runner = null (production):          runner present, corroborated:
  severity  : blocker                  severity  : blocker
  escalate  : null                     escalate  : null
  conditions: []                       conditions: []
```

Rendered, they were **byte-identical**: `refuter_outcome` was set on the finding
and `renderVerdict` never emitted it — zero occurrences in `verdict.mjs` and
`parse-verdict.mjs`.

So a reasoned blocker that nothing had examined would have posted as a reasoned
blocker that had been examined and upheld. That is
`evidence-reader-empty-on-failure` **inside the component whose entire job is to
be the check on judgment** — the worst place in the reviewer for it to be, and
the direct analogue of #604 Ruling 3: a trustworthy-looking slot with no honest
producer behind it. Here it was worse, because the slot had a producer waiting
and no honest *challenger*.

**Cost of the ruling, in the same sentence as the choice, as #552 requires:**
choosing (a) buys the finding class above and costs a network dependency in the
reviewer's environment, a second credential that #604's negative control does
not cover, non-determinism in a verdict that gates merges, and a per-run price —
and it costs one more thing that is not optional: the refuter must be built and
wired first, which is work (a) does not itself deliver.

### On (b): refused, for #408's own reason restated

`insufficient` and `inferential` are different words and only one of them means
*reasoned*. Manufacturing a softer claim so a fork can fire is the error
`causal-admission.mjs` refuses one level down — *"inventing the claim would be
worse than omitting it"*. Nothing here changes that.

---

# What ships in this change

The ruling's precondition, and only that. **No producer is built.**

## REQ-552-1 — The refuter distinguishes "nothing to challenge" from "nothing to challenge it with"

`evaluateRefuter` returns two different states where it returned one:

- **no inferential blockers** → silent, `unchallenged: 0`, `escalate: null`.
  This is every verdict brain posts today and it must not change.
- **inferential blockers, no runner** → each marked
  `refuter_outcome: 'unchallenged'`, `unchallenged: n`, `escalate: 'human'`.

The finding still **blocks**. This marks the evidence; it does not soften it.

## REQ-552-2 — The escalation is by symmetry, not by invention

`escalate: 'human'` matches the existing `inconclusive` branch. *"The challenge
was inconclusive"* already escalates, and *"there was no challenge at all"* is
strictly weaker evidence than that, so it cannot escalate less.

It cannot cause #394's escalation storm: it fires only on a finding class
**nothing currently produces**, which is also why this change lands green and
inert on the whole suite.

## REQ-552-3 — The verdict states it, and the finding-level marker reaches the wire

`applyCausalAdmission` appends a condition naming the count and the cause.
`conditions` is the field protocol §10 already uses for *"the evidence behind
this verdict is weaker than it looks"*, which is exactly this.

`renderVerdict` emits `refuter_outcome`, `refuted` and `refuter_rationale`,
applying **#483 ruling point 3** — *"the marker is rendered, or it does not
exist"* — to the marker that ruling missed. The severity downgrade on a refuted
finding was already visible; the reason for it was not.

Emitted in **both** the `findings` and `follow_ups` loops, unlike
`schema_invalid`, and the asymmetry is measured rather than assumed:
`classifyAgainstBase` runs BEFORE the refuter and only sets
`causal_disposition`, so a finding can be an inferential blocker, be
reclassified `pre-existing`, be refuted, and then be routed to `follow_ups[]` by
`buildVerdict`. Rendering it in one loop only would drop the marker exactly
where the finding is weakest.

## REQ-552-4 — The pin records a decision, not a pending state

REQ-409-6's refuter half and its message now say what the ruling is and what a
red there means: a producer landed, so verify the refuter is genuinely wired
before accepting it. The pin **moves with** the producer rather than being
deleted — the instruction its author left for #408, which #408 honoured.

---

# Sequencing — what (a) needs before it can start

1. **This change.** The refuter fails closed and is visible on the wire. Landed.
2. **A production `refuterRunner`.** Today there is none, at any call site. A
   producer without it re-opens exactly the state this change closed, one layer
   up: the condition would fire on every judgment verdict, which is honest but
   useless.
3. **#575 Ruling 3's declaration** — a mechanical-only review must say it ran
   mechanical checks only. Today's verdicts do not; a reader takes
   `conditions: []` for *"reviewed, nothing found"*.
4. **The producer**, with its own approved ticket. It is the largest thing in
   the reviewer's roadmap and it must not be decided by the agent that just
   ruled on it.

**The self-certification hazard, named rather than assumed away.** A reasoning
evaluator built by an agent, judging agent-written code, challenged by a refuter
that is the same class of reasoner, is the shape this repository spent #413,
#604 and ADR-0031 refusing: *the producer asserting about itself*. ADR-0031's
distinction applies unchanged — **provenance is not authorship; a claim becomes
evidence when something other than the claimant attests to it**. Whatever the
refuter runner turns out to be, an honest one cannot be the same process,
holding the same context, that produced the finding. That constraint belongs in
the producer's ticket, and it is the reason this ruling does not open one here.
