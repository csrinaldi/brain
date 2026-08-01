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
- [x] **HUMAN GATE — ratify `standard`'s artefact set** (`design.md` §3: primary
      recommendation = all four; alternative = `proposal+spec+design`; forbidden =
      `proposal+spec`) — RATIFIED: primary recommendation (all four), per orchestrator
      instructions and confirmed already reflected in ADR-0026 (Accepted)
- [x] **HUMAN GATE — ratify brain's own tier as `lite`** and the `lite` budget choice
      (`design.md` §5: recommend 1000 with 400 kept as convention) — RATIFIED and
      already shipped: `brain.config.json` declares `"tier": "lite"` (commit `7e2d8f1`)
- [x] **HUMAN GATE — promote ADR-0026** to `brain/project/decisions/` with its
      `HOME.md` entry in the SAME PR (`decision-gate` step 1) — already shipped:
      ADR-0026 status is `Accepted` (commit `e8f9e93`, restored `b9e3723`)
- [x] Confirm the ADR number: `0026` is the human's claimed number, already used —
      no renumbering needed (confirmed via `brain/project/decisions/adr-0026-*.md`)
- [x] Post the resolution summary on #358 and the recommendation on #329
- [ ] Close #358 — still NOT closed in this batch: Phase 4 (evidence tiering) is
      blocked on #328, and #329's acceptance asks for a promoted ADR (done) + shipped
      REQ-L5-1′ (Phase 4, not yet done)

## Phase 1 — The tier module (no behaviour change)

Committed: `db674bb` — feat(governance): implement tier module (phase 1)

- [x] `brain/scripts/vcs/governance-tiers.mjs`: `TIERS`, `NEVER_TIERED`, `GATE_MATRIX`,
      `resolveTier`, `resolveGatePolicy`, `resolveGateEvidence`, `tierParams`,
      `requiredJobs` — pure, no I/O at import
- [x] `governance-tiers.test.mjs`: monotonicity (REQ-TIER-1), never-tiered core is
      `required` everywhere (REQ-TIER-2), no policy outside
      `{required, detection}` (REQ-TIER-3), position-tiered ∩ never-tiered = ∅
      (REQ-TIER-7), unknown tier fails closed
- [x] Drift-guard test (REQ-TIER-8): `GOVERNANCE_JOBS` ⊆ matrix keys AND matrix keys ⊆
      workflow job names — fail-closed, naming the unmapped gate
- [x] `config-migrations.mjs` `0.9.0`: `governance.tier: "standard"` + migration test
      asserting `buildDefaultConfig()` produces it

## Phase 2 — Derive the two consumer surfaces (REQ-TIER-9)

Committed: `90156e9` — feat(governance): derive consumer surfaces from tier matrix (phase 2)

- [x] `governance-checks.mjs`: `checkContexts(tier)` / `requiredJobs(tier)` derived
      from the matrix; keep `GOVERNANCE_JOBS` tier-independent. `REQUIRED_JOBS`/
      `DETECTION_JOBS` kept as backward-compatible aliases (computed from
      `requiredJobs('standard')`) — see apply-progress risk note on the wider
      literal-array importers left unmigrated (out of scope for phases 1-3).
- [x] `run-check.mjs`: `runDiffSizeCheck` resolves tier + `tierParams` and honors
      `size:exception` per tier; ALSO added the shared `mapDetectionToWarning(result,
      tier, gate)` helper (exported + tested) — deliberately NOT yet wired into
      `memory-gate`'s exit path: design §6 scopes that flip to **T2.1**
      ("do not couple T2.1's merge to that flip"), and wiring it now would both
      jump T2.1's scope and break the existing hard-required memory-gate test
      fixtures. `issue-link`/`decision-gate`/`diff-size` are never-tiered
      (always `required`), so the helper is a no-op there today by construction.
- [x] `brain-protect.mjs`: arm `checkContexts(resolveTier(config))`
- [x] `brain-governance-status.mjs`: print `tier <t> (declared) · rung <n> (detected)`
      plus the per-gate cross-product (REQ-TIER-11), with unit tests over the print
      logic using injected substrate + tier

## Phase 3 — Tiered parameters

Committed: `6169909` — feat(governance): tier-scoped diff budget and artefacts (phase 3)

- [x] `diff-size.mjs`/`run-check.mjs`: budget from `tierParams(tier).diffBudget`; honor
      `size:exception` per tier (REQ-TIER-6)
- [x] **Delete** the duplicate budget literals: `.github/workflows/governance.yml:126`
      and `brain/scripts/hooks/pre-push:59` route through the JS path (REQ-TIER-9) —
      diff-size job now calls `run-check.mjs diff-size` directly; pre-push calls the
      new `governance-tiers.mjs diff-budget` CLI printer
