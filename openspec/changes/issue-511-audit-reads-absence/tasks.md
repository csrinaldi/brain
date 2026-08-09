---
status: retro-fitted
issue: 511
---

# Tasks — issue 511

Recorded in the order things actually happened, including the four wrong turns.

- [x] T1 — Reproduce the false positive on PR #507; map the three enforcement surfaces.
- [x] T2 — **Attempt 1**: split added from modified. Implemented across all three surfaces,
      7/7 check cases, 80/80 in `run-check`. **Breaks A10.** Kept as a local branch, unpushed.
- [x] T3 — **Attempt 2**: "the invariant is L6". Refuted by DRIVING the evaluator — PASS at
      `lite`, WARN at `standard`/`regulated`. The claim had already survived a ticket re-scope
      and an ADR draft before anyone ran it.
- [x] T4 — Maintainer rulings: separate the invariants (#510/#511 split) · reinforce A10,
      option (3) · at `lite` the maintainer's authorship is governance.
- [x] T5 — **Attempt 3**: fail a merge with no PR → 16 tests red (#474's contract).
- [x] T6 — **Attempt 4**: a second uncomputable channel in the check → same tests red again.
- [x] T7 — Abstention as ABSENCE from `realResults`; capability gap separated from failed read.
      Suite green.
- [x] T8 — `writes-governed.test.mjs`: 9 cases — both readings, both tiers, the three
      non-verdicts, and a case that fails if the tier matrix is ever re-implemented locally.
- [x] T9 — **A10b/A10c**, the reinforcement. Frozen invariants untouched.
- [x] T10 — **Mutation proof, diffs printed first**: the `warn`→pass reading · the abstention
      branch · the tier pass-through · neutralising the check against A10b. All RED.
- [x] T11 — Merged as PR #512. 2906 tests, 0 failures.
- [x] T12 — First real run: `governance-postmerge` green on `5886acc`, cursor advanced.
- [ ] T13 — These artefacts, retro-fitted under #513.

## Micro-decisiones en caliente

- **Evidence is time-dependent.** The finding that survived all four attempts, and the one
  worth carrying beyond ADRs: a PR-time gate and a post-merge audit cannot share an evidence
  rule even when they share a question.
- **Abstention is absence.** Adding a state to a machine #474 had just stabilised cost 16
  tests. Expressing "nothing to say" as "not in the result set" cost nothing.
- **Drive it, do not read it.** Three of the four refutations came from running code; the
  claim that survived longest ("it is L6") came from reading it.
- **The artefacts were written last.** Recorded rather than back-dated — see #513, and note it
  is the second ticket in a row to do this.
