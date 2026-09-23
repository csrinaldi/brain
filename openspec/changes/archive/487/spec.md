---
status: draft
issue: 487
---

# Spec — the verdict block's terminator

## REQ-487-1 — a fenced value does not truncate the block
Every emitted finding MUST survive the round trip, byte-identical, when any value carries a
markdown code fence. `sequencing` MUST survive with it.

## REQ-487-2 — no real label is deleted because a verdict was unreadable
`reconcileBoardLabels` MUST NOT place a live `seq:*` label in `toRemove` as a consequence of
a fenced value. This is the acceptance criterion; a parser-only guard would let the same end
state return through another door.

## REQ-487-3 — the #452 reader guarantee is preserved
A partially-read block MUST answer `null`, never a confident truncated prefix.

## REQ-487-4 — the terminator is anchored, not greedy
A greedy terminator MUST NOT be used: it swallows a later legitimate block. With two fenced
blocks in one body, the FIRST is read (design.md §E2 rule 17).

## REQ-487-5 — an indented fence inside a value is not a terminator

## REQ-487-6 — the untagged-prose-fence limitation is pinned
Behaviour is unchanged and MUST stay asserted, so a future change to rule 17 is forced to
update the doctrine and the test together.
