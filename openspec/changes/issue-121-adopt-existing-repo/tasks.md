# Tasks: brain:adopt S1 — Read-Only Inventory + Classification

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 750–850 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 → PR 2 → PR 3 |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Fixture + resolve-logical-name + classify-divergence (code + tests + tuning) | PR 1 | base: main; ~380 lines |
| 2 | render-report + build-plan integration (code + tests) | PR 2 | base: PR 1 branch; ~280 lines |
| 3 | CLI wrapper + package.json + guard test | PR 3 | base: PR 2 branch; ~130 lines |

---

## Schema Note — Spec is Canonical

Design-to-spec corrections that ALL code must implement:

- Per-file field names: `sourcePath` (not `path`), `divergenceKind` (not `divergence`), `classification: "generic" | "project"` (not `"project-owned"`)
- Summary field: `project` (not `projectOwned`)
- `proposedAction` value: `"place-under-project"` (not `"place-under-brain-project"`)
- `divergenceKind` in plan.json has NO `flag-for-review` value; the classifier's internal `"flag-for-review"` signal maps to `divergenceKind: "drift"` + `proposedAction: "flag-review"` in the final plan record
- `languageFlag` is a required per-file field: `true` iff `divergenceKind === "translation"`

---

## Phase 1: Test Fixture

- [x] 1.1 Create `__fixtures__/catastro-flat/brain/methodology/intro.md` — Spanish translation of an upstream methodology intro; include ≥6 ES markers (diacritics + ES stopwords) and mirror upstream heading structure to trigger the `translation` scenario (spec: Logical-Name Classification § catastro fixture).
- [x] 1.2 Create `__fixtures__/catastro-flat/docs/onboarding/guide.md` — project doc absent from `managed[]`; triggers `absent-upstream` / `keep-as-project` scenario (spec: File absent from manifest).
- [x] 1.3 Create `__fixtures__/catastro-flat/scripts/setup.sh` — root-level script; triggers flat `scripts/` → `brain/scripts/` path-mapping scenario.

## Phase 2: resolve-logical-name (Pure + Unit Test) [parallel-capable with Phases 3–4]

- [x] 2.1 Create `brain/scripts/lib/adopt/resolve-logical-name.mjs` — POSIX normalization + five mapping rules: flat `brain/<seg>/` (seg ∉ core|project|scripts) → `brain/core/<seg>/`; root `scripts/` → `brain/scripts/`; `brain/project/**` → stays project; `brain/core/**` → as-is; anything else → as-is; returns `{ logicalName, classification, matchedGlob }`; `classification` values `"generic" | "project"`; imports only `node:path` + installer pure helpers (`globToRegExp`, `matchesAny`); no `node:fs`.
- [x] 2.2 Create `brain/scripts/lib/adopt/resolve-logical-name.test.mjs` — `node --test` units covering all five mapping rules and both spec scenarios: flat brain/methodology → `brain/core/methodology` (generic), root scripts → brain/scripts (generic), brain/project → project, brain/core → as-is, no-manifest file → project.

## Phase 3: classify-divergence (Pure + Unit Test) [parallel-capable with Phases 2, 4]

