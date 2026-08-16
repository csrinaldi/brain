---
status: draft
issue: 636
---

# Proposal — the second half of #574's acceptance

## What this completes

#574's acceptance read *"the duplicate count on the current corpus is reported **and reconciled
to zero**"*. #598 delivered the reporting and deliberately left the corpus alone, on #574's own
sequencing — *"a one-shot cleanup … **after** the rule exists — not before, or the rule ships
untested against the only real corpus there is"*. That was right. #574 then closed on the merge
and the second half lost its ticket. This is it.

## Measured on `main@1c21976`, before anything was written

```
unique records       : 2046
duplicated ids       : 49
excess lines         : 139
divergent groups     : 0
excess lines per file: {"2026-07.jsonl": 89, "2026-06.jsonl": 50}
occurrence histogram : {2: 15, 3: 16, 4: 2, 5: 8, 6: 1, 8: 7}
no group spans two files
```

Identical in every respect to the ticket's own measurement except the record total, which has
risen 2039 → 2046 as seven records landed since. The excess is **unchanged at 139**, which is
itself worth stating: no new duplicate has arrived in the meantime, so this is still the same
pre-#221 residue and not a growing union-merge problem.

## The safety argument, measured rather than asserted

The ticket warns: *"it must not run while another branch carries unmerged records, or union will
resurrect them."* Three branches are in flight right now (#663, #664, #667), and each carries an
unmerged record. So the warning applies — and it is satisfied, precisely:

| | |
|---|---|
| every excess line is in | `2026-06.jsonl` (50) and `2026-07.jsonl` (89) |
| lines removed from `2026-08.jsonl` | **0** |
| what the three in-flight branches touch | `2026-08.jsonl` only — `1 added, 0 deleted` each |

The files this rewrites are files no open branch modifies. Union cannot resurrect a line that no
incoming side contains, so the resurrection risk is not merely unlikely here, it is absent.

## Losslessness is provable here, not argued

The rule applied is the strictest one available: a repeat is dropped **only when its raw line is
byte-identical to the line already kept for that id**. Not "canonically equal", not "same id" —
the same bytes. Probed before writing the script:

```
repeat lines       : 139
RAW byte-identical : 139
RAW differing      : 0
```

So the strictest possible rule was already satisfied by the whole corpus. This is the one moment
where "no information is lost" is a measurement rather than a claim.

The proof after the fact is stronger still, and comes from git rather than from me:

```
index sha256 before : 4c29a1c5450e602114ad3427cd7eaf9802ba0d0615a7e6170632db830c75488d
index sha256 after  : 4c29a1c5450e602114ad3427cd7eaf9802ba0d0615a7e6170632db830c75488d
$ git diff --numstat .memory/
0   50   .memory/records/2026-06.jsonl
0   89   .memory/records/2026-07.jsonl
```

`.memory/index.jsonl` does not appear in the diff **at all** — 139 physical lines left the
durable log and the projection built from it did not move by one byte. The records diff is
`0 added, 139 removed`: pure deletion, nothing rewritten in place.

## What it buys

`npm run memory:reindex` before and after:

```
before: ✓ reindex complete — 2046 record(s) indexed.
        ⚠ 49 duplicate record id(s) … 139 excess physical line(s) … (+11 more lines)

after:  ✓ reindex complete — 2046 record(s) indexed.
```

The twelve-line warning that fired on every store-reading verb is gone. That matters beyond
tidiness: while the baseline sat at 49, a genuinely new union-merged duplicate was invisible
inside it. From zero, the next firing of that report means something.

## The append-only exception, and why it is not a precedent

`records/*.jsonl` is append-only by doctrine (ADR-0017), and union safety leans on it. This
rewrites two of those files. Recorded as a deliberate, one-shot exception:

- **What was rewritten:** `2026-06.jsonl` (135 → 85 lines) and `2026-07.jsonl` (2000 → 1911).
  `2026-08.jsonl` untouched.
- **Why it was safe here:** every removed line was raw byte-identical to a kept one (139/139), no
  group spanned two files, no divergent group existed, and no in-flight branch touches either
  rewritten file. The index is byte-identical across the change, which is the independent check.
- **Why it is not a precedent:** the residue is pre-#221 — a re-run of the migration or export
  from before `readRecordIds` deduped candidates — and #221 closed the source. The conditions
  that make this lossless (0 divergent, 0 cross-file, 0 in-flight overlap) were *measured for
  this corpus on this day*, not assumed, and none of them is guaranteed to hold next time. A
  future duplicate arriving by union merge is a different object with a different answer, and
  #574 already ruled that one: **dedupe-and-report, never rewrite**.

**Deliberately NOT amended into ADR-0017.** Writing a carve-out into the ADR is how a one-off
becomes a standing permission — the opposite of what this ticket asks for. The exception belongs
in the historical record of the act that took it, which is this change folder. ADR-0017's rule is
left stated without qualification, which is the strongest available signal that this was an
exception rather than a rule.

## The script: kept, but not as a verb

The ticket asks explicitly. The ruling is to keep it **in this change folder**
(`dedupe-records.mjs`) and not in `brain/scripts/`, and not behind an `npm run` verb.

Discarding it outright was the alternative. Rejected: the only remaining evidence of a 139-line
rewrite of the durable store would be the diff, and a reviewer would have to reconstruct the rule
from it. Making it a verb was the other extreme — a rewrite tool for an append-only log, one
tab-completion away from a live store, permanently.

It also defaults to report-only and requires `--apply`, and it refuses outright — naming every
offender — if any repeat is not byte-identical to the kept line. Choosing between two differing
copies is a human decision, and a cleanup script must not make it quietly.

## Acceptance

- [x] `npm run memory:reindex` reports **no** duplicates, and the index is unchanged by the
      cleanup — proved by sha256 and, independently, by the index not appearing in `git diff`.
- [x] Record count identical: **2046 in, 2046 out**.
- [x] The append-only exception is written down: what, why safe, why not a precedent.
- [x] Landed as its own commit, pure deletions, before/after numbers in the message.

## Links

- #574 (the criterion this completes) · #598 (the rule, which had to exist first) · #221 (the
  dedup whose absence produced these lines) · ADR-0017
