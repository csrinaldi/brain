---
status: draft
issue: 519
epic: 313
---

# Proposal — a memory layer that stops being written must say so

## What was measured

`.memory/records/` — newest record `2026-08-04T15:35:08Z`. Six days, during which #512,
#515 and #517 merged plus the work behind #510, #511, #513, #454 and ADR-0026 Amendment 3.
**Not one record.**

`memory-gate` was green on every one of those PRs, correctly by its own definition: it asks
whether the repo has **ever** captured a `session_summary`. There are 205.

## The diagnosis, in two phases — only the first was legitimate

| window | what was happening |
|---|---|
| **Aug 4 → Aug 8** | Materialization was genuinely blocked by **#469** — the secret-scrub gate scanned zero chunks and stood between local session content and a public repo. Not writing was correct. |
| **Aug 8 → Aug 10** | **#469 closed.** The block lifted and the practice never resumed. |

The second phase is the finding. Nothing scheduled the resumption, nothing measured the
gap, and the only signal in either phase was one dim line — `memory: engram unavailable
(skipped)` — printed at the top of every agent session and reading as housekeeping.

`git log -- .memory/records/` shows why it can stall so quietly: every materialization in
this repo's history is a deliberate act, either a dedicated `chore(memory): materialize …`
commit or one bundled into a feature PR. It is a habit, not a mechanism.

And the habit has a precondition the busiest environment cannot meet: capture is
`mem_session_summary` **into engram**, and `command -v engram` fails in the remote agent
environment. Every session there prints the skip line and proceeds.

## What this change does

Reports the age of the newest durable record at `brain:session:start`:

```
memory:   engram unavailable (skipped)
memory:   newest durable record is 5 days old — nothing captured since (see #519)
```

It reads `.memory/records/*.jsonl` **directly rather than asking engram** — deliberately,
because the case worth reporting is exactly the one where engram is what is missing, so a
probe that needs engram to answer cannot answer it. Committed records are the durable truth
(ADR-0002); engram is the queryable projection.

An unreadable or empty store answers `null` (unknown), never `0` (fresh). *"Cannot
determine"* and *"captured today"* are different answers, and collapsing them is the
`evidence-reader-empty-on-failure` class this repo has now paid for nine times.

## What it deliberately does not do

**It does not touch `memory-gate`.** Whether the gate should be able to see this is #519's
open ruling, with three options at ascending cost (correct the prose · require recency ·
require per-change capture). Tightening the gate while the writer is unreliable converts a
silent outage into a total block, and the fix would then be measured by how quickly people
reach for `skip:memory-gate`.

What is closed here is the **silence**. The ruling stays the human's.

`memory-presence.mjs`'s header is corrected in the same pass: it described reading
`.memory/chunks/*.jsonl.gz`, a directory the C4 migration (#247) retired. The reader
followed the migration; the comment did not.
