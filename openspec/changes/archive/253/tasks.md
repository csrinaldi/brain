---
status: draft
issue: 253
---

# Tasks — Wire the Gates Onto the Contract (slice B1)

> Reads: [spec.md](spec.md) (REQ-B1-1..6) · [design.md](design.md) (per-site wiring table §2, golden harness
> §2.2, A3 §4, slug §5, co-promotion branch §6, budget §7) · [[sdd/issue-253-b1/constraints]] (#595 — all pins
> locked: 3 scope + F1-F3 + the 2 final: check-refs→4-artifact enforcement, slug=ERROR).
> Frozen corpus count: **measure at apply time, record actual N — do NOT hardcode 27 or 28.** Design's §7
> reconciliation note (pin says 27, pre-wiring HEAD showed 28) is resolved by capture, not by choosing a number
> now.

## Review Workload Forecast

| Item | Value |
|---|---|
| Counted source lines (design §7, non-test/non-openspec) | ~43 (check-refs ~10, session-start ~6, phase-order-check ~5, new-change ~12, engram ~6, feature-resolution ~4) |
| Budget-free additions | golden fixture + capture test, A3 test, tripwire consolidation (if included), B0 test-file import edits |
| Changed-lines budget | ≤400 — NOT tight, no `size:exception` |
| PR shape | **Single PR** into `feature/v2.0.0`, part of #253 |
| Chained PRs needed? | **No** |
| 400-line budget risk | **Low** |
| Decision needed before apply? | **No** (all open items resolved below or explicitly deferred to owner call at apply time) |
| Out-of-band artifact | A SEPARATE co-promotion branch off `feature/v2.0.0` (Deliverable B) — pushed, NOT opened, NOT counted against this PR's budget, sequenced as its own phase (Phase 7) |

**Verdict: confirmed.** Single PR, no chain, no exception. The co-promotion branch is prepared and pushed by
the same apply run but is a distinct git artifact the human opens/merges separately — it never becomes a second
PR authored against this change's own branch.

---

## Phase 0 — Baseline (before touching anything)

- [x] 0.1 Run `npm test`, `brain:repo:check`, `brain:nav`, `brain:change:verify` on `feat/issue-253-b1` at the
      tip of `feature/v2.0.0` (post-B0) and confirm all green. This is the pre-wiring gate baseline every later
      phase is diffed against. — *Gate (spec §Gate)*
- [x] 0.2 Enumerate `openspec/changes/*` (excluding `issue-253-b1` itself) on the pre-wiring tree and record the
      **actual count N**. This is the number that goes into the fixture's `_frozenCount` and header in Phase 1 —
      resolves design §7 open item 1 (27 vs 28 reconciliation). — *REQ-B1-2*

## Phase 1 — F1: capture the BEFORE golden fixture (RED first, committed before any site is touched)

