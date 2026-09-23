---
status: draft
issue: 634
---

# Spec

## REQ-634-1 — a reader that prints a count carries the accounting
`computeMemoryCoverage` MUST read through `readRecords` and MUST return the duplicate accounting
alongside the total. `total + duplicates.lines` MUST equal the store's physical line count.

## REQ-634-2 — the accounting is always a normalized shape
`duplicates` MUST be present and normalized on every path, including the unavailable one. It MUST
NOT be `undefined`: "I could not look" is carried by `available`, never by the absence of a field.

## REQ-634-3 — `brain:metrics` states the gap, and only when there is one
The markdown report MUST print the physical line count, the excess, the number of repeated ids,
and the verb that locates them. It MUST print nothing when the store is clean, and nothing when
the store is unavailable. A report that fires on every store informs nobody.

## REQ-634-4 — the JSON report carries counts, never the groups
`renderJson` MUST emit `duplicates` as counts only. `groups` MUST NOT reach it: the snapshot is
denormalized onto every period row, and passing it whole was measured at 62× the size. The
projection MUST NOT mutate the caller's snapshot — the markdown renderer reads the same object.

## REQ-634-5 — existence-only consumers stay silent, and the silence is proved
`memory-gate`, `brain:check` and `brain:audit` MUST NOT gain output. The justification MUST be a
measured property — `memoryPresence` is invariant under dedup, because dedup keeps the first copy
of each `id` — and MUST be verified by a test, not asserted in prose alone.

## REQ-634-6 — the register lives at the chokepoint
The list of who reads through the shared reader, and which of them report, MUST be recorded at
`readRecordObservations` — the one function all six go through — so the next reader does not
re-derive it from six files.

## REQ-634-7 — the reviewer's treatment is a recorded ruling
`cold-boot.mjs` MUST carry an explicit decision, with its reasoning and the condition under which
it should be revisited. An omission MUST NOT stand in for a decision.

## REQ-634-8 — `share()`'s side effect is documented
`plainfiles.share`'s docblock MUST state that it materializes `.memory/index.jsonl` on a repo with
no record store, MUST record the gating alternative and why it was not taken, and MUST name the
condition that would make gating right.

## REQ-634-9 — red-proved in both directions
Every requirement above MUST be red-proved by mutation: the guard removed, the mutation shown to
have landed, the failure observed, the file restored byte-identically.
