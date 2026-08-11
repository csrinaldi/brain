---
status: draft
issue: 408
---

# Tasks — #408

- [x] **T1** Measure before designing: does a base commit carry the gates? (No — `governance.yml`
      is `pull_request`-only.) Which required jobs can inherit a failure? (One.)
- [x] **T2** `lib/base-comparison.mjs` — the base-reproducible set, the workflow-mirroring
      command list, the detached-worktree probe, the pure classifier.
- [x] **T3** Wired at the one convergence point: annotate → classify → refute.
- [x] **T4** `cli.mjs` gathers lazily and appends the probe's own condition to the evaluator's.
- [x] **T5** 15 unit guards + 2 e2e cases over the real CLI, real git history, real parser.
- [x] **T6** Six mutations RED; the one that survived corrected a test, not the code.
- [x] **T7** Full suite: **3128 tests, 0 failures**.
- [x] **T8** REQ-409-6's tripwire honoured — reframed, not deleted, per its own instruction.
- [x] **T9** The `inferential` producer filed as **#552**, with the reason it is not a deferral.

## Recorded

- [x] **R1** **The obvious design was inert and measuring is the only reason it is not in this
      PR.** A comparator reading the base commit's rollup finds no governance gate there at
      all, because the workflow triggers on `pull_request` only. It would have been green in
      every test and silent in production — #335, arrived at by writing the natural thing.
- [x] **R2** **Seven of the eight required gates cannot inherit a failure**, and that is
      structural rather than incidental: they read the diff, the PR body, or the PR's approval.
      The narrowness of the producer is the measurement, not a first slice.
- [x] **R3** **The e2e fixture was not a consumer after adopt.** It vendored `brain/core`
      without `brain/HOME.md` — neither `managed` nor `local`, because `brain:env:init` writes
      it — so `brain:nav` failed on every fixture for that reason alone. Invisible until a base
      probe started RUNNING `brain:nav`: every case would have reported "already broken", true
      of the fixture and false of what it models.
- [x] **R4** **A tripwire came due and did not fire.** REQ-409-6 said "flip means #408 landed,
      move these". It did not flip, correctly — its finding is `gate:phase-order`, which no
      base comparison can speak to. Left as-is it would have told a future reader #408 had not
      landed, so its framing was rewritten to what it now means: a statement about SCOPE.
- [x] **R5** **`base-only` and `inferential` were left unproduced on purpose.** Both are
      admitted by the schema, routed by the verdict builder, and have no honest producer. The
      module says so where a reader meets them rather than leaving the absence to be inferred.
- [x] **R6** **M1 survived and the test was the defect.** The guard's value is not its return
      value — the failure path returns the same `null` — it is that nothing gets spawned.
