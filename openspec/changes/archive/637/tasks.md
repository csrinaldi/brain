---
status: draft
issue: 637
---

# Tasks — #637

- [x] **T1** Reproduce on `main@1c21976` against a planted tampered store: told it failed, no
      index, record durable in `2026-08.jsonl`. Exactly as the ticket reports.
- [x] **T2** Measure the retry, which turned out to be worse than the ticket says: three retries
      produced **three distinct ids**, because `ts` is hashed into the id at second resolution.
      Only a same-second retry duplicates an id; every hand retry mints a record no dedup can
      ever collapse.
- [x] **T3** Rule option 1. Reject 2 and 3 on the ticket's own ground — neither may refuse the
      operator's valid record because of somebody else's broken one.
- [x] **T4** Annotate and rethrow the reindex failure (`indexFailed`, `recordId`, `recordFile`);
      never wrap, so `rebuildIndex`'s `file:line` diagnosis and the stack survive.
- [x] **T5** `cli.mjs` reports the accurate outcome, keyed on the one flag set at the one site.
- [x] **T6** `en.mjs` + `es.mjs`, translated, all three placeholders in both.
- [x] **T7** Build the retry dedup, measure it, and **remove it**: it can only fire on a
      same-second retry, there is no automated caller, and shipping a guard that reads as
      protection and cannot fire is #632's shape. Cost measured before deciding: `readRecordIds`
      96ms vs `rebuildIndex` 336ms on this repo's 2046-record store.
- [x] **T8** Nine tests: four on the backend function, four on the real CLI, one on the catalogs.
      Including the one that matters most — **execute the prescribed recovery** (repair, then
      `memory:reindex`) and assert the record `save` wrote is indexed.
- [x] **T9** Seven mutations RED, each verified to have LANDED before the result was read, each
      restore `diff -q` byte-identical:

      | # | mutation | went red |
      |---|---|---|
      | M1 | annotation removed (pre-#637 behaviour) | 2 tests |
      | M2 | CLI branch disabled | 1 test |
      | M3 | `recordId` dropped | 1 test |
      | M4 | `recordFile` dropped | 2 tests |
      | M5 | error wrapped, diagnosis lost | 2 tests |
      | M6 | annotation leaks to a real refusal | 2 tests |
      | M7 | clean-path stdout changed | 1 test |

- [x] **T10** Full suite: **3634 tests, 0 failures**, 1 pre-existing skip (`copyManaged`, skipped
      because the runner is root).
- [x] **T11** **Cold review of this PR caught the annotation destroying the diagnosis it exists to
      preserve.** `err.indexFailed = true` on a non-object throw raises
      `TypeError: Cannot create property 'indexFailed' on string 'boom'` — module code is always
      strict — replacing the real failure with an internal one and losing the record's id and file
      with it. Measured, not imagined. A primitive is now wrapped, keeping its text as the message.
      `rebuildIndex` throws Errors today, so this is not reachable in production; it is about not
      making a future seam's mistake unreadable, in a fix whose entire subject is preserving the
      diagnosis. Red-proved: the naive assignment restored as a mutation fails the new test.
- [ ] **T12** *(filed, not done)* the residual: a hand retry still lands a second record. Only a
      refusal (option 2/3) could prevent it, and this ticket ruled against refusing. The message
      is the mitigation; whether that trade is right is the maintainer's call, not something to
      settle inside the fix.
