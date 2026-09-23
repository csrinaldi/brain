---
status: draft
issue: 529
---

# Spec

## REQ-529-1 — the ruling exists and names its cost
A ruling on (1)/(2)/(3) MUST be recorded, with the chosen option's cost in the same sentence as
the choice.

## REQ-529-2 — the doctrine states the scope where it is read
The invariant table MUST say that `memory-gate` is repo-scoped. A correction living only in the
metrics caveats does not satisfy this.

## REQ-529-3 — the unenforced override is not claimed
The table MUST NOT describe `skip:memory-gate` as an override while no code path honours it.

## REQ-529-4 — nothing enforces per-change capture, said outright
The doctrine MUST state that the PR template's per-change promise is kept by no gate.

## REQ-529-5 — the sequence is part of the ruling
The transition to recency MUST be conditioned on #530 and on `skip:memory-gate` being
implemented, and the ruling MUST say so.

## REQ-529-6 — no behaviour change in this slice
`memoryPresence` MUST be unchanged.

## REQ-529-7 — the question is not lost again
#529 MUST be closed with the ruling quoted, not merely linked — the failure mode #519 and #368
both hit.
