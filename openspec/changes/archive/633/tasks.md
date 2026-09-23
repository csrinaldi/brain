---
status: draft
issue: 633
---

# Tasks — #633

- [x] **T1** Reproduce the three lines on `main@6aad799`, and measure what each verb writes per
      stream instead of assuming: `share` 0/3, `reindex` 1/3, `feature-checkpoint` **0/2**.
- [x] **T2** Correct a bad measurement of my own before drawing a conclusion from it: the first
      probe showed `resolve-index` emitting 0 stderr lines with a duplicate planted, which would
      have contradicted the ticket. Cause was the probe, not the code — `resolve-index` resolves
      from `repoRoot` and ignores `BRAIN_MEMORY_TEST_ROOT` (cli.mjs:170), so it had read the real
      store, which #636 had just reconciled to zero.
- [x] **T3** `pre-push:39` — `2>&1` dropped. `>/dev/null` and `|| exit 0` kept.
- [x] **T4** `post-merge:43` — `2>&1` dropped, matching `:35` eight lines above it.
- [x] **T5** `pre-push:49` — `2>/dev/null` → `>/dev/null`, decided on the same rule. The
      measurement makes it the most severe of the three: the verb writes nothing to stdout, so
      the redirection discarded everything it says, including the hook's own documented
      ambiguous-feature skip.
- [x] **T6** State the rule in both hook headers, in full.
- [x] **T7** Enforce it structurally over EVERY hook invocation — no list of known lines, because
      a list would pass forever while a fourth bad line is added beside them, which is exactly
      how `:43` came to sit under `:35`'s correct reasoning.
- [x] **T8** Prove both directions on a real store: duplicate present → 3 lines reach the
      operator; clean store → 0. And the tampered record: the refusal now reaches the operator
      while the hook still exits 0 (before: exit 0, zero lines).
- [x] **T9** Six mutations RED, each verified to have LANDED before the result was read, each
      restore `diff -q` byte-identical:

      | # | mutation | went red |
      |---|---|---|
      | M1 | `share` back to `2>&1` | 2 tests |
      | M2 | `feature-checkpoint` back to `2>/dev/null` | 3 tests |
      | M3 | `resolve-index` back to `2>&1` | 2 tests |
      | M4 | `share` stops discarding stdout | 1 test |
      | M5 | the rule deleted from the header | 1 test |
      | M6 | **a FUTURE line added with `2>&1`** | 1 test |

      M6 is the one that matters: it adds a line this ticket never wrote, to prove the guard
      covers the author who comes next. Its first attempt did not land — the `perl` pattern
      needed multiline mode — and a mutation that fails to land produces a green run that looks
      exactly like a passing test, so it was rebuilt and re-run rather than reported.
- [x] **T10** Full suite: **3736 tests, 0 failures**, 1 pre-existing skip (`copyManaged`; root).
- [ ] **T11** *(recorded, not done)* `resolve-index` has no test-root seam, unlike `reindex`,
      `save` and `search`. Not needed by this ticket — the hook tests use a mock `node` — but the
      asymmetry is real and will bite whoever next tries to drive that op against a fixture.
