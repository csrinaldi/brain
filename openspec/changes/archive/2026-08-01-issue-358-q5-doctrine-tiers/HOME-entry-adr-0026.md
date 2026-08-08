# HOME.md Index Entry for ADR-0026 — Draft Promotion Instructions

## Where it goes

Under `## Project-specific (brain/project/)` → `### Architecture decisions`, immediately
AFTER the `ADR-0024` bullet (currently the last entry, `brain/HOME.md:72`), matching the
existing list format.

## The entry (paste exactly)

```markdown
- [ADR-0026](project/decisions/adr-0026-governance-doctrine-tiers.md) — Governance doctrine tiers: a declared lite/standard/regulated axis orthogonal to the detected substrate ladder (amends ADR-0015 REQ-L4-2/L5-1/L6-1; resolves #329)
```

## Numbering caveat — check before pasting

`0018`, `0023`, and `0025` are each cited somewhere in the repo but absent from
`brain/project/decisions/`:

- `0018` — draft only, `openspec/changes/archive/231/brain-drafts/adr-0018-gitlab-governance-pipeline.md`
- `0023` — draft only, `brain-drafts/adr-0023-sdd-role-port.md` (M5, #312)
- `0025` — cited by #331 / `issue-337-efficacy-probes`, **not in tree** (recorded there
  as a phantom: *"ADR-0025 (cited by #331) is not in tree; do not assert its guarantee"*)

`0026` is the first number with no claim on it. If the human intends to promote
ADR-0023 or land ADR-0025 first, renumber this ADR and this entry together.

## Co-promotion note — DO NOT split from the ADR

This entry MUST land in the same PR as
`brain/project/decisions/adr-0026-governance-doctrine-tiers.md` (the promoted, signed
ADR). `decision-gate` requires that an ADR file change and a `brain/HOME.md` change
co-occur in the diff — either one alone is a broken promotion and fails the gate.

## Ratification gates before promotion

Do not promote until both are decided (`design.md` §3 and §5):

1. **`standard`'s artefact set** — primary recommendation: all four. Alternative:
   `proposal + spec + design`. Forbidden: `proposal + spec` (weakens the default tier
   and contradicts ratified REQ-L4-2).
2. **brain's own tier and `lite` budget** — recommendation: `"tier": "lite"` in
   `brain.config.json`, budget 1000 with 400 kept as a chained-PR convention.

## Status: PROMOTED

Per orchestrator instructions, both ratification gates have been decided:
1. **`standard`'s artefact set**: Ratified as all four artefacts (primary recommendation)
2. **brain's own tier**: Ratified as `"tier": "lite"` (already shipped in `brain.config.json`)
3. **ADR status**: Now **Accepted** (promoted to `brain/project/decisions/`)
