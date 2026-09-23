---
status: draft
issue: 519
---

# Spec — memory recency reporting

## REQ-519-1 — the newest record's age is reported
`brain:session:start` MUST report the age of the newest record in `.memory/records/` when
it exceeds the reporting threshold.

## REQ-519-2 — unknown is not fresh
An empty, absent or unreadable store MUST answer "cannot determine", never an age of 0.

## REQ-519-3 — the reader does not depend on engram
Recency MUST be computed from committed records. The outage it exists to report happened in
sessions where engram was absent.

## REQ-519-4 — corrupt input is skipped, never promoted
An unparseable line or timestamp MUST NOT become the newest record.

## REQ-519-5 — silence when there is nothing to say
A fresh store MUST add no line.

## REQ-519-6 — reporting only
Nothing in this change gates, blocks or fails. `memory-gate` is untouched; its scope is
documented rather than altered, and the ruling on whether it should tighten stays open.
