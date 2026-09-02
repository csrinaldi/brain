# Proposal: #323 S2 — the check that replaces the refusal

Tier `lite`. Change `issue-323-stage-routing`, worktree
`/home/gandalf/IA/brain-issue-323` off `main @ 1421f35` (M5 complete).

**Authority**: ADR-0019 Amendment 1 (the four conditions, signed 28/08 via
#792 — condition 4 is this change's work order), ADR-0024 Amendment 1, the
D6 axis vocabulary, and the maintainer's ruling of 02/09/2026: **option A
now, option C ticketed** (#833, filed the same day as the debt A takes on).

## Intent

The doctrine gets its reader. `assertRoutableStage`'s flat refusal of the
four lifecycle stages — which has been HOLDING conditions 1–3 true since
ADR-0019 — is replaced by a check that enforces them: a stage is routable
iff it is DECLARED (lifecycle, or a member of the resolved `sdd.stages`),
and — for lifecycle stages — the routed value names an `SDD_ENGINES` member
that DECLARES the stage through M5's port, enabled. Everything the amendment
permits becomes possible; everything it forbids becomes a refusal with a
name.

## Decisions

- **D1 (the maintainer, 02/09) — option A: the check splits by stage class.**
  Lifecycle stages route only to declaring engines. Custom stages may name a
  transport (ADR-0033's word) — the split preserves the one live config in
  the field and is stated OUT LOUD in the refusal texts and the ADR trail.
  The debt is #833's, filed, not implied.
- **D2 — the port is the enforcement surface.** "The engine declares the
  stage" is answered by `loadInhabitant` + `resolveRoles` — the M5 calls
  every consumer makes. No second registry, no parallel list: an engine that
  refuses its interrogation is unroutable, with the port's own words.
- **D3 — undeclared stages refuse everywhere.** `resolveStageEngine` gains
  the resolved-set check the roadmap's S2 line always promised: an `sdd.map`
  entry for a stage that is neither lifecycle nor declared in `sdd.stages`
  is an error naming both sets, never a silent route.
- **D4 — conditions 1–3 get their pins.** C1: the map's value shape carries
  `{engine, model}` and nothing path-shaped — refused by the schema check.
  C2: pinned by test — no shared reader reads an engine field. C3: the parity
  property is S4's suite; this change lands the HOOK (the check exposes what
  was routed so the suite can compare) and states plainly that C3's proof
  arrives with S4, not here.

## Scope

`stage-engine.mjs` (the new `assertRoutableStage` + `resolveStageEngine`'s
declared-set refusal + the async port interrogation seam), its callers
unchanged in signature, the refusal catalog lines (i18n), tests RED-first
including: the four lifecycle stages routable to a declaring engine; refused
to a non-engine; refused to a non-declaring engine; custom stages keep
transport naming; undeclared stages refuse; the #812 field config still
resolves.

## Non-goals

- #833 (one vocabulary — the split's retirement).
- S4's ≥2 wired engines and the parity suite (C3's proof).
- `VALID_OPS` growth, S5's artifact-contract guards, S6 (#810).
- Any change to what the shared readers read (C2 stays structural).

## Risks

- **The async seam**: `resolveRoles` needs the inhabitant module; today's
  `assertRoutableStage` is sync and called in sync paths. The design must
  either pre-resolve (the caller passes the declaration) or make the check
  async where its callers already are — decided in design, not silently.
- The #812 workaround must keep working byte-for-byte (custom stage +
  transport name) — pinned by test before anything else changes.
