## Verification Report

**Change**: issue-599-adr-0023-citation-gap
**Version**: N/A (flat spec, no capability version)
**Mode**: Strict TDD (test runner: `npm test`, node:test, Node 22 ESM)

### Completeness
| Metric | Value |
|--------|-------|
| Tasks total | 22 |
| Tasks complete | 21 |
| Tasks incomplete | 1 (5.6 — PR creation, explicitly deferred to orchestrator per design; not an implementation task) |

### Build & Tests Execution

**Targeted e2e file**: ✅ 10 passed / 0 failed
```text
$ node --test test/adr-citation-resolves.e2e.test.mjs
tests 10
pass 10
fail 0
```
KNOWN_GAPS confirmed empty at line 145: `const KNOWN_GAPS = Object.freeze([]);` (verified by direct read, not trusted from apply-progress). Staleness guard (subtest 9, "no registry entry outlives the citation it exempts") passes over the empty registry, and the ticket-naming guard (subtest 10, ADR-0018-never-baselined) also passes vacuously.

**Full suite**: ✅ 3925 passed / 0 failed
```text
$ npm test
tests 3925
pass 3925
fail 0
duration_ms 18281.045796
```
Matches apply-progress's claimed count exactly (independently re-run, not trusted).

**Coverage**: not configured for this repo / not requested — ➖ Not available (informational only, non-blocking per Strict TDD rules).

### Negative Controls (design D6, re-derived independently)

1. **Staleness guard reddens on stale exemption** — re-added one `KNOWN_GAPS` entry (`docs/inbox/MASTER-PLAN-1.0.md` / `'0023'`) via a scratch Python edit (not `sd`, which choked on parens), re-ran the e2e file directly:
   ```text
   not ok 9 - adr-citations: no registry entry outlives the citation it exempts
   not ok 10 - adr-citations: KNOWN_GAPS only shrinks — ADR-0018 is never baselined (#590)
   pass 8 / fail 2
   ```
   Subtest 9 (the staleness guard) reddened exactly as design D6 predicts. Subtest 10 also reddened because my probe's `why` text didn't cite a real ticket (expected side-effect of a synthetic probe, not a defect).
   Reverted with `git checkout -- test/adr-citation-resolves.e2e.test.mjs`; confirmed `git status --short` empty (clean); re-ran the e2e file — back to 10/10 green.

2. **Bare `ADR-0023` token check** — `rg -n --pcre2 'ADR-(\d{4})(?!\d)' docs/inbox/MASTER-PLAN-1.0.md docs/inbox/brain-v2-epic-plan.md | rg '0023'` → zero matches. The CITATION_RE pattern (`/ADR-(\d{4})(?!\d)/g`) cannot find a bare `0023` token in either reworded doc — confirmed by direct regex application against the actual file content, not inferred.

3. **Tree-wide bare-token scan** — `rg -n 'ADR-0023' --glob '!openspec/**' .` → exactly one hit: `brain-drafts/adr-0023-sdd-role-port.md:1` (the draft's own title). `brain-drafts/` is in `UNSCANNED_ROOTS`, so this is outside the scanned surface and pre-existing (file untouched by this change). Zero hits anywhere in `docs/inbox/**` or elsewhere in the scanned surface.

### Diff Inspection (git diff main...HEAD, re-derived)

Full branch diff touches 8 non-openspec/non-memory files across 4 commits; scoped to `docs/`+`test/` per REQ-599-4's actual intent (the doc+test repair commit), the diff is exactly 3 files:

```text
$ git diff main...HEAD --stat -- docs/ test/
 docs/inbox/MASTER-PLAN-1.0.md           | 5 +++--
 docs/inbox/brain-v2-epic-plan.md        | 4 +++-
 test/adr-citation-resolves.e2e.test.mjs | 7 +------
 3 files changed, 7 insertions(+), 9 deletions(-)
```

Per-commit breakdown (git show --stat on each of the 4 commits):
- `d947b55` — openspec planning artifacts only (proposal/spec/design/tasks.md), 516 insertions.
- `387e0e0` — the doc+test repair work unit: exactly `docs/inbox/MASTER-PLAN-1.0.md`, `docs/inbox/brain-v2-epic-plan.md`, `test/adr-citation-resolves.e2e.test.mjs` — matches spec REQ-599-4's diff-scope check verbatim. KNOWN_GAPS deletion and all three rewordings land in this single commit (design D5 atomicity honored — verified by reading this commit's diff directly, not the deletion split across commits).
- `47527b4` — `.memory/` sync only (repo convention, `npm run memory:share` output).
- `1e5d539` — `apply-progress.md` + `tasks.md` checkbox updates only.

