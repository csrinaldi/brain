---
issue: 810
phase: explore
---

# Explore — #456 slice B: the declared custom stage runs end to end

## What already exists (measured on main at 5d403bed)

- `resolveStageSet(config)` (`brain/scripts/lib/sdd-layout.mjs:126`) resolves
  `sdd.stages` with three refusals (omission, relative reorder, artefact
  collision) and returns `{stages, files}` — the full declared set in declared
  order, custom artefacts mapped. Ships validated but UNCONSUMED by the three
  surfaces this ticket names.
- Consumers of `resolveStageSet` today: the router (`stage-engine.mjs`,
  `stage-config.mjs`), the role port, the engines report. None of scaffold,
  phase-order, archive.
- **SCAFFOLD** (`brain/scripts/new-change.mjs`): hardcodes four templates and
  writes exactly proposal/spec/design/tasks. Never reads config.
- **GATE** (`brain/scripts/vcs/phase-order-check.mjs`): Rule A walks
  `artefacts = tierParams(tier).artefacts` — names only, mapped to boolean
  flags via `ARTEFACT_FIELD` (`hasProposal`…) computed by `buildChangeDir`,
  which probes a fixed file list. A custom stage has no flag and no probe:
  today it is invisible to the walk.
- **ARCHIVE** (`brain/scripts/lib/archive-logic.mjs`): merges delta specs then
  moves the whole change dir. A custom artefact would ride the move — nothing
  pins that behaviour.
- `check-refs` and the reviewer checkpoint demand `requiredArtifactsFor(tier)`
  presence and do NOT refuse extra files — custom artefacts are additive there.
- Doctrine: ADR-0019 Amendment 1 §"What this amendment does NOT authorise"
  explicitly withholds a stage whose artefact joins what the gates demand:
  "That is #456's question, and it is not authorised here." Amendment promote
  arm exists (`brain:promote -- <brain-drafts/*.draft.md>`, brain-amendment/1).

## The gap, in one sentence

`sdd.stages["x"].artefact` is validated, mapped, routed (S2/S4) — and no gate,
scaffold, or archive surface ever looks at it: declaring a custom stage today
changes nothing observable in the change dir's lifecycle.
