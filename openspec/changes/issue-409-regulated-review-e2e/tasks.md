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
- [ ] T2 — fixture builder: bare origin + consumer clone, `regulated` config, PR-shaped
      branch with a diff that trips a deterministic `/2` finding (design D4).
- [ ] T3 — the `gh` PATH stub: argv dispatch, canned reads, captured writes
      (`posted/reviews.jsonl`), invocation log (`calls.log`).
- [ ] T4 — e2e cases REQ-409-1..4 (the `/2` verdict, parseability, causal annotation,
      the `/1` degradation control).
- [ ] T5 — e2e cases REQ-409-5(a-c) (identity gates execute; mismatch and missing-token
      refuse through the real boot path).
- [ ] T6 — REQ-409-6 plumbing-honesty assertions, each naming #408 at the assertion.
- [ ] T7 — harness README (REQ-409-7): the reuse contract for #405/#408.
- [ ] T8 — red-proof pass: REQ-409-1 red under a forced-`/1` mutation; REQ-409-4's
      control both directions; fixture-integrity assertion red on a bogus sha.
- [ ] T9 — full suite + `repo:check` + `brain:nav`; diff budget (tests are ignoreList'd
      — the counted surface is the harness scripts + docs).
- [ ] T10 — PR to `main`, `Closes #409`.
- [ ] T11 — **HUMAN (not this change):** decide whether brain itself declares
      `regulated` (design D5; epic HUMAN row) — this harness is the evidence base.
