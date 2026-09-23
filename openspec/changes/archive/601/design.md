---
status: draft
issue: 601
---

# Design — REFUSE protects a first-ship path (issue 601)

## D1 — A new list, not a widened `consumerModified`

`consumerModified` means "the bytes differ from what brain last shipped here".
On a first ship there is nothing to differ from. Pushing first-ship paths into
that list would make the return value say something untrue, and the field is
read by callers that report it to an operator.

## D2 — Guarded on `outgoing !== null`

`--no-install` deliberately passes `null` so the degradation is carried in the
result rather than disguised as a clean bill of health. Reading that as "brain
never shipped this path" would refuse every REFUSE path on every degraded run —
turning a fail-closed fix into a fail-stuck one. Proven by mutation M1.

## D3 — The existing gate, not a parallel one

First-ship paths join `refused`/`forced` through the same loop shape, so
`--force-managed` covers them without a second code path to keep in step. One
gate, one meaning.

## D4 — Why the ratified table is untouched

ADR-0013 requires a new human signature to change a strategy ROW. No row changes
value here: `.gitlab/merge_request_templates/Default.md` was REFUSE before and
is REFUSE now. What changed is the code honouring that classification a release
earlier, and the comment describing it truthfully.
