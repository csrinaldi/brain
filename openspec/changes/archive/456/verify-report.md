# Verify Report: #456 slice A — the SDD stage set becomes data

**Change**: issue-456-stage-set
**Worktree verified**: /home/gandalf/IA/brain-issue-456 (branch feat/issue-456-…, off origin/main @ b6f9dd8)
**Mode**: full artifacts (spec + design + tasks + apply-progress) — read against the CURRENT (twice-amended) spec.md text, not the version apply may have started from.
**Verdict: PASS. No CRITICAL findings. One WARNING (spec-completeness gap, already self-flagged by the apply report). No SUGGESTIONs beyond documenting the deferred Tier 3 promotions.**

## 1. Spec requirement → test coverage matrix

Read from the CURRENT `specs/sdd-stage-set/spec.md` (both amendments present: reorder REFUSED not normalized; `sdd.stages` is an object keyed by stage name). Every requirement/scenario maps to a named, passing test in `brain/scripts/lib/sdd-layout.test.mjs` unless noted.

| Requirement / Scenario | Covering test | Status |
|---|---|---|
| Zero-config identity — no `sdd.stages` key | `#456 1.1: resolveStageSet(undefined) resolves to the canonical four...` | PASS |
| Zero-config identity — `{}` resolves same as absent | `#456 1.1: resolveStageSet({}) — no sdd key at all — resolves identically...` + `#456 1.1: resolveStageSet({ sdd: { stages: {} } })...` | PASS |
| Zero-config identity — same gate outcomes | `1.2: ...REQUIRED_ARTIFACTS unchanged`, `#555` suite (`requiredArtifactsFor` per tier unchanged), `6.1` (SCAFFOLD vs GATE at `lite`) | PASS |
| Additive declaration — custom stage added | `#456 1.5: the four plus an explicit custom stage (threat-model) resolves to five, files merged` | PASS |
| Missing lifecycle stage refusal — omits one | `#456 1.3: resolveStageSet refuses a declared set omitting one lifecycle stage, naming it` | PASS |
| Missing lifecycle stage refusal — omits two | `#456 1.3: ...omitting TWO lifecycle stages, naming both` | PASS |
| Declaration is an empty object → four | `#456 1.3: ...an EXPLICIT empty set is zero-config` | PASS |
| Non-canonical key order → REFUSED (amendment 1) | `#456 1.3: resolveStageSet refuses the four declared out of relative order (D5a)` + message-states-order test | PASS |
| Four in canonical order + custom stage → succeeds | `#456 1.5`, `#456 1.3: a custom stage interleaved BETWEEN the four...is legal` | PASS |
| Unknown stage name refusal — custom stage declares file | `#456 1.5` | PASS |
| Unknown stage name refusal — custom stage w/o file | `#456: a custom stage declared WITHOUT an artefact file is refused, naming the stage` | PASS |
| Single source of truth — no rival full-set declaration | `2.1`–`2.5` (`.md`-suffixed scan), `5.1`–`5.2` (bare-name scan), `A3` suite (import-shape) | PASS |
| Drift guard sees bare-name notation | `5.1: scanForRivalStageArray catches a bare-name rival array literal...` | PASS |
| SCAFFOLD/GATE/routable stay separate | `6.1: REQ-L4-2′ both directions at lite` | PASS |
| Routing refusal unmodified | `6.2: assertRoutableStage refuses all four when sdd.stages declares the four plus a custom stage` + `stage-engine.test.mjs` byte-identical (see §2) | PASS |

**Zero requirement/scenario in spec.md is left without a passing covering test.**

**Deviation, confirmed real (item 8 of the verify brief):** design D5's third refusal — a declared artefact colliding with an existing lifecycle file (impersonation) — has a passing test (`#456 1.3: resolveStageSet refuses a declared artefact colliding with an existing lifecycle file (impersonation, D5)`) but **no corresponding spec.md Scenario**. Neither "Missing lifecycle stage refusal" nor "Unknown stage name refusal" covers it. This is accurately self-flagged in apply-progress and remains true after re-reading the current spec text. See WARNING-1 below.

## 2. Load-bearing invariants (checked in the tree, not the report)

1. **`brain/scripts/lib/stage-engine.test.mjs` byte-for-byte unmodified** (ADR-0019 Amendment 1 condition 4):
   `git diff -- brain/scripts/lib/stage-engine.test.mjs` → **empty**. Confirmed unmodified.
