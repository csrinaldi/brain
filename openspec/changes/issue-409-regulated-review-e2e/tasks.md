---
status: tasks
issue: 409
epic: 313
artifact_store: openspec
topic_key: sdd/issue-409-regulated-review-e2e/tasks
---

# Tasks — the `regulated`-tier reviewer e2e (issue #409)

- [x] T1 — SDD artefacts: proposal / spec (REQ-409-1..7) / design / tasks. Baseline on
      `main` @ `6c944fe`: **2400 pass / 1 skip / 2401 tests**.
- [x] T2 — fixture builder (`test/review-regulated/fixture.mjs`): bare origin + consumer
      clone with brain VENDORED (D3 was amended on measurement — `loadBrainConfig`
      resolves from the script location, not cwd, so the vendored shape IS the
      production shape). Deterministic finding via a red required gate (`redJob`) —
      the planned diff-budget breach found tranche's LINE_BUDGET hardcoded at 400,
      untiered → **#443 filed**; the fixture comment points there.
- [x] T3 — the `gh` PATH stub: argv dispatch, canned reads, captured writes
      (`posted/reviews.jsonl`), invocation log (`calls.log`), fail-closed on
      unrecognized argv (exit 2, argv on stderr).
- [x] T4 — e2e cases REQ-409-1..4. First run found TWO things: a harness bug of ours
      (`parseVerdict` takes `({ body })`, not a string — fixed) and the REAL product
      defect #443. The e2e paid for itself before it was green.
- [x] T5 — e2e cases REQ-409-5(a-c) — green on the FIRST run: the identity endpoint is
      hit token-scoped (calls.log evidence), mismatch and missing-token refuse with
      nothing posted.
- [x] T6 — REQ-409-6 plumbing-honesty assertions, each naming #408 at the assertion.
- [x] T7 — harness README (REQ-409-7): the reuse contract for #405/#408, the expected
      assertion flips when each lands, and the #443 restoration note.
- [x] T8 — red-proof pass: forced-/1 mutation in the VENDORED copy → REQ-409-1 red
      (first mutation attempt hit the JSDoc comment, not the value — verified the
      mutation took effect before trusting the red); bogus headRefOid → run exits
      non-zero (production git integrity, D2). REQ-409-4 proven both directions by
      the lite control.
- [ ] T9 — full suite + `repo:check` + `brain:nav`; diff budget (tests are ignoreList'd
      — the counted surface is the harness scripts + docs).
- [ ] T10 — PR to `main`, `Closes #409`.
- [ ] T11 — **HUMAN (not this change):** decide whether brain itself declares
      `regulated` (design D5; epic HUMAN row) — this harness is the evidence base.
