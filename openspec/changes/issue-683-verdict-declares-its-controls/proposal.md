---
status: draft
issue: 683
---

# Proposal — the verdict declares which classes of control ran (issue 683)

## What

One derived field on every posted verdict:

```yaml
conditions: []
controls: ["deterministic"]
escalate: null
```

Each evaluator declares what it is capable of producing (`PRODUCES`); the
verdict reports the union over the evaluators that actually ran; the reader
parses it back and refuses a class outside the vocabulary.

## Why

`conditions: []` reads as *"reviewed, nothing outstanding."* The truthful reading
is *"the mechanical half ran; the judgment half does not exist."* Those are
different answers and only the second is true — `evidence-reader-empty-on-failure`
at the level of the **stage**, which #575 Ruling 3 already ruled must be closed:

> A mechanical-only review MUST declare that it ran mechanical checks only.

The reviewer now holds every other component to this standard — `run()`'s launch
failures, the negative control's `unusable`/`lockout`, `brain:promote`'s
*"NONE applied … that is not checked clean"*, and since #552 the refuter's
`unchallenged` — and did not hold itself to it.

## The design decision, and it is the whole change

**Derived from the evaluators that RAN, never from the findings present.**

Deriving from `findings[].evidence_class` is the obvious implementation and it is
wrong: a clean mechanical run produces **zero findings**, so the derived list
would be empty — and *"no control ran"* would render identically to *"controls
ran and found nothing"*. That is the defect this field exists to remove,
re-created inside its own fix, and invisible precisely on the green verdicts
where nobody would look.

Proven on real runs rather than argued: a fixture with findings and one without
must make the same claim about what ran, and the e2e asserts it.

## Why a declaration and not a hardcoded string

#683's constraint, kept: a literal `"mechanical only"` becomes a lie the day
#682 lands, and a stale honesty marker is worse than none. Because each
evaluator owns its own declaration, a judgment evaluator that declares
`inferential` makes the verdict say so with no other edit.

## Cost

One field per verdict, and one refusal path: a run whose findings carry a class
no evaluator declared posts **nothing**. A verdict whose self-description is
false is the artefact this ticket exists to prevent, so silence is the better
failure.

## What this is not

Not the judgment half — that is #682, and the point of this change is that the
declaration is useful **before** the producer exists and stays correct **after**
it lands.
