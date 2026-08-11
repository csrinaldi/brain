---
status: draft
issue: 340
---

# Tasks — #340

- [x] **T1** Reproduce both cases from the ticket and its comment, driven rather than assumed.
- [x] **T2** Run the audit #340 asks for over every check `brain:check` performs.
- [x] **T3** `brain:check` calls the CI evaluator for `issue-link` and `memory-gate`.
- [x] **T4** `getDefaultBranch` / `getTargetBranch` — fail closed, stricter default,
      `BASE_BRANCH` as the explicit opt-out.
- [x] **T5** The `[UNVERIFIED]` state, the suppressed ready-to-ship claim, and the remedy.
- [x] **T6** `local-ci-parity.test.mjs` — 7 fixtures × 2 checks, plus the two deliberate
      divergences and the two unverifiable paths. 18 guards.
- [x] **T7** Three mutations RED (5 / 1 / 2).
- [x] **T8** Full suite: **3111 tests, 0 failures**.
- [x] **T9** Hazard 2 filed separately as **#545**, with its measurement and the question it
      has to answer first (what the platform actually does with a reference in a code span).

## Recorded

- [x] **R1** **The audit found three divergences, not one.** Two were invisible to the ticket:
      the approved-label verification and the issue-scoped memory match are both policy layers
      CI grew *after* `brain:check` was written, and nothing noticed either. The ticket's own
      last line — "audit the other five before assuming this one is isolated" — was the
      load-bearing instruction.
- [x] **R2** **A test fixture encoded the defect.** `brain-check.test.mjs`'s "all checks pass"
      context carried a `session_summary` with no `issue` and a body reading `Closes #42` — a
      combination CI rejects. It was asserting exit 0 on a change CI would fail. Corrected to
      scope the summary, rather than relaxed.
- [x] **R3** **`init.defaultBranch` was tried and removed.** It describes branches git CREATES,
      not this remote's, so reading it as a fallback answers confidently with a value unrelated
      to the repo — a fabricated default in the place the ticket specifically says to fail
      closed.
- [x] **R4** **The target branch cannot be known locally at all**, because the PR does not
      exist. It defaults to the STRICTER rule with an explicit opt-out, which is the only shape
      that satisfies "local is never laxer" without pretending to know something it does not.
- [x] **R5** **`git symbolic-ref refs/remotes/origin/HEAD` is unset in a fresh clone**, which is
      what this container is — so `issue-link` reports UNVERIFIED here rather than a verdict.
      That is the honest state, and it is why the remedy is printed instead of a fallback
      invented.
- [x] **R6** **Hazard 2 reproduces**: `"deliberately does NOT close #405"` followed by
      `Closes #485` yields matches `['close #405', 'Closes #485']`, and `extractIssueNumber`
      is first-match-wins — so brain verifies the approved label on **#405** while the PR is
      about #485. Filed rather than bundled: this ticket is *two implementations of one rule*,
      that one is *one implementation misreading its input*, and merging them would make the
      parity guard hostage to a debate about PR prose. Filed as **#545**.
