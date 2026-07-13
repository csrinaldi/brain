---
status: draft
issue: 253
---

# Design — Wire the Gates Onto the Contract (slice B1)

> **Reads:** [proposal.md](proposal.md) · constraints [[sdd/issue-253-b1/constraints]] (#595, the F1–F3 ruling) ·
> contract inventory [[sdd/track-b/contract-inventory]] (#584, the 6 sites file:line) · the B0 accessor
> `brain/scripts/lib/sdd-layout.mjs` + its rehearsal tests `brain/scripts/lib/sdd-layout.test.mjs` (the per-site
> call spec).
> **Guardrails honored:** PURE WIRING (Pin A) — no new behavior over the frozen corpus. TDD: the golden baseline
> is captured FIRST, before any site is touched. English (ADR-0009). A3 carries the A1-precision lesson forward.

This is the HOW at architectural level for B1's two deliverables. It decides five things the proposal left to
design: (1) the exact per-site wiring, (2) the golden-capture harness (F1, frozen-27 keys), (3) the A3
import-shape drift-guard (F2, precision), (4) the `new-change.mjs` slug mandate, (5) the co-promotion branch prep
(F3). Task breakdown is tasks.md.

---

## 1. Architecture approach — consume, don't reshape

B0 shipped `sdd-layout.mjs` as pure, side-effect-free, fs-injectable helpers whose signatures were validated by
rehearsal tests written *as the six sites will call them* (#587). B1 adds NO new logic: each site swaps its inline
`openspec/changes/**` literal(s) for the matching helper, the drift-guard gains its last rung (A3), one latent
gap closes (the slug), and a golden regression net proves the swap changed nothing over the frozen corpus.

```
   brain/scripts/lib/sdd-layout.mjs  (B0, unchanged) ── single source of truth
        ▲          ▲          ▲          ▲          ▲
  ./lib/    ./lib/    ./lib/    ../lib/   ../../lib/  ../../lib/   ← per-site import depth (A3 pins each)
  check-refs session   new-change phase-   engram      feature-
             -start               order              -resolution
                                  -check
        │
        └── golden harness (test-only): frozen-27 fake-fs → run wired gates → deepEqual committed BEFORE
```

**Behavior-preservation is the whole point.** Every wiring below is proven identical over the frozen corpus by
the golden net (§2); the per-site *call shape* is proven by the B0 rehearsal tests, which stay green unchanged.

---

## 2. Per-site wiring (Deliverable A, items 1–2)

Import depth per file is computed from the site dir to `brain/scripts/lib/sdd-layout.mjs` — three distinct
specifiers (`./lib/`, `../lib/`, `../../lib/`); this drives A3 (§4).

| # | Site (file:line) | Inline literal / logic replaced | Helper(s) consumed | Import specifier | Behavior-preservation argument |
|---|---|---|---|---|---|
| 1 | `check-refs.mjs:96-112` (S-1) | `join(ROOT,'openspec/changes')`; the 2-of-4 loop `['proposal.md','tasks.md']`; `path: openspec/changes/${name}/...` | `CHANGES_ROOT`, `missingRequiredArtifacts`, `isGrandfathered` | `./lib/sdd-layout.mjs` | Over the frozen 27, **every** non-grandfathered dir already has all 4 artifacts (verified: §2.1) and the 12 grandfathered short-circuit to `[]` → verdict = ZERO violations before AND after. The richer 4-artifact check is **latent** for future incomplete dirs (closes #584 gap #1) — in-scope because the golden's frozen-set design scopes new dirs out. |
| 2 | `session-start.mjs:38-69` (`deriveChangeFromBranch`) | caller's `'openspec/changes'` literal; the hand-rolled delimiter-anchored dir match `name===token \|\| name.startsWith(`${token}-`)` | `CHANGES_ROOT`, `parseChangeId` | `./lib/sdd-layout.mjs` | Branch→iid extraction (`/issue-(\d+)/i`) STAYS (it parses a branch, not a dir — `parseChangeId` is anchored to dir shape). The dir match becomes `parseChangeId(name)?.iid === iid`, proven equivalent to the delimiter-anchored match (rehearsal 1.6: `issue-138-session-start`→iid `138`, never substring `13`). |
| 3 | `phase-order-check.mjs` | `CHANGE_DIR_PREFIX='openspec/changes/'` (L20); `BASELINE_EXEMPT_DIRS=[3 dirs]` (L185) | `CHANGES_ROOT` (as `` `${CHANGES_ROOT}/` ``), `LEGACY_GRANDFATHERED` (default arg of `applyBaselineExemption`) | `../lib/sdd-layout.mjs` | Prefix swap is byte-identical. Expanding the exempt list 3→12 is a no-op over the corpus: the extra 9 grandfathered dirs all carry nested `specs/*/spec.md` (verified: §2.1) → `hasSpec=true` → they never produce a downgradeable `fail`. Only the original 3 (no spec at all) were ever downgraded — unchanged. |
| 4 | `new-change.mjs:48-110` | `changeId` construction (L48); `join(repoRoot,'openspec','changes',id)` (L49); the 4 `writeFileSync` targets (L122-125) | `changeDir`, `artifactPaths` (+ slug fix, §5) | `./lib/sdd-layout.mjs` | Scaffolder, not a corpus gate — not covered by the golden; its own unit test proves the four write targets equal `join(repoRoot, artifactPaths(id).*)` (rehearsal 1.4) and the slug mandate (§5). `spec.md` emission already shipped (#251, confirmed at L123). Local var renamed to avoid shadowing the imported `changeDir`. |
| 5 | `engram.mjs:804-805 & 925-926` | `join(root,'openspec','changes',feature)` (×2); `'resume.md'` (×2) | `changeDir`, `OPERATIONAL_ARTIFACTS[0]` | `../../lib/sdd-layout.mjs` | Two sites, one file. Behavior-identical by construction (same absolute path). Local `changeDir` var renamed (shadow). Covered by A3 + existing engram tests, not the golden (resume I/O, not a corpus verdict). |
| 6 | `feature-resolution.mjs:37-81` | `join(root,'openspec','changes')` (L37); `'resume.md'` (L81) | `CHANGES_ROOT`, `OPERATIONAL_ARTIFACTS[0]` | `../../lib/sdd-layout.mjs` | The `'archive'` reserved-name literal (L61) STAYS inline (the accessor does not own it — residual, §7). resume.md disambiguation is captured by the golden. |

### 2.1 Corpus facts underpinning items 1 & 3 (measured, not assumed)

- All 16 non-grandfathered frozen dirs (`issue-121, 137, 201, 203, 205, 214, 217, 219, 221, 222, 229, 231, 239,
  244, 246, 250`) carry proposal + design + tasks + a flat `spec.md` → `missingRequiredArtifacts` returns `[]`.
- The 9 grandfathered-beyond-the-3 (`feature-working-memory, auto-adrs, governance, managed-paths-namespace,
  issue-138, issue-144, install-home-scaffold, issue-193, issue-196`) all carry nested `specs/*/spec.md` →
  `hasSpec=true` in phase-order-check → no `fail` to downgrade. The 3 original exempts
  (`installer-versionado, vcs-adapter, cli-i18n`) carry NO spec artifact — the only dirs the exemption acts on.

This is why items 1 and 3 are behavior-preserving *over the frozen corpus*, and why the golden (§2.2) is the
authoritative proof, not the argument.

### 2.2 Golden-capture harness (F1 — lifecycle pinned)

**Module shape (test-only, budget-free).** A capture helper + a committed JSON fixture, both under test scope:

- `brain/scripts/lib/sdd-layout-golden.fixture.json` — the committed BEFORE snapshot (the frozen substrate).
- `brain/scripts/lib/sdd-layout-golden.test.mjs` — reads the fixture, rebuilds a **fake fs from the fixture's
  own recorded facts**, runs the (post-wiring) gates, `deepEqual`s the committed verdicts.

**The iteration mechanism (the pin's core).** The test iterates `Object.keys(fixture.changes)` — the FROZEN-27
keys — and builds the injected fs (`exists`/`listDir`/`_readdir`) **exclusively from each key's recorded facts**.
It NEVER calls a live `readdir(openspec/changes)`. Consequence: a new change dir (including `issue-253-b1/`
itself) cannot enter the run by legitimate growth — the guard cannot die by "a new dir has no BEFORE entry."
Every gate seam is injectable (`missingRequiredArtifacts({exists,listDir})`, `deriveChangeFromBranch(_,_,{_readdir})`,
`gatherPhaseOrderInputs({deps})`, `resolveFeature` via a fs fake), so the fake-fs feed is mechanical.

**Fixture schema (deterministic, keys sorted; one line per frozen dir):**

```jsonc
{
  "_header": "point-in-time migration proof over the frozen 27; new dirs out of scope by design",
  "_capturedAtBase": "<pre-wiring HEAD sha>",
  "_frozenCount": 27,
  "changes": {                              // SORTED keys — the frozen set, EXCLUDING issue-253-b1
    "auto-adrs": {
      "facts": { "proposal": true, "specFlat": false, "specNested": true,
                 "design": true, "tasks": true, "resume": false },   // the fake-fs inputs
      "checkRefs":  { "missing": [] },                               // missingRequiredArtifacts verdict
      "phaseOrder": { "level": "exempt|pass|warn|fail", "findings": [ /* normalized, sorted */ ] },
      "featureResolution": { "hasResume": false }                    // resume.md disambiguation signal
    }
    /* … 26 more … */
  },
  "sessionStart": {                         // per-branch, over the SAME frozen key set (fake _readdir)
    "issue-138": { "token": "issue-138", "matches": ["issue-138-session-start"] }
    /* one entry per representative frozen iid */
  }
}
```

Each of the 27 keys stores the verdict of **each corpus gate** that reads it: `check-refs` missing-list,
`phase-order-check` per-dir `{level,findings}`, `feature-resolution` resume signal. `session-start` is captured in
a sibling block keyed by branch token (its verdict is per-branch over the whole set, not per-dir), fed the frozen
keys via the injected `_readdir`.

**RED→GREEN sequence.**
1. On the pre-wiring tree (BEFORE touching any site): run the capture against real fs over
   `openspec/changes/*` minus `issue-253-b1`, serialize sorted, commit as the fixture. The test is GREEN against
   pre-wiring code — this is the baseline (TDD "golden first").
2. Wire each site (each guarded RED→GREEN by its B0-rehearsal-shaped unit test).
3. Re-run the golden: it regenerates verdicts from the **now-wired** gates over the fixture's fake-fs and
   `deepEqual`s the committed BEFORE. ZERO diff → GREEN (preservation proven). Any diff → a regression → fix.

**Confirm the fixture excludes `issue-253-b1/`.** A guard assertion inside the test:
`assert.ok(!('issue-253-b1' in fixture.changes))` — it did not exist at B0-capture time and is out of the frozen
set by design. (Count reconciliation → §7 open item.)

---

## 3. `phase-order-check` exempt-list swap — detail (item 2)

`applyBaselineExemption(evaluation, baselineDirs = BASELINE_EXEMPT_DIRS)` → default becomes
`baselineDirs = LEGACY_GRANDFATHERED`; the local `export const BASELINE_EXEMPT_DIRS` is deleted. The B0 test file
imports `BASELINE_EXEMPT_DIRS` (test line 31) and rehearses the subset proof — that import moves to
`LEGACY_GRANDFATHERED` (a test-file edit, budget-free). The tripwire `EXEMPT_PATH_RE = /^openspec\/changes\//`
(`plainfiles-actorkind-doc-tripwire.test.mjs:47`) is consolidated to `new RegExp('^' + CHANGES_ROOT + '/')` — a
test-file edit, budget-free, optional (§7).

---

## 4. Drift-guard A3 (F2 — precision over coverage, the A1 lesson)

A3 asserts every consuming file references the module via its **real ESM import shape**, per site — never a loose
substring, never a single shared depth literal.

**Curated site → expected specifier map** (the precision guarantee — a shared `../lib/` literal would
false-NEGATIVE the 3 `./lib/` sites and the 2 `../../lib/` sites):

| Consuming file | Expected specifier |
|---|---|
| `brain/scripts/check-refs.mjs` | `./lib/sdd-layout.mjs` |
| `brain/scripts/session-start.mjs` | `./lib/sdd-layout.mjs` |
| `brain/scripts/new-change.mjs` | `./lib/sdd-layout.mjs` |
| `brain/scripts/vcs/phase-order-check.mjs` | `../lib/sdd-layout.mjs` |
| `brain/scripts/memory/backends/engram.mjs` | `../../lib/sdd-layout.mjs` |
| `brain/scripts/memory/lib/feature-resolution.mjs` | `../../lib/sdd-layout.mjs` |

The specifier is computed programmatically (`path.relative(dirname(site), layoutAbs)`, POSIX-normalized, leading
`./` ensured) so it stays correct if a file moves. Per site, assert a match of:

```
/import\s*\{[^}]*\}\s*from\s*['"]<ESCAPED_SPECIFIER>['"]/
```

where `<ESCAPED_SPECIFIER>` is the regex-escaped exact relative path ending `…/sdd-layout.mjs`. Scans exactly the
6 files above (5 physical files; engram's two sites share one import). NOT a recursive tree scan.

**False-positive / false-negative traps closed (A1 death-mode discipline):**
- Loose substring `sdd-layout` → matches doc-comment mentions and the `.test.mjs` filename. REJECTED; anchor on
  the full `import { … } from '…'` statement.
- `/sdd-layout.test.mjs` → the quoted specifier terminates immediately after `sdd-layout.mjs'`, so the test
  filename cannot satisfy it.
- Wrong depth → a shared `../lib/` literal false-negatives 5 of 6 sites; the per-site map prevents it (F2's
  exact concern).
- Side-effect import `import '…/sdd-layout.mjs'` (no braces) → requiring `{…}` demands a real named consumption,
  not a stray import.

---

## 5. Slug mandate in `new-change.mjs` (item 4)

Today: `changeId = title ? `issue-${issue}-${slugify(title)}` : `issue-${issue}`` — bare `issue-<N>` when
`--title` is omitted (#584 gap #2).

**Decision: ERROR when `--title`/slug is absent** — symmetric with the existing `fail()` when `--issue` is
missing (L42-46). Rationale: the canonical contract mandates the slug; a dir name has no meaningful slug to
*derive* from an issue number alone, and silently inventing a placeholder (`issue-<N>-change`) scaffolds a
low-signal directory the human then can not cheaply rename. Fail fast with a clear message. This is a scaffolder
behavior change (not a corpus verdict) → outside the golden; a dedicated unit test covers it: absent title →
throws/`fail`; present title → `issue-<N>-<slug>`. (F alternative "derive a placeholder" recorded as a §7 open
item for owner confirmation.)

---

## 6. Deliverable B — co-promotion branch prep (F3)

A **second, dedicated branch** off `feature/v2.0.0` (NOT off `feat/issue-253-b1` → the two merge in any order),
carrying ONLY the doc-zone diff, **pushed-not-opened**. Created at apply time; the B1 wiring PR is a separate,
normally-opened PR.

**Prep steps (the apply agent performs, then STOPS):**
1. **ADR-0019.** Move `openspec/changes/issue-250-b0/brain-drafts/adr-draft-harness-port.md` →
   `brain/project/decisions/adr-0019-harness-port.md`. Set `Status: Accepted`, add the promotion banner, add an
   ISO date (`2026-07-12`). **Number re-verified against BOTH registries:** promoted max in
   `brain/project/decisions/` = `adr-0017`; claimed-but-unpromoted in `**/brain-drafts/` = `adr-0018`
   (`issue-231-a2`) → **0019 is the correct next monotonic** (standing rule #587 item 3). ✓
2. **`sdd-layout.md`.** Move `openspec/changes/issue-250-b0/brain-drafts/sdd-layout.md` →
   `brain/core/methodology/sdd-layout.md`.
3. **Nav entries, ATOMIC with the move (same commit).** `brain:nav` integrity fails if a doc lands in
   `brain/core/**` without its HOME entry (B0 measured this):
   - `brain/HOME.md` (methodology list, ~L28): `- [SDD layout contract](core/methodology/sdd-layout.md) — the
     canonical openspec/changes/** layout: artifacts, sealed grandfather set, path/parse helpers`.
   - `brain/core/templates/HOME.template.md` (matching list, ~L21): the same entry.
4. **Push, do NOT open.** `git push -u`; hand off a ready-to-open MR description. The agent MUST NOT run
   `gh pr create` / `glab mr create` / merge for this branch (CP-B0 doctrine, [[workflow/doc-zone-promotion-doctrine]]).
   The human's ONLY action is OPEN + MERGE.

---

## 7. Budget, testing, open items

**Counted diff (non-test, non-openspec) — pure wiring:**

| Source file | ~counted lines |
|---|---|
| check-refs.mjs (import + S-1 swap) | ~10 |
| session-start.mjs (import + match swap + caller literal) | ~6 |
| phase-order-check.mjs (import + prefix + exempt swap) | ~5 |
| new-change.mjs (import + slug fix + path wiring) | ~12 |
| engram.mjs (import + 2 sites) | ~6 |
| feature-resolution.mjs (import + 2 literals) | ~4 |
| **Total** | **~43** |

Budget-FREE (test / openspec exemption): the A3 test, the golden capture harness + `*.fixture.json`, the
tripwire consolidation, and all B0-test-file import edits. **~43 counted ≪ 400 — NOT tight; no `size:exception`.**
(Caveat: if the capture harness is factored as a shared *non-test* module instead of test-scoped, add ~30 counted
lines — still ≤400. Design recommends test-scoping to keep it free.)

**Testing strategy.**

| Layer | What | How |
|---|---|---|
| Unit (per site) | each site's call shape | B0 rehearsal tests stay green unchanged (the call spec) |
| Regression (corpus) | behavior-preservation over frozen 27 | golden `deepEqual` (§2.2), RED→GREEN |
| Drift-guard | consumers reference the module | A3 import-shape scan (§4) |
| Unit (scaffolder) | slug mandate + path wiring | new-change unit test (§5), not the golden |
| Synthetic | edge-case dirs | added ON TOP of the corpus proof, never instead |

**Open items for tasks.md:**
1. **Frozen-count reconciliation.** Pin states 27; current pre-wiring HEAD shows **28** non-`issue-253-b1` change
   dirs. Capture at apply time, exclude `issue-253-b1`, record the actual `N` in `_frozenCount` + header. Confirm
   whether one dir is legitimately out (created post-B0-capture) or the pin rounded.
2. **Slug-absent behavior** (§5): design mandates ERROR; confirm owner does not prefer a derived placeholder.
3. **Capture-harness location:** test-scoped helper (recommended, budget-free) vs shared module (+~30 counted).
4. **Tripwire `EXEMPT_PATH_RE` consolidation** (§3): include now (budget-free) or defer — owner call.
5. **`'archive'` reserved-name literal** in feature-resolution/check-refs/session-start stays inline (accessor
   doesn't own it). Note as residual; a future `ARCHIVE_DIR_NAME` export is out of B1 scope.
6. **Co-promo branch name + base SHA** off `feature/v2.0.0` — pin at apply time.