Reworded line content (`git diff main...HEAD -- docs/inbox/MASTER-PLAN-1.0.md docs/inbox/brain-v2-epic-plan.md`), read in full and compared word-for-word against design D3:
- Site A (MASTER-PLAN-1.0.md:72, table row): `| M5 | Role-as-port (C) | #312 — owns the decision record; \`0023\` reserved, unpromoted draft at \`brain-drafts/adr-0023-sdd-role-port.md\` |` — matches D3 Site A verbatim.
- Site B (MASTER-PLAN-1.0.md:93-94, prose): two-line replacement matches D3 Site B verbatim, 3-space continuation indent preserved.
- Site C (brain-v2-epic-plan.md:114-116, Spanish): three-line replacement matches D3 Site C verbatim.

Each of the three reworded lines carries all three required facts (REQ-599-2): draft path `brain-drafts/adr-0023-sdd-role-port.md`, `0023` reserved (not promoted/ratified), `#312` owns it. None claims the ADR exists.

Spanish line (Site C) semantic check: original said "Ratificar **ADR-0023**" (ratify — implies a decision already made, only needs signature). Reworded line says "Escribir el ADR del port de roles desde el código ya entregado y promoverlo" (write the ADR from the code already shipped, then promote it) — this is the correct semantic per design D1: the ADR gets written from shipped code when #312 lands, not ratified from the current (unshipped) draft. Register check: infinitive-led ("Escribir", cf. neighboring bullets "Fix del string...", "Surfacear...", "Módulo..."), no voseo, no regionalism — consistent with the rest of the file's bullet style (confirmed by reading lines 100-120 of the file).

### Guard Checks

| Check | Result |
|-------|--------|
| `brain-drafts/adr-0023-sdd-role-port.md` untouched | ✅ `git diff main...HEAD -- brain-drafts/ .gitlab-ci.yml brain/project/decisions/` → 0 lines |
| `.gitlab-ci.yml` untouched | ✅ same command, 0 lines |
| `brain/project/decisions/` untouched | ✅ same command, 0 lines |
| No ADR-0023 file created | ✅ no `brain/project/decisions/adr-0023-*.md` found (fd search returned nothing) |
| `npm run brain:repo:check` | ✅ "No prohibited references found." + "Artifact structure is valid." |
| Commit messages conventional, no AI-attribution trailers | ✅ `git log main..HEAD --format=full` shows 4 conventional commits (`docs(openspec):` x2, `docs(inbox):`, `chore(memory):`), all referencing #599, none with Co-Authored-By or any AI trailer |
| Working tree clean after all probes | ✅ `git status --short` empty |

### Spec Compliance Matrix

