# ADR-0029 — The audit may not enforce an invariant by proxy

**Status**: Draft — pending human signature
**Date**: 2026-08-08 — drafted by an agent for promotion (Tier 2)
**Issue**: #510 · **Epic**: #313

## Context

`brain-audit` re-verifies governance on merged history. It is the enforcing guarantee for
every repository that cannot reach rung 1, including brain's own, so what it can and cannot
see is a governance fact, not an implementation detail.

It evaluates four checks: `diffSize`, `issueLink`, `adrPresence`, `memoryPresence`. It does
**not** evaluate `brain-writes-reviewed` (L6), the gate that requires a human review for any
write to `brain/core/**` or `brain/project/**`.

An ADR lives in `brain/project/decisions/`. So at PR time an ADR change already carries a
human gate — and on merged history nothing asks whether it did. Since #297, `adrPresence` has
been standing in for that question, and it could only do so because it decided on file names
from `git diff --name-only`, which cannot tell an added path from a modified one.

That imprecision became load-bearing. `A10`, the frozen finder fixture from the #297
finder≠patcher ruling, pins the MODIFY channel of the property *a live-at-HEAD ungoverned
artifact must always be reported* — and `adrPresence`'s coarseness is what catches it.

Two consequences met in issue #510:

1. **A false positive with a live cost.** A PR correcting one dead path citation inside an
   ADR from months ago — already indexed in `brain/HOME.md` — fails `decision-gate` (PR #507).
   The failure reason reads *"ADR file added"*, asserting something the check never measured.
2. **A fix that removes a protection.** Distinguishing added from modified was implemented
   across all three enforcement surfaces and breaks A10, because on the audit surface
   `adrPresence` was never an indexing rule at all.

The second is the finding: **one function has been answering two different questions**, and
the second answer is documented only in a docstring belonging to another module and another
ruling (`postmerge/resolution.mjs`).

## Decision

**An invariant is enforced by the check that owns it, on every surface that enforces it. A
surface that cannot see an invariant is blind, and blindness is recorded, never papered over
with a proxy.**

Concretely:

1. `adrPresence` answers exactly one question — *does a NEW ADR arrive with its
   `brain/HOME.md` entry?* — and takes an added-only path list to answer it.
2. The human-gate question is L6's, at PR time and on merged history alike. The audit gains
   an L6-shaped check rather than a new gate: the invariant is not new, only the surface is.
3. That check is **not** a member of `TREE_KEYED_CHECKS`. It keys on PR metadata, not on the
   tree, so it never emits `[FAIL-SHA]` and never auto-reverts. The remedy for *"nobody
   reviewed this"* is a human reviewing it, not a machine undoing it.
4. Review evidence has **three** states, never two: governed, ungoverned, and
   **undeterminable**. A merge whose PR cannot be resolved yields absent evidence, reported
   with the `uncomputable` vocabulary #474 established. Collapsing it into *ungoverned* turns
   the audit red over history it cannot judge; collapsing it into *governed* is a silent
   fail-open.
5. **A10 is reinforced, not retired.** Its frozen invariants stay untouched; it gains a
   resolvable PR carrying review evidence so it distinguishes the three states above. A
   fixture that would pass under the new design for a reason its own comment no longer
   describes is an apparent protection.

## Never do

- **Never let one check answer two invariants.** If a second question is being answered, it is
  answered by name, on every surface, or it is recorded as unenforced.
- **Never add a gate to express an invariant an existing gate already expresses.** Two places
  to read one rule is the drift #340 records for `issue-link` and #443/#472 record for the
  tiered budget.
- **Never collapse absent evidence into negative evidence**, in either direction.
- **Never disarm a frozen fixture to unblock a change.** If the mechanism it pins has moved,
  re-freeze it by ruling, with its comment updated to the mechanism that now does the work.

## Consequences

- **Positive.** A PR that corrects an existing ADR stops being blocked, and the reason a PR
  is blocked stops asserting more than its evidence supports. The human-gate invariant becomes
  enforceable on merged history for the first time — a genuine widening, not a swap.
- **Positive.** No new gate: no `GATE_MATRIX` row, no `governance.yml` job, no
  `GOVERNANCE_JOBS` entry, no branch-protection re-arm, no tier decision. Nine coupling points
  collapse to three.
- **Negative.** The audit gains a per-merge network dependency for review evidence, on the
  existing best-effort seam. Repositories auditing offline will see `uncomputable` where they
  previously saw a verdict — honest, and noisier.
- **Negative.** The MODIFY channel is no longer auto-revertible. It was, by accident, through
  a tree-keyed proxy; it is not, through the invariant that actually owns it. Stated here so
  it is a decision rather than a discovery.
- **Neutral.** `adrPresence` keeps its pre-#510 behaviour when the added-only list is omitted,
  so `brain-promote` and `postmerge/resolution` are untouched.

## References

- Issue #510 · PR #507 (#499) · epic #313
- A10: `brain/scripts/brain-audit.test.mjs` (frozen, governance #297)
- The proxy, documented elsewhere: `brain/scripts/governance/postmerge/resolution.mjs`
- L6: `brain/scripts/vcs/brain-writes-reviewed.mjs` · `GATE_MATRIX` in `governance-tiers.mjs`
- `uncomputable` vs failed: #474 · surface drift: #340
