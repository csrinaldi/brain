---
status: draft
issue: 528
---

# Tasks — #528

- [x] **T1** `assertNoApprovalLabel` in `vcs/lib/`, resolving the label through config.
- [x] **T2** `issueCreate` on GitHub (`gh issue create` + URL-parsed number) and GitLab
      (`POST …/issues` + `iid`), both calling the guard first.
- [x] **T3** `VERBS`, the drift-guard and `vcs-contract.md` — the three sources stay in sync.
- [x] **T4** `brain:ticket:new` + `package.json`; prints the human approval step by its
      resolved label.
- [x] **T5** 20 guards: 8 on the refusal (incl. the both-providers structural lock), 6 on
      contract parity, 6 on the consumer verb.
- [x] **T6** Full suite: **2976 tests, 0 failures**.
- [x] **T7** Six mutations RED, each a plausible implementation rather than a strawman.

## Recorded

- [x] **T8** The first drive of the guard showed GitLab NOT refusing `status:approved`. That
      is the guard working, not failing: on GitLab the approval label is the SCOPED
      `status::approved`, and `actor-check` does not accept the unscoped form either.
      Verified both directions before writing the test, because "the guard did not fire"
      and "the guard is inert" look identical from one call.
