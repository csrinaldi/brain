# Apply Progress: #456 slice A — the SDD stage set becomes data

**Batch**: 1 (first and only batch this session)
**Mode**: Strict TDD (test runner `npm test`, node:test, no external deps)
**Baseline**: 4497 pass / 0 fail → **Final: 4519 pass / 0 fail** (+22 tests, 0 regressions)

## Completed Tasks

- [x] Phase 1 (1.1–1.6): `sdd-layout.mjs` — `LIFECYCLE_STAGES`, `resolveStageSet(config)`,
  `artefactFiles(names, fileMap = ARTEFACT_FILE)`; `REQUIRED_ARTIFACTS` re-derived,
  byte-identical, still a resolvable `export const` (`cites-resolve.test.mjs` unaffected).
- [x] Phase 2 (2.1–2.2): `stage-engine.mjs` — `SDD_LIFECYCLE_STAGES` collapsed to a re-export
  of `LIFECYCLE_STAGES`. `stage-engine.test.mjs` UNMODIFIED (`git diff --stat` empty, verified).
- [x] Phase 3 (3.1–3.2): `phase-order-check.mjs` — `STANDARD_ARTEFACTS` → `LIFECYCLE_STAGES`
  import (one-line default swap, seam pre-existed per design D7). Pinned
  `'spec.md/design.md'` literal still selected.
- [ ] Phase 4 (4.1–4.3): Migration `0.11.0` — **NOT APPLIED, DRAFTED**. `config-migrations.mjs`
  is `brain/core/**`, Tier 3, prohibited. Draft at
  `openspec/changes/issue-456-stage-set/brain-drafts/config-migrations-0.11.0.md` with the
  exact migration entry + companion test edits for `brain-config.test.mjs` and
  `stage-engine.test.mjs` (both reference the real `migrations` array; applying only the test
  half without the real entry would go RED against nothing). Phases 1–3/5–6 are green without
  this landing, as designed.
- [x] Phase 5 (5.1–5.3): Second drift scan — `scanForRivalStageArray` in `sdd-layout.test.mjs`,
  bare-name notation, same `BRACKET_RE`/3-of-4 threshold as A1, one allowlist entry
  (`governance-tiers.mjs` `TIER_PARAMS`, reason states REQ-L4-2′). Landed LAST, after Phases
  2–3 removed both bare-name literals — real-tree scan returns zero.
- [x] Phase 6 (6.1–6.3): REQ-L4-2′ both directions at `lite` asserted; `assertRoutableStage`
  proven to refuse all four even when `sdd.stages` declares them plus a custom stage; the six
  set-blind importers confirmed unedited (`git status --porcelain` empty on all six).
- [x] Phase 7 (7.1–7.2): Two Tier 3 draft corrections created under `brain-drafts/`
  (ADR-0019 Amendment 1 citation fix, `sdd-layout.md` guard-scope correction). Final verify run.

## Files Changed

| File | Action | What Was Done |
|------|--------|---------------|
| `brain/scripts/lib/sdd-layout.mjs` | Modified | Added `LIFECYCLE_STAGES` (frozen four), `resolveStageSet(config)` (pure, 3 refusals: omission, relative-order, file-collision), `artefactFiles` gained optional `fileMap` param; `REQUIRED_ARTIFACTS` re-derived from `LIFECYCLE_STAGES` |
| `brain/scripts/lib/stage-engine.mjs` | Modified | `SDD_LIFECYCLE_STAGES` collapsed to `= LIFECYCLE_STAGES` (import from `sdd-layout.mjs`), doc comment updated; `assertRoutableStage` body untouched |
| `brain/scripts/vcs/phase-order-check.mjs` | Modified | `STANDARD_ARTEFACTS` local literal replaced with `= LIFECYCLE_STAGES` import (added to existing import line); doc comment updated |
| `brain/scripts/lib/sdd-layout.test.mjs` | Modified | +22 tests: Phase 1 resolver/refusal tests, Phase 5 second drift scan (traps + real-tree scan), Phase 6 separation/routing-unmodified proofs |
| `openspec/changes/issue-456-stage-set/brain-drafts/config-migrations-0.11.0.md` | Created | DRAFT — migration `0.11.0` exact content + target file, for human promotion |
| `openspec/changes/issue-456-stage-set/brain-drafts/adr-0019-amendment-1-citation-correction.md` | Created | DRAFT — citation-accuracy correction for `brain/project/decisions/adr-0019-harness-port.md` |
| `openspec/changes/issue-456-stage-set/brain-drafts/sdd-layout-md-guard-scope-correction.md` | Created | DRAFT — guard-scope correction for `brain/core/methodology/sdd-layout.md` |
| `openspec/changes/issue-456-stage-set/tasks.md` | Modified | Checkboxes marked `[x]` for completed tasks; Phase 4 left `[ ]` with a DRAFT note |

