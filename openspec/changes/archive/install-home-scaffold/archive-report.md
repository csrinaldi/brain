---
status: archived
change: install-home-scaffold
---

# Archive Report — Install-time HOME.md Scaffold

**Archived:** 2026-07-02  
**Change:** `install-home-scaffold` (implements #184 ADR scaffolding pipeline)  
**Verdict:** PASS (0 remaining CRITICAL issues)

---

## SDD Artifact Audit Trail

All planning, specification, design, implementation, and verification artifacts have been
created, reviewed, and are recorded here together with full observation IDs for
traceability.

| Artifact | Engram ID | Topic Key | Status |
|----------|-----------|-----------|--------|
| Proposal | — | `sdd/install-home-scaffold/proposal` | Complete |
| Specification (home-scaffold) | — | `sdd/install-home-scaffold/spec/home-scaffold` | Complete (6 REQs) |
| Specification (home-index) | — | `sdd/install-home-scaffold/spec/home-index` | Complete (7 REQs) |
| Design | — | `sdd/install-home-scaffold/design` | Complete (5 decisions + file matrix) |
| Tasks | #339 | `sdd/install-home-scaffold/tasks` | 100% complete — all tasks `[x]` (Slice 1 Phases 1–7, Slice 2 Phases 8–11, Closure C.1–C.4) |
| Apply Progress | #340 | `sdd/install-home-scaffold/apply-progress` | Complete — merged to main via PR #187; REQ-7 CRITICAL closed by follow-up PR #188 |
| Verify Report | #342 | `sdd/install-home-scaffold/verify-report` | PASS WITH WARNINGS → PASS (CRITICAL resolved) |

---

## Change Summary

**What:** Two coupled, agnostic, testable parts to fix the broken `brain:env:init` → read HOME.md pipeline and remove agent-specific HOME.md-patch logic from the Claude adapter.

### Part 1 — Scaffold

- **New template** `brain/core/templates/HOME.template.md` — shipped to consumers via `brain/core/**` managed glob, ships with `### Architecture decisions` empty section and only `core/**` links (no dead `project/**` references).
- **New helper** `brain/scripts/lib/home-scaffold.mjs` exporting `ensureHome(root, opts)` — create-if-absent contract mirroring `ensureBrainConfig`, injectable seams for testing, CLI guard for `node home-scaffold.mjs ensure`.
- **Nav exclusion** `brain/scripts/check-brain-nav.mjs` — extended filter to exclude `/templates/` files from orphan/dead-link detection (the template file itself would cause false failures otherwise).
- **Wiring** `brain/scripts/bootstrap.sh` — invokes scaffold near the brain-config ensure step; idempotent re-runs leave HOME.md untouched.
- **Tests** — unit tests for create/no-overwrite/return contract; fixture test proving fresh-consumer HOME.md is nav-clean (exit 0).

### Part 2 — Index Helper + Adapter Rewire

- **New helper** `brain/scripts/lib/home-index.mjs` exporting `insertAdrLink(homeText, { number, slug, description })` — pure string→string, handles append-after-last / insert-after-empty-heading / fail-safe / idempotent branches; CLI wrapper with I/O and exit-code contract (0 = patched/no-op, 1 = I/O error, 2 = bad usage, 3 = fail-safe).
- **Adapter rewire** `.claude/commands/project-bootstrap-adrs.md` Phase 4 — removed the prose patch-mechanics subsections; now delegates to `node brain/scripts/lib/home-index.mjs insert …` per ADR, branching on exit code.
- **Tests** — unit tests for all insertion branches; fixture test proving patched HOME.md is nav-clean; adapter-assertion test confirming old prose is gone and helper is called.

---

## Delivery: 2-Slice Chain + Follow-up

Delivered via `feature-branch-chain` strategy per the tasks.md Review Workload Forecast.

| Step | PR | Scope |
|---|---|---|
| Slice 1 | #185 | Scaffold, nav exclusion, `ensureHome`, bootstrap.sh wiring, tests (Part 1 — self-contained) |
| Slice 2 | #186 | Index helper, adapter rewire, nav integrity fixture (Part 2 — depends on Part 1) |
| Tracker → main | #187 | Epic merge; closes #184 |
| **Follow-up** | **#188** | **REQ-7 agent-neutrality source-scan test** (resolves CRITICAL from verify-report) |

**Merge commits:**
- Slice 1 merge to tracker: `1ebbcda`
- Slice 2 merge to Slice 1: `5f9dc5c`
- Tracker merge to main: `666a5b8` (closes #184)
- Follow-up merge to main: `4759dc7` (closes #189)

**Test suite:** 822/822 green post-follow-up merge (all slices + follow-up integrated; no regressions).

---

## Implementation + Review-Fix Cycle

### Main Implementation (Slice 1 + Slice 2)

- Slice 1 (5 commits, strict TDD): nav exclusion, template, `home-scaffold.mjs`, tests, bootstrap.sh wiring, Docker-gated fresh-install assertion.
- Slice 2 (4 commits, strict TDD): `home-index.mjs` pure helper + CLI, adapter rewire, nav-integrity fixture, managed-paths assertion.

### Fresh-Review Fix Batch (Slice 2, 4 commits)

Fresh adversarial review before PR2 opening found and closed 2 MEDIUM + 2 LOW findings:

1. **MEDIUM: CRLF + trailing-space heading misdetection** — `insertAdrLink` matched `### Architecture decisions` via exact line equality on split text; CRLF files or headings with trailing whitespace would fail anchor detection and abort (false fail-safe). Fixed: detect EOL (`\r\n` vs `\n`), match heading via regex after `trimEnd()`, join result with detected EOL to preserve original line-ending style. Tests added: CRLF round-trip, trailing-space heading.
2. **MEDIUM: CLI file I/O unguarded** — `readFileSync`/`writeFileSync` were unguarded; missing `--home` file threw Node.js stack trace, undefined exit code. Fixed: wrapped in try/catch, print clean stderr message, exit 1 (I/O error). Tests added: I/O error scenarios.
3. **LOW: Incomplete exit-code documentation** — Phase 4's exit-code branching table only mapped 0 and 3. Added documentation rows: exit 1 → report message, skip this ADR's patch; exit 2 → report message, indicates invocation bug. Edited `.claude/commands/project-bootstrap-adrs.md`.
4. **LOW: Weak REQ-5 assertion** — the adapter-delegation test only checked ABSENCE of old prose (could pass vacuously). Added positive assertion: helper invocation command line MUST be present AND "not re-described" sentence MUST be present. Test `home-index-adapter.test.mjs` now has both positive + negative guards.

---

## Verification Results (from `sdd/install-home-scaffold/verify-report` #342, then PR #188 follow-up)

**Initial Verdict:** PASS WITH WARNINGS — 1 CRITICAL issue on REQ-7 Scenario 1.  
**After PR #188 (follow-up):** **PASS** — 0 CRITICAL issues.

### REQ-7 CRITICAL (resolved by PR #188)

**Scenario 1 of REQ-7** ("no reference to a specific agent name") had zero automated test coverage. On manual inspection, `brain/scripts/lib/home-index.mjs`'s header comment contained literal "Claude" and "Codex" references (illustrative, not functional code). The requirement's literal text ("contains no reference to a specific agent name") was violated, and there was no runtime-executed test proving otherwise.

**Resolution (PR #188):** Added `brain/scripts/lib/home-index-source-scan.test.mjs` — automated source-scan test mirroring the existing `substrate.mjs` neutrality-scan pattern, reworded comments in `home-index.mjs` to avoid agent-name literals, confirmed test passes with zero agent names in the scanned content.

### Test Coverage

- **home-scaffold** (6 REQs): 100% covered — create/no-overwrite unit tests, nav-integrity fixture (real template + real brain/core, exit 0).
- **home-index** (7 REQs): 100% covered — all insertion branches (empty/existing/fail-safe/idempotent), CLI I/O + exit codes, nav-integrity post-patch, adapter-delegation assertion, source-scan (REQ-7 Scenario 1).

All 13 requirements map to an implementing artifact AND a passing test. `npm test` = **822/822 pass, 0 fail**. `npm run brain:nav` exit 0.

---

## Specs Sync

**Main specs:** `openspec/specs/` is empty (only `.gitkeep`) — following this repo's convention (same as issue-138, issue-144).

**Delta specs** (`openspec/changes/install-home-scaffold/specs/`):
- `home-scaffold/spec.md` — 6 REQs (scaffold, template, test cases, wiring, managed-paths exclusion).
- `home-index/spec.md` — 7 REQs (pure helper, append/insert/fail-safe branches, adapter delegation, agent-neutrality, distribution).

Both remain in the change folder as the canonical audit trail. No merge/promotion to main-specs performed (consistent with repo convention).

---

## Archive Filesystem

**Convention followed:** in-place archival within `openspec/changes/`, matching precedent (issue-138-session-start, issue-144-governance-v3).

**Updated frontmatter:**
- `openspec/changes/install-home-scaffold/proposal.md`: `Status: Draft for implementation` → `Status: Archived`
- `openspec/changes/install-home-scaffold/design.md`: (status line updated to Archived)
- `openspec/changes/install-home-scaffold/tasks.md`: `Status: ` marker updated to Archived
- Archive report: `openspec/changes/install-home-scaffold/archive-report.md` (this file, new)

**Not done (intentionally, no repo convention calls for it):**
- No move to `openspec/changes/archive/YYYY-MM-DD-{change-name}/`.
- No merge into `openspec/specs/` — delta specs stay in change folder.
- No edits to brain source code, tests, or workflows — archive is docs/bookkeeping only.

---

## Deferred Follow-ups (tracked, not blockers)

Documented in apply-progress #340 but not implemented in this batch (out of scope):

1. **Same-ADR-number + different-slug duplicate-on-rename** — not specifically guarded by helper logic; self-surfaces via `npm run brain:nav` orphan/broken-link detection if it occurs (acceptable, low-risk scenario).
2. **CLI `--number`/`--slug` argument-shape validation + `--desc` shell-quoting hardening** — CLI currently trusts argv as-is; a potential future hardening (low priority, requires caller discipline in adapter).
3. **Empty-section blank-line cosmetic ordering** — the new link is inserted between the heading and `---` rather than immediately before `---`; functionally correct per REQ-2's literal wording ("immediately after the heading"), visually slightly asymmetric with existing-section case. Cosmetic, not a spec violation.

None of these block this archive: 0 CRITICAL issues, epic PR #187 merged to `main`, issue #184 closed.

---

## SDD Cycle Complete

The change has been:
1. Proposed (proposal.md)
2. Specified (2 delta specs: home-scaffold, home-index — 13 REQs total)
3. Designed (design.md — 5 decisions, file matrix, testing strategy)
4. Tasked (tasks.md — 39 items across 2 chained-PR slices + closure checklist)
5. Implemented (2 slice PRs #185/#186, epic PR #187 merged to `main`, issue #184 closed; + follow-up PR #188 for REQ-7 test)
6. Verified (PASS WITH WARNINGS → PASS; REQ-7 CRITICAL resolved by #188; #342)
7. Archived (this report; frontmatter updated to `status: archived`; 3 tracked follow-ups carried forward, not blockers)

**Ready for the next change.**

---

**Archived by:** sdd-archive executor  
**Repository:** brain  
**Artifact store:** hybrid (file + engram)  
**Engram topic keys for traceability:**
- `sdd/install-home-scaffold/proposal` (file in openspec; engram lookup available)
- `sdd/install-home-scaffold/spec/home-scaffold` (file in openspec)
- `sdd/install-home-scaffold/spec/home-index` (file in openspec)
- `sdd/install-home-scaffold/design` (file in openspec)
- `sdd/install-home-scaffold/tasks` (#339)
- `sdd/install-home-scaffold/apply-progress` (#340)
- `sdd/install-home-scaffold/verify-report` (#342)
- `sdd/install-home-scaffold/archive-report` (this file + engram save to follow)