- [x] 3.1 Create `brain/scripts/lib/adopt/classify-divergence.mjs` — marker-ratio heuristic; returns internal `{ divergenceKind: "identical"|"translation"|"drift"|"flag-for-review", languageSignal, reason }`; `languageSignal: { es, en, verdict: "es"|"en"|"mixed" } | null`; conservative default `"flag-for-review"`; no `node:fs` import.
- [x] 3.2 Create `brain/scripts/lib/adopt/classify-divergence.test.mjs` — `node --test` units: identical bytes→`"identical"`, ES-dominant→`"translation"`, EN-diff→`"drift"`, ambiguous/short→`"flag-for-review"`; assert `languageSignal.verdict` shape.
- [x] 3.3 **Tuning (open question #1)**: MIN_HITS=3 pinned; ES_STOPWORDS (30 tokens) and EN_STOPWORDS (26 tokens) arrays finalized; catastro intro.md yields es≥39, en≈0 → translation ✓; EN-only diff yields en>0, es=0 → drift ✓; block comment in classify-divergence.mjs documents chosen values and rationale.

## Phase 4: render-report (Pure + Unit Test) [parallel-capable with Phases 2–3]

- [ ] 4.1 Create `brain/scripts/lib/adopt/render-report.mjs` — pure MD renderer accepting a plan object; required sections: summary table, Adopted Translations (`languageFlag: true` files), Flag for Review (`proposedAction: "flag-review"`), Project Files; no `node:fs` import.
- [ ] 4.2 Create `brain/scripts/lib/adopt/render-report.test.mjs` — `node --test`: assert all four sections present; translations section contains intro.md path; flag-review section non-empty when drift files present; project section contains guide.md path.

## Phase 5: build-plan Integration [sequential after Phases 1–4]

- [ ] 5.1 Create `brain/scripts/lib/adopt/build-plan.mjs` — assemble per-file records via injected `readConsumer(path)` + `readUpstream(logicalName)` readers; pipeline: `resolveLogicalName` → `classifyDivergence` → map to canonical spec schema; internal `"flag-for-review"` → `divergenceKind: "drift"` + `proposedAction: "flag-review"`; `languageFlag = divergenceKind === "translation"`; `proposedAction` matrix: generic identical→`adopt-upstream`, generic divergent→`adopt-upstream`, generic flagged→`flag-review`, project file (no-brain)→`place-under-project`, project file (flat-brain)→`keep-as-project`; summary uses field `project` (not `projectOwned`); envelope: `schemaVersion: "1"`, `tool: "brain:adopt"`, `generatedAt` ISO, `target`, `manifestSource`; no `node:fs` import.
- [ ] 5.2 Create `brain/scripts/lib/adopt/build-plan.test.mjs` — integration test with stub readers over `__fixtures__/catastro-flat/`; assert: `summary.generic === 1`, `summary.project === 2`, `summary.translation === 1`; intro.md `proposedAction: "adopt-upstream"`, `divergenceKind: "translation"`, `languageFlag: true`; guide.md `proposedAction: "keep-as-project"`, `classification: "project"`; `schemaVersion: "1"`, `tool: "brain:adopt"`.

## Phase 6: CLI + Output [sequential after Phase 5]

- [ ] 6.1 Create `brain/scripts/adopt.mjs` — thin CLI (I/O edge): `listFiles(root)` → `buildPlan(...)` → `renderReport(plan)` → `mkdir -p outDir` → write `outDir/plan.json` + `outDir/report.md`; parse `--out <dir>` (default `.brain-adopt/`); resolve upstream root: prefer `node_modules/brain/`, fall back to repo root when `package.json.name === "brain"` (self-host); no writes outside `outDir`.
- [ ] 6.2 **Finalize default out-dir behavior (open question #2)**: decide whether `report.md` content is also printed to stdout when `--out` is omitted; document decision in `--help` text and a code comment in `adopt.mjs`; add a CLI smoke test (fixture → assert both files written to default `.brain-adopt/`).

## Phase 7: Wiring + Guard [Phase 7.1 anytime; 7.2 after all lib files exist]

- [ ] 7.1 Modify `package.json` — add `"brain:adopt": "node ./brain/scripts/adopt.mjs"` to `scripts` (consistent with existing `brain:*` verb pattern).
- [x] 7.2 Create `brain/scripts/lib/adopt/read-only.guard.test.mjs` — `node --test` guard: for each `*.mjs` in `brain/scripts/lib/adopt/`, read source text and assert it matches neither `/import[^'"]*['"]node:fs['"]/` nor `/import[^'"]*['"]node:child_process['"]/`; test fails on any new lib file that adds a prohibited import.

---

## Parallelism Map

```
Phase 1 (fixture)
  └─► Phase 2, 3, 4 [parallel — pure, no cross-deps]
         └─► Phase 5 (build-plan integration) [requires 1+2+3+4]
               └─► Phase 6 (CLI)
                     └─► Phase 7.2 (guard)
Phase 7.1 (package.json) — independent, any time
```

## Spec Requirements Coverage

| Requirement | Tasks |
|-------------|-------|
| Logical-Name Classification | 2.1, 2.2, 5.1, 5.2 |
| Language-Aware Divergence Classification | 3.1, 3.2, 3.3, 5.1, 5.2 |
| No-Brain Repo Inventory | 2.1, 5.1 |
| JSON Plan Schema (canonical) | 5.1, 5.2 |
| Output Location + `--out` flag | 6.1, 6.2 |
| Read-Only Contract | 2.1, 3.1, 4.1, 5.1, 7.2 |
| Open Question: MIN_HITS + stopwords | 3.3 |
| Open Question: default out-dir stdout | 6.2 |
