---
status: draft
issue: 487
---

# Tasks — #487

- [x] **T1** Reproduce through the REAL chain, red first. 2 findings → 1, evidence
      corrupted, `sequencing` undefined, both `seq:*` labels in `toRemove`.
- [x] **T2** Anchor `FENCE_RE`'s terminator to a line start.
- [x] **T3** Round-trip guard with a fenced value (REQ-487-1).
- [x] **T4** The consumer guard — `reconcileBoardLabels` (REQ-487-2). The acceptance test.
- [x] **T5** Adversarial shapes: unterminated · tagged prose fence · untagged prose fence
      (limitation) · indented fence inside a value · two blocks in one body.
- [x] **T6** Full suite: **2933 tests, 0 failures**.
- [x] **T7** Four mutations, diffs printed first — M1 unanchored (4 red) · M2 greedy
      (1 red) · M3 `yamlScalar` stops escaping `\n` (3 red) · M4 board stops reading
      `sequencing` (1 red).

## Recorded

- [x] **T8** My first probe reported two extra corruptions — `severity: "correction"` and
      `reviewed:revise` in `toRemove` — and I put them in the epic before checking. Both
      were the probe's fault: the cites gate downgrades an uncited blocker (§5) and the
      real label is `reviewed:revised`. **The ticket body was accurate as written.**
      Corrected on #313 rather than left standing.
- [x] **T9** M3 exists because the fix's comment makes a claim — "a fenced value is emitted
      on one physical line, so the terminator cannot match inside it" — and a claim in a
      comment is worth what its mutation is worth. Removing the `\n` escape turns three
      guards red, so the dependency is real and pinned rather than asserted.
