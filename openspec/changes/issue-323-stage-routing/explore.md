# Exploration: #323 S2 — the check that replaces the refusal (M8)

Worktree `/home/gandalf/IA/brain-issue-323`, refreshed to `main @ 1421f35`
(M5 complete). S1 landed 28/08 via #792: ADR-0019 Am.1 rules lifecycle
routing PERMITTED under four conditions; ADR-0024 Am.1 retires the predicted
supersede. Condition 4 is the work order: *"a check, not a comment —
everything above is doctrine until something refuses on its behalf."*

## What exists

- `stage-engine.mjs`: `assertRoutableStage` refuses the four lifecycle stages
  flat (the pre-S1 boundary, still standing — correctly, until the check
  exists); `resolveStageEngine` resolves `sdd.map[stage]` but **never checks
  the stage is DECLARED** — the roadmap's own S2 line ("acepta custom
  declaradas, rechaza las no declaradas") is unimplemented.
- Callers of the refusal: `claude.mjs#runStage`, `run-cold-review-stage`,
  `harness/cli`, `sdd-layout` — every spawn path goes through it.
- **M5's port is the natural enforcement surface**: an engine DECLARES the
  stages it can produce (`declareRoles`, refusing absence), with
  `instructions`, tiers, and `state: enabled|disabled` per `sdd.configs`.
  M8 routing can therefore be CHECKED against M5 declarations — which is
  the reason the roadmap sequenced M5 before M8.

## The shape of the check (conditions → mechanisms)

| condition | mechanical enforcement available |
|---|---|
| 1 — one layout | structural today (single accessor); the check adds: no engine input can name a path — `sdd.map` values carry `{engine, model}` only |
| 2 — verification neutral | structural today (shared readers read no engine field); pinned by test, not by the router |
| 3 — indistinguishable at the boundary | a TESTABLE property: the parity suite of S4 — same change dir, two engines, same gates. The check cannot prove a future write; the suite does |
| 4 — refusal replaced | **the deliverable**: routable iff the stage is in the RESOLVED set (lifecycle ∪ declared customs) AND the routed engine DECLARES it through the port, enabled. Undeclared stage → refuse; undeclaring engine → refuse; the four lifecycle names stop being special-cased and start being CHECKED |

## THE TENSION — transports are not engines, and the field proves it

The one live `sdd.map` entry in the wild routes `cold-review → engine:
"claude"` (the #812 workaround, ADR-0033's transport). `claude` is an
AGENT_PLATFORM (D6), not an `SDD_ENGINES` member, and it has no
`declareRoles`. A check that demands "the routed engine declares the stage
via the port" **refuses the maintainer's own working config** the day it
lands.

Three ways out, none obviously mine to pick:
- **A**: `sdd.map` values must be SDD_ENGINES for LIFECYCLE stages; custom
  stages (cold-review) may keep naming a transport (ADR-0033's word), the
  check splits by stage class. Cost: two vocabularies in one map, said out
  loud.
- **B**: platforms become port inhabitants too (claude gets declareRoles) —
  rejected territory: #312's design warned binding platforms into the port
  mixes the axes; D6 separated them ON the maintainer's correction.
- **C**: ADR-0033's transport naming migrates — cold-review routes to an
  ENGINE which internally uses a platform transport (gentle-ai/plain declare
  cold-review since #814). Cleanest vocabulary, but touches the review
  pipeline's routing and the #812 workaround dance.

## Also in scope per the roadmap's S2

`sdd.map` schema already migrated (0.10.0); the model field already opaque
(#312's readRoutedModel). The undeclared-stage refusal in `resolveStageEngine`
is net-new. `VALID_OPS` growth and ≥2 wired engines are S4, not S2.
