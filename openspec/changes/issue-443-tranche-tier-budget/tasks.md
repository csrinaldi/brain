---
status: tasks
issue: 443
epic: 313
artifact_store: openspec
topic_key: sdd/issue-443-tranche-tier-budget/tasks
---

# Tasks — the tranche diff budget follows the tier (issue #443)

- [x] T1 — SDD artefacts: proposal / spec (REQ-443-1..6) / design / tasks. Baseline on
      `main` @ `653e34e`: **2470 tests / 2469 pass / 1 skip / 0 fail**.
- [x] T2 — RED first (design D6 steps 1-3), observed against the SHIPPED code:
      `regulated`/250 produced **no budget finding** (the ticket's false negative, on
      the tier that pays for `/2`) and `lite`/500 **did** produce one (the false
      positive). `standard` green throughout — the control.
- [x] T3 — the fix: `diffBudget` (+ the tier NAME, evidence-only) threaded through
      `gatherTrancheInputs` → `evaluateTranche`; `LINE_BUDGET` deleted; the default
      derived from `tierParams('standard')`, never written as a literal.
- [x] T4 — REQ-443-4: `cites` now names `governance-tiers.mjs tierParams(tier).diffBudget`
      (mirroring the sibling gate finding) and the evidence carries `250 > 200 (tier:
      regulated)`. Asserted as strings, including that `cites` no longer names `400`.
- [x] T5 — REQ-443-5: a checkpoint case that GATHERS for real at `regulated` (not
      hand-wired `trancheInputs`) — proven load-bearing in T7, where it goes red.
- [x] T6 — REQ-443-6: #409's fixture restored to the diff-budget breach (`redJob`
      default → `null`, kept as an opt-in second source); a new e2e case pins the
      negative half at `lite` with the SAME diff; harness README's #443 note turned
      from instruction into record.
- [x] T7 — red-proof pass (design D6 step 4): replaced `tierParams(tier).diffBudget`
      with a literal `400` in the gather. **Mutation verified to have landed on
      executable code** (line 243, not a comment — the #409 lesson) → **5 unit failures
      + 2 e2e failures**, including the checkpoint case, and `standard` stayed green as
      the control. Restored; 56/56 green.
- [x] T8 — full suite **2480 pass / 1 skip / 0 fail** (+10 from baseline) ·
      `repo:check` ✓ · `brain:nav` ✓ · diff 82 counted lines against `lite`'s 1000.
- [x] T9 — PR #471 to `main`, `Closes #443`.
- [x] T10 — **cold review round (PR #471, verdict REVISE)** — an independent reviewer
      with no context on this change; all three findings reproduced before acting.
      **F1 (spec self-contradiction)** REQ-443-2 claimed the `evidence` string was
      unchanged at `standard` while REQ-443-4 mandated changing it at every tier.
      Measured: `main` emits `… = 401` / `cites: governance.yml diff-size gate
      (400-line budget)`; the branch emits `… = 401 > 400 (tier: standard)` /
      `cites: governance-tiers.mjs tierParams(tier).diffBudget`. `standard` is what
      every consumer who never declared a tier inherits, so this is a real change to
      what they see. Fixed on both sides: the requirement now separates the DECISION
      (unchanged) from the PROSE (changed by design), and the exact `standard` strings
      are pinned by a test. Proven load-bearing by mutating the suffix (verified to
      have landed first — the first attempt's `perl` substitution silently did not
      match, and the resulting 26/26 green said nothing).
      **F2 (`evidence-reader-empty-on-failure`, in my own assertion layer)** the new
      `lite` e2e case asserted only the ABSENCE of a budget finding — and was written
      `verdict.findings ?? []`, the exact shape flagged against this author in #444.
      Reproduced: mutating the gather to `if (true || !baseSha || !headSha)` (budget
      NEVER computed) left the case GREEN. Fixed with positive evidence — APPROVE plus
      empty `conditions`, since an uncomputable budget fails closed to REVISE — and a
      `diffLines: 1001` companion so the case is falsifiable from inside its own
      fixture. Both mutations now red.
      **F3 (coverage regression)** flipping `redJob`'s default to `null` left the
      parameter with zero call sites: the gate-shaped finding path stopped crossing
      the process boundary at all, and deleting its honoring outright kept the file
      green. The REQ-409-6 case now carries `redJob: 'phase-order'` and asserts the
      gate finding reaches the posted body; deleting the honoring is now red.
- [x] T11 — post-review verification: suite **2482 pass / 1 skip / 0 fail** ·
      `repo:check` ✓ · `brain:nav` ✓.

## Found while here — NOT fixed here (scope)

`checkpoint.mjs:24` carries the SECOND untiered literal: `BUDGET_CLAIM_RE =
/(\d+)\s*\/\s*400\b/`. Measured: `parseBudgetClaim` returns `372` for `"372/400"`,
**`null` for `"372/1000"` and `"150/200"`**. So at `lite` and `regulated`, `reportClaims`
stays `[]` and the §10.1 report-vs-tree drift check silently checks nothing —
indistinguishable from "no drift". brain declares `lite`, so this is inert on brain
today.

Both literals were flagged by the #358 Q5 verify-report (WARNING-1), which recommended
"an explicit deviation note or a follow-up task". #443 is the follow-up for the first;
the second has a different failure mode (a silent no-op check, not a wrong verdict) and
gets its own ticket rather than riding along.
