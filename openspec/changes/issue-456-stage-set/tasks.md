# Tasks: #456 slice A — the SDD stage set becomes data

> Spec/design reconciliation checked: `specs/sdd-stage-set/spec.md` "Missing
> lifecycle stage refusal" already carries the D5a amendment (reorder REFUSED,
> not normalized). No reconciliation task needed — design is authoritative and
> spec matches it.

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines (countable) | ~90–100 (`sdd-layout.mjs` ~55, `stage-engine.mjs` ~20, `phase-order-check.mjs` ~7, `config-migrations.mjs` ~14) |
| Estimated changed lines (total incl. tests) | ~250–300 (`*.test.mjs` not counted — see below) |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR (contingency: if countable drifts >400, split at Phase 5 — the drift guard has an independent verification story and clean rollback) |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending (not needed — risk is Low) |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

**Verified, not assumed**: `brain.config.json` → `governance.tier: "lite"` (confirmed
`diffBudget: 1000` in `governance-tiers.mjs`); `governance.ignoreList` contains
`"**/*.test.mjs"` and `"openspec/changes/**"` verbatim. So test-file additions
(~160–200 lines across `sdd-layout.test.mjs`, `config-migrations.test.mjs`) are
real reviewer surface but genuinely NOT counted toward the 1000-line gate. Countable
production diff (~90–100) is well under budget even before that exclusion.

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Phases 1–7 below | PR 1 (only) | Single PR; drift guard (Phase 5) lands last per design D7/§ordering |

## Phase 1: `sdd-layout.mjs` — the resolver (Foundation)
- [x] 1.1 RED — `sdd-layout.test.mjs`: assert `resolveStageSet(undefined)` and `resolveStageSet({})` deepEqual `['proposal','spec','design','tasks']`; `REQUIRED_ARTIFACTS` unchanged. [Req: Zero-config identity]
- [x] 1.2 GREEN — `sdd-layout.mjs`: add `LIFECYCLE_STAGES` (frozen four), `resolveStageSet(config)` (pure, config received never read), `artefactFiles(names, fileMap = ARTEFACT_FILE)`; re-derive `REQUIRED_ARTIFACTS = artefactFiles(LIFECYCLE_STAGES)`.
- [x] 1.3 RED — refusal tests: omission names missing stage(s); reorder of the four refused, message states expected order; file collision (declared artefact == existing lifecycle file); unknown stage w/o file. [Req: Missing lifecycle stage refusal; Unknown stage name refusal]
- [x] 1.4 GREEN — implement the three refusals + additive merge `{...ARTEFACT_FILE, ...declared}` inside `resolveStageSet`. [Req: Additive declaration]
- [x] 1.5 RED+GREEN — four + `threat-model` (explicit artefact) resolves to five; default-map `artefactFiles(['threat-model'])` still throws.
- [x] 1.6 Verify — `npm test` green; `cites-resolve.test.mjs` still resolves `REQUIRED_ARTIFACTS` as a const symbol.

## Phase 2: `stage-engine.mjs` — collapse to re-export
- [x] 2.1 Modify — replace the literal with `export const SDD_LIFECYCLE_STAGES = LIFECYCLE_STAGES` (imported from `sdd-layout.mjs`). No new test — value byte-identical. [Req: Single source of truth]
- [x] 2.2 Verify — `stage-engine.test.mjs`, `run-stage.test.mjs` green, UNMODIFIED; `git diff --stat -- brain/scripts/lib/stage-engine.test.mjs` empty. [Req: Routing refusal is unmodified]

## Phase 3: `phase-order-check.mjs` — default swap (seam already exists)
- [x] 3.1 Modify — import `LIFECYCLE_STAGES`; delete local `STANDARD_ARTEFACTS` const; rename default param in `evaluateRuleA`/`evaluatePhaseOrder` to `= LIFECYCLE_STAGES`; `messageForArtefacts` sentinel compares against it.
- [x] 3.2 Verify — `phase-order-check.test.mjs` green; pinned `'spec.md/design.md'` literal still selected for the canonical four. [Req: Missing lifecycle stage refusal — positional]