2. **`REQUIRED_ARTIFACTS` stays a resolvable `export const` symbol**: `brain/scripts/lib/sdd-layout.mjs:88` — `export const REQUIRED_ARTIFACTS = Object.freeze(artefactFiles(LIFECYCLE_STAGES));` (a const, not a function). `brain/scripts/review/cites-resolve.test.mjs:162` asserts `probe('sdd-layout.mjs', 'REQUIRED_ARTIFACTS') === true` — ran this file in isolation (`node --test brain/scripts/review/cites-resolve.test.mjs`): **68/68 assertions pass** (whole-file run), and the full-suite run also carries it green.
3. **Nothing under `brain/core/**` or `brain/project/**` was written**: `git status --porcelain -- brain/core/ brain/project/` → **empty**. `git diff --stat -- brain/core/config-migrations.mjs` → **empty** (untouched, as claimed — Phase 4 is draft-only).

## 3. Zero-config identity — proven, not assumed

- `resolveStageSet(undefined)` and `resolveStageSet({})` both deep-equal `{ stages: ['proposal','spec','design','tasks'], files: {proposal:'proposal.md', spec:'spec.md', design:'design.md', tasks:'tasks.md'} }` — asserted directly in tests, not inferred.
- `REQUIRED_ARTIFACTS` (the SCAFFOLD set) stays `['proposal.md','spec.md','design.md','tasks.md']`, frozen, byte-identical to before this change (`1.2`, `#456 1.1`, `#555`, `6.1`).
- `requiredArtifactsFor('lite'|'standard'|'regulated')` (the GATE set) is unchanged at all three tiers (`#555` suite).
- `assertRoutableStage` still refuses all four unconditionally, even with a declared custom stage present (`6.2`).
- This repo's own `brain.config.json` carries no `sdd` key at all — brain is the live zero-config fixture, and `npm test` passing end-to-end (see §5) is that identity exercised for real, not only in unit fixtures.

## 4. Drift guard — proven to catch what it claims

- `5.1: scanForRivalStageArray catches a bare-name rival array literal co-occurring 3+ of the 4 lifecycle names, naming the file` — a trap fixture proves the scan fires on a re-introduced bare-name declaration.
- `5.1: the allowlisted governance-tiers.mjs-shaped path does NOT trip, while a non-allowlisted twin at a different path DOES` — proves the allowlist is scoped to the exact path, not the shape.
- `5.2: real-tree scan of brain/scripts/** returns ZERO offenders` — confirms Phases 2–3 actually removed both prior bare-name literals from the real tree (not just from the fixtures).
- **Allowlist reason, verified in the tree**: `brain/scripts/lib/sdd-layout.test.mjs:783-786` — the sole entry (`brain/scripts/vcs/governance-tiers.mjs`) carries a written reason: *"REQ-L4-2′: the tier scopes what the GATE demands, never what the SCAFFOLD produces — TIER_PARAMS.artefacts is the tier-scoped GATE set, a DIFFERENT set from LIFECYCLE_STAGES on purpose."* Confirmed the object is in fact named `TIER_PARAMS` at `brain/scripts/vcs/governance-tiers.mjs:219`, matching the allowlisted path exactly. An allowlist entry without a reason would be a finding; this one carries one, so it is not.

## 5. Phase 4 — DRAFT, not applied (confirmed)

- `brain/core/config-migrations.mjs`: `git diff --stat` empty — untouched.
- `openspec/changes/issue-456-stage-set/brain-drafts/config-migrations-0.11.0.md` contains: the exact migration entry (version, description, `defaults: { sdd: { stages: {} } }`) for a human to append, PLUS the companion test edits for both `brain-config.test.mjs` (schemaVersion + `cfg.sdd.stages` assertion) and `stage-engine.test.mjs` (new `#456` migration-default test), with explicit sequencing instructions (Edit 1 first, then 2+3) and a warning against renumbering `0.11.0` if another migration lands first. **This draft is complete enough for direct promotion** — not a finding.
- Two further Tier 3 drafts exist for Phase 7 (ADR-0019 Amendment 1 citation correction, `sdd-layout.md` guard-scope correction), both with precise before/after text. Also complete.

## 6. Single source of truth — the three declarations really collapsed to one

