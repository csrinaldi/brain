---
status: draft
issue: 518
---

# Spec

## REQ-518-1 — parity of shape
A squash-shaped commit MUST receive the same verdict a merge-shaped commit carrying the
identical payload receives. This is asserted as one comparison, never two assertions.

## REQ-518-2 — the walk enumerates the whole first-parent line
No enumerator on the audited path may filter to `--merges`.

## REQ-518-3 — `--first-parent` is retained
A commit inside a merged feature branch MUST NOT be audited as though it landed on the
integration line.

## REQ-518-4 — both sides agree
The offender walk and the revert-side enumerators MUST range over the same commits.

## REQ-518-5 — a squash is remediable
A tree-keyed failure on a single-parent commit MUST be nominatable via `[FAIL-SHA]`.

## REQ-518-6 — the root is uncomputable, never narrowed
A range reaching the root commit MUST fail closed. `readMergeParent` MUST refuse it and MUST
resolve the single parent of any other commit.

## REQ-518-7 — the frozen A-series is unchanged
`#297`'s A5/A7/A8/A10/A11/A12 MUST pass with zero edits to their fixtures or assertions.

## REQ-518-8 — no advisory that cannot fire
The `[WARN] N … were NOT audited` line MUST be removed, not left reporting a structural zero.

## REQ-518-9 — J-2's note is refreshed
The measurement claiming the revert-side gap is unexercised MUST be corrected.
