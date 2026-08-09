---
status: retro-fitted
issue: 511
epic: 313
---

# Proposal — the audit reads absence with the meaning absence has there

> **Written after the change merged (PR #512), and marked as such.** `phase-order` caught the
> gap; issue #513 carries the correction. A retro-fitted artefact that pretends to have been
> written first is worse than a missing one, so the status above says `retro-fitted` and the
> tasks below record what actually happened, in the order it happened.

## What was wrong

Nothing enforced **"an ADR's decision content must not change without a human gate"** on
merged history. What looked like enforcement was `adrPresence` — an *indexing* check —
covering it by accident, because it decided on file names from `git diff --name-only` and
could not tell an added path from a modified one.

That accident is what caught **A10**, the frozen finder fixture from #297. It is also what
blocks legitimate PRs: correcting one dead citation inside an ADR from months ago fails
`decision-gate` (#510, PR #507).

So the imprecision could not simply be fixed. Removing it removes a protection nobody had
named.

## What was tried, and why each attempt failed

Recorded because the failures are the reasoning, and three of the four were only visible by
building the previous one:

1. **Split added from modified.** Implemented end to end across three enforcement surfaces.
   **Breaks A10** — on the audit surface `adrPresence` was never an indexing rule.
2. **"The invariant already exists: it is L6."** False as stated. Driving
   `evaluateBrainWritesReviewed` with A10's inputs returns **PASS** at `lite` (its evidence is
   agent-authorship exclusion — reviews are never consulted) and **WARN** at
   `standard`/`regulated` (*"never failing on missing evidence"*). It catches A10 at no tier.
3. **Fail a merge with no PR.** Turned **16 tests red**: #474 had just established that such a
   merge stays evaluable, and failing it re-poisons the windows that ticket cleared.
4. **A second `uncomputable` channel inside the check.** Re-broke the same tests. The
   established `prMetaError` channel already existed, one function up.

## What shipped

L6's question, asked on merged history with the reading absence carries **there**:

| | absent review evidence means | verdict |
|---|---|---|
| PR time | not reviewed **yet** | `warn` — correct, or every fresh PR blocks |
| merged history | **never** reviewed | `fail` |

`writesGoverned` **calls** `evaluateBrainWritesReviewed`; it does not re-implement the tier
matrix, the agent-authorship exclusion or the approver set. Two implementations of one rule is
the class #340 records.

## What it deliberately does not do

No new gate: no `GATE_MATRIX` row, no `governance.yml` job, no `GOVERNANCE_JOBS` entry, no
branch-protection re-arm, no tier decision. ADR-0026 already made every one of those calls.
