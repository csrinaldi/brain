```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:84eb25fd7de08f9f7782d45759e57c6df129ff505cb73e981b342cc0ecc09f12
verdict: pass
blockers: 0
critical_findings: 0
requirements: 6/6
scenarios: 16/16
test_command: npm test
test_exit_code: 0
test_output_hash: sha256:609ae092fbaff80ea9cb0b1884da706aa2e608f5263fbacb5f4c7498eaee3f59
build_command: npm run brain:repo:check && npm run brain:nav
build_exit_code: 0
build_output_hash: sha256:0fce395b1089b8caea24ef8fa9377494534fe2bcf0e717b94aa2d96ececd64be
```

# Verify Report: issue-1086-audit-pr-resolution

**Date**: 2026-09-20
**Verdict**: PASS
**Verified in**: `/home/gandalf/IA/brain-issue-1086` (branch `fix/issue-1086-audit-pr-resolution`, HEAD `c6fabb58`, 7 commits over `origin/main` `a8c04640`). Read-only verify — no source files edited, nothing committed/pushed/reset/checked-out/stashed/reverted. `git status --porcelain` showed only the pre-existing untracked draft `verify-report.md` (this file, being rewritten) before and after every command in this session; no tracked file was touched by any test or build run.

`evidence_revision` = `sha256(HEAD_sha ":" test_output_hash ":" build_output_hash)`, the same derivation used by `openspec/changes/archive/936/verify-report.md` and by this change's own earlier pass: a reproducible, independently recomputable binding of this verify pass to the exact code revision and exact captured evidence bytes.

**What changed since the earlier verify pass (HEAD was `c7eadb7a`)**: two commits.
1. `e1662ba7` — cold-review remediation: `gitlab.mjs#commitPrs` now requests `per_page=100` explicitly and returns `null` (refuses) when the page comes back full, instead of deciding on a possibly-truncated list — mirroring `mrList`'s full-page guard (#930/#936). Three new tests land in `providers.test.mjs`; `design.md`'s D3 row and `apply-progress.md`'s Deviation #5 are corrected in the same commit.
2. `c6fabb58` — the maintainer promoted the Tier 2 draft (`brain-drafts/vcs-contract-commitprs-row.draft.md`) into `brain/core/methodology/vcs-contract.md` via `brain:promote`, adding the `commitPrs` row and the `prView` `absent` field sentence. `verb-contract-drift-guard.test.mjs`'s hand-off is therefore RESOLVED.

