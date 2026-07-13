# Tasks — The Harness Port Contract, Written Down (slice B0, #250)

> **PLAN-DEVIATION (post-review doctrine fix — CP-B0 re-emitted):** `decision-gate` (rung 1) caught a
> promotion-doctrine violation the review layers missed — `brain/core/methodology/sdd-layout.md` + HOME/template
> nav edits were in an agent PR. Doc-zone `brain/core/**` + HOME promote only via a HUMAN co-promotion MR
> (#216 pattern), never an agent slice. FIX: `sdd-layout.md` now ships as a DRAFT at
> `openspec/changes/issue-250-b0/brain-drafts/sdd-layout.md` (beside the ADR); HOME/template edits reverted;
> the human co-promotion MR is an explicit B1 deliverable. So task 4.1 below reads "brain/core/…" but the file
> actually landed in `brain-drafts/` — corrected, not re-run.

> `sdd-layout.mjs` accessor + drift-guard (A1+A2) + `plain.mjs` backend + `sdd-layout.md` + ADR-0019 draft.
> B0 does NOT touch the 6 measured call sites (B1). Strict TDD (RED → GREEN) for every code task. Rehearsal
> tests hardening (owner ruling #587): the accessor's tests are written AS the 6 measured sites will call
> them — each test case cites its site by file:line. Docs English (ADR-0009).
> Acceptance = CP-B0 (stop-and-declare the full package for the orchestrator).

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated counted lines | ~270–340 (`sdd-layout.mjs` ~130–150 + `plain.mjs` ~50–70 + `sdd-layout.md` ~90–120; tests + ADR draft + openspec/changes/** are budget-free per `governance.ignoreList`) |
| Budget ceiling | 400 |
| 400-line budget risk | TIGHT but LOW-to-MEDIUM — the doc is the swing factor; mitigation is pre-decided (cap `sdd-layout.md` ≤~110 lines; if running total crosses ~380, move narrative prose out of the doc and into the ADR draft, which is free) |
| Decision needed before apply | No — mitigation path already pinned in design §8 |
| Chained PRs recommended | No |
| Delivery | Single PR into `feature/v2.0.0`, `Part of #250`, no `size:exception` expected |

Verdict: proceed as a single PR. Confirmed against design §8's estimate; no refinement needed unless the
running counted total (tracked live during apply per task 6.2) crosses ~380, at which point apply must move
prose out of `sdd-layout.md` rather than request `size:exception`.

## Phase 1: `sdd-layout.mjs` — the accessor, built helper-by-helper with rehearsal tests (RED → GREEN)
> REQ-B0-2, REQ-B0-3. Rehearsal-tests hardening (owner ruling #587): each helper's test cites the exact
> measured site invocation it rehearses. If a helper cannot express a site's need, STOP — that is a B0
> finding, not a B1 patch.

- [x] 1.1 Test (RED): `sdd-layout.test.mjs` imports `REQUIRED_ARTIFACTS`, `OPERATIONAL_ARTIFACTS`,
      `CHANGES_ROOT`, `LEGACY_GRANDFATHERED` from `./sdd-layout.mjs` — fails because the module does not
      exist yet. Confirm the failure is "module not found", not a syntax/typo error.
- [x] 1.2 GREEN: create `brain/scripts/lib/sdd-layout.mjs` with the four frozen constants exactly as
      specified in design §2 (`REQUIRED_ARTIFACTS = ['proposal.md','spec.md','design.md','tasks.md']`,
      `OPERATIONAL_ARTIFACTS = ['resume.md']`, `CHANGES_ROOT = 'openspec/changes'`, `LEGACY_GRANDFATHERED`
      = the sealed 12) and the sealed-list lock comment verbatim in substance ("Grandfather = past only...
      a NEW change dir must never appear here"). Test: each const is `Object.isFrozen`; `LEGACY_GRANDFATHERED`
      has exactly 12 entries.
- [x] 1.3 Test (RED) + GREEN: `changeDir(changeId)` — rehearses **new-change.mjs:48-110**
      (`join(repoRoot,'openspec','changes',changeId)`), **engram.mjs:804-805 & 925-926**
      (`join(root,'openspec','changes',resolvedFeature)`), **feature-resolution.mjs:37-45**
      (`join(root,'openspec','changes')` prefix), and **phase-order-check.mjs**'s `CHANGE_DIR_PREFIX =
      'openspec/changes/'`. Assert `changeDir('issue-250-b0') === 'openspec/changes/issue-250-b0'`
      (POSIX-relative, matches every site's join shape once `CHANGES_ROOT` is the shared prefix).
- [x] 1.4 Test (RED) + GREEN: `artifactPaths(changeId)` — rehearses **new-change.mjs:48-110**'s four
      scaffolded file targets. Assert it returns `{ proposal, spec, design, tasks }`, each a path under
      `changeDir(changeId)`, matching the four files the scaffold is meant to write (spec.md included —
      note in the test comment that today's `new-change.mjs` does not actually write `spec.md`; that gap
      is `#251`'s scaffold micro-fix + B1's wiring, not fixed by this accessor).
- [x] 1.5 Test (RED) + GREEN: `archivePath(iid)` — direct unit test (no rehearsal site; E1/`archive` is
      unbuilt). Assert `archivePath('250') === 'openspec/changes/archive/250'`, matching the measured value
      from design §5 (§E1 line 361 of `docs/inbox/PLAN-adapters-v3.md`).
- [x] 1.6 Test (RED) + GREEN: `parseChangeId(name)` — rehearses **session-start.mjs:38-69**'s
      `deriveChangeFromBranch` delimiter-anchored token match (a dir name matches a token only when it IS
      the token or starts with `<token>-`, e.g. `'issue-138-session-start'` must NOT match token
      `'issue-13'`) and **new-change.mjs:48**'s `changeId` construction shape. Assert
      `parseChangeId('issue-250-b0')` → `{ iid: '250', slug: 'b0' }`; `parseChangeId('issue-250')` →
      `{ iid: '250', slug: null }` (a violation for NEW dirs per REQ-B0-1's mandatory-slug rule, but a
      valid parse); `parseChangeId('not-a-change-dir')` → `null`.
- [x] 1.7 Test (RED) + GREEN: `isGrandfathered(changeId)` — rehearses **phase-order-check.mjs**'s
      `BASELINE_EXEMPT_DIRS` (assert all 3 of `installer-versionado`, `vcs-adapter`, `cli-i18n` are a
      SUBSET of `LEGACY_GRANDFATHERED` — proves B1's planned `BASELINE_EXEMPT_DIRS` →
      `LEGACY_GRANDFATHERED` swap is behavior-preserving) and **check-refs.mjs:96-112**'s S-1 per-dir loop
      (a legacy dir must be recognized so B1's replacement loop can skip it). Assert `isGrandfathered(x)`
      is `true` for all 12 sealed names and `false` for an arbitrary new `issue-<N>-<slug>`.
- [x] 1.8 Test (RED) + GREEN: `hasSpec(changeId, { exists, listDir })` — rehearses
      **check-refs.mjs:96-112**'s required-artifact-per-dir check, extended to the flat-OR-nested tolerance
      pin (D1/Pin 1). Assert `true` for a fake fs with flat `spec.md`; `true` for a fake fs with
      `specs/<capability>/spec.md` nested and no flat file (the `governance`/`auto-adrs`-style legacy
      shape); `false` when neither exists. Injectable `{ exists, listDir }` — no real fs in this test.
- [x] 1.9 Test (RED) + GREEN: `missingRequiredArtifacts(changeId, { exists, listDir })` — rehearses
      **check-refs.mjs:96-112** end-to-end (the S-1 loop this helper is meant to replace in B1). Assert: a
      NEW dir (not grandfathered) missing `spec.md` and `design.md` returns
      `['spec.md','design.md']`; a grandfathered dir missing everything returns `[]` (short-circuit — "the
      past is recorded, not edited"); the spec slot delegates to `hasSpec` so a grandfathered dir with only
      a nested spec still counts as present for a hypothetical non-grandfathered check of the same shape.
- [x] 1.10 Also rehearse the disambiguation-adjacent shape used by **feature-resolution.mjs:79-84**
      (`existsSync(join(changesDir, candidate, 'resume.md'))`) and **engram.mjs:805/926**'s `resume.md`
      path build: assert `OPERATIONAL_ARTIFACTS.includes('resume.md')` and that `resume.md` is excluded
      from `REQUIRED_ARTIFACTS` and never consulted by `missingRequiredArtifacts`.
- [x] 1.11 If any helper above cannot cleanly express its cited site's need (RED that can't turn GREEN
      without reshaping the site itself, which is out of scope for B0) — STOP, do not patch around it, and
      report the exact gap as a B0 finding for the orchestrator (owner ruling #587, item 2).
      **STOP-CONDITION DID NOT FIRE.** Every helper expressed its cited site's call shape cleanly.

## Phase 2: the drift-guard — A1 (single source) + A2 (sealed 12), a TEST not a lint rule (RED → GREEN)
> REQ-B0-2 (single source), REQ-B0-3 (sealed allowlist). A3 (consumers-reference-the-module) is STAGED TO
> B1 — do NOT implement it here (design §3).

- [x] 2.1 Test (RED) — **A1 false-positive fixture**: seed an injectable-root fixture (temp dir or fake
      file-content map, NOT the real repo tree) containing a rival array literal with `'proposal.md'`
      alongside `'tasks.md'` in a file other than `sdd-layout.mjs`. Assert the scan reports that file by
      name. This proves the regex CAN catch a real rival before hardening it against false positives.
- [x] 2.2 Test (RED) — **A1 precision guard** (CP concern per #587: false positives are the drift-guard's
      death mode): seed fixtures that must NOT trigger a match — a 3-element array like
      `BASELINE_EXEMPT_DIRS` (`installer-versionado`, `vcs-adapter`, `cli-i18n`, no `proposal.md`/
      `tasks.md` tokens), a 2-element subset mentioning only `'proposal.md'` alone, and a multi-line/
      differently-formatted array containing the same 4 strings but not as a co-occurring literal array
      (e.g. scattered across separate `const` declarations). Assert zero matches on all three.
      **PLAN-DEVIATION found during apply:** the naive "co-occurs `'proposal.md'` + `'tasks.md'`" regex
      literally in design §3 is a REAL false-positive trap, not a hypothetical one — `check-refs.mjs:102`'s
      pre-existing S-1 loop `['proposal.md', 'tasks.md']` tripped it. Tightened to "≥3 of the 4 canonical
      filenames co-occur inside one `[...]` literal" (still catches the 2.1 fixture; excludes
      check-refs.mjs's known 2-of-4 partial array, which is exactly what B1 worklist item 1 migrates).
- [x] 2.3 GREEN: implement the A1 scan in `sdd-layout.test.mjs` — walk `brain/scripts/**/*.mjs` excluding
      `sdd-layout.mjs` and `*.test.mjs`, regex-match an array literal containing `'proposal.md'`
      co-occurring with `'tasks.md'`, precision-tuned per 2.2. Run it against the real repo tree as the
      final assertion of this task (real-world true-negative: today's repo has no rival array).
- [x] 2.4 Test (RED) — **A2 sealed-12 lock**: construct a 13th-entry copy (`[...LEGACY_GRANDFATHERED,
      'issue-999-not-real']`) and assert `assert.notDeepEqual` against the hardcoded 12 sorted names —
      i.e. confirm the test's own comparison mechanism actually distinguishes 12 from 13 before trusting it
      against the real export.
- [x] 2.5 GREEN: assert `assert.deepEqual([...LEGACY_GRANDFATHERED].sort(), THE_12_HARDCODED.sort())`
      against the real `sdd-layout.mjs` export. This IS the lock's teeth (REQ-B0-3 scenario 3) — a future
      13th entry, removal, or typo fails here.
- [x] 2.6 Document (comment in the test file, not new code): A3 is deferred to B1 — record the exact
      consolidation targets (`phase-order-check.mjs`'s `BASELINE_EXEMPT_DIRS`, the tripwire's
      `EXEMPT_PATH_RE` where applicable) so B1 has a literal pointer, per design §3's consolidation note.

## Phase 3: `plain.mjs` — a real dispatchable `SDD_HARNESS` backend, n=2 on `init` (RED → GREEN)
> REQ-B0-5. No `cli.mjs` change — the dispatcher is already backend-agnostic (design §4).

- [x] 3.1 Test (RED): `plain.test.mjs` — unit-level, injects a capturing fake `_emit` into
      `init({ _emit })` and asserts all nine `MANUAL_FLOW_STEPS` (sourced verbatim from
      `docs/workflow-guide.md` §B, cross-checked against design §4's numbered list) are emitted in order,
      each prefixed `N. `. Fails because `backends/plain.mjs` does not exist yet.
- [x] 3.2 GREEN: create `brain/scripts/harness/backends/plain.mjs` exporting `async function init({ _emit =
      console.log } = {})` per design §4's exact shape — the header line
      (`'SDD_HARNESS=plain — manual flow (no AI). Run these npm verbs in sequence:'`) plus the 9
      `MANUAL_FLOW_STEPS`. Zero AI provider, zero network call, zero tool beyond the repo's own npm verbs.
- [x] 3.3 Test (RED) + GREEN: end-to-end dispatch — call the real `dispatch('plain', 'init', [])` from
      `harness/cli.mjs` (real `defaultBackendLoader`, no fake) and assert it resolves without throwing,
      proving `resolveHarness` → `defaultBackendLoader('plain')` → `VALID_OPS.includes('init')` →
      `backend.init()` all work with ZERO `cli.mjs` change (REQ-B0-5 scenario 2 — both `gentle-ai` and
      `plain` resolve through the same dispatch path).
- [x] 3.4 Confirm n=2: a short assertion (or test-file comment) that `SDD_HARNESS=gentle-ai` and
      `SDD_HARNESS=plain` are now both real, dispatchable `init` inhabitants — closing the port on n=2
      ahead of B2's real second-harness baptism.

## Phase 4: `sdd-layout.md` — the normative canonical layout doc
> REQ-B0-1. Budget-watched: keep ≤~110 lines (design §8 mitigation).

- [x] 4.1 Write `brain/core/methodology/sdd-layout.md` documenting: the change-dir pattern
      `openspec/changes/issue-<N>-<slug>/` with the slug MANDATORY; the four `REQUIRED_ARTIFACTS` at the
      change-dir root as canonical for NEW changes; the nested `specs/*/spec.md` variant as
      LEGACY-ACCEPTED (readers tolerate it, the scaffold must never produce it — stated alongside the flat
      preference, never as an equal alternative); the checked-task pattern (`- [x]`, case-insensitive); the
      archive destination as a path OWNED by `sdd-layout.mjs` (name the accessor, not the literal value —
      REQ-B0-1 leaves the concrete value to the accessor); and `resume.md` documented as
      OPERATIONAL/EPHEMERAL, explicitly outside `REQUIRED_ARTIFACTS`, in its own subsection.
- [x] 4.2 Cross-check the doc's prose against the two spec scenarios verbatim (flat/nested preference +
      mandatory slug; `resume.md` never in `REQUIRED_ARTIFACTS`) — confirm both scenarios are satisfied by
      a literal reading of the doc, not just implied.
- [x] 4.3 Line-count check: if `sdd-layout.md` is trending past ~110 lines, move narrative/rationale prose
      into the ADR draft (Phase 5, budget-free under `openspec/changes/**`) rather than trim content that
      the spec requires. **71 lines — well under the ~110 cap; no mitigation needed.**

## Phase 5: the ADR-0019 draft (D3, Fork A)
> REQ-B0-4. Location `openspec/changes/issue-250-b0/brain-drafts/adr-draft-harness-port.md` (budget-free —
> `openspec/changes/**` is in `governance.ignoreList`). ADR number VERIFIED (#587 item 3): 0017 = Accepted,
> 0018 = draft, 0019 = free — monotonic, never reused.

- [x] 5.1 Write the ADR draft per design §7's outline: Title/Status (Draft), Context (the #584 measured
      finding — `VALID_OPS=['init']`, single-op dispatcher, harness-neutral downstream), Decision (the
      SIGNED wording verbatim — four surfaces, nothing in the SDD artifact lifecycle, `init` as current
      state not a ceiling), the four surfaces stated as the NORM, Rationale (the Track A pure-evaluator /
      thin-wrapper analogy applied to the executor, cited explicitly), Consequences, Rejected alternatives
      (expand `VALID_OPS` per-backend; treat single-op as a ceiling), Evidence (#584, #585, #587;
      `harness/cli.mjs:52`, `gentle-ai.mjs:74,221`).
- [x] 5.2 Verify against the two spec scenarios (REQ-B0-4): the four surfaces are named as the invariant
      and `init` is NOT presented as a ceiling; the Track A analogy is explicitly cited as the applied
      pattern, not left implicit.

## Phase 6: baseline gate + B1 handoff + CP-B0
- [x] 6.1 `npm test` green (0 failures, including every new `*.test.mjs` from Phases 1–3) ·
      `brain:repo:check` · `brain:nav` · `brain:audit` — no new failure introduced by this slice (spec
      Gate). **1302/1302 green (baseline 1270 + 32 new). `brain:repo:check` clean. `brain:nav` clean
      (required patching `brain/HOME.md` AND `brain/core/templates/HOME.template.md` — the fixture tests
      `home-index-nav-integrity.test.mjs` / `home-scaffold-nav-integrity.test.mjs` copy real `brain/core/**`
      over a freshly-scaffolded HOME.md, so the template needed the new doc's link too, not just the real
      HOME.md). `brain:audit`: same 2 pre-existing `adrPresence` FAILs (04ae992, 8d60661) — unchanged,
      historical.**
- [x] 6.2 Budget check: sum the counted lines actually added in `sdd-layout.mjs` + `plain.mjs` +
      `sdd-layout.md` (tests, ADR draft, and all `openspec/changes/**` files are free). Confirm the total
      lands in the ~270–340 estimate; if it crosses ~380, apply the Phase 4.3 mitigation retroactively
      (move prose out of the doc) rather than request `size:exception`. **Authoritative count via
      `parseDiffNumstat` + the real `ignoreList`: 213 counted lines (`sdd-layout.mjs` 111, `plain.mjs` 29,
      `sdd-layout.md` 71, `brain/HOME.md` +1, `HOME.template.md` +1) — under the 270–340 estimate, well
      under the 400 ceiling. No mitigation needed.**
- [x] 6.3 `memory:share` before push, per house convention. **Ran `npm run memory:share` — exported 229
      observations / 1 session / 16 mutations to a new `.memory/` chunk.**
- [x] 6.4 **STOP at CP-B0** — declare the full package for the orchestrator rather than proceeding into B1:
      the accessor (`sdd-layout.mjs`) + its rehearsal-test suite, the drift-guard (A1+A2), `plain.mjs` +
      its dispatch test, `sdd-layout.md`, the ADR-0019 draft, gate-green confirmation, and the B1 worklist
      below. Do not begin wiring the 6 sites — that is a separate change (B1). **STOPPED — reporting to
      orchestrator, no B1 work started.**
- [x] 6.5 **Fresh-context review remediation (2 MINORs, both test-only, budget unchanged at 213):**
      MINOR 1 — softened the tautological "rehearses phase-order-check.mjs's CHANGE_DIR_PREFIX" test
      comment to honestly state it documents the shared literal (that const is private/unexported; B1's
      consolidation is what actually wires the import). MINOR 2 — hardened A1's `countArtifactTokens` to
      also match backtick-quoted array elements (RED: a backtick rival fixture was NOT caught → GREEN
      after adding the backtick branch; real-repo-tree true-negative re-confirmed), and documented the
      split-bracket evasion as a known, deliberately-unclosed heuristic limit (closing it risks false
      positives, the guard's actual death mode). `npm test` 1303/1303 green; `brain:repo:check` /
      `brain:nav` clean; counted diff re-confirmed at 213 (unchanged, both fixes were test-only).

## B1 worklist (handoff — NOT implemented in B0)
1. Migrate the six measured hard-coding sites onto `sdd-layout.mjs`'s helpers:
   `check-refs.mjs:96-112` → `missingRequiredArtifacts` (+ `isGrandfathered` short-circuit, replacing the
   ad hoc `['proposal.md','tasks.md']` S-1 loop); `session-start.mjs:38-69` → `parseChangeId` +
   `CHANGES_ROOT`; `phase-order-check.mjs` → `isGrandfathered`/`LEGACY_GRANDFATHERED` (see item 2);
   `new-change.mjs:48-110` → `changeDir` + `artifactPaths` (and fix the scaffold to actually write
   `spec.md` — folds in `#251`); `engram.mjs:804-805 & 925-926` → `changeDir` + `OPERATIONAL_ARTIFACTS`;
   `feature-resolution.mjs:37-81` → `changeDir`/`CHANGES_ROOT` + `OPERATIONAL_ARTIFACTS` for the
   `resume.md` disambiguation check.
2. Replace `phase-order-check.mjs`'s `BASELINE_EXEMPT_DIRS` (3 dirs, a strict subset of the sealed 12) with
   `import { LEGACY_GRANDFATHERED } from '../lib/sdd-layout.mjs'` — no behavior change (design §3
   consolidation note); consolidate the tripwire's `EXEMPT_PATH_RE` where applicable.
2a. Consolidate any Track-B-adjacent scattered exempt-list not already covered by item 2, if discovered
    during migration.
3. Add drift-guard A3 (consumers-reference-the-module) — grep-assert every one of the six sites imports
   from `sdd-layout.mjs` rather than re-declaring path logic inline (spec REQ-B0-2 scenario 2, deferred
   from B0).
4. Fix `new-change.mjs`'s scaffold: (a) write `spec.md` (currently only proposal/design/tasks are
   generated — the flat spec-artifact gap `#251` folds into here), (b) mandate the slug (REQ-B0-1's
   `issue-<N>-<slug>` pattern is not currently enforced at scaffold time).
5. Decide `promotedSpecPath` (design §5 scope boundary) when E1 (`brain:change:archive`) is actually built
   — whether the accessor also owns `openspec/specs/<capability>/spec.md`. Not decided in B0; E1 must not
   invent it independently.
6. Promote the ADR-0019 draft to `brain/project/decisions/adr-0019-harness-port.md` at B1/archive time.

## Open items where spec/design left a choice for apply time
- **A1 fixture mechanism** (task 2.1–2.3): design does not pin whether the false-positive/true-positive
  scan fixtures are an injectable in-memory content map or real temp-dir files — left to apply-time
  judgment; either satisfies "precision over coverage" as long as the real-repo-tree pass is the final
  assertion.
- **Budget swing** (task 4.3 / 6.2): the design pre-decides the mitigation (move prose to the ADR draft)
  but the trigger threshold (~380) is a judgment call during apply, not a hard gate.
- **`promotedSpecPath`** (B1 worklist item 5): explicitly NOT a B0 decision — flagged so E1 does not invent
  a second source when it lands.
- **A3's exact grep shape** (B1 worklist item 3): design names the two known scattered exempt-lists but
  does not pin the grep pattern itself — B1 to decide, informed by whatever import shape items 1–2 land in.

## Out of scope
- B1 (the 6-site wiring, `BASELINE_EXEMPT_DIRS` → `LEGACY_GRANDFATHERED` swap, drift-guard A3) — see B1
  worklist above.
- B2 (the Antigravity adapter, the real second-AI-harness baptism, `#247` candidate slice).
- B3 (deferred — no speculative third adapter).
- The `spec.md` scaffold micro-fix (`#251`) itself — B0 depends on it conceptually (folds the flat
  `spec.md` requirement into `REQUIRED_ARTIFACTS`) but does not re-implement `new-change.mjs`.
- The concrete `promotedSpecPath` decision (E1, not yet built).
