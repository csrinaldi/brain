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

## Cold review — the round that changed the change

A zero-context reviewer was run over the finished PR before merge, per #313's method note
(*"a zero-context reviewer belongs in the loop, not at the margins"*). It returned **two
blockers and six lesser findings**, every one reproduced by running code. All are fixed and
each fix is now proven by the reviewer's own mutation.

- [x] **C1 — BLOCKER, a FALSE PASS.** `probeBase`'s command loop treated **any** throw as
      "the gate is red at base": `ENOENT`, `ENOBUFS`, a signal, a script missing from the base
      tree. So a reader's own failure became the gate's approval — `pre-existing` →
      `follow_ups[]` → REVISE softens to APPROVE. The header claimed twice that a failed probe
      "costs a false block, never a false pass"; that was true of the git layer and **false**
      inside the loop. Reproduced against a base with no `brain/scripts/` — a PR that vendors
      brain for the first time. Fixed: only a numeric non-zero `err.status` means red;
      everything else, and any command missing from the base tree, is `unreproducible` — which
      keeps the finding blocking and emits a condition naming the gate.
- [x] **C2 — BLOCKER, a race on the happy path.** The worktree path was keyed on the base sha,
      so **two PRs branched off the same `main` tip shared it** — and each run's first act was
      `worktree remove --force`. Run B deleted run A's live worktree; A's next command failed;
      by C1 that read as a red base. Reproduced: a **healthy** base returned `pre-existing` for
      both concurrent runs. Fixed with `mkdtempSync`, which also retires the pre-emptive remove.
- [x] **C3 — the teardown was unguarded.** `filter(c => c.includes('worktree remove')).length
      >= 1` was satisfied by the pre-emptive remove, so deleting the `finally` left all 3128
      tests green and leaked a worktree per run — in the test whose title ends *"and tears it
      down"*. The repo's own `red-proof-blind-along-an-unvaried-axis`. Now: exactly one
      teardown, and its POSITION (last call) is what is asserted.
- [x] **C4 — the "ORDER IS LOAD-BEARING" test observed nothing.** It injected a runner and
      asserted it saw `null` — but `evaluateRefuter` only calls a runner when an `inferential`
      blocker exists, and the fixture had none. `null === null`, having watched nothing;
      reversing the pipeline left the suite green. The stub's signature was wrong too
      (`runner(blockers)` takes an array, not `{ findings }`), so it would have thrown had it
      ever fired. **`evidence-reader-empty-on-failure` in the assertion layer, in a test written
      to guard an ordering claim.** Now the finding is `inferential`, the refuter really forks,
      and what it sees is asserted.
- [x] **C5 — the `conditions` plumbing was unproven.** Dropping the append in `cli.mjs` left
      everything green, so *"the inability is reported, never swallowed"* was a claim about a
      layer nothing observed. Two CLI cases now drive it through `deps.probeBase` — a seam the
      review noted had no caller at all — and assert the condition reaches the rendered block.
- [x] **C6 — a false factual claim in the header.** It said seven of eight required jobs are
      diff- or PR-scoped, listing `memory-gate` among them. `memory-gate` reads
      `.memory/records/` from the **checked-out tree** (`memory-presence.mjs`: *"the repo has
      AT LEAST ONE session summary captured, EVER"*), so a repo that never captured one fails
      it identically at base and head — inherited. Verified independently before accepting.
      Corrected to **six of eight**, with `memory-gate` named as a second base-reproducible
      gate left out for a stated scope reason rather than by an error.
- [x] **C7 — the healthy-base e2e passed over an inert probe.** It asserted only that the
      finding stayed `introduced`, which is also what happens when the probe never runs.
      Making `probeBase` return `null` unconditionally left it green. Now it asserts
      `conditions` is EMPTY — the only observation that separates "ran and found base green"
      from "never measured", and the fix REQ-443-1 established for the silent-budget case in
      the same file.
- [x] **C8 — `maxBuffer` at 74 %.** The suite command emits ~776 KB on a green run against
      `execFileSync`'s 1 MiB default; crossing it throws `ENOBUFS`, which under C1 read as a
      red base. Set explicitly to 64 MiB, and `stdio` now captures rather than inherits so a
      base run's stack traces stay out of `brain:review`'s stderr (C9).
- [x] **C10** `deps.probeBase`'s sync contract documented — a promise degrades silently.
- [x] **C11** Wording: the evidence said *"SAME gate fails at base"*. What was observed is that
      a gate **with the same name** is red there; a base broken for reason A under a head
      broken for reason B is indistinguishable to this probe. Now *"`<gate>` is ALSO red at
      base"*, which is the claim it can actually make.
- [x] **C12** All seven of the review's mutations re-run against the fixes: **all RED.**
      Full suite **3135 tests, 0 failures**.