| Requirement | Scenario | Test/Evidence | Result |
|-------------|----------|------|--------|
| REQ-599-1 | e2e scan against reworded MASTER-PLAN-1.0.md finds no unresolved-citation for 0023 | `node --test test/adr-citation-resolves.e2e.test.mjs` subtest 6 ("every cited ADR-NNNN resolves") — ok; plus direct regex re-derivation, zero bare-0023 matches | ✅ COMPLIANT |
| REQ-599-1 | e2e scan against reworded brain-v2-epic-plan.md finds no unresolved-citation for 0023 | same subtest 6, same regex re-derivation on that file | ✅ COMPLIANT |
| REQ-599-2 | Reader of either MASTER-PLAN line finds draft path + reserved status + #312, never a claim the ADR exists | Direct read of both reworded lines (Site A, Site B) — all three facts present, no existence claim | ✅ COMPLIANT |
| REQ-599-2 | brain-v2-epic-plan.md reworded line stays Spanish, carries the same three facts | Direct read of Site C — Spanish, neutral register, all three facts present, semantically correct ("escribir...desde el código ya entregado" not "ratificar") | ✅ COMPLIANT |
| REQ-599-3 | Partial rewording (one MASTER-PLAN line only) with both entries deleted fails resolution check | Not independently re-probed (would require reverting one site only); design D5's `covers` logic (file+number pair, not per-line) makes this a straightforward corollary of the single-commit atomicity already verified. Verified indirectly: the actual landed state (all 3 sites reworded + both entries deleted in one commit) is the only state that reaches 10/10 green — confirmed by direct test run | ⚠️ PARTIAL (logically implied and commit-atomicity confirmed, not independently reproduced as a standalone failing scenario) |
| REQ-599-3 | Full rewording without deleting entries fails staleness guard | Independently reproduced via negative-control probe: re-added 1 entry after reword landed → subtest 9 reddened | ✅ COMPLIANT |
| REQ-599-3 | Full rewording + deletion passes both | `node --test test/adr-citation-resolves.e2e.test.mjs` → 10/10, full `npm test` → 3925/3925 | ✅ COMPLIANT |
| REQ-599-4 | Committed diff touches exactly docs/inbox/MASTER-PLAN-1.0.md, docs/inbox/brain-v2-epic-plan.md, test/adr-citation-resolves.e2e.test.mjs and nothing else | `git show --stat 387e0e0` — exactly those 3 files, 7 insertions/9 deletions | ✅ COMPLIANT |
| REQ-599-4 | No ADR file created, brain-drafts/, .gitlab-ci.yml, brain/project/decisions/ untouched | `git diff main...HEAD` on those paths — 0 lines; no adr-0023-*.md found | ✅ COMPLIANT |

**Compliance summary**: 8/9 scenarios independently reproduced as COMPLIANT; 1/9 (partial-rewording-fails-resolution-check) is logically implied by the verified `covers` semantics and atomic single-commit landing rather than independently reproduced as a standalone failing run — WARNING, not CRITICAL, since the design's own reasoning (D5) is sound and the actual landed diff cannot exhibit the partial state.

### Correctness (Static Evidence)

| Requirement | Status | Notes |
|------------|--------|-------|
| D1 — no ADR written, 0023 reserved | ✅ Implemented | No file under `brain/project/decisions/adr-0023-*` |
| D2 — lowercase draft-path form | ✅ Implemented | All 3 sites use `brain-drafts/adr-0023-sdd-role-port.md` (lowercase, unmatched by CITATION_RE) |
| D3 — exact replacement text, all 3 sites | ✅ Implemented | Byte-for-byte match against design D3 quoted blocks |
| D4 — KNOWN_GAPS surgery (both entries deleted, docblock kept) | ✅ Implemented | Diff shows only the 2 object literals removed; docblock and 3 call sites (registry spread, ADR-0018 guard, ticket assertion) untouched |
| D5 — atomicity (one commit, three files) | ✅ Implemented | Commit `387e0e0` is the sole commit touching docs+test, all 3 files together |
| D6 — verification order (red-first) | ✅ Implemented | RED evidence captured in apply-progress matches design's predicted 3-site failure; GREEN confirmed 10/10; full gate 3925/3925 |

### Coherence (Design)

