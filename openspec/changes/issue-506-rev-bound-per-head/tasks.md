---
status: draft
issue: 506
---

# Tasks — #506

- [x] **T1** `verdictsAtHead` — the shared definition, exported and documented.
- [x] **T2** `cli.mjs` counts at head; `poster.mjs`'s lock cites the same function.
- [x] **T3** `gatherColdBoot` surfaces `priorDecisions` from the same review list.
- [x] **T4** `buildVerdict` takes `rulingAtHead`, guarding only the count-based escalation.
- [x] **T5** Six guards, all DERIVED from a review list per the ticket's red-proof duty.
- [x] **T6** Full suite: **2956 tests, 0 failures**.
- [x] **T7** Five mutations RED: lifetime counting restored · the exit removed · the exit
      widened to `unknownCausality` · decisions unread · a ruling at any head clears it.