**Not touched, verified**: `brain/scripts/lib/stage-engine.test.mjs` (`git diff --stat` empty —
Amendment 1 condition 4's load-bearing constraint); the six set-blind importers
(`session-start.mjs`, `memory/backends/engram.mjs`, `memory/lib/feature-resolution.mjs`,
`lib/archive-sweep.mjs`, `lib/archive-logic.mjs`, `new-change.mjs`).

**Pre-existing, not made by this apply run**: `openspec/config.yaml` shows a modification
(`strict_tdd: false → true`, testing baseline block) that was already present in the working
tree before this batch started (confirmed via `git status` at session start). Not part of
issue-456 slice A's scope; left as-is, flagged here for transparency since `git diff --stat`
will show it.

## TDD Cycle Evidence

| Task | RED | GREEN | REFACTOR |
|------|-----|-------|----------|
| 1.1–1.6 `resolveStageSet` + `LIFECYCLE_STAGES` + `artefactFiles(fileMap)` | Import of `LIFECYCLE_STAGES`/`resolveStageSet` failed (`SyntaxError: does not provide an export`) before implementation | 15 new tests pass after implementing `sdd-layout.mjs` | Reused `artefactFiles` refusal path inside `resolveStageSet` instead of a parallel check (D3) |
| 2.1–2.2 `stage-engine.mjs` re-export | N/A — value byte-identical by design, no new test (task 2.1 explicitly: "No new test") | `stage-engine.test.mjs` (9/9) + `run-stage.test.mjs` (22/22) verified green, file diff empty | none needed |
| 3.1–3.2 `phase-order-check.mjs` default swap | N/A — one-line default-param swap on a pre-existing seam (D7), no new test required by design | `phase-order-check.test.mjs` (42/42) green, pinned literal still selected | none needed |
| 5.1–5.3 second drift scan | Traps + real-scan assertions written against `scanForRivalStageArray`, which did not yet exist in the test file at authoring time (self-contained test-file artifact, same shape as existing A1 — no separately-exported production symbol to RED against) | 5 new tests (traps + real-tree-zero) pass | none needed |
| 6.1–6.2 separation + routing proof | Assertions written against existing exports (`REQUIRED_ARTIFACTS`, `requiredArtifactsFor`, `assertRoutableStage`) — genuinely already GREEN-capable pre-slice-A on the SCAFFOLD/GATE half; the routing half is a regression proof, not new production behaviour | 2 new tests pass | none needed |

**Note on Phase 5/6 RED evidence**: unlike Phases 1 (a genuinely new exported function) these two
phases add assertions inside the SAME test file as their subject (mirroring A1's own precedent,
which is entirely test-file-local with no separately-exported guard function). There was no
intermediate "fails to compile" state distinct from Phase 1's for these — they were authored and
run together, then confirmed green. Recorded plainly rather than dressed up as a RED cycle that
didn't distinctly occur.

## Deviations from Design

- **File-collision refusal semantics** (D5's third refusal) has no explicit `Scenario:` in
  `spec.md` — the spec's Requirements section covers omission/reorder (with the D5a amendment)
  and unknown-stage-name, but not collision. Implemented per design D5's prose ("a declared
  artefact equal to a lifecycle file... a custom stage impersonating a gate artefact"): any
  declared stage whose `artefact` equals one of `ARTEFACT_FILE`'s five existing values, where
  that value belongs to a DIFFERENT stage name, is refused. This is filling a spec gap from
  design, not deviating from design — flagged because `sdd-tasks` should consider adding the
  scenario to `spec.md` in a future amendment for completeness.
- **`sdd.stages` shape**: `spec.md`'s scenario prose writes `sdd.stages` as a bare array
  (`['proposal', 'design', 'tasks']`), but design D3/§5 is unambiguous that the real config shape
  is an OBJECT keyed by stage name (`Record<string, {artefact?: string}>`), symmetric with
  `sdd.map`, and the migration default is `{}` not `[]`. Implemented per design (object form) —
  the array notation in spec.md scenarios is read as shorthand for "the declared set of names in
  this order," not a literal JSON shape. Not a deviation from design; noted because a future
  reader of spec.md alone could be misled into expecting array support.
- Everything else matches design exactly: PURE `resolveStageSet` (config received, never read),
  D5a refusal-not-normalization for reorder, D6's second-scan-not-widened-A1 approach with the
  single `governance-tiers.mjs` allowlist entry, D7's phase ordering (drift guard last).

## Issues Found

None beyond the pre-existing `openspec/config.yaml` change noted above (unrelated to this task,
not modified by this apply run).

## Workload / PR Boundary

- Mode: single PR (per tasks.md's Review Workload Forecast: `400-line budget risk: Low`,
  `Chained PRs recommended: No`, delivery strategy `ask-on-risk`)
- Current work unit: Unit 1 (Phases 1–7), the only planned unit
- Boundary: starts from a green baseline (4497/0), ends at a green baseline (4519/0) with Phase 4
  drafted rather than applied (Tier 3 constraint) — the whole slice's committable surface in one
  PR, as forecast
- Estimated review budget impact: 167 countable production lines (well under the `lite` tier's
  1000-line budget, and under `standard`'s 400 as well) — matches the tasks.md forecast (~90–100
  estimated, some growth from house-style docstring rationale on the refusal branches)

## Status

7/7 phases addressed (6 fully applied + verified, 1 drafted per Tier 3 constraint).
**Ready for verify.** `npm test`: 4519 pass / 0 fail. `npm run repo:check`: pass.
`npm run brain:nav`: pass.
