---
status: draft
issue: 637
---

# Spec

## REQ-637-1 — an index failure is never reported as a refused save
When `rebuildIndex` throws after the append, `save` MUST NOT surface as a bare
`plainfiles.save() failed — …`. The report MUST state that the record was written, MUST name its
`id` and the file it landed in, and MUST carry `rebuildIndex`'s own diagnosis unchanged.

## REQ-637-2 — the report prescribes the recovery, and forbids the harmful one
The message MUST name `memory:reindex` as the next step and MUST explicitly tell the operator not
to re-run `memory:save`. It MUST state the consequence of re-running: a second record with a later
`ts`, hence a different id, which no deduplication can collapse.

## REQ-637-3 — the recovery it prescribes actually works
Repairing the store and running `memory:reindex` MUST index the record `save` had already
written. This MUST be proved by executing that sequence, not by asserting the wording.

## REQ-637-4 — a genuine refusal stays a refusal
Failures that occur BEFORE the append — a missing `type`, an invalid `issue`, a secret hit — MUST
NOT claim that a record was written, and MUST leave `records/` untouched. The new reporting branch
MUST NOT be a catch-all.

## REQ-637-5 — the original error survives
The reindex failure MUST be annotated and rethrown, not wrapped. Every existing caller keeps the
fail-closed throw it already had; `err.message` keeps `rebuildIndex`'s `file:line` diagnosis and
the stack keeps pointing at the origin.

## REQ-637-6 — the clean path does not move
On a store that indexes cleanly, `save`'s stdout MUST be byte-identical to its pre-#637 form, and
its return value MUST be unchanged. This MUST be asserted against the exact string.

## REQ-637-7 — the exit code reflects the real outcome
An index failure MUST exit non-zero: the run did not complete and no index exists. The message,
not the exit code, is what distinguishes it from a refusal.

## REQ-637-8 — the report is a catalog key
The string MUST exist in both `en.mjs` and `es.mjs`, MUST differ between them, and MUST carry the
`{id}`, `{file}` and `{message}` placeholders in every locale.

## REQ-637-9 — red-proved in both directions
Each requirement MUST be red-proved by mutation: the guard removed, the mutation shown to have
landed, the failure observed, the file restored byte-identically.
