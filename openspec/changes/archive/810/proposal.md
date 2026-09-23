---
issue: 810
phase: proposal
---

# Proposal — the artefact field stops being inert

## Intent

A consumer who declares a stage beyond the four gets a stage that BEHAVES like
one: scaffolded at `new-change`, walked by `phase-order` in its declared
position, carried whole into the archive. Zero-config identity holds: without
`sdd.stages`, every surface is byte-identical to today.

## Scope (what changes)

1. **Doctrine first**: ADR-0019 Amendment 5, drafted under `brain-drafts/` in
   this change dir, promoted by the human. It authorises exactly this: a
   DECLARED custom stage's artefact joins the evidence contract, under
   Amendment 1's four conditions — one layout (the artefact lives in the same
   change dir, resolved by the same `resolveStageSet`), neutral verification
   (gates read the resolved set, never an engine), boundary-indistinguishable
   (S2/S4 already route it), refusal replaced not removed (`resolveStageSet`'s
   three refusals + the collision guard ARE the replacement's enforcement).
2. **SCAFFOLD**: `new-change.mjs` reads the config, resolves the stage set,
   writes a generic front-mattered stub for each custom artefact. The scaffold
   produces the FULL declared set — never tier-scoped (REQ-L4-2′).
3. **GATE**: `phase-order`'s Rule A walk becomes
   `tier-scoped four ∪ declared customs`, in declared interleaved order.
   The tier scopes what doctrine demands of the FOUR; a custom stage exists
   only by consumer declaration — declaring it IS the demand. `buildChangeDir`
   grows a generic presence probe for names outside the fixed flag map.
4. **ARCHIVE**: a test pins that a custom artefact rides the whole-dir move
   into `openspec/changes/archive/` — behaviour exists, contract doesn't.

## Non-goals

- No new config keys, no migration (sdd.stages shipped in 0.11.0).
- No change to what `check-refs`/checkpoint DEMAND (tier-scoped four only);
  custom artefacts stay additive there.
- No removal or weakening of any of slice A's refusals.

## Risks

- The gate message sentinel (`messageForArtefacts`) compares positionally
  against the standard four — a custom set must fall through to the
  actually-missing branch, never mutate the legacy literal (pinned by tests).
- `new-change.mjs` gaining a config read must not break the zero-config path
  (config absent → same four files, same bytes).
