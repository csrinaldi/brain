---
status: draft
issue: 552
---

# Tasks — issue 552

## Done

- [x] **T1** — Measured before ruling: `refuterRunner` is a test-side injection
      only (`cli.mjs`, `runner: deps.refuterRunner ?? null`), so the refuter has
      never run in production.
- [x] **T2** — Measured: the two states rendered **byte-identically**. Same
      severity, same `escalate: null`, same `conditions: []`, and
      `refuter_outcome` emitted nowhere — zero occurrences in `verdict.mjs` and
      `parse-verdict.mjs`.
- [x] **T3** — The ruling: **(a), sequenced behind a runnable refuter**; (b)
      refused. Cost stated in the same sentence as the choice (`spec.md`).
- [x] **T4** — `refuter.mjs` splits the two states (REQ-552-1/2).
- [x] **T5** — `causal-admission.mjs` states it on the verdict (REQ-552-3).
- [x] **T6** — `verdict.mjs` renders the marker and its rationale, in both
      loops, applying #483 ruling point 3 to the marker it missed (REQ-552-3).
- [x] **T7** — REQ-409-6's pin and header record the ruling as a decision
      (REQ-552-4).

## The measurement that decided it

```
runner = null (production):          runner present, corroborated:
  severity  : blocker                  severity  : blocker
  escalate  : null                     escalate  : null
  conditions: []                       conditions: []
  → rendered: byte-identical
```

After:

```
findings:
  - id: design:coupling
    ...
    refuter_outcome: unchallenged
conditions: ["1 inferential blocker(s) were NOT challenged — no refuter runner is configured"]
escalate: human
```

## Mutation proof

Each mutation asserted to land by **observing the mutated behaviour**, shown
red, reverted byte-identical (`diff -q`).

| # | mutation | result |
|---|---|---|
| N1 | fold the two states back together (the original fail-open) | **4 red** |
| N2 | drop the condition — annotate the finding, say nothing on the verdict | **1 red** |
| N3 | stop rendering the marker (back to invisible on the wire) | **1 red** |

N1 was verified by importing the mutated module and printing what it answers
(`unchallenged: 0, escalate: null`), not by finding the string in the file — the
discipline this line of work adopted after a mutation landed in the bytes and
not in the behaviour.

## Limits, stated

**This change is inert on every verdict brain posts today.** No evaluator emits
`evidence_class: inferential`, so the new branch fires nowhere: 3729 tests green
with it, and 3729 green without it except for the cases written here. That is
the honest reading — it is a precondition, not a feature, and its whole value is
that it is in place *before* the thing it guards exists.

**It does not make the refuter work.** There is still no production
`refuterRunner`. What changed is that its absence is now stated on the verdict
instead of being indistinguishable from its presence.

## Found on the way, NOT fixed here

`causal-admission.mjs`'s header states the order annotate → classify → refute is
chosen so that *"a finding reclassified to `pre-existing` is on its way out of
the blocking set, so refuting it would be challenging a finding that no longer
blocks anything."* **The intent is documented and not enforced**: the refuter
filters on `severity === 'blocker'`, and `classifyAgainstBase` changes only
`causal_disposition`, so a `pre-existing` inferential blocker still reaches the
refuter today.

Not fixed, deliberately: changing which findings the refuter sees is a semantic
change to a path with no producer, and #552's own discipline is not to shape a
dead path speculatively. It is instead **accounted for** — the marker renders in
the `follow_ups` loop as well, so the case cannot lose its annotation while the
gap stands.
