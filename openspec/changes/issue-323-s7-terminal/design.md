---
issue: 323
phase: design
---

# Design — S7

## D1 — the guard derives, never copies

Tokens come from `SDD_ENGINES` (platform.mjs) at import time. A second list
here would be the one-rule-two-implementations shape; deriving means the
guard's coverage moves with the platform without anyone remembering it.

## D2 — scope draws the produce/verify line

Scanned: brain's declared VERIFICATION_SURFACE (governance-tiers.mjs) —
the vcs and governance roots plus the named verify-side files outside them:
check-refs, brain-audit, change:archive (archive.mjs + archive-logic.mjs),
and the checkpoint evaluator's four files under review/. review/ as a ROOT
stays excluded — its cli and cold-review runner import harness because they
PRODUCE — which is exactly why the verify-side files are declared one by
one (round 7: ADR condition 2's own enumeration is the boundary, and two of
its four readers lived outside the roots).

Entry surfaces, not import closure — a deliberate scope ruling (round 7's
editorial): transitively following imports crosses into shared lib/ and
config vocabulary where an engine name is DATA (migration defaults, config
schema), not a conditional; the neutrality claim is about gate DECISION
surfaces, and the per-file harness-import check already refuses the one
road a decision surface has to reach engine code.

## D3 — proven to bite before shipped

A planted offender file turned the guard red; removing it restored green.
A guard born green with no red in its history is an assumption, not a guard.