| Decision | Followed? | Notes |
|----------|-----------|-------|
| D1-D6 | ✅ Yes | Verbatim match, no deviations found (apply-progress claims "None — implementation matches design D1-D6 verbatim", independently confirmed) |
| D7 (rejected alternatives) | ✅ N/A | Rejected alternatives correctly not implemented (no ADR written, no new exemption mechanism, no renumbering) |

### TDD Compliance
| Check | Result | Details |
|-------|--------|---------|
| TDD Evidence reported | ✅ | Found in apply-progress, single TDD Cycle Evidence row covering the combined REQ-599-1/2/3 task |
| All tasks have tests | ✅ | The single implementation task is covered by `test/adr-citation-resolves.e2e.test.mjs` |
| RED confirmed (tests exist) | ✅ | Test file exists at expected path, pre-dates this change (only KNOWN_GAPS array was edited) |
| GREEN confirmed (tests pass) | ✅ | 10/10 independently re-run, matches reported GREEN |
| Triangulation adequate | ✅ | 10 distinct subtests exercise different guard dimensions (vacuity, self-exclusion, root coverage, resolution, sibling links, staleness, ticket-naming) |
| Safety Net for modified files | ✅ | Baseline `npm test` (1.2) = 3925 pass, post-change (4.1) = 3925 pass — re-verified independently, same count |

**TDD Compliance**: 6/6 checks passed

### Test Layer Distribution
| Layer | Tests | Files | Tools |
|-------|-------|-------|-------|
| E2E | 10 (targeted) + 3925 (full suite) | 1 targeted file within a 3925-test full suite | node:test (Node 22 built-in) |
| **Total** | **3925** | | |

This change is doc-repair-only; no new test files were created or needed — the existing e2e citation-resolve suite already covered the surface (KNOWN_GAPS array is data, not a new test).

### Changed File Coverage
Coverage analysis skipped — no coverage tool detected/configured for this repo's `npm test` invocation.

### Assertion Quality
Not applicable — no new test assertions were written by this change (only the `KNOWN_GAPS` data array shrank; the 10 subtests and their assertions pre-date this change and were read, not authored, during apply). No tautologies, ghost loops, or trivial assertions introduced.

**Assertion quality**: ✅ N/A — no new assertions added by this change

### Quality Metrics
**Linter**: ➖ Not run (doc-only change plus a data-array edit in a test file; no lint config surfaced in capabilities for markdown)
**Type Checker**: ➖ Not applicable (JS/markdown, no TS in changed files)

### Issues Found

**CRITICAL**: None

**WARNING**:
- REQ-599-3 scenario "partial rewording (one MASTER-PLAN line only) with both entries deleted fails resolution check" was not independently reproduced as a standalone failing test run. It is logically implied by the verified `covers(entry, citation)` semantics (file+number pair matching, confirmed by reading design D5's citation of line 214/281) and by the fact that the actual landed commit is atomic across all 3 sites, but no fresh probe (e.g., temporarily reverting only Site A while keeping both entries deleted) was run to directly observe this specific failure mode. Low risk: the reasoning is sound and re-derivable from code, but it is one degree removed from "ran it myself."

**SUGGESTION**:
- None.

### Verdict
**PASS**

All CRITICAL-tier checks passed on independent re-execution: targeted e2e suite 10/10, full suite 3925/3925 (matches apply-progress claim, not just trusted), `npm run brain:repo:check` clean, diff-scope exactly 3 files in the atomic work-unit commit, guarded paths byte-identical to main, no ADR file created, commit messages conventional with zero AI-attribution trailers, and both negative-control probes (staleness-guard re-add, bare-token regex) behaved exactly as design D6 predicts. The single WARNING (one spec scenario reasoned-through rather than freshly reproduced) does not block archive readiness — it reflects a scenario whose only way to fail differently than verified is already ruled out by the atomic single-commit landing this report independently confirmed.

Task 5.6 (open PR) is the only unchecked task and is explicitly out of this executor's scope per design and apply-progress — not a defect.
