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

**I2 has no owner.** The obvious candidate was `brain-writes-reviewed` (L6), which covers
`brain/core/**` and `brain/project/**` at every tier — but driving its evaluator with A10's
inputs (`reviews: []`) returns **PASS** at `lite` (its evidence is agent-authorship exclusion,
never reviews) and **WARN** at `standard`/`regulated` (*"never failing on missing evidence"*).
It catches A10 at no tier, and that fail-open is deliberate: at PR time, absent review evidence
means *not reviewed yet*. An audit reads merged history, where the same absence means *never
reviewed*. **The same evidence carries different meaning depending on when it is read.**

So I2 is genuinely unenforced on merged history, covered only by `adrPresence`'s imprecision.
It moves to **#511**.

## What this change does

`adrPresence` keeps I1 and takes an added-only list. Backward compatible: omitting the list
preserves pre-#510 behaviour for callers that cannot cheaply produce one.

That is all it does. I2 is #511's.

## The sequencing constraint

This fix **disarms A10**, which is the only thing guarding the MODIFY channel today. It cannot
land unexamined. Three postures, chosen deliberately on #510 rather than implied:
hold until #511 lands · keep the audit surface coarse and accept two surfaces disagreeing ·
land it and record the loss in `KNOWN-LIMITATIONS` with A10 re-frozen by ruling.

## Why it still needs an ADR

Not for the code. For the two rules the investigation produced — evidence is time-dependent,
and a blind surface is recorded rather than given a proxy — and because it narrows what the
audit guarantees until #511 closes.
