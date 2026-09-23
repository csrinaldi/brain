---
status: draft
issue: 637
---

# Design

## Decision 1 — annotate and rethrow, never wrap

The reindex failure is the *same error object*, given four extra properties, thrown onward:

```js
err.indexFailed = true;
err.recordId    = candidate.id;
err.recordFile  = file;
throw err;
```

Wrapping it in a new `Error` was the obvious alternative and is worse in three ways at once. It
would drop `rebuildIndex`'s `id mismatch at 2026-07.jsonl:1 — stored id … does not match …`,
which is the only line in the whole report that says *which record is broken*. It would move the
stack away from the origin. And it would change the exception type every existing caller sees,
for a benefit that is purely cosmetic.

Returning a result object instead of throwing was also considered and rejected: `save` is
fail-closed today, and every caller — including future ones — relies on a throw. Downgrading a
failure to a return value that a caller might not read is precisely #574's defect (`share`
returned an accounting nobody printed). The facts travel as data; the *failure* keeps travelling
as a throw.

## Decision 2 — the branch is narrow by construction

`cli.mjs` keys on `err.indexFailed`, a flag set at exactly one site — the `catch` around
`_rebuildIndex`. It is not a message match, not an `instanceof`, not a heuristic. So a refusal
that happens before the append cannot reach the new branch even by accident, and the mutation
that makes one leak (M6) fails two tests.

This matters because the new message asserts something very specific — *"the record WAS
written"* — and that claim is only true downstream of the append. A catch-all would turn the fix
into the same lie pointing the other way.

## Decision 3 — the message carries the consequence, not just the instruction

`Do NOT run memory:save again` on its own is an instruction an operator can reasonably ignore
while debugging. So the message says *why*:

> a retry mints a SECOND record with a later `ts`, hence a different id, which no deduplication
> will ever collapse

That sentence is the measurement from the proposal, compressed. It is in the message rather than
only in the ticket because the ticket is not what the operator is reading at 2am.

## Decision 4 — the dedup guard, built and then removed

Implemented, measured, deleted. The reasoning is in the proposal; the part that belongs here is
what it would have cost structurally: a fifth injectable seam on `save`, a second return shape
(`alreadyPresent`), a third catalog string, and a branch in the CLI's success path — all to
protect a window measured at "two human invocations inside the same wall-clock second", with no
automated caller in the repo to widen it.

The decisive argument was not cost. It was that the guard reads like protection and cannot fire,
which is the failure mode #637's own reference list names (#632). Removing it keeps the diff
honest about what it does and does not achieve.

## Decision 5 — exit 1, and why that is not a contradiction

The record landed, so "success" is tempting. It is wrong: no index was produced, the store is in
a state that needs repair, and automation reading only the exit code must not be told everything
is fine. Exit 1 is the accurate signal for the *run*.

What was broken was never the exit code — it was that the exit code was the operator's only
accurate signal, and the message contradicted it by implying the record had not been written.
The exit code stays; the message stops lying.

## Decision 6 — the recovery path is executed, not asserted

`REQ-637-3` exists because a message that names `memory:reindex` is worth nothing if
`memory:reindex` cannot in fact recover the record. The test removes the tampered file and runs
the real `reindex` op, then asserts it indexed **1 record** — the one `save` had written. Advice
that has never been run is not advice.

## What the clean-path test actually asserts

Not "stdout contains the id". The exact string:

```js
`memory/cli: ✓ saved ${id} → ${join(recordsDir, '2026-08.jsonl')}\n`
```

`REQ-637-6` says byte-identical, and a `match()` would have passed against the mutation that
appends ` (indexed)` to the success line. M7 exists to prove it does not.