**Correction to the earlier report's claim about the Tier 2 draft's commit state**: the earlier pass (verified at `c7eadb7a`) stated the Tier 2 draft was "not committed to this branch" (WARNING #2). That was already stale at the time it was written — `git ls-tree HEAD -- openspec/changes/issue-1086-audit-pr-resolution/brain-drafts/` at `c7eadb7a` shows the draft file was in fact committed in that same commit. `apply-progress.md`'s own remediation section (added in `e1662ba7`) documents and corrects this directly: Deviation #5 is now marked `[CORRECTED — see Remediation (cold review) below]`. This report does not repeat the earlier claim.

**Correction to the earlier report's `test_command` workaround**: the earlier pass excluded `verb-contract-drift-guard.test.mjs` from its authoritative `test_command` because raw `npm test` had exactly one known-red test (the pre-promotion drift guard) and `gentle-ai sdd-verify-validate` refuses a passing verdict against non-zero exit evidence. That workaround is NOT carried over here. On this HEAD, the drift guard is green (promotion landed in `c6fabb58`), so the envelope's `test_command` is the full, unmodified `npm test` — no file is excluded, no substitute command is constructed. This is a complete, unqualified GREEN.

## Completeness

| Metric | Value |
|--------|-------|
| Tasks total | 29 |
| Tasks complete | 29 |
| Tasks incomplete | 0 |

`tasks.md` shows all 29 checkboxes `[x]` across Phases 1-5 (1.1-1.3, 2.1-2.5, 3.1-3.7, 4.1-4.9, 5.1-5.5) — unchanged from the earlier pass; no task text or checkbox state was edited by the remediation or promotion commits. `apply-progress.md` documents Batch 1 (Phases 1-3), Batch 2 (Phase 4-5), and now a "Remediation (cold review)" section (added in `e1662ba7`) covering the two cold-review findings and their fixes, each with its own TDD Cycle Evidence table. Cross-checked against `git log`: 4 code commits (Phases 1-4) + 1 docs commit (`c7eadb7a`, SDD artifacts + Tier 2 draft) + 1 remediation commit (`e1662ba7`) + 1 maintainer promotion commit (`c6fabb58`) = 7 commits, matching `git log --oneline origin/main..HEAD`.

## Build & Tests Execution

**Build**: PASS
```text
$ npm run brain:repo:check && npm run brain:nav
✓ No prohibited references found.
✓ Artifact structure is valid.
✓ Navegación de brain/ íntegra: sin huérfanos, sin links rotos, sin rutas citadas inexistentes.
exit 0 / exit 0
```
No tracked file was modified by either build command (`git status --porcelain` unchanged, empty of tracked changes before and after). `build_output_hash` is byte-identical to both the `issue-936` archive report's and this change's own earlier pass — expected, since these build commands' output is deterministic and unaffected by this change's code.

**Tests**: 6337 passed / 0 failed / 0 skipped (6337 total)
```text
$ npm test
1..6337
# tests 6337
# suites 0
# pass 6337
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 29289.143258
exit 0
```
Every test in the repository is green, including `verb-contract-drift-guard.test.mjs` (independently re-run in isolation: `node --test brain/scripts/vcs/verb-contract-drift-guard.test.mjs` → 4/4 pass, exit 0 — the promotion in `c6fabb58` closed the hand-off). The count rose from 6334 (the pass at `c7eadb7a`) to 6337 (+3, the new `commitPrs` pagination tests added in `e1662ba7`); `apply-progress.md`'s own remediation section reports 6336/6337 at the point the remediation commit landed (one test still red — the not-yet-promoted drift guard) and this session's fresh run at `c6fabb58` confirms the promotion closed that last gap: 6337/6337.

No `test_command` exclusion, substitution, or workaround was needed or used for this envelope — full `npm test`, unmodified, is the authoritative evidence.

**Coverage**: Not available — no coverage tool detected in this repo (informational, not a failure per strict-tdd-verify.md).

**Test isolation (bare-repo / no-network invariant)**: `git rev-parse --git-common-dir` → `/home/gandalf/IA/brain/.git` (shared worktree common dir, expected); `<git-common-dir>/shallow` does not exist after the full run — the suite never touched the real repo's shallow/clone state. `rg` across every changed `*.test.mjs` file for `spawnSync\(|fetch\(|https?://|execSync\(` found only: (a) literal placeholder/fixture URLs (`example.test`, `gitlab.test`, `gl.example.com`, `github.com/o/r/...`) inside injected fixture data or fake `fetchImpl`/`web_url` closures — never a real host reached at runtime; (b) `spawnSync('git', ...)`/`spawnSync('node', ...)` calls in `merge-walk.test.mjs` and `brain-audit.test.mjs`, all operating against `mkdtempSync(join(tmpdir(), ...))` temp directories (pre-existing test infrastructure pattern, unmodified by this change or its remediation). The new `providers.test.mjs` pagination tests (Finding 1) inject a fake `fetchImpl` closure directly — zero network calls, zero `spawnSync`. No test in the suite makes a live network call.

## Spec Compliance Matrix

| Requirement | Scenario | Test | Result |
|---|---|---|---|
| The port answers which PRs contain a commit | A commit with one containing pull request | `vcs.contract.test.mjs:875` (`commitPrs (contract): happy fixture normalizes to an ascending number[]`, both providers) | ✅ COMPLIANT |
| The port answers which PRs contain a commit | No pull request contains the commit | `vcs.contract.test.mjs:886` (`a definitive empty list normalizes to [], never null`, both providers) | ✅ COMPLIANT |
| The port answers which PRs contain a commit | An unreadable lookup is never an empty answer | `vcs.contract.test.mjs:895` (`a transport failure yields null, never throws and never a fabricated []`, both providers) **+ `providers.test.mjs` (new, this pass): `gitlab.commitPrs requests per_page=100 explicitly`, `... returns null when the page comes back FULL (100)`, `... returns the list intact, ascending, when the page is short (< 100)`** — a full (possibly-truncated) page is now also treated as unreadable, closing the truncation hazard the cold review found | ✅ COMPLIANT |
| `prView` distinguishes absent from unreadable | A number that is an issue, not a pull request | `vcs.contract.test.mjs:293` (`reports absent:true on the not-found fixture`, both providers, sourced from live-confirmed `github-prView-notfound.json` + derived `gitlab-prView-notfound.json`) | ✅ COMPLIANT |
| `prView` distinguishes absent from unreadable | A transport failure is not an absence | `vcs.contract.test.mjs:284` (widened failure-fixture pin asserting `absent: null`, both providers) | ✅ COMPLIANT |
| `prView` distinguishes absent from unreadable | Existing consumers are unaffected | `vcs.contract.test.mjs:265` (`absent: false` on the happy-fixture shape-lock pin) + all pre-existing `prView` consumer call sites (`merge-walk.mjs:307` pre-#1086 tests, `ci-context.mjs`, `review/cold-boot.mjs`, `review/queue.mjs`, `governance/relabel-retrigger.mjs`, `status/cli.mjs`) unmodified and green | ✅ COMPLIANT |
| Audit resolves PR by commit sha only on definitive absence | The real `(#978)` shape is evaluated | `merge-walk.test.mjs:287` (`#1086 regression pin: the real (#978) shape resolves through commitPrs to a real verdict`) | ✅ COMPLIANT |
| Audit resolves PR by commit sha only on definitive absence | A transport failure never reaches the commit-sha lookup | `merge-walk.test.mjs:268` (`#1086 fail-closed proof: a transport failure NEVER reaches the commitPrs lookup`) | ✅ COMPLIANT |
| Audit resolves PR by commit sha only on definitive absence | Two containing pull requests are uncomputable | `merge-walk.test.mjs:347` (`absent + two containing pull requests is uncomputable — neither is evaluated`) | ✅ COMPLIANT |
| Audit resolves PR by commit sha only on definitive absence | No containing pull request falls back to the commit body | `merge-walk.test.mjs:334` (`absent + no containing pull request falls back to the commit body (prSource null)`) | ✅ COMPLIANT |
| The audit output names how the PR was resolved | A commit-sha resolution is visible on the verdict line | `brain-audit.test.mjs:2196` (`the commit-sha-resolved suffix renders on [PASS]/[FAIL]`) | ✅ COMPLIANT |
| The audit output names how the PR was resolved | Each uncomputable cause is distinguishable | `brain-audit.test.mjs:2161` + `:2177` (`the legacy [UNCOMPUTABLE] line stays byte-identical`; `an ambiguous [UNCOMPUTABLE] line (two containing PRs) names its own cause, distinct from the legacy line`) | ✅ COMPLIANT |
| Exit semantics and audit baseline unchanged | A previously passing window still passes identically | `brain-audit.test.mjs:2206`/`:2210` (`no suffix for an ordinary subject-resolved merge`; `no suffix when the subject references no PR at all`) + all pre-existing `merge-walk.test.mjs:187-258` and `brain-audit.test.mjs` REQ-TS-*/`[PASS]`/`[FAIL]` tests unmodified and green | ✅ COMPLIANT |
| Exit semantics and audit baseline unchanged | An uncomputable merge still drives the window to exit 2 | Pre-existing `brain-audit.test.mjs:789` (`expected exit 2 (uncomputable)`), `:891` (REQ-TS-2), `:2064` (`uncomputable dominates`) — all unmodified, all green | ✅ COMPLIANT |
| Tests never touch the real repo or spawn an entrypoint | The port verb is exercised from fixtures | `vcs.contract.test.mjs` `commitPrs` cases — all routed through fixture-glue helpers (`jsonSpawnCallArgs`/`gitlabCallArgs`/`commitPrsArgs`), each fixture's provenance (`derived`/`recorded`) asserted at `:57-66`; new `providers.test.mjs` pagination tests inject a fake `fetchImpl` closure, zero network | ✅ COMPLIANT |
| Tests never touch the real repo or spawn an entrypoint | The fallback matrix is exercised from a fake port | `merge-walk.test.mjs:268-419` — all 7 `#1086` tests pass a plain `{ prView, commitPrs }` object literal as `vcs`, zero `spawnSync`/`fetch` calls in any of them | ✅ COMPLIANT |

**Compliance summary**: 16/16 scenarios compliant, 6/6 requirements covered. All test file:line references independently re-verified against the current HEAD in this session (unchanged from the earlier pass, since neither remediation nor promotion touched the files these line numbers live in, except `providers.test.mjs`, which only gained new tests appended after existing ones).

## Correctness (Static Evidence — the adversarial question)

**Stated plainly, from source: can an unreadable API ever produce a verdict — on this HEAD, after the pagination fix?** No. Re-verified by direct source inspection at the current HEAD, `merge-walk.mjs:319-506` (unchanged by the remediation commit, which touched only `gitlab.mjs` and its test file), cross-checked against the 7 `#1086` tests:

- `resolveByCommitSha` (the ONLY function that can produce `prSource: 'commit-sha'`) is called from exactly one call site (`merge-walk.mjs:341`), gated by `pr.absent === true` — a definitive negative, never `absent: false` (success) or `absent: null` (any other failure/throw). Structural gate, not a heuristic.
- Inside `resolveByCommitSha` (`:467-506`), every branch that is not a clean single-candidate resolution returns through the shared `uncomputable(reason)` helper (`prNum: null`, `prMetaError` set, never a verdict):
  - `commitPrs` verb missing or `sha` absent → uncomputable.
  - `commitPrs` returns `null` — now including the pagination fix's new source of `null` (a full, possibly-truncated GitLab page) alongside a genuine transport failure — → uncomputable. The remediation adds a new PRODUCER of the already-handled `null` value; it does not add a new consumption path, so this dispatch's fail-closed guarantee is unchanged, only strengthened at the source.
  - `commitPrs` returns `[]` (definitive empty) → falls to the commit-body path, never a PR verdict.
  - `commitPrs` returns 2+ candidates → uncomputable, `prViewCallsForCandidates` proven `0` in the test.
  - `commitPrs` returns exactly one candidate → `readPr()` is called; if `readPr` itself fails, the result is STILL `uncomputable`, not a partial verdict.
- Only when `readPr` succeeds with real `labels`/`body` does `resolveByCommitSha` return `prSource: 'commit-sha'` with a real verdict.

Conclusion: every path from an unreadable/ambiguous/unavailable/truncated API state terminates at the shared `uncomputable()` sentinel; the single success path requires both a definitive one-PR resolution from `commitPrs` AND a successful `readPr`. This is independently confirmed at runtime by `merge-walk.test.mjs:268-280` (fail-closed proof) and the three new `providers.test.mjs` tests confirming the pagination refusal at the provider boundary, one layer below `merge-walk.mjs`'s dispatch.

| Requirement | Status | Notes |
|---|---|---|
| D2 `isNotFound` predicate | ✅ Implemented | `uncomputable-cause.mjs` exports `isNotFound`; unchanged by this session's commits |
| D1 `prView` additive `absent` (github/gitlab) | ✅ Implemented | Unchanged by this session's commits |
| D3 `commitPrs` verb (github/gitlab), now with GitLab pagination discipline | ✅ Implemented, hardened | `gh api --paginate` (GitHub, auto-paginates); GitLab now requests `per_page=100` explicitly and returns `null` on a full page — `gitlab.mjs:695-716`, confirmed by 3 new `providers.test.mjs` tests |
| D4 `fetchPrMeta` dispatch, one-level re-read, no recursion | ✅ Implemented | Unchanged by this session's commits |
| D6 audit/metrics emission (`prSource` suffix, no new line tag) | ✅ Implemented | Unchanged by this session's commits |
| `governance.auditBaseline` unchanged | ✅ Confirmed | `git diff a8c04640 HEAD -- brain.config.json` empty; `rg "auditBaseline"` shows `v1.0.0` |
| Exit-code ladder unchanged | ✅ Confirmed | `git diff a8c04640 HEAD -- brain/scripts/governance/` empty |
| `brain/**` scope | ✅ Confirmed, one intentional exception | `git diff a8c04640 HEAD --name-only -- brain/` → 21 files under `brain/scripts/**` plus exactly one file under `brain/core/**`: `brain/core/methodology/vcs-contract.md` — the maintainer's `brain:promote` of the Tier 2 draft (`c6fabb58`), the expected and only sanctioned exception to the "scope confined to `brain/scripts/**`" pattern this change otherwise holds |
| Tier 2 draft confined to `brain-drafts/` | ✅ Confirmed | `openspec/changes/issue-1086-audit-pr-resolution/brain-drafts/vcs-contract-commitprs-row.draft.md` — now promoted into `brain/core/methodology/vcs-contract.md`, both the promoted row and the draft file coexist (draft retained as the SDD artifact trail, not deleted) |
| No `.git`/shallow touched by the suite | ✅ Confirmed | `<git-common-dir>/shallow` absent after the full `npm test` run |
| Governed diff size vs `origin/main` | ⚠️ Over estimate, within budget | `git diff --numstat a8c04640 HEAD` excluding `**/*.test.mjs`, `.memory/**`, `openspec/**`, `AGENTS.md` → **599 changed lines** (527 add / 72 del), independently reproduced. Design/tasks estimated ~340; actual is 1.76x that, a **76% overrun** on the estimate. This is 3 lines higher than the orchestrator's pre-promotion figure of 596 — the promotion commit's 2-insertion/1-deletion `vcs-contract.md` edit is itself governed (it lives under `brain/core/**`, not excluded by any of the four exclusion globs) and is correctly counted here. Still comfortably within the 1000-line lite-tier budget (no `size:exception` needed). See WARNING below (process finding, not a spec/code defect). |

## Coherence (Design)

| Decision | Followed? | Notes |
|---|---|---|
| D1-D7 | ✅ Yes | All seven design decisions map 1:1 to the implemented code |
| D3 (this session) | ✅ Yes, updated in place | Design.md's D3 row was corrected in `e1662ba7` to document the `per_page=100` + full-page-refusal behavior and the deliberate GitHub/GitLab pagination asymmetry; the Rejected column now also names "a GitLab pagination loop matching GitHub's `--paginate`" as considered and deferred |
| D7 (blocking hand-off) | ✅ Resolved | The maintainer's `brain:promote` in `c6fabb58` closes D7's hand-off exactly as designed — "the maintainer lands it in `brain/core/methodology/vcs-contract.md` inside this PR" |
| Cold-review remediation (Findings 1-2) | ✅ Both fixed, disclosed in place | `apply-progress.md`'s "Remediation (cold review)" section documents both findings, their fixes, and the corrected Deviation #5 text (marked `[CORRECTED —  see Remediation (cold review) below]` rather than silently rewritten) |
| Deviations 1-7 (apply-progress, batches 1-2) | ✅ Reasonable, all disclosed | Unchanged from the earlier pass's assessment; none contradicts spec or design |

## Strict TDD Compliance

| Check | Result | Details |
|---|---|---|
| TDD Evidence reported | ✅ | `apply-progress.md` carries TDD Cycle Evidence tables for all 6 task groups (1.1-1.3 through 4.8) plus a dedicated table for the remediation batch (Finding 1) |
| All tasks have tests | ✅ | 29/29 tasks map to covering test files, cross-referenced against actual test file contents above |
| RED confirmed (tests exist) | ✅ | All new/modified test files verified present; the remediation's 3 new tests are explicitly narrated as RED-before-GREEN (2 of 3 failed pre-fix: missing `per_page` param, full page returned intact instead of `null`) |
| GREEN confirmed (tests pass) | ✅ | 6337/6337 on a fresh `npm test` run in this session — the FULL suite, no exclusion |
| Triangulation adequate | ✅ | `commitPrs` pagination: full (100) / short (3) / explicit-param-presence, each a distinct expected outcome distinguishing "refuse" from "decide" |
| Safety Net for modified files | ✅ | Remediation's own report: 360/360 pre-fix combined `providers.test.mjs` + `vcs.contract.test.mjs` suite (minus the 2 new RED cases), confirmed green before the fix; 360/360 after |

**TDD Compliance**: 6/6 checks passed

### Test Layer Distribution
| Layer | Notes |
|---|---|
| Unit | `uncomputable-cause.test.mjs`, `merge-walk.test.mjs` (fake-port), `brain-audit.test.mjs` (pure formatter unit tests), `providers.test.mjs` (fake-`fetchImpl`, this session's 3 new pagination tests) |
| Contract (parameterized, both providers) | `vcs.contract.test.mjs` — `absent` and `commitPrs` cases |
| Regression (spawn-based, temp-dir isolated) | `brain-audit.test.mjs`'s pre-existing spawn-based suite, confirmed still green |
| Source guard | `verb-contract-drift-guard.test.mjs` — now GREEN (4/4) since `c6fabb58`'s promotion; no longer a known-red exception |

### Assertion Quality
No tautologies found (`rg` scan across the new/modified `#1086` test blocks, including the 3 new pagination tests, found none — every assertion carries a distinct expected value: `seenUrl` regex match, exact array equality, `null` sentinel). Spot-checked assertions carry distinct, non-trivial expected values throughout.

**Assertion quality**: ✅ No CRITICAL or WARNING issues found in the sampled test code.

### Quality Metrics
**Linter**: Not run — no linter detected as a distinct capability separate from `npm test` in this repo's cached capabilities.
**Type Checker**: N/A — plain `.mjs`, no TypeScript.

## Issues Found

**CRITICAL**: None.

**WARNING**:
1. **Governed diff overran the design/tasks estimate by 76%** (599 actual vs ~340 estimated), independently reproduced. Still comfortably within the 1000-line lite-tier budget and `tasks.md`'s own forecast explicitly flagged this as a "Medium" risk term ("fixtures are the volatile term"). The magnitude (nearly double) is worth noting for future estimate calibration on fixture-heavy VCS-port changes, and the maintainer's own promotion commit (`+2/-1` under `brain/core/**`) is a small, correctly-counted contributor to the final total's rise from the earlier pass's 581 to this pass's 599. Process finding, not a blocker.

**Remaining human follow-up**: only one item, no longer two.
1. **The #996 issue comment (task 5.2) has not been posted.** Text is prepared in `apply-progress.md`; posting is explicitly reserved for the orchestrator to post under the session's standing forge-write authorization. Not a code defect, but an open follow-up action outside this verify pass's scope.

(The Tier 2 promotion follow-up from the earlier pass's WARNING #2 is RESOLVED as of `c6fabb58` and is not carried forward. The earlier pass's separate, now-corrected claim that the draft itself was uncommitted is addressed above, not repeated here.)

**SUGGESTION**:
1. `evidence_revision`'s derivation (`sha256(HEAD:test_hash:build_hash)`) is the same reproducible convention used in `openspec/changes/archive/936/verify-report.md` and this change's own earlier pass, not a value returned by a dedicated `gentle-ai` command. Continue using this convention consistently until a future gentle-ai release exposes an explicit evidence digest for non-runtime-bearing verify passes.
2. No coverage tool is configured for this repo; changed-file line/branch coverage could not be independently measured (informational only, per strict-tdd-verify.md — never blocking).
3. Success criterion 5.5 (the three sibling `(#978)`-shaped merges beyond the regression-pinned one) remains verified by construction/regression-pin rather than a live `brain:audit "v1.5.0..HEAD"` run, unchanged from the earlier pass. Consider a single follow-up live `brain:audit` run (read-only, already-authorized `gh` access) before or shortly after merge, purely as an end-to-end confidence check.

## Verdict

**PASS** — 6/6 spec requirements and 16/16 scenarios map to passing runtime tests, all 29/29 tasks are complete, `npm test` is a full, unqualified 6337/6337 green (no exclusion, no substitute command — the drift guard that forced the earlier pass's workaround is now green because the maintainer promoted the Tier 2 draft in `c6fabb58`), the build commands (`brain:repo:check` + `brain:nav`) pass with zero side effects, all invariants hold (`governance.auditBaseline` unchanged at `v1.0.0`, exit-code ladder untouched, no live/network call in any test, `brain/**` changes confined to `brain/scripts/**` plus exactly the one sanctioned maintainer-promoted row under `brain/core/**`, no test touches the real repo's `.git`), and direct source inspection plus the fail-closed dispatch tests confirm `fetchPrMeta`'s dispatch can never turn an unreadable/ambiguous/truncated API state into a rendered verdict — every such path terminates at the shared `uncomputable()` sentinel, now including the newly-hardened GitLab pagination boundary. Zero CRITICAL findings. One WARNING carried forward (the estimate overrun, a process finding, not a defect). Exactly one human follow-up remains outside this verify pass's authority: the orchestrator posting the prepared #996 comment. Ready for `sdd-archive`.
