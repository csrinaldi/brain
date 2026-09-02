# Exploration: #323 S4 — ≥2 engines wired, and C3's proof

Off `main @ 0d0a755` (S2 merged). S3 (the config verb) landed as #823.

## The terrain

- `VALID_OPS = ['init', 'run-stage']`; `run-stage` is `cli: false`, dispatched
  through `stage-seam.mjs` → `dispatch(engine, 'run-stage', …)`. The seam's
  doctrine: THREE states (unrouted / routed-no-backend REFUSED naming the
  engine / routed-and-answered), and **falling back is the failure mode**.
- Only `claude` implements `run-stage` (the ADR-0033 transport). Both
  SDD_ENGINE frameworks export `AGENT_RUNTIME = null` — **neither engine can
  run anything today**; "wired" currently ends at the seam's refusal.
- Since S2, `assertRoutedStage` hands back the PORT's resolved `role` — the
  instructions, tier, chooses_model — as C3's hook.
- Since #814/#576, gentle-ai's roles carry real `instructions`; plain's carry
  the checked null (a human executes).

## What "wired" can honestly mean per engine

- **plain**: `run-stage` answers with the MANUAL HANDOFF for that stage —
  the role resolved, the steps rendered, `{ok: true, manual: true}`. No spawn:
  the human IS the runtime, and the wiring makes the seam stop refusing an
  engine the operator legitimately named.
- **gentle-ai**: the framework runs ON a platform (D6). Its `run-stage` would
  compose the port's `role.instructions` for the stage into a prompt and
  spawn through the claude transport — exactly the cold-review shape, but for
  a LIFECYCLE stage, gated on S2's routed evidence.

## C3's proof (the parity suite)

*"The same change dir, produced by two engines, passes the same gates."*
Mechanically provable half: both engines' `run-stage` target the SAME artifact
path for a stage (the single accessor's answer) and the shared readers accept
a fixture change dir regardless of which engine stamped it. The
human-produced half (plain) is played by the test writing what the handoff
names — the readers cannot tell, which is the point.

## THE FORK (the maintainer's, not design's)

Wiring gentle-ai's `run-stage` means **brain can spawn an SDD lifecycle phase
headless** — a real engine producing a real proposal/spec/design/tasks
artifact through a model, end to end. That is the roadmap's stated
destination ("el owner compone su pipeline eligiendo engine por etapa") and
also its biggest step: cost per run, review pressure, and the first time a
lifecycle artifact is machine-produced under routing.

- **Full S4**: both wirings + the parity suite. The milestone's promise, whole.
- **Half S4**: plain's wiring + the parity suite over declarations and the
  fixture dir; gentle-ai's spawn becomes S4b behind its own ticket.
