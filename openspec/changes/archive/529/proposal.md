---
status: draft
issue: 529
epic: 313
---

# Proposal — the ruling #519 asked for, made

## What this change is

**A ruling, not an implementation.** #529's acceptance asks for one thing: a decision on
(1)/(2)/(3) *"with the chosen option's cost stated in the same sentence as the choice"*. So this
change carries a Tier-2 draft and its promotion checklist, and no behaviour change — because
option (1) is prose by definition, and changing the gate here would pre-empt the ruling.

## The ruling

**Option (1) — correct the prose — now, and its cost is that the gate still cannot notice the
next outage; what it buys is that no one reads it as a per-change guarantee while it cannot be
one.** Sequenced: (2) recency lands after #530 makes the writer a mechanism, and not before
`skip:memory-gate` exists in code.

## The evidence, re-measured

| | |
|---|---|
| `session_summary` records | 205 |
| newest | 2026-08-04T13:58:29Z — **7 days** |
| commits touching `.memory/records/` since 2026-08-05 | **0** |
| merges to `main` in that window | **34**, all green on `memory-gate` |

The gap grew from six days to seven between the ticket being filed and this being drafted. The
measurement moved in the wrong direction while the question sat open.

## Why the ordering is the substance

**Option (2) would have blocked all 34 merges** — the newest record predates every one of them.
And the override the doctrine promises **does not exist**: `workflow-governance.md`'s own caveats
already record that no code path checks `skip:memory-gate`. So (2) today blocks with no escape,
and the only way to land anything is to remove the gate. A protection whose first act is to be
reverted teaches that gates are obstacles — worse than the silence it replaces.

That is why this ruling is a *sequence* and not a *choice*, and why signing it is signing the
order.

## A second defect the measurement surfaced

The doctrine's invariant table says row 3 is **"Hard with override"**. Neither half is true: it
is not hard (repo-scoped, permanently satisfied, green through a seven-day outage) and the
override is unimplemented.

The file already contradicts itself — the metrics caveats state the repo-global scope plainly,
**120 lines below the table**. The table is where a reader forms the belief, and a correction
that lives only in the caveats is one nobody reaches in time. The replacement text fixes the
table and points the caveat at it, so the rule is stated once where it is met first.

## What stays out

**The writer.** `command -v engram` fails in the environment where most of this week's work
happened, and every record in `git log -- .memory/records/` arrived as a deliberate human
`chore(memory): materialize …` act. A habit, not a mechanism. That is **#530**, kept separate on
purpose: a ruling that also fixed the writer would be two subjects, and the second would decide
the first by default.
