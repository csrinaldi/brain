---
status: draft
issue: 636
---

# Design

## Decision 1 — raw bytes, not canonical equality

The obvious rule is "same `id` → drop the later one", since the id is a content hash and
`rebuildIndex` already resolves repeats first-wins. It is rejected as the *script's* rule.

An id collision means the hashed fields match. It does not mean the LINE matches: `source` is not
hashed, which is precisely why `duplicates.divergent` exists — brain's own export→import→export
widens that field. A cleanup keyed on the id alone would therefore silently discard a line that
differed from the one it kept, and "silently discarded a durable record that differed" is the
worst thing a script touching an append-only log can do.

So the rule is raw byte equality, and anything else refuses the whole run. Probed first: 139
repeats, 139 raw byte-identical, 0 differing — the strictest rule was already satisfiable, so
choosing it cost nothing and bounded the blast radius to exactly zero.

## Decision 2 — refuse the RUN, not the group

On a differing repeat the script exits non-zero and writes nothing at all, rather than skipping
that group and processing the rest. A partial rewrite of an append-only log is a state nobody
asked for and nobody can review: the diff would then be "some duplicates removed", and
reconstructing which and why would mean re-deriving the rule from the data.

All-or-nothing keeps the outcome binary and the diff explainable.

## Decision 3 — first-wins, because anything else moves the index

The retained copy is the first occurrence in sorted month-file order. That is not a preference —
it is the only choice that leaves `index.jsonl` untouched, because it is exactly what
`rebuildIndex` and `readRecords` already resolve to (`store.mjs`: *"the winner is the earliest
line of the earliest month — the SAME line `readRecords()` hands the hydration path"*).

Keeping the last copy would produce an equally valid store and a different index, which would
destroy the one independent proof this change has.

## Decision 4 — the arithmetic self-check

Before writing, the script asserts `physical lines − dropped === unique ids`. It is redundant with
the logic that produced both numbers, and that is the point: it is a check on the *implementation*
rather than on the data. If the parser ever skipped a line, or a corrupt line were counted into
one total and not the other, the numbers stop reconciling and the script refuses instead of
writing a result it cannot account for.

## Decision 5 — corrupt lines are preserved, never dropped

A line that fails `JSON.parse` is written back verbatim. `rebuildIndex` is the store's fail-closed
integrity gate and it reports these; a cleanup script that quietly removed unparseable lines would
be doing integrity work through a side door, and would make the store's own gate report a clean
result on a store it had never seen.

(There are none in this corpus. The branch exists so that it is a decision rather than an
accident, and so the arithmetic check above stays meaningful if one ever appears.)

## Decision 6 — report-only by default

`--apply` is required. A rewrite tool for an append-only log that acts on its bare invocation is
one mistyped command away from a live store. The dry run prints the same numbers the real run
does, so the report is a genuine preview rather than a different code path.

## Decision 7 — kept in the change folder, never a verb

Three options, and the middle one:

| | |
|---|---|
| discard after use | the only evidence of a 139-line rewrite would be the diff; the rule would have to be reconstructed from it |
| `brain/scripts/` + `npm run` verb | a permanent, tab-completable rewrite tool aimed at an append-only log |
| **change folder** | reproducible, auditable, and inert — nothing routes to it, and its header states it is one-shot |

The change folder is also where it belongs by kind: `openspec/changes/**` is the historical
record, and this script IS the historical record of what was executed against the store.

## Decision 8 — the exception is NOT amended into ADR-0017

Recorded here, in the record of the act that took it — not as a clause in the ADR.

Writing "except when …" into ADR-0017 is how a one-off becomes a standing permission. The
conditions that made this lossless (0 divergent, 0 cross-file groups, 0 overlap with in-flight
branches, 139/139 raw-identical) were measured for this corpus on this day; none is guaranteed to
hold for the next occurrence, and the next occurrence — a duplicate arriving by union merge — has
a different answer that #574 already ruled: **dedupe-and-report, never rewrite**.

Leaving ADR-0017's rule stated without qualification is the strongest available signal that this
was an exception. Someone reading the ADR should find "append-only", full stop; someone auditing
`git log .memory/` and finding a deletion commit is led here by its message.

## Decision 9 — verify the in-flight overlap by measurement

The ticket's warning ("must not run while another branch carries unmerged records") is a
condition, not a prohibition, and conditions are checked rather than waited out. Three branches
are in flight; `git diff --numstat origin/main origin/<branch> -- .memory/` shows each touching
`2026-08.jsonl` only, `1 added / 0 deleted`, while every removed line is in `2026-06`/`2026-07`.

Union merge concatenates both sides. A line absent from the incoming side cannot be reintroduced
by it — so the risk is not mitigated here, it is structurally absent. Had any branch touched
`2026-06` or `2026-07`, the answer would have been to wait.

## The independent proof

Everything above is reasoning about the script. The check that does not depend on any of it:

```
index sha256 before : 4c29a1c5…488d
index sha256 after  : 4c29a1c5…488d
git diff --numstat .memory/  →  0/50 in 2026-06, 0/89 in 2026-07, index.jsonl ABSENT
```

139 lines left the durable log and the projection derived from it did not move by one byte. If
the collapse had dropped, altered, or reordered anything the index depends on, the index would
have changed — and git, not the script's own accounting, is what says it did not.
