---
status: draft
issue: 510
epic: 313
---

# Proposal — one check was answering two questions, and the audit was blind to one of them

## What is wrong

`adrPresence` decides on file names from `git diff --name-only`, which cannot tell an added
path from a modified one. So the rule *"a new ADR must be indexed in `brain/HOME.md`"* fires
on any PR that merely **touches** an existing ADR. PR #507 corrects one dead path citation
inside an ADR from months ago — already indexed — and `decision-gate` blocks it.

Its reason string is a second defect: **"ADR file added but brain/HOME.md was not updated"**,
on evidence that never established adding.

## Why the obvious fix is wrong

Distinguishing added from modified was implemented end to end and **breaks A10**, a frozen
finder fixture from the #297 finder≠patcher ruling: an ungoverned ADR *edited back in* and
live at HEAD must always be reported. On the audit surface `adrPresence` is not an indexing
rule — it is a content tripwire, documented only in a docstring belonging to another module
and another ruling (`postmerge/resolution.mjs:461`).

## The actual shape

Two invariants have shared one function since before tiering, and nothing separated them
because no PR had ever modified an ADR without also touching `brain/HOME.md`.

| | invariant | keys on |
|---|---|---|
| **I1** | a NEW ADR appears with its `brain/HOME.md` entry | added paths |
| **I2** | an ADR change carries a human gate | review evidence |

**I2 already exists and is already enforced.** `brain-writes-reviewed` (L6) covers
`brain/core/**` and `brain/project/**` at every tier, so an ADR modification cannot merge
without human evidence. What does not exist is the audit's ability to *see* it:
`evaluateMerge` builds four results and L6 is not among them. `adrPresence`'s coarseness has
been standing in for that answer since #297, when it was the only instrument available.

## What this change does

1. `adrPresence` keeps I1 and takes an added-only list. Backward compatible: omitting the
   list preserves pre-#510 behaviour for callers that cannot cheaply produce one.
2. The audit gains an L6-shaped check, so I2 is enforced by the invariant that owns it on
   both surfaces rather than by a proxy on one.
3. A10 is **reinforced**, not retired: it gains a synthetic reviewed PR so it distinguishes
   *ungoverned* from *undeterminable*, and proves the MODIFY channel under the new design
   rather than passing for an accident of fail-closed arithmetic (maintainer ruling).

## What it does not do

No new gate. No `GATE_MATRIX` row, no `governance.yml` job, no `GOVERNANCE_JOBS` entry, no
branch-protection re-arm, no tier decision — L6 already carries all of them. This is not a
new invariant; it is an existing one reaching a surface that could not see it.

## Why it still needs an ADR

It changes **what the audit is allowed to be blind to**, and it re-freezes a fixture a prior
ruling froze. Both are decisions about the governance model, not implementation details.
