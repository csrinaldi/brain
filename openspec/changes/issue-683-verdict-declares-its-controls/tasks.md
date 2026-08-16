---
status: draft
issue: 683
---

# Tasks — issue 683

## Done

- [x] **T1** — `lib/controls.mjs`: the vocabulary, the union, and the invariant
      (REQ-683-1/4/5/6).
- [x] **T2** — `PRODUCES` declared on `tranche`, `checkpoint` and `ruling`, next
      to the code it describes (REQ-683-1).
- [x] **T3** — `cli.mjs` sets `controls` from the evaluator that ran, and
      refuses before building a verdict whose declaration would be false
      (REQ-683-1/6).
- [x] **T4** — `verdict.mjs` emits it always, JSON-encoded (REQ-683-2/3/7).
- [x] **T5** — `parse-verdict.mjs` reads it back with `sequencing`'s
      flat-string reader and refuses an unknown class (REQ-683-3/4).
- [x] **T6** — e2e through the real verb: a posted body carries the declaration,
      and a clean run declares the same controls as a run with findings.

## What the tests caught in this change's own work

**The vocabularies are not equal.** The first cut asserted
`CONTROL_CLASSES === ALLOWED_EVIDENCE_CLASSES` and went red: `schema-v2.mjs`
allows **three** classes, and `insufficient` is not a control — it names a
finding whose evidence was not enough, the opposite of a way to establish one.
Left unnoticed, `checkControlsCoverFindings` would have **refused a run** over
an `insufficient` finding, which says nothing about what was applied. The fix is
a declared partition (`CONTROL_CLASSES` ∪ `NOT_A_CONTROL`) asserted against the
schema, so a fourth class forces a decision instead of being silently ignored.

**The "clean" fixture was not clean.** The e2e case comparing a green run to a
red one called `withFixture({ tier: 'regulated' })` clean; the fixture defaults
to `diffLines: 250` and `regulated`'s budget is 200, so it carried a `budget`
blocker. Measured from the failure rather than assumed.

## Mutation proof

Each mutation asserted to land by **observing the mutated behaviour**, shown
red, reverted byte-identical (`diff -q`).

| # | mutation | result |
|---|---|---|
| P1 | derive from the FINDINGS instead of the evaluator (the trap REQ-683-1 exists for) | **1 red** (e2e) |
| P2 | omit the key when the list is empty — back to silence | **1 red** |
| P3 | render bare instead of JSON — breaks the round-trip | **2 red** unit, **2 red** e2e |
| P4 | accept an unknown class at the reader | **1 red** |
| P5 | drop the anti-drift refusal in `cli.mjs` | **1 red** |
| P6 | move the check AFTER `buildVerdict` — the claim is already made | **1 red** |

**P5 found a hole in this change's own work.** On its first run, deleting the
refusal left the entire suite green: the guard was wired and nothing measured
the wiring. The case that now covers it was written because of that
measurement — the mutation pass earning its keep on the change that ran it.

**A revert mistake, recorded.** P4's first attempt was reverted with
`git checkout` instead of a file copy, which discarded every edit to
`parse-verdict.mjs` rather than just the mutation. Caught immediately (the field
stopped parsing), reapplied, and P4 redone against a real backup. Worth writing
down: `git checkout` is not a mutation revert when the file also carries the
change under test.

## Limits, stated

**REQ-683-6's refusal is proven structurally at the call site, not
behaviourally.** Making a finding carry an undeclared class requires an evaluator
that emits one, and the three evaluators are not injectable — `main` takes
`trancheDeps`/`checkpointDeps`/`rulingDeps`, which steer an evaluator's *inputs*,
never its output classification. Inventing a `deps.evaluatorFindings` seam purely
to reach the branch would add a production override that exists for the test.

So the split is: the **rule** is proven behaviourally in `controls.test.mjs`; the
**wiring** — that `cli.mjs` calls it, and calls it *before* `buildVerdict` — is
pinned by a source scan, the same split `brain-promote.locks.test.mjs` uses for
the properties its behavioural proof cannot reach. P5 and P6 both go red, so the
pin is real; it is not the same as a behavioural proof and is not claimed to be.

**The field is inert in the sense that matters least and live in the sense that
matters most.** Nothing changes about which findings a run produces. What changes
is that every verdict brain posts from now on states what checked it — and today
that statement is `["deterministic"]`, which is the honest and previously
unstated answer.
