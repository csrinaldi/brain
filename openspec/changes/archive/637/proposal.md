---
status: draft
issue: 637
---

# Proposal — the save did not fail; the store was already broken

## The ruling

**Option 1 — report it accurately.** Keep the order, catch the reindex failure, and say the
three things the old message denied: the record **was** written, here is where, and here is what
to run instead.

Options 2 and 3 are both rejected for the reason the ticket itself gives: *"`save` should not be
the verb that discovers a pre-existing tamper."* Pre-flighting (2) and write-ahead (3) differ in
machinery but agree in outcome — both **refuse the operator's work** because of somebody else's
broken record, weeks old, in an unrelated month file. The operator's record is valid, scanned,
and content-addressed; there is no reason for it not to land.

## Measured before writing anything

On `main` at `1c21976`, against a store carrying one line whose bytes no longer hash to its id:

```
$ … cli.mjs save "T" "C" --type discovery
memory/cli: plainfiles.save() failed — rebuildIndex: id mismatch at 2026-07.jsonl:1 —
  stored id 'rec-fd1672d…' does not match the recomputed id 'rec-20d8224…' (tampered or stale record)
EXIT=1

$ ls .memory/records/            → 2026-07.jsonl  2026-08.jsonl   ← 2026-08 did not exist before
$ wc -l .memory/records/2026-08.jsonl → 1          ← the record IS there
$ ls .memory/index.jsonl          → No such file
```

Told it failed. No index. Record durable. Exactly as reported.

## What the retry actually does — worse than the ticket says

The ticket says re-running "appends a **second** copy". Measured, it is worse than that, and the
difference matters:

```
run 1 → rec-d395b54eaef9e5e9
run 2 → rec-83056a6155f0c305      ← different id
run 3 → rec-fa27966b4558757f      ← different id
2026-08.jsonl: 3 lines, 3 unique ids
```

`ts` is hashed into the content-addressed id, at second resolution. So:

- **retried inside the same wall-clock second** → identical `ts`, identical id, a genuinely
  duplicated line. #574's report can at least name it. Verified: 2 lines, 1 unique id.
- **retried a second later** — which is every hand retry — → a different id. By the store's own
  definition these are **not duplicates**, so no dedup will ever collapse them and no report
  will ever mention them. The same knowledge, twice, permanently, invisibly.

This is why the fix is the message and not a guard: see below.

## A guard I built, measured, and removed

The acceptance line *"re-running does not silently duplicate"* invites a dedup, and
`dualWriteRecords` already has one (#221) whose comment claims "a retry after ANY abort is
safe". So it was implemented: read `readRecordIds` before the append, decline a candidate whose
id is already present. It works, and `readRecordIds` is even the right reader for it — it skips
corrupt lines rather than refusing, so it still answers on the very store whose `rebuildIndex`
is about to throw.

Then it was measured, and **it does not fire in the real scenario**. It can only match when the
retry lands in the same second as the original, because otherwise the id differs. There is no
automated caller — `memory:save` is a hand-run npm verb and nothing in the repo invokes it — so
the window it protects is "two human invocations inside one second", i.e. never.

It was removed. Shipping it would have cost every save a full extra read of the store (measured:
96ms against `rebuildIndex`'s 336ms, 28% of a rebuild) to buy a protection that reads as real
and cannot fire — which is the shape #637 itself cites as related: **#632, a test green for the
wrong reason**. A guard whose green means nothing is the same defect wearing different clothes.

So `re-running does not silently duplicate` is satisfied by the only thing that can satisfy it
here: the duplication is no longer **silent**. The message names the action, forbids it, and
explains the consequence in the terms that make it stick — a second record with a different id
that nothing will ever collapse.

## Why this is the same defect family the repo keeps finding

Every other write in this module scans before it writes. `dualWriteRecords` aborts *"before the
append-only log is ever touched"*; `share()` runs the chunk backstop first because otherwise
*"`records/` would already be mutated on an aborted share"*. `save` is the one verb that
**cannot** follow the rule — `rebuildIndex` reads the whole store, so it can only run after the
line it must see.

The discipline being impossible is not the defect. Reporting the impossibility as a refusal is.
Two different situations — "your save was rejected" and "your save landed on a store that was
already broken" — were printed identically, and the message named neither.

`duplicates.mjs:216-221` already documents this exact hazard from the other side, where it
guards its own reporter against turning a completed save into `plainfiles.save() failed`. The
guard was correct; the underlying lie was left standing.

## Acceptance

- [x] On a store whose reindex refuses, `save` states the record WAS written, where, why the
      index failed, and what to run — never a bare `save() failed`.
- [x] Exit code reflects the real outcome: **1**, because the run did not complete — but the
      message no longer lets that be read as "nothing happened".
- [x] Re-running does not *silently* duplicate — with the honest note above that the mechanism
      is the message, and why a guard cannot do it.
- [x] The clean path is byte-identical to today — asserted on the exact stdout string, not by eye.
- [x] Red-proved both directions: a broken store and a healthy one, plus a pre-append refusal
      that must NOT claim a record landed.

## Links

- #598 / #574 — where this was found and disclosed · #632 — a test green for the wrong reason,
  the reason the dedup was dropped · #221 — `dualWriteRecords`' scan-then-write, the discipline
  this verb cannot follow · ADR-0017
