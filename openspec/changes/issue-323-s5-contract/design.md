# Design: S5

- `sdd-layout.mjs`: `SLICE_SCOPE_TAG = 'brain-slice-scope/1'`;
  `parseSliceScopes(text)` → `{scopes, refusal}` (fenced-block extraction as
  migration-draft.mjs does; JSON.parse only; per-block shape refusals).
- `check-refs.mjs` (the "Artifact structure" half): for every
  `openspec/changes/*/tasks.md`, if blocks present → parse; refusal = red
  naming the file. Absence passes (grandfather-by-absence).
- `brain/scripts/status/stranded.mjs`: `strandedTrackers({branches, openPrHeads})`
  PURE (list in, list out); the CLI half reads `git for-each-ref` +
  the VCS adapter's PR list, filters `feature/*`, reports via `brain:status`.
- Follow-up ticket filed here: the reviewer consumes the scope blocks
  (questions 1 and 3 mechanical) + new-change block enforcement.
