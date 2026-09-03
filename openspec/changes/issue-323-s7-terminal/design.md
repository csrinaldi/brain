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

Scanned: vcs + governance + check-refs (verifier territory). Excluded:
harness/roles/review — engines are their subject matter; scanning them would
force allowlist noise and dilute the signal to zero.

## D3 — proven to bite before shipped

A planted offender file turned the guard red; removing it restored green.
A guard born green with no red in its history is an assumption, not a guard.
