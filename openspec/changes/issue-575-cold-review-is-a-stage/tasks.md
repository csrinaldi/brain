---
status: draft
issue: 575
---

# Tasks — the cold review is a stage, not an event (issue 575)

## Done in this change

- [x] **R0** — Re-measure #575's stated dependencies rather than trusting the
      body. Two were stale: `reviewer-protocol.md` is **signed** (#580), #555 is
      **closed** (PR #597). #552 and #456 are **open** and still block.
- [x] **R1..R5** — The five rulings, in `spec.md`:
      1. a **loop on a rung**, not a fifth rung — Rule B's monotonicity holds;
      2. the artefact is the **posted verdict**; the change folder gains nothing;
      3. the two controls are the `/2` `deterministic`/`inferential` split, and
         a mechanical-only slice **must declare itself** mechanical-only;
      4. it runs as the **reviewer identity**, in an environment that clears
         #604's negative control — which means CI with the PAT as a secret;
      5. skipping is **detected** at lite/standard, **blocks** at regulated, and
         an absent label is never read as an approval.

## The sequence — implementation, in order

Each entry names what makes it *possible*, not merely what makes it tidy.

- [ ] **T1 — #552 gets its ruling.** Now unblocked in principle: #552 declined to
      build a producer until *(a) had a reason to exist that is not "a fork is
      unreachable"*, and **#575 is that reason** — the stage's judgment control
      is a product requirement, not a fork hunting for a producer.
      This change does **not** rule it: #552 is `status: approved` and owns its
      own decision, and deciding another ticket's scope from inside this one is
      the thing the repo's ruling discipline exists to prevent.
      **This is the item that destrabs the interesting half of #575.**

- [ ] **T2 — the CI reviewer job.** A GitHub Actions workflow running
      `brain:review` with the reviewer PAT as a repository secret.
      Precondition for Ruling 4, and it does triple duty: it is the only
      environment that clears #604's negative control, and the only one with no
      authoring context **by construction**, which is what closes #604 half 2 by
      mechanism rather than convention.
      Sequence it **before** the stage, not alongside: it is the precondition
      for the stage being honest, not just automated.

- [ ] **T3 — #456, the configurable stage set.** The stage cannot be added until
      the set is configurable; a hardcoded fifth entry is the same defect with
      one more row. Behind #312 → #323.
      Post-#555 this is smaller than when #575 was filed: the set is already
      single-sourced and tier-resolved, with `artefacts` a mandatory argument.

- [ ] **T4 — the stage, slice 1 (mechanical).** Only after T2 and T3. Emits
      `deterministic` findings only and **says so on every verdict** (Ruling 3).

- [ ] **T5 — the stage, slice 2 (judgment).** Only after T1 produces a real
      `inferential` producer. The REQ-409-6 pin moves **with** it rather than
      being deleted — the instruction #408 was left and honoured.

- [ ] **T6 — the gate.** Ruling 5's three-state check. Lands with or after T4;
      before it there is nothing to detect.

- [ ] **T7 — the doctrine amendment.** `reviewer-protocol.md` §6 (if provenance
      lands), §10 (a skipped-stage row), and the stage's input contract.
      Tier 2, signed: **ADR → HOME.md → regenerate AGENTS.md**, three steps, not
      an edit. Citations name symbols, never line numbers (#580/#586).

## Blocked, and by what — the short version

```
#575 stage
  ├── T2 CI runner ────────── (nothing; buildable today)   ← also closes #604 half 2
  ├── T3 #456 ─────────────── behind #312 → #323
  └── T5 judgment half ────── behind #552 ← unblocked in principle by THIS ticket
```

T2 is buildable today and is the highest-value next step in this line: one job
satisfies Ruling 4, clears #604's negative control, and is the mechanism that
makes coldness structural instead of procedural.

## Exit criteria — status against #575's own list

| #575's exit criterion | state |
|---|---|
| the sequence is written where a contributor and an agent both read it | **met** — `spec.md`, and it says which control produces which class |
| running the stage is a verb, not a composed prompt | **not met** — needs T2/T4 |
| a verdict cannot count as human approval, proven by test | **already true** — protocol §2's three locks, and Ruling 4 keeps it true through the stage |
| skipping the stage is visible | **ruled** (R5), **not built** — T6 |
| the loop leaves a durable artefact per turn | **ruled** (R2) — the posted verdict, indexed by `reviewed:*` |

## Review note

This change is rulings and documentation only — no verb, no gate, no file in
`brain/` changes. It is the sibling of the #604 change in the same line of work;
that one carries the mechanism and its own review caveat.
