---
status: draft
issue: 518
epic: 313
---

# Proposal — the audit says what it did not look at

Option **(a)** of #518's residual (2). **(b) — widening the walk — is the real fix and stays
open**; this is the honest interim, not a substitute for it.

## The gap

`listMerges` selects `git log --first-parent --merges`. A squash merge lands as a
**single-parent** commit, so it is never enumerated: none of `diffSize` / `issueLink` /
`adrPresence` / `memoryPresence` / `writesGoverned` ever runs on it. On a clean window the
cursor advances to the tip, and since the cursor only moves forward, those commits fall
outside every future window — **permanently unauditable**.

Measured on `origin/main`, 60 days: **101 first-parent commits, 70 merges, 33 never
audited** (32 carrying a `(#N)` PR reference).

The old silence, reproduced in a fixture: a window whose only content is a squash printed

```
[INFO] No merge commits found in range: <base>..HEAD
```

and exited 0. Not *"checked and clean"* — never read, reported as nothing to read.

## What lands here

The audit emits `[WARN] N first-parent commit(s) … were NOT audited`, and reports coverage
**unknown** rather than zero when the count cannot be taken.

**Advisory only** — it does not touch the verdict, the exit code or the cursor. Making it
fail would halt the cursor over 33 commits of existing history and turn `cursor.mjs accept`
into a routine act, which is the erosion #518 itself names.

`docs/KNOWN-LIMITATIONS.md` records the gap with the measurement, what it does and does not
mean, the operator action (disable Squash/Rebase in the repository's merge-button settings —
a platform setting `brain:protect` does not reach), and the pointer to (b).

## Why (a) is explicitly not a durable answer

It depends on a repository setting nobody enforces and on a warning nobody must act on. It
is correct about the past and buys nothing for a consumer who squash-merges by policy —
which is most of them. **The ticket is re-scoped so (b) is the stated fix.**

## Why (b) is a design change, not a filter change

The reverter-exemption model keys on `<sha>^1..<sha>` — a merge's contribution against its
first parent. For a linear commit that is simply its own diff, so `netAddFull`,
`addedPathsAbsentAt` and `[FAIL-SHA]` nomination each need re-deriving before the walk can
widen. Changing the filter alone would extend the audit to commits whose exemption
semantics are undefined.

## Correction carried from the ticket

Residual (2) was recorded as *"the documented J-2 liveness gap"*. It is not. J-2
(`resolution.mjs`) is the same filter on the **revert** side and is **fail-CLOSED** — an
offender never auto-clears, more human-gate load, no forgery. This is the **offender** side
and is **fail-OPEN**. J-2's own note that *"brain merges PRs with `--merge` … the gap is
currently unexercised here"* has also expired: 32 squashes in 60 days.
