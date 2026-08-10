---
status: draft
issue: 518
epic: 313
---

# Proposal — the audited set is the first-parent line, not the merges on it

## What was wrong

`listMerges` selected `git log --first-parent --merges`. `--merges` means *more than one
parent*, so a **squash merge — a single-parent commit — was never enumerated**. Not evaluated
and passed: never looked at. None of `diffSize` / `issueLink` / `adrPresence` /
`memoryPresence` / `writesGoverned` ran on it.

The silence compounds. A window with no findings exits 0, the workflow advances the cursor to
the tip, and the next window starts there. Because the cursor only moves forward, every
unenumerated commit became **permanently un-re-auditable**. There was also no remediation path:
`[FAIL-SHA]` can only nominate a commit the audit enumerated.

Measured on `origin/main`, 60 days to 2026-08-10: **112 first-parent commits, 79 enumerated, 33
never audited** — 32 of them carrying a `(#N)` PR reference, among them #404, #433, #448, #462,
#401. Governance work.

## Why the merges-only walk was not simply a filter bug

The maintainer's ruling was **(b), the widening**, with (a) explicitly recorded as a stopgap.
The reason it stood open across three PRs is that every exemption predicate is built on
`<sha>^1..<sha>` — a merge's contribution against its first parent — and nothing had decided
what that means with no second parent.

**The answer makes the model simpler, not harder.** `^1` resolves for *any* non-root commit, and
for a linear one it is simply its own diff — less ambiguous than a merge's contribution, not
more. So `sign`, `netPresent`, `netAddFull` and `addedPathsAbsentAt` need **no change**.

What had to move is the three **enumerators**, and they had to move together:

| | |
|---|---|
| `listAuditedCommits` (`merge-walk.mjs`) | the offender side |
| `firstParentMergesAfter` (`resolution.mjs`) | the revert side, half-open |
| `firstParentMergesInclusive` (`resolution.mjs`) | the revert side, full-window |

Widening one alone is worse than either narrow one: an offender the walk now reports, whose
genuine revert the revert side still cannot see, would be reported and never clear.

## J-2 closes in the same change

J-2 was the same `--merges` filter on the revert side, documented rather than fixed because it
is fail-**closed** — a genuine revert unseen means the offender never auto-clears and goes to
the human gate.

**Its premise had expired.** The docstring reassured that brain merges with `--merge`, so "the
gap is real but currently unexercised here", measured at 105 first-parent merges and **0**
non-merge reverts. Re-measured: **33** single-parent commits on the line. Both directions live.

It also has to be said for anyone following the old pointer: J-2's reassurance that *"no forgery
slips through"* described the revert side. It never applied to the offender-side walk, where the
identical filter was fail-**OPEN**. Reading one as the other is how this stayed unrecorded.

## The consequence to weigh, stated plainly

**Every commit on the integration line is now governed, including direct pushes.** A commit
pushed straight to the default branch with no issue reference now fails `issueLink`, where
before it was invisible.

That is the fix, not a side effect — but it is the thing a reviewer should weigh, and it is why
three existing fixtures needed a closing reference on their helper commits. `--first-parent` is
untouched, so a `Part of #N` commit inside a merged feature branch is still not audited as
though it had landed on its own.

**Existing history is not re-audited**: the cursor only moves forward and already sits at the
tip, so the 33 stay unaudited and nothing turns red retroactively. The gap closes for
everything from here.

## Naming

`listMerges` returning `{ merges }` became untrue of both the function and the field. Renamed
to `listAuditedCommits` / `{ commits }` rather than kept with a note, because a destructured
field name propagates the untruth into every caller.
