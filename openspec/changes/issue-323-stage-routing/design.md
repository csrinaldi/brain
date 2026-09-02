# Design: #323 S2 — the check, the evidence, the pins

## T1 — `resolveStageEngine` learns the resolved set (D3)

Imports `resolveStageSet` (already the sibling's export — same module family,
no cycle: stage-engine already re-exports sdd-layout's constant). An entry
for an undeclared stage throws naming the stage, the lifecycle set, and
`sdd.stages`. C1's pin rides here: value keys beyond `{engine, model}` or a
`/` in either refuse citing condition 1.

## T2 — `assertRoutedStage({config, stage, _load})` — async, the routing-layer check

1. `resolveStageEngine` (with T1's refusals) → `null` (unrouted) passes
   through as `{routed: false}`.
2. Custom stage → `{routed: true, routing}` — transport naming allowed
   (option A; the refusal text for lifecycle names the split and #833).
3. Lifecycle stage → engine must be in `SDD_ENGINES` (platform → refusal
   citing D6 + #833) AND `loadInhabitant`+`resolveRoles` must answer the
   stage with `state: 'enabled'` (port's own errors travel; disabled →
   refusal quoting the reason). Returns `{routed: true, routing, role}` —
   the role is C3's hook: S4's parity suite compares what two engines
   resolve for one stage.

## T3 — `assertRoutableStage` REPLACED (condition 4's letter)

Signature grows: `assertRoutableStage(stage, { routed } = {})`. Name-shape
refusal unchanged. The lifecycle arm now refuses ONLY when `routed` is
absent — the message names `assertRoutedStage` as the step that was
skipped. `claude.mjs#runStage` passes its `routed` through (new optional
param, default absent — today's callers spawn custom stages only and are
untouched). The refusal is replaced by a demand for evidence, exactly as
condition 4 words it.

## Sizing

~140 countable (stage-engine ~110, claude.mjs ~10, i18n ~0 — stage-engine's
throws are raw English today and stay so, consistency over novelty). Tests
exempt. Single PR, closes nothing prematurely: #323 stays open for S4–S7 —
the PR closes a NEW slice issue? NO: per the #816 lesson the PR needs a
closable target and #323 must survive. **The PR closes #792? Already closed.**
Decision: the PR carries `Closes` against a new slice ticket (#834-to-be)
— created at PR time, the #816 pattern, so #323 lives until S7.
