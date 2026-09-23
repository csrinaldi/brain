---
status: draft
issue: 636
---

# Spec

## REQ-636-1 — the corpus reports zero duplicates
After the reconciliation, `npm run memory:reindex` MUST report no duplicate ids. The store-reading
verbs MUST fall silent on this condition, so that the report's next firing means something.

## REQ-636-2 — the collapse is lossless, and proved so
`.memory/index.jsonl` MUST be byte-identical before and after. The record count MUST be identical
(2046 in, 2046 out). The records diff MUST be pure deletion — zero added lines.

## REQ-636-3 — only byte-identical repeats may be dropped
A repeat MUST be removed only when its RAW line is byte-identical to the line already kept for
that id. Canonical equality is NOT sufficient. Any repeat that differs MUST cause the script to
refuse the entire run and name every offender: choosing between two differing copies is a human
decision.

## REQ-636-4 — first-wins, matching the index
The retained copy MUST be the first occurrence in sorted month-file order — the same line
`rebuildIndex` indexes and `readRecords` returns. Any other choice would change the index.

## REQ-636-5 — the rewrite is defaulted off
The script MUST report only unless `--apply` is passed explicitly.

## REQ-636-6 — corrupt lines are not this script's business
A line that does not parse MUST be preserved verbatim, never dropped. `rebuildIndex` is the
fail-closed integrity gate; a cleanup script is not.

## REQ-636-7 — the run is arithmetically self-checked
The script MUST refuse if `physical lines − dropped ≠ unique ids`, rather than write a result it
cannot account for.

## REQ-636-8 — the append-only exception is recorded
What was rewritten, why it was safe in this instance, and why it is not a precedent MUST be
written down. It MUST NOT be amended into ADR-0017, whose rule stays stated without qualification.

## REQ-636-9 — the rewrite tool is not a verb
The script MUST NOT live under `brain/scripts/` and MUST NOT be exposed as an `npm run` verb. It
MUST remain in the change folder as the historical record of what was executed.

## REQ-636-10 — no in-flight branch may be resurrected
The reconciliation MUST NOT rewrite a month file that any unmerged branch also modifies. This MUST
be verified by measurement before applying, not assumed.
