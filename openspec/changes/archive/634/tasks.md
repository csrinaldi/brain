---
status: draft
issue: 634
---

# Tasks — #634

- [x] **T1** Measure the corpus and the output: 2185 physical lines, 2046 unique, 139 excess
      across 49 ids — and `brain:metrics` printing `13/2046` with nothing able to explain the gap.
- [x] **T2** Read all six consumers and classify them: three test existence, two print a count,
      one carries records into a verdict.
- [x] **T3** `computeMemoryCoverage` reads through `readRecords` and returns the accounting,
      normalized on every path including the unavailable one.
- [x] **T4** `brain:metrics` markdown states the gap — physical total, excess, ids, and the verb
      that locates them — and only when there is one.
- [x] **T5** JSON report takes the counts and drops `groups`. Found while implementing: passing
      the snapshot through whole measured **6871 bytes per row against 111** — 62×, ~79 KiB of
      repetition on a twelve-period run, because the snapshot is denormalized onto every row.
      Projected explicitly and without mutating the caller's object; both have mutation tests.
- [x] **T6** PROVE the existence-only silence instead of asserting it: `memoryPresence` is
      `.some()`, dedup is first-wins, so the predicate is invariant. Verified by a test with both
      preconditions asserted, so it cannot pass against a fixture that never had duplicates.
- [x] **T7** Record the register at `readRecordObservations` — the one chokepoint all six share —
      including the rule for the next consumer, not just the list.
- [x] **T8** Rule the reviewer's treatment and write it into `cold-boot.mjs`: deliberately silent,
      with the reasoning and the condition under which it should be revisited.
- [x] **T9** Reproduce `share()`'s side effect on a store-less repo and document it, recording the
      gating alternative, why it was not taken, and what would make it right.
- [x] **T10** Nine tests; seven mutations RED, each verified to have LANDED before the result was
      read, each restore `diff -q` byte-identical:

      | # | mutation | went red |
      |---|---|---|
      | M1 | accounting never leaves the snapshot (pre-#634) | 6 tests |
      | M2 | metrics duplicate line removed | 1 test |
      | M3 | line fires unconditionally | 5 tests (4 pre-existing) |
      | M4 | physical total computed wrong | 1 test |
      | M5 | `groups` leak into JSON | 1 test |
      | M6 | projection mutates the caller's object | 2 tests (1 pre-existing) |
      | M7 | unavailable returns `undefined` duplicates | 1 test |

- [x] **T11** Full suite: **3634 tests, 0 failures**, 1 pre-existing skip (`copyManaged`; root).
- [x] **T12** **Cold review caught the new line asserting a total it never measured.** The first
      wording was "the store holds N physical line(s)", with N derived as `total + duplicates.lines`
      — but `readRecords` silently skips unparseable lines, so with one corrupt line it reported 2
      where `wc -l` says 3. A message in a ticket about readers that misreport must not misreport.
      Reworded as an accounting of what was READ (`X indexed + Y repeated = Z record line(s) read`),
      which keeps the reconciliation without inventing a file total. Pinned by a test with a real
      corrupt line.
- [ ] **T13** *(recorded, not done)* the PR template describes an issue-scoped `memory-gate` that
      does not exist in `brain/scripts/governance/`. Does not change this ticket's conclusion —
      an issue-scoped `.some()` is invariant under dedup too — but the template and the
      implementation disagree, and someone should reconcile them.
