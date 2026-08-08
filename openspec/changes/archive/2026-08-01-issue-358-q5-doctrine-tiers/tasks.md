# Tasks: Governance Doctrine Tiers (#358 / Q5)

Reads: `proposal.md`, `spec.md`, `design.md`.

Phase 0 is the decision itself — it is what unblocks #329, #94, T2.1 and M3, and it is
complete when a human ratifies §3. Phases 1+ are implementation and MUST NOT start
before Phase 0 closes.

## Phase 0 — Decision (this change)

- [x] Map the two axes: declared tier vs detected rung (`proposal.md`)
- [x] Enumerate alternatives and record the rejections (`design.md` §1)
- [x] Define the three tiers and the gate distribution matrix (`design.md` §2)
- [x] Separate position tiering from evidence tiering; state which gate uses which
- [x] Write the seven tier invariants as testable requirements (`spec.md`)
- [x] Record the deliberate divergence from the Q5 one-liner on `standard`'s artefact
      set, with the epic-literal alternative (`design.md` §3)
- [x] Surface the undocumented `brain-writes-reviewed` n=1 contradiction (`design.md` §0)
- [x] Write the #329 resolution recommendation against its own acceptance criteria
      (`design.md` §4)
- [x] Write the gate-promotion verdict per detection job, with preconditions (§4.1)
- [x] Measure the honest cost of brain declaring `lite` (`design.md` §5)
- [x] Write T2.1 gate-scoping guidance (`design.md` §6)
- [x] Write M3 reviewer-gate impact (`design.md` §7)
- [x] Draft ADR-0026 in `brain-drafts/` (Tier 2 — the agent drafts, the human signs)
- [x] Draft the `brain/HOME.md` index entry for co-promotion
- [x] **HUMAN GATE — ratify `standard`'s artefact set** (primary recommendation = all four) — RATIFIED
- [x] **HUMAN GATE — ratify brain's own tier as `lite`** — RATIFIED
- [x] **HUMAN GATE — promote ADR-0026** to Accepted status — DONE
- [x] Confirm the ADR number: `0026` — confirmed
- [x] Post the resolution summary on #358 and the recommendation on #329

## Phase 1 — The tier module (no behaviour change)

Committed: `db674bb` — feat(governance): implement tier module (phase 1)

- [x] `brain/scripts/vcs/governance-tiers.mjs`: `TIERS`, `NEVER_TIERED`, `GATE_MATRIX`,
      `resolveTier`, `resolveGatePolicy`, `resolveGateEvidence`, `tierParams`,
      `requiredJobs` — pure, no I/O at import
- [x] `governance-tiers.test.mjs`: monotonicity (REQ-TIER-1), never-tiered core is
      `required` everywhere (REQ-TIER-2), no policy outside `{required, detection}` (REQ-TIER-3)
- [x] Drift-guard test (REQ-TIER-8): `GOVERNANCE_JOBS` ⊆ matrix keys AND matrix keys ⊆ workflow job names
- [x] `config-migrations.mjs` `0.9.0`: `governance.tier: "standard"` + migration test

## Phase 2 — Derive the two consumer surfaces (REQ-TIER-9)

Committed: `90156e9` — feat(governance): derive consumer surfaces from tier matrix (phase 2)

- [x] `governance-checks.mjs`: `checkContexts(tier)` / `requiredJobs(tier)` derived from the matrix
- [x] `run-check.mjs`: tier-aware diff-size check, `mapDetectionToWarning` helper
- [x] `brain-protect.mjs`: arm `checkContexts(resolveTier(config))`
- [x] `brain-governance-status.mjs`: report tier × rung cross-product (REQ-TIER-11)

## Phase 3 — Tiered parameters

Committed: `6169909` — feat(governance): tier-scoped diff budget and artefacts (phase 3)

- [x] `diff-size.mjs`/`run-check.mjs`: budget from `tierParams(tier).diffBudget`
- [x] **Delete** duplicate budget literals from `.github/workflows/governance.yml:126` and `brain/scripts/hooks/pre-push:59` (REQ-TIER-9)
- [x] `phase-order-check.mjs` Rule A: artefact set from `tierParams(tier).artefacts`
- [x] Tier-scope the pre-existing `override:*` label: honored at lite/standard, refused at regulated (REQ-TIER-6)
- [x] Tests: `regulated` + `size:exception` at 260 lines fails with the tier named
- [x] Tests: `regulated` + `override:*` still fails L5/L6
- [x] **CRITICAL fix** (commit `ac1d058`): `lib/merge-walk.mjs` now tier-aware; `brain-audit.mjs` and `brain-metrics.mjs` resolve and thread tier context

## Phase 4 — Evidence tiering (blocked on #328)

- [ ] **BLOCKED on #328** — do not start.
- [ ] `actor-check.mjs`: REQ-L5-1′ evidence forms
- [ ] `brain-writes-reviewed.mjs`: REQ-L6-1′ evidence forms
- [ ] Tests: solo maintainer passes at `lite` with no override; fails at `standard`

## Phase 5 — Promotions (each precondition-gated, separate PRs)

- [ ] Promote `actor-check` to `required` at all tiers — after Phase 4
- [ ] Promote `brain-writes-reviewed` to `required` at all tiers — after Phase 4
- [ ] Fail-close `phase-order`'s uncomputable-diff branch, then promote
- [ ] Set `brain.config.json` `"tier": "lite"` (already shipped)

## Phase 6 — Documentation

- [ ] `workflow-governance.md`: the tier axis, the matrix, and the tier × rung composition
- [ ] `adoption.md`: how an adopter picks a tier
- [ ] `KNOWN-LIMITATIONS.md`: unexercised tiers, regulated unsupported on GitLab
- [ ] Resolve pre-existing `decision-gate` code-vs-doc divergence
