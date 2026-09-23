---
status: draft
issue: 506
---

# Spec

## REQ-506-1 — the bound counts verdicts at the current head
Verdicts at earlier heads MUST NOT count. Pushing a fix re-arms the loop.

## REQ-506-2 — the bound is not weakened
Four verdicts at the current head MUST still escalate.

## REQ-506-3 — one definition, two guards
The anti-loop lock and the rev bound MUST cite the same notion of "the same review
iteration". Any additional condition (the lock's author check) MUST be stated where applied.

## REQ-506-4 — the escalation has an exit
A `brain-decision/1` block at the current head MUST clear the count-based escalation, read
from the review list cold boot already fetches.

## REQ-506-5 — the exit is head-bound
A ruling at an earlier head MUST NOT clear an escalation at the current one.

## REQ-506-6 — the exit is scoped to one escalation
A ruling MUST NOT clear `unknownCausality`.