- [x] 1.1 Write `brain/scripts/lib/sdd-layout-golden.test.mjs` (test-scoped, budget-free — resolves design §7
      open item 3: capture-harness stays test-scoped, not a shared module) with a capture routine that walks
      the REAL `openspec/changes/*` on the pre-wiring tree (excluding `issue-253-b1`), and for each of the N
      frozen keys records: `check-refs` missing-artifacts list (from the CURRENT, pre-wiring 2-of-4 logic —
      the fixture captures what the code does *today*, before REQ-B1-1's 4-artifact enforcement lands),
      `phase-order-check` per-dir `{level, findings}`, `feature-resolution` resume signal, plus a sibling
      `sessionStart` block keyed by representative branch tokens. — *REQ-B1-2*
- [x] 1.2 Generate and commit `brain/scripts/lib/sdd-layout-golden.fixture.json` from that capture run. Header
      MUST read, verbatim in substance: *"point-in-time migration proof over the frozen N; new dirs out of
      scope by design"* (N = the measured count from 0.2/1.1 — never a hardcoded 27). Include
      `_capturedAtBase` (pre-wiring HEAD sha) and `_frozenCount: N`. Sorted keys. — *REQ-B1-2*
- [x] 1.3 Add the guard assertion `assert.ok(!('issue-253-b1' in fixture.changes))` inside the test. —
      *REQ-B1-2, scenario "adding a 28th dir does not break the golden test"*
- [x] 1.4 Commit the fixture + capture test as their own commit, BEFORE any site-migration commit. Verify via
      `git log` that this commit predates every site-wiring commit (this is the audit trail REQ-B1-2's third
      scenario requires — "captured and committed from the pre-migration tree ... never regenerated from the
      post-wiring code"). Confirm this test is GREEN against the pre-wiring code right now (TDD "golden
      first," not RED at this step — the RED phase comes per-site in Phase 2). — *REQ-B1-2*

## Phase 2 — REQ-B1-1: wire the six sites (RED → GREEN per site, against the Phase 1 golden)

Each sub-task: (a) write/confirm the B0-rehearsal-shaped unit test for that site's call shape is RED against
the current inline logic once the golden is re-run expecting the new import (or: import added but not yet
consumed → compile/lint RED), (b) swap the inline literal for the accessor import, (c) re-run the golden —
`deepEqual` against the committed Phase 1 fixture must show ZERO diff → GREEN.

- [x] 2.1 **`check-refs.mjs:96-112`** — replace the inline `join(ROOT,'openspec/changes')` and the 2-of-4 loop
      (`['proposal.md','tasks.md']`) with `import { CHANGES_ROOT, missingRequiredArtifacts, isGrandfathered }
      from './lib/sdd-layout.mjs'`. This is the 4-artifact enforcement pin (#595): the check now runs
      `missingRequiredArtifacts` (4-of-4), not the old 2-of-4. Update the violation `reason` message to name
      **all** missing artifacts (not just the one that failed the old loop) and point to
      `brain/core/methodology/sdd-layout.md` — the never-cryptic message pin (#595 pin 1b). Commit message /
      task description for this site MUST read "behavior-preserving over the frozen corpus + B0-contract
      enforcement going forward" — **never "pure wiring."** Verify via golden (Phase 1 fixture, captured under
      the OLD 2-of-4 logic) that every frozen dir still resolves to zero violations post-swap (design §2.1:
      all 16 non-grandfathered frozen dirs already carry all 4 artifacts). — *REQ-B1-1, REQ-B1-2 scenario
      "byte-identical pre/post"; #595 pin 1*
- [x] 2.2 **`session-start.mjs:38-69` + caller at `:293`** — replace the caller's
      `join(cwd, 'openspec', 'changes')` literal with `CHANGES_ROOT`, and replace the hand-rolled
      delimiter-anchored dir match inside `deriveChangeFromBranch` with `parseChangeId(name)?.iid === iid`.
      Import `{ CHANGES_ROOT, parseChangeId } from './lib/sdd-layout.mjs'`. Keep the `/issue-(\d+)/i` branch
      token extraction as-is (parses a branch, not a dir shape). Prove equivalence against the delimiter-
      anchored match on the `issue-138-session-start` case (iid `138`, never substring `13` per B0 rehearsal
      1.6). Golden's `sessionStart` block must `deepEqual`. — *REQ-B1-1*
- [x] 2.3 **`phase-order-check.mjs`** — replace `CHANGE_DIR_PREFIX = 'openspec/changes/'` (L20) usage with
      `` `${CHANGES_ROOT}/` ``. This is sequenced together with Phase 3 (the `BASELINE_EXEMPT_DIRS` swap) since
      both touch the same file and same import statement — see Phase 3 for the exempt-list half. Import
      `{ CHANGES_ROOT } from '../lib/sdd-layout.mjs'` here; `LEGACY_GRANDFATHERED` import added in Phase 3. —
      *REQ-B1-1*
- [x] 2.4 **`new-change.mjs:48-110`** — replace `join(repoRoot,'openspec','changes',id)` and the four
      `writeFileSync` targets with `changeDir` / `artifactPaths` from `import { changeDir, artifactPaths }
      from './lib/sdd-layout.mjs'`. Rename the local `changeDir` variable (it currently shadows the imported
      name — design §2 item 4) to e.g. `targetDir`. Sequenced together with Phase 5 (slug mandate) since both
      touch the `changeId` construction line — see Phase 5. Not covered by the golden (scaffolder, not a
      corpus gate); covered by a dedicated unit test proving the four write targets equal
      `join(repoRoot, artifactPaths(id).*)` (B0 rehearsal 1.4). — *REQ-B1-1*
- [x] 2.5 **`engram.mjs:804-805 & 925-926`** — replace both `join(root,'openspec','changes',resolvedFeature)` +
      `'resume.md'` pairs with `changeDir(resolvedFeature)` + `OPERATIONAL_ARTIFACTS[0]`, importing
      `{ changeDir, OPERATIONAL_ARTIFACTS } from '../../lib/sdd-layout.mjs'`. Rename the local `changeDir`
      variable at both sites (shadows the import). Behavior-identical by construction (same absolute path
      result). Covered by A3 (Phase 4) + existing engram tests — not the golden (resume I/O, not a corpus
      verdict). — *REQ-B1-1*
- [x] 2.6 **`feature-resolution.mjs:37-81`** — replace `join(root,'openspec','changes')` (L37) and the
      `'resume.md'` literal (L81) with `CHANGES_ROOT` + `OPERATIONAL_ARTIFACTS[0]`, importing
      `{ CHANGES_ROOT, OPERATIONAL_ARTIFACTS } from '../../lib/sdd-layout.mjs'`. The `'archive'` reserved-name
      literal stays inline (accessor doesn't own it — design §7 open item 5, explicitly out of scope). Golden's
      `featureResolution.hasResume` per key must `deepEqual`. — *REQ-B1-1*
- [x] 2.7 Re-run the full Phase 1 golden fixture test after all six sites are wired: `deepEqual` against the
      committed BEFORE values for every frozen key, zero diff. This is the authoritative REQ-B1-1 proof (design
      §2.1: "the golden is the authoritative proof, not the argument"). — *REQ-B1-1, REQ-B1-2*

## Phase 3 — REQ-B1-3: `BASELINE_EXEMPT_DIRS` → `LEGACY_GRANDFATHERED` swap

- [x] 3.1 In `phase-order-check.mjs`, delete `export const BASELINE_EXEMPT_DIRS = [3 dirs]` (L185) and change
      `applyBaselineExemption(evaluation, baselineDirs = BASELINE_EXEMPT_DIRS)` (L197) to default to
      `LEGACY_GRANDFATHERED`, imported alongside `CHANGES_ROOT` from Phase 2.3's import statement (same file,
      same import line — one combined `import { CHANGES_ROOT, LEGACY_GRANDFATHERED } from '../lib/sdd-layout.mjs'`).
- [x] 3.2 Update the B0 test file that currently imports `BASELINE_EXEMPT_DIRS` (test line 31) to import
      `LEGACY_GRANDFATHERED` instead — test-file edit, budget-free.
- [x] 3.3 **Owner decision needed at this task, not deferred silently:** consolidate the tripwire
      `EXEMPT_PATH_RE = /^openspec\/changes\//` (`plainfiles-actorkind-doc-tripwire.test.mjs:47`) to
      `new RegExp('^' + CHANGES_ROOT + '/')`. Design §7 open item 4 marks this "include now (budget-free) or
      defer — owner call." Default to **include now** (it is budget-free and removes a second independent
      literal of the same concept, closing a drift seam A3 does not cover since it's a test file) unless the
      owner flags otherwise at apply time. — *REQ-B1-3*
- [x] 3.4 Verify: the set of dirs `phase-order-check` treats as exempt is byte-identical before/after (golden's
      `phaseOrder.level` per key, re-checked from Phase 2.7, plus design §2.1's proof that the 9
      newly-included grandfathered dirs all carry nested specs and never had a `fail` to downgrade). Confirm
      `BASELINE_EXEMPT_DIRS` no longer exists as a declaration anywhere in the file. — *REQ-B1-3*

## Phase 4 — REQ-B1-4: drift-guard A3 (write the false-positive traps FIRST, then the real assertion)

- [x] 4.1 Write the curated site → expected-specifier map as data (six entries, design §4 table), with the
      specifier computed programmatically via `path.relative(dirname(site), layoutAbs)` (POSIX-normalized,
      leading `./` ensured) — never a hand-typed literal, so it self-corrects if a file moves.
- [x] 4.2 Write the false-positive/false-negative trap tests FIRST (RED against a naive loose-substring
      matcher, to prove the traps actually catch the naive approach): (a) loose substring `sdd-layout`
      matching a doc-comment mention, (b) the `.test.mjs` filename satisfying a substring match, (c) a shared
      `../lib/` literal false-negatiing the 3 `./lib/` sites and the 2 `../../lib/` sites, (d) a bare
      side-effect `import '…/sdd-layout.mjs'` (no braces) satisfying the guard. — *REQ-B1-4 scenario "legitimate
      import passes without a substring false-positive"*
- [x] 4.3 Implement the real A3 assertion: per site, match
      `/import\s*\{[^}]*\}\s*from\s*['"]<ESCAPED_SPECIFIER>['"]/` against the exact per-site expected specifier
      from 4.1. Scans exactly the 6 files (5 physical — engram's two call sites share one import). NOT a
      recursive tree scan. Confirm all 4.2 traps now pass/fail correctly (GREEN). — *REQ-B1-4*
- [x] 4.4 Add the negative-case test: a hypothetical site re-declaring a rival literal (own artifact-name array,
      own `openspec/changes` path literal, own grandfather list) without importing the accessor fails A3,
      naming the offending site file. — *REQ-B1-4 scenario "a site re-declaring a rival literal fails A3"*
- [x] 4.5 Run A3 against all six sites as wired in Phases 2–3. All six must pass on their real per-site
      specifier (`./lib/`, `../lib/`, or `../../lib/` per design §4 table — never a shared literal).

## Phase 5 — REQ-B1-5: `new-change.mjs` slug mandate

- [x] 5.1 Replace `changeId = title ? \`issue-${issue}-${slugify(title)}\` : \`issue-${issue}\`` with: when
      `title` (or equivalent slug source) is absent, call `fail(...)` (symmetric with the existing `--issue`
      missing check at L42-46) with an actionable message asking for a slug. **Never** a derived placeholder
      (e.g. `issue-<N>-change`) — locked by #595 pin 2: "a placeholder would be a silent lie, same sin as the
      #216 hand-edit errata." This resolves design §7 open item 2 (confirmed, not reopened).
- [x] 5.2 Unit test: invocation with no `--title` → throws/`fail`s with a clear message, no dir created. —
      *REQ-B1-5 scenario "new-change without a slug is rejected"*
- [x] 5.3 Unit test: invocation with `--title` → produces `issue-<N>-<slug>` exactly as before (unchanged
      path). — *REQ-B1-5 scenario "new-change with a title produces issue-<N>-<slug> as before"*
- [x] 5.4 Confirm this task is sequenced with Phase 2.4 (both touch the `changeId` construction line in the
      same file) — land as one coherent edit to `new-change.mjs`, not two separate diffs to the same lines.

## Phase 6 — Synthetic edge-case fixtures (on top of, never instead of, the frozen corpus)

- [x] 6.1 Add synthetic fixtures beyond the frozen-N corpus: a dir with no artifacts (all 4 missing), a dir in
      `LEGACY_GRANDFATHERED` (verify short-circuit to `[]` still fires post-wiring), a dir with a nested
      `specs/*/spec.md` (verify `hasSpec` still recognizes it via the flat-OR-nested tolerance). — *REQ-B1-2
      "Synthetic edge-case fixtures ... MUST be added on top of, never instead of, the frozen corpus proof"*
- [x] 6.2 Add a synthetic fixture for the NEW 4-artifact check-refs behavior (2.1): a dir missing exactly one
      of the 4 (e.g. `design.md` present, `tasks.md` absent) to prove the check now catches what the old 2-of-4
      loop would have missed — this is the "latent-stricter for future new dirs" proof #595 calls for, and it
      cannot come from the frozen corpus (which by design has zero such dirs today).

## Phase 7 — Gate baseline (post-wiring)

- [x] 7.1 Run `npm test`, `brain:repo:check`, `brain:nav`, `brain:change:verify` — all green, no new
      `brain:audit` failure. — *spec §Gate*
- [x] 7.2 Confirm changed lines ≤400, no `size:exception` requested or needed (Review Workload Forecast
      verdict above). Confirm docs are English (ADR-0009).
- [x] 7.3 Confirm TDD sequencing is honored end-to-end via `git log`: fixture commit (Phase 1) predates every
      site-migration commit (Phase 2), A3 (Phase 4) lands only after all six sites are wired.

## Phase 8 — Deliverable B: co-promotion branch (F3) — separate from the wiring PR, apply-time, agent stops after push

This phase is sequenced LAST and produces a SEPARATE git branch, not a commit on `feat/issue-253-b1`. It is not
part of this PR's diff or line budget.

- [ ] 8.1 Create a new branch off the tip of `feature/v2.0.0` (post-B0, NOT off `feat/issue-253-b1` — the two
      must be independently mergeable in any order). Name pinned at apply time (design §7 open item 6) —
      suggest `docs/adr-0019-sdd-layout-promotion` or equivalent doc-zone naming, confirm against repo
      convention at apply time.
- [ ] 8.2 **ADR-0019.** Move `openspec/changes/issue-250-b0/brain-drafts/adr-draft-harness-port.md` →
      `brain/project/decisions/adr-0019-harness-port.md`. Set `Status: Accepted`, add the promotion banner, add
      an ISO-format date. **Re-verify the ADR number** at prep time against BOTH `brain/project/decisions/`
      (promoted numbers) AND `**/brain-drafts/` (claimed-but-unpromoted numbers) — do not trust the number
      recorded in design.md as still current if time has passed; re-run the check live. — *REQ-B1-6*
- [ ] 8.3 **`sdd-layout.md`.** Move `openspec/changes/issue-250-b0/brain-drafts/sdd-layout.md` →
      `brain/core/methodology/sdd-layout.md`. — *REQ-B1-6*
- [ ] 8.4 **Nav entries, in the SAME commit (or same atomic commit set) as 8.3** — never split into a
      doc-move-only commit followed by a separate nav-fix commit: add the `sdd-layout.md` entry to
      `brain/HOME.md` (methodology list) and `brain/core/templates/HOME.template.md` (matching list). —
      *REQ-B1-6 scenario "brain:nav passes because the doc move and nav edits are atomic"*
- [ ] 8.5 Run `brain:nav` against the branch locally to confirm it passes before pushing (self-check, not a
      substitute for CI).
- [ ] 8.6 `git push -u` the branch. The agent MUST NOT run `gh pr create` / `glab mr create` and MUST NOT merge
      — CP-B0 / doc-zone-promotion doctrine. Hand off a ready-to-open MR description to the human summarizing
      the ADR-0019 promotion + `sdd-layout.md` move + nav atomicity, so the human's only action is open+merge. —
      *REQ-B1-6 scenario "the agent never opens or merges the branch"*
- [ ] 8.7 Confirm the errata checklist from #216 is satisfied (no leftover placeholder text, no unresolved
      cross-references to the old `brain-drafts/` path anywhere in the repo — grep for stale references before
      pushing).

---

## Open items resolved / carried forward from design §7

| # | Open item | Resolution in this tasks.md |
|---|---|---|
| 1 | Frozen-count reconciliation (27 vs 28) | Measured live at apply time (Phase 0.2 / 1.1–1.2); N is whatever the pre-wiring tree actually has, recorded in the fixture — never hardcoded |
| 2 | Slug-absent behavior | Locked: ERROR, no placeholder (#595 pin 2) — Phase 5.1 |
| 3 | Capture-harness location | Test-scoped (`sdd-layout-golden.test.mjs`), budget-free — Phase 1.1 |
| 4 | Tripwire `EXEMPT_PATH_RE` consolidation | Defaulted to "include now" (budget-free) pending owner override at apply time — Phase 3.3 |
| 5 | `'archive'` reserved-name literal | Stays inline, out of scope, noted at Phase 2.6 |
| 6 | Co-promo branch name + base SHA | Named at apply time in Phase 8.1, base = `feature/v2.0.0` tip at prep time |