`rg` for both notations across `brain/scripts/**` (excluding `*.test.mjs`):

```
brain/scripts/vcs/governance-tiers.mjs:240:    artefacts: Object.freeze(['proposal', 'spec', 'design', 'tasks']),
brain/scripts/lib/sdd-layout.mjs:76:export const LIFECYCLE_STAGES = Object.freeze(['proposal', 'spec', 'design', 'tasks']);
```

Two hits: the owner (`sdd-layout.mjs`, excluded by design from its own scan) and the one allowlisted entry (`governance-tiers.mjs`'s `TIER_PARAMS`, reason confirmed above). No third, non-allowlisted bare-name or `.md`-suffixed rival exists. `stage-engine.mjs` and `phase-order-check.mjs` both now import `LIFECYCLE_STAGES` rather than declaring their own literal (confirmed by direct source read).

## 7. Test suite — measured, not trusted from the report

Run in `/home/gandalf/IA/brain-issue-456`:

| Command | Claimed | Measured |
|---|---|---|
| `npm test` | 4519 pass / 0 fail | **4519 pass / 0 fail** — matches exactly |
| `npm run repo:check` | pass | **pass** — "No prohibited references found. Artifact structure is valid." |
| `npm run brain:nav` | pass | **pass** — "sin huérfanos, sin links rotos, sin rutas citadas inexistentes" |

`brain/scripts/lib/sdd-layout.test.mjs` run in isolation: 68/68 pass, including all `#456`-tagged tests and the Phase 5 drift-guard tests.

## 8. Task completion vs code state

`tasks.md` on disk: 18 checked (`- [x]`) + 3 unchecked (`- [ ]`) = 21 tasks across 7 phases, matching the brief. The 3 unchecked are exactly Phase 4's tasks (4.1–4.3, the migration), consistent with the DRAFT-only status confirmed in §5. All Phase 1/2/3/5/6/7 tasks are checked and each has direct source/test evidence above. No task is checked without matching code/test evidence, and no applied-and-working code is left unchecked.

## Findings

**WARNING-1 — spec.md gap: file-collision refusal has no Scenario.**
`openspec/changes/issue-456-stage-set/specs/sdd-stage-set/spec.md` — Requirements section, between "Missing lifecycle stage refusal" (lines 40–121) and "Unknown stage name refusal" (lines 123–140). Design D5 (design.md, "Three refusals, each naming the offender") specifies a third refusal — a declared `artefact` colliding with an existing lifecycle file — and it is implemented (`sdd-layout.mjs:165-182`) and tested (`sdd-layout.test.mjs:316-328`). Neither existing spec Requirement's prose or Scenario set names this case.
Concrete failure scenario if unaddressed: a future reader of spec.md alone (not design.md) would not know this refusal exists, could assume `sdd.stages` only refuses omission/order/unknown-name, and could file a "missing feature" issue against behavior that already exists and is already tested — or, worse, a future spec-only reviewer approving a regression that silently permitted artefact collision because the spec text gave no requirement to check it against.
**Recommendation**: add a fourth scenario under "Missing lifecycle stage refusal" or a new "Declared artefact collision refusal" requirement before archive. This does not block archive on correctness grounds (the code is correct and tested against design authority), but it is a real completeness gap in the artifact meant to be the authoritative requirement source, and should be closed before this spec is treated as final.

No other CRITICAL, WARNING, or SUGGESTION findings. No untested spec scenario. No load-bearing invariant violated. No Tier 3 write occurred. Zero-config identity is proven. The drift guard's trap tests prove it would catch a re-introduced bare-name rival, and its one allowlist entry carries a written REQ-L4-2′ reason at the correct path. The three declarations of the stage set are confirmed collapsed to one plus the one legitimate, reasoned allowlist exception. Phase 4 is a complete, promotable draft, not silently skipped. All 4519 tests pass, matching the apply report exactly, and `repo:check`/`brain:nav` both pass.

## Pre-existing, out-of-scope note (not a finding against this change)

`openspec/config.yaml` carries an unrelated modification (`strict_tdd: false → true` + a testing baseline block), present in the worktree per apply-progress's own note as "ALREADY modified before this apply batch started... not part of issue-456 slice A scope." Not evaluated as part of this verification; flagged only so it is not mistaken for slice-A scope by a later reader of `git diff`.