- [x] `phase-order-check.mjs` Rule A: artefact set from `tierParams(tier).artefacts`
      (added `hasVerification`, sourced from `verify-report.md` presence)
- [x] Tier-scope the pre-existing `override:*` label (`governance.approvalActors`):
      honored at lite/standard, refused at `regulated` (REQ-TIER-6) — implemented in
      `actor-check.mjs`/`brain-writes-reviewed.mjs` (override tier-scoping only;
      the deeper REQ-L5-1′/REQ-L6-1′ evidence-form rewrite stays Phase 4, blocked)
- [x] Test: `regulated` + `size:exception` at 260 lines fails with the tier named
- [x] Test: `regulated` + an allow-listed `override:*` still fails L5/L6
- [x] **CRITICAL fix** (post-verify, commit `ac1d058` — fix(governance): make
      rung-2/3 audit path tier-aware): `lib/merge-walk.mjs`'s `evaluateMerge()`
      called `diffSize(numstat, ignoreList)` with no budget, silently falling
      back to `diff-size.mjs`'s own 400-line default, and honored
      `size:exception` unconditionally — the rung-2 (`brain-audit.mjs`,
      `release.yml`) and rung-3 (`brain-metrics.mjs`,
      `governance-postmerge.yml`) audit path had zero tier awareness,
      violating REQ-TIER-9/REQ-TIER-6. Now accepts explicit `diffBudget` /
      `honorSizeException` / `tier` ctx params (defaulting to the pre-tier
      400/honored behaviour for any un-migrated caller); `brain-audit.mjs`
      and `brain-metrics.mjs` resolve `tierParams(resolveTier(config))` once
      per run and thread it through; `brain-check.mjs` resolves the same
      source for its own local `diffSize()` budget. Tests added:
      `merge-walk.test.mjs` (lite 900-line diff passes; regulated + 260-line
      `size:exception` fails naming the tier; no-budget-supplied legacy
      400-line fallback) and `brain-check.test.mjs` (budget=1000 passes 900
      lines; no-budget-supplied legacy 400-line fallback).

## Phase 4 — Evidence tiering (blocked)

- [ ] **BLOCKED on #328** — do not start. The lite distinct-act evidence is a
      timestamp comparison against an event #328 proves is not yet observable.
- [ ] `actor-check.mjs`: REQ-L5-1′ evidence forms; fail closed when the label-add
      event is unreadable
- [ ] `brain-writes-reviewed.mjs`: REQ-L6-1′ evidence forms; agent identities from the
      existing `governance.reviewActors` key — no new list
- [ ] Tests: solo maintainer passes at `lite` **with no `override:*` label**, same PR
      fails at `standard`, approval predating the head commit fails at every tier,
      agent-authored `brain/**` change fails at every tier

## Phase 5 — Promotions (each precondition-gated, separate PRs)

- [ ] Promote `actor-check` to `required` at all tiers — after Phase 4
- [ ] Promote `brain-writes-reviewed` to `required` at all tiers — after Phase 4
- [ ] Fail-close `phase-order`'s uncomputable-diff branch (ADR-0015's recorded
      precondition), THEN promote at `standard`/`regulated`
- [ ] `brain.config.json`: set `"tier": "lite"` — after the human gate. NOTE: this
      is factually already true (`brain.config.json` has carried `"tier": "lite"`
      since commit `7e2d8f1`, merged via PR #390) — left unchecked here because
      the actor-check/brain-writes-reviewed promotion this Phase 5 task exists to
      pair with has NOT landed yet (still blocked on Phase 4/#328); checking this
      box in isolation would misstate the phase as done.

## Phase 6 — Documentation

- [ ] `brain/core/methodology/workflow-governance.md`: the tier axis, the matrix, and
      the tier × rung composition (human-signed — `brain/core/**` is Tier 2)
- [ ] `docs/adoption.md`: how an adopter picks a tier (and that it is a declaration
      about their operating model, not about their GitHub plan)
- [ ] `docs/KNOWN-LIMITATIONS.md`: `standard`/`regulated` unexercised at n=0 external
      adopters; `regulated` unsatisfiable on GitLab today (rung 3 is GitHub-only, #130)
- [ ] Resolve the pre-existing `decision-gate` code-vs-doc divergence (design §9) —
      either fix `adr-presence.mjs` or fix `workflow-governance.md`
- [ ] Decide `skip:memory-gate`: implement it or remove it from the docs (design §9)
