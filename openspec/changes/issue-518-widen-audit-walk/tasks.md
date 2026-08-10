---
status: draft
issue: 518
---

# Tasks — #518

- [x] **T1** Settle the held design question: `^1` resolves for any non-root commit, so the
      exemption primitives need no change. Only the enumerators do.
- [x] **T2** Widen all three enumerators together — offender side and both revert-side.
- [x] **T3** `readMergeParent`'s contract re-derived; the root is the only refusal.
- [x] **T4** Rename `listMerges`/`merges` → `listAuditedCommits`/`commits` so the untruth does
      not propagate into every caller's destructuring.
- [x] **T5** Remove option (a)'s advisory and replace it with a source drift guard.
- [x] **T6** J-2's expired measurement note refreshed; the fail-OPEN/fail-CLOSED confusion named.
- [x] **T7** The parity test the ticket asks for — one comparison, not two assertions.
- [x] **T8** Frozen A-series passes with zero edits (verified on the diff).
- [x] **T9** Five mutations RED; M4 survived the first pass and its guard was rewritten as a unit.
- [x] **T10** `KNOWN-LIMITATIONS` updated from "the real fix is #518" to the measurement, plus the
      two consequences worth recording (the root, and direct pushes now governed).
- [x] **T11** Full suite: **3041 tests, 0 failures**.
