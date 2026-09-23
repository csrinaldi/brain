---
status: draft
issue: 510
---

# Tasks — #510

## Implementation

- [x] **T1** — `adrPresence(changedFiles, addedFiles = null)`; the missing-index branch
      keys on the added list, the `HOME.md`-without-ADR branch keeps the touched set.
- [x] **T2** — CI: `defaultDiffNameOnlyAdded` in `governance/run-check.mjs`, read inside
      the SAME `try` as the touched list.
- [x] **T3** — local: `brain-check.mjs` passes the added list; the CLI computes it.
- [x] **T4** — audit: `readMergeDiff` returns `addedFiles` through `gitOrThrow`;
      `evaluateMerge` threads it; `brain-audit.mjs` and `brain-metrics.mjs` pass it.

## Fixture and guard work

- [x] **T5** — A10 reinforced (maintainer's ruling, option 3): a resolvable PR whose only
      review is a COMMENT, plus an assertion that the report names `writesGoverned`.
      Frozen invariants untouched.
- [x] **T6** — **A10d** added: the cleanup reverter's missing human gate survives the
      net-parity exemption and never carries `[FAIL-SHA]`.
- [x] **T7** — `D2 A6` re-anchored to its property. It asserted R is `[SKIP]`; R now comes
      out `[PASS]` because the spurious `adrPresence` failure it was being exempted from no
      longer exists. Asserting `[SKIP]` would be asserting the bug is still there.
- [x] **T8** — the exit-contract drift-guard gains the added-list read as its own cell.
- [x] **T9** — `runCheck` tests: modified passes, added fails and names it, injected
      added-list uncomputable, and the SHIPPED reader uncomputable.

## Verification

- [x] **T10** — full suite: **2913 tests, 0 failures**.
- [x] **T11** — five mutations, each diff printed before it ran:

  | | mutation | must turn RED |
  |---|---|---|
  | M1 | `writesGoverned` always passes | A10 · A10b · A10d |
  | M2 | `adrPresence` back to name-only | the modified-ADR case |
  | M3 | the added-list read returns `[]` instead of throwing | the shipped-reader guard |
  | M4 | `writesGoverned` added to `TREE_KEYED_CHECKS` | A10d |
  | M5 | `writesGoverned` dropped from `realResults` | A10 · A10b · A10d |

## What the mutations found — recorded because they were wrong turns, not confirmations

- [x] **T12** — M3 came back **green** on the first run. Every existing guard injected
      `diffNameOnlyAdded`, so nothing exercised the shipped reader; the mutation could gut
      it in production and leave the suite untouched. An injected-only guarantee guards
      nothing. Fixed by T9's fourth case.
- [x] **T13** — M4 came back **green** too, and the comment I had written on A10 claimed
      the opposite: that A10's `never [SKIP]` now held *because* `writesGoverned` is not
      tree-keyed. False. A10's offender is live at the tip, so the exemption never applies
      to it whatever the membership is. The comment was corrected to say what A10 does not
      prove, and A10d was written to prove it where it can actually fail.
- [x] **T14** — A10d's first version asserted the property of the wrong merge. It aimed at
      the offender O and failed, because `resolvedSkipLine` drops a net-absent merge
      **before any check runs** — O never reaches `writesGoverned` at all. The exemption
      only decides for the cleanup reverter R, which is what A10d now tests. The
      pre-evaluation skip's reach over review evidence is real, is documented behaviour
      (design §3.5), and is raised separately rather than changed inside this ticket.

## Doctrine

- [x] **T15** — `ADR-0029` drafted under `brain-drafts/` (Tier 2 — an agent may draft,
      a human promotes). It supersedes the draft on `feat/issue-510-audit-sees-l6`, whose
      "I2 is unowned" framing expired when #511 merged.
