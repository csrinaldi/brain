# Proposal: #323 S4 — two engines wired, and C3's proof

Tier `lite`, off `main @ 0d0a755`. **Authority**: the maintainer's ruling of
02/09 ("S4 completo"), S2's evidence contract, the seam's own doctrine
(three states; falling back is the failure mode), D6, ADR-0033 (the
transport shape), the 05/08 scoping ruling.

## Intent

The seam stops refusing the two frameworks. `plain` answers a lifecycle
stage with the MANUAL HANDOFF — the human is the runtime, and that is a
real wiring, not a stub. `gentle-ai` composes the PORT's instructions for
the stage and spawns through the claude transport — the cold-review shape,
applied to the lifecycle, gated on S2's routed evidence at every spawn.
C3's parity suite proves the boundary: the same artifact path from both
engines, and the shared readers blind to which one stamped it.

## Decisions

- **D1 — plain's run is the handoff.** `{ok: true, manual: true, steps}`:
  the resolved role (checked-null instructions), the target artifact path
  from the single accessor, the steps rendered. No spawn, no pretense.
- **D2 — gentle-ai runs ON the platform, explicitly.** Its `run-stage`
  builds the stage prompt FROM `routed.role.instructions` (the port's
  recorded content — never the installed files) and delegates the spawn to
  the claude backend as transport — a sibling-backend import, stated; the
  dispatcher stays unimported (platform.mjs's rule intact).
- **D3 — no spawn without bound evidence.** Both engines refuse a lifecycle
  payload lacking S2's `routed` evidence for THAT stage — the transport
  guard's demand, honored at the engine layer too.
- **D4 — C3's proof is the parity suite.** Both engines, one stage: the
  SAME `artifactPaths`-derived target; a fixture change dir passes
  `phase-order`'s readers identically whichever engine is named. The
  human-produced half is played by the test writing what the handoff names.

## Non-goals

S5 (the artifact-contract guards, #713/#752), S6 (#810), the S4b question
of running WITHOUT a human watching (scheduling, batching), #833.
