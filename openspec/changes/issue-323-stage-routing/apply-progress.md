# Apply Progress: #323 S2 — single PR (closes #834; #323 survives to S7)

Strict TDD, worktree brain-issue-323 off main@1421f35.

- [x] 1.1 The #812 field config pinned FIRST — and the pin's first cut LIED:
      it gave the fixture an sdd.stages declaration reality lacks; the full
      suite caught it with 47 failures. cold-review is CODE-declared
      (COLD_REVIEW_STAGE, ADR-0033) — the declared set is resolveStageSet ∪
      the shipped stage.
- [x] 1.2 D3 undeclared refusal + C1 pin. C1's first cut覆 covered the model
      and the 05/08 opacity ruling's own test caught the overreach
      ('vendor/model:2026-08' is a legal id) — narrowed to the engine.
- [x] 1.3 assertRoutedStage — async, the port as enforcement surface;
      platform → D6/#833 refusal; non-declaring/disabled → the port's words;
      unrouted passes through; the routed role = C3's hook for S4.
- [x] 1.4 assertRoutableStage(stage, {routed}) — the evidence demand;
      runStage pass-through; four old-doctrine pins flipped to the amended
      contract (the FACT survives: without evidence, still refuses).
- [x] 1.5 #834 created (the #816 pattern); suite 4681/0; gates clean.
- [ ] 1.6 Push, PR, CI, cold review.