## Phase 4: Migration `0.11.0`
- [ ] 4.1 RED — `config-migrations.test.mjs`: `0.11.0` additive, default `{ sdd: { stages: {} } }`, idempotent, existing consumer value survives.
- [ ] 4.2 GREEN — `config-migrations.mjs`: add migration per design D4 (version, description, `defaults`), following `0.10.0` exactly.
- [ ] 4.3 Verify — `npm test` green.

> **NOT APPLIED — DRAFT ONLY.** `config-migrations.mjs` lives at `brain/core/config-migrations.mjs`,
> Tier 3 (prohibited outright per `AGENTS.md`; this apply run cannot write there). Exact migration
> entry + companion test edits (for `brain-config.test.mjs` and `stage-engine.test.mjs`, both of
> which reference the real `migrations` array and would go RED against a migration that does not
> exist) recorded at
> `openspec/changes/issue-456-stage-set/brain-drafts/config-migrations-0.11.0.md` for human
> promotion. Phases 1–3, 5–6 are green WITHOUT this landing, by design (D7/D8).

## Phase 5: Drift guard — second scan (LANDS LAST — do not reorder)
- [x] 5.1 RED (traps first, `tmp-tree-adoption` style) — bare-name rival array outside allowlist caught; allowlisted `governance-tiers.mjs` `TIER_PARAMS` does NOT trip; a non-allowlisted twin does; real-tree scan returns zero. [Req: Drift guard sees bare-name notation]
- [x] 5.2 GREEN — implement `scanForRivalStageArray`: same `BRACKET_RE` window, quoted-token requirement, 3-of-4 threshold; one allowlist entry for `governance-tiers.mjs` `TIER_PARAMS`, reason text states REQ-L4-2′ ("the tier scopes what the GATE demands, never what the SCAFFOLD produces").
- [x] 5.3 Verify — real-tree scan returns zero, proving Phases 2–3 landed (no bare-name rival remains in `stage-engine.mjs`/`phase-order-check.mjs`).

## Phase 6: Separation + untouched-surface proof
- [x] 6.1 Add test — REQ-L4-2′ both directions at `lite`: SCAFFOLD (`REQUIRED_ARTIFACTS`) four files; GATE (`requiredArtifactsFor('lite')`) `['spec.md']`. [Req: SCAFFOLD, GATE, and routable stages stay separate]
- [x] 6.2 Add test — `assertRoutableStage` refuses all four when `sdd.stages` declares the four + `threat-model`. [Req: Routing refusal is unmodified]
- [x] 6.3 Verify (manual, not coded) — the six set-blind importers (`session-start`, `memory/backends/engram`, `memory/lib/feature-resolution`, `archive-sweep`, `archive-logic`, `new-change`) unedited: `git diff --stat` shows no change to those files. **Confirmed**: `git status --porcelain` on all six is empty.

## Phase 7: Close
- [x] 7.1 Draft (Tier 3, no commit to `brain/core/**`/`brain/project/**`) — ADR-0019 Amendment 1 citation correction + `sdd-layout.md` guard-scope correction, under `openspec/changes/issue-456-stage-set/brain-drafts/`; human promotes. **Both drafts created.**
- [x] 7.2 Final verify — `npm test` ≥ 4497 pass / 0 fail (measured: **4519 pass / 0 fail**); countable diff confirmed within `lite`'s 1000-line budget (measured: **167 countable production lines** — `sdd-layout.mjs` +131/-4, `stage-engine.mjs` +18/-1, `phase-order-check.mjs` +11/-2; test file and `openspec/changes/**` additions excluded per `governance.ignoreList`). `npm run repo:check` and `npm run brain:nav` both pass.
