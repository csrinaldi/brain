---
issue: 810
phase: tasks
---

# Tasks — #456 slice B

```brain-slice-scope/1
{"slice": 1, "claims": ["S6-R1", "S6-R2", "S6-R3", "S6-R4"], "terminal_pr": "this PR -> main"}
```

- [x] T1. Amendment 5 draft under `brain-drafts/` (brain-amendment/1 block);
      prove it parses via the promote parser (S6-R4).
- [x] T2. `phase-order-check.mjs`: resolve the walk set per D2; generic
      presence probe per D3; tests — interleaved custom missing (fails naming
      it), zero-config byte-identity, sentinel falls through for custom sets,
      malformed declaration → uncomputable (S6-R2).
- [x] T3. `new-change.mjs`: resolve stage set, scaffold custom stubs, refusal
      passthrough; tests — zero-config byte-identity, custom file written,
      omission refusal (S6-R1).
- [x] T4. Archive pin test: custom artefact rides the move (S6-R3).
- [ ] T5. Full suite green; memory record; PR; cold review rounds.
