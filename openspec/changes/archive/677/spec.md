---
status: draft
issue: 677
---

# Spec

## REQ-677-1 — a record is written to its own file
`appendRecord` MUST write a record as exactly one physical JSONL line to
`records/<yyyy-mm>-<id>.jsonl`, where `<id>` is the record's content-addressed `id` and
`<yyyy-mm>` is derived from its `ts`. The layout MUST be stated in exactly one place
(`recordFilename`), never re-templated at a call site.

## REQ-677-2 — the `id` is a path, so its shape is checked
Because the `id` names a file, `recordFilename` MUST refuse any `id` that is not `rec-` followed
by 16 lowercase hex characters, and any `ts` whose month prefix is not `YYYY-MM`. It MUST fail
closed: nothing is created, including the records directory.

## REQ-677-3 — writing is idempotent and says so
`appendRecord` MUST NOT overwrite a record file that already exists, and MUST report which
happened (`written: true|false`). Where an existing file diverges in bytes from the record being
written, what is on disk wins — it may be what another branch merged in. "The record is present"
and "I just wrote it" are different facts and MUST be distinguishable by the caller.

## REQ-677-4 — the merge needs no driver
Two branches capturing two different records, merged with **no `.gitattributes` merge driver in
effect**, MUST merge cleanly with both records present. This MUST be verified by running a real
git merge, not by reading `.gitattributes`. The failing case it replaces (the same two records
appended to one month file) MUST be verified in the same way, so the comparison is executable.

## REQ-677-5 — the residual conflict is bounded and named
A same-`id` pair whose bytes diverge remains a conflict where no driver runs. It MUST be confined
to a single file holding a single record, and the doctrine MUST say so rather than claim the
layout is conflict-free without qualification.

## REQ-677-6 — reading accepts both layouts
Every store reader MUST read a month-file store, a per-record store, and any mixture of the two
identically. No migration may be required to read a store written by an older brain, because
`.memory/**` is consumer-owned.

## REQ-677-7 — the migration proves itself before it destroys anything
`memory:split-records` MUST be report-only unless `--apply`. It MUST refuse — writing nothing —
on any physical line that does not parse, does not validate, or whose bytes do not hash to its
own `id`. It MUST delete a month file only after reading every record that file held back out of
the new layout. On a verification failure it MUST leave both layouts on disk and throw: a
duplicated store is detectable and reported, a store short a record is not.

## REQ-677-8 — the migration collapses repeats the way the readers do
A repeated `id` MUST be collapsed first-wins — the earliest line of the earliest month file, the
line `readRecords()` and `rebuildIndex()` already resolve to — and MUST be REPORTED on both the
report-only and the `--apply` path, including whether the pair was divergent. It MUST NOT be
refused.

## REQ-677-9 — the union attribute stops being load-bearing
`.gitattributes` MAY keep `merge=union` for `records/*.jsonl` as a local convenience for the
residual divergent case, but nothing MAY cite it as making the log conflict-free. Its removal
MUST NOT change any guarantee this change asserts — verified by mutation.

## REQ-677-10 — the doctrine is corrected through the sanctioned door
ADR-0017 and `memory-format.md` MUST be corrected to describe the layout that ships. Both live
under `brain/**` (Tier 3), so the correction MUST ship as `brain-drafts/*.draft.md` consumed by
`brain:promote`, never as a direct agent edit.
