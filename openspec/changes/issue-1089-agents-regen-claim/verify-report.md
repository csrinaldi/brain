```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:c0a4c3c704e0c989a32167e2435a42704c3fa6016c147e9898ddc272cdd5b717
verdict: fail
blockers: 1
critical_findings: 1
requirements: 3/4
scenarios: 8/9
test_command: npm test
test_exit_code: 0
test_output_hash: sha256:d342f392efb681a752ecdc92b05acf182a09c7fb1bad0a429c3c2e4d456588a9
build_command: npm run brain:repo:check && npm run brain:nav
build_exit_code: 0
build_output_hash: sha256:0fce395b1089b8caea24ef8fa9377494534fe2bcf0e717b94aa2d96ececd64be
```

# Verify Report: issue-1089-agents-regen-claim

**Date**: 2026-09-20
**Verdict**: FAIL (one CRITICAL — one spec scenario has no covering test; the underlying implementation is otherwise correct and minimal)
**Verified in**: `/home/gandalf/IA/brain-issue-1089`, branch `fix/issue-1089-agents-regen-claim`, HEAD `d71d4f2d`, 3 commits over `origin/main` `b0fbc1c9`.
**Mode**: Strict TDD, full artifact set (proposal + design + spec + tasks + apply-progress). Read-only verify — no source files edited; nothing committed, pushed, or reset. Only file written by this pass: this report.

`evidence_revision` = `sha256(HEAD_sha ":" test_output_hash ":" build_output_hash)`, the same derivation used in `openspec/changes/archive/936/verify-report.md`, reproducible from the three fields already in this envelope. No dedicated `gentle-ai` command exposes a different mandated formula for a non-runtime-bearing manual verify pass.

## Completeness

| Metric | Value |
|--------|-------|
| Tasks total | 12 |
| Tasks complete | 12 |
| Tasks incomplete | 0 |

`tasks.md` shows all 12 checkboxes `[x]` across Phases 1-3. `apply-progress.md` corroborates with a matching TDD Cycle Evidence table and two commits (`997b3fa6`, `c9997af2`). Task completion is real, but see **Issues Found** below: `tasks.md` itself never planned a test for one of the four wording branches spec.md requires, so "12/12 tasks done" does not equal "spec fully covered."

## Build & Tests Execution

**Build**: PASS
```text
$ npm run brain:repo:check && npm run brain:nav
✓ No prohibited references found.
✓ Artifact structure is valid.
✓ Navegación de brain/ íntegra: sin huérfanos, sin links rotos, sin rutas citadas inexistentes.
exit 0 / exit 0
```

**Tests**: 6342 passed / 0 failed / 0 skipped
```text
$ npm test
# tests 6342
# pass 6342
# fail 0
# duration_ms 29036.048542
exit 0
```
Matches `apply-progress.md`'s own count (6342/6342) exactly. Targeted runs also independently confirmed:
- `node --test brain/scripts/harness/backends/antigravity.test.mjs` → 27/27
- `node --test brain/scripts/brain-upgrade.test.mjs` → 21/21
- `node --test brain/scripts/harness/backends/antigravity.drift.test.mjs` → 5/5 (confirmed unaffected, as claimed)

## Spec Compliance Matrix

| Requirement | Scenario | Test | Result |
|---|---|---|---|
| Init Reports Unreadable Source Docs | One doc unreadable | `antigravity.test.mjs:189` (`1.2`) | ✅ COMPLIANT |
| Init Reports Unreadable Source Docs | All docs readable | `antigravity.test.mjs:170` (`2.1`, extended: `missingDocs: []`) | ✅ COMPLIANT |
| Init Reports the AGENTS.md Write Outcome | Write fails | `antigravity.test.mjs:203` (`1.3`) | ✅ COMPLIANT |
| Init Reports the AGENTS.md Write Outcome | Write succeeds | `antigravity.test.mjs:170` (`2.1`, `agentsWritten: true`) + `antigravity.test.mjs:276` (`2.4`) | ✅ COMPLIANT |
| Return Shape Stays Backward Compatible | Existing CLI dispatch caller is unaffected | `antigravity.test.mjs:226` (`1.5`, asserts no `ok` key under every failure combination) + source proof: `harness/cli.mjs:266` `r.ok === false` is `undefined === false` when no `ok` key exists | ✅ COMPLIANT (unit test + direct code reading; no dedicated `cli.mjs` integration test exists for the `isMain` exit path — pre-existing gap, not introduced here) |
| brain-upgrade's Regen Claim Matches the Report | Nothing missing, write succeeded (byte-identical wording) | `brain-upgrade.test.mjs:221` (REQ-397-4, extended with exact-string assertion, task 2.2) | ✅ COMPLIANT |
| brain-upgrade's Regen Claim Matches the Report | `brain/HOME.md` missing | `brain-upgrade.test.mjs:249` (task 2.1) | ✅ COMPLIANT |
| brain-upgrade's Regen Claim Matches the Report | **A different source doc is missing** | **none** | ❌ **UNTESTED — CRITICAL** |
| brain-upgrade's Regen Claim Matches the Report | The AGENTS.md write itself failed | none at the `brain-upgrade.mjs` wording level either | ⚠️ see note below |

**Compliance summary**: 8/9 scenarios compliant with a passing runtime test, 1/9 UNTESTED. 3/4 requirements fully covered.

### CRITICAL — "A different source doc is missing" has zero covering test

`brain-upgrade.mjs:695` — `warn(\`AGENTS.md was compiled without ${report.missingDocs.length} missing source doc(s): ${report.missingDocs.join(', ')}\`)` — is new code added by this change (it did not exist before; the old code had no branching at all). I confirmed via `rg -n "compiled without" brain/scripts/` that this exact string appears **only** at that one call site, in no test file anywhere in the repo. `tasks.md` Phase 2 has exactly two RED tasks (2.1 "brain/HOME.md missing", 2.2 "byte-identical happy path") — it never planned a task for the "some *other* doc is missing" scenario, even though `spec.md`'s fourth requirement explicitly lists it as its own scenario ("A different source doc is missing"). `makeUpgradableConsumer()` in `brain-upgrade.test.mjs` always writes all four methodology docs unconditionally (lines ~193-195), so no existing fixture can even reach this branch without further test code.

This is a real gap, not a nitpick: per the strict-TDD contract, "a spec scenario is compliant only when a covering test passed at runtime" — source inspection is not sufficient. I read the branch and it looks correct (it reuses the same `report.missingDocs` array already proven correct at the `antigravity.mjs` unit level), but that is exactly the kind of claim strict TDD exists to make unnecessary. **Fix**: add one test to `brain-upgrade.test.mjs` — extend `makeUpgradableConsumer` to optionally omit a methodology doc (or write a fixture directly), run `runBrainUpgrade`, and assert the "AGENTS.md was compiled without N missing source doc(s)" wording appears while the byte-identical success line does not.

**Note on "the write itself failed" (brain-upgrade.mjs wording level)**: also has no test at the `brain-upgrade.mjs` integration level (there is no fixture that makes `writeAgents` throw inside a `runBrainUpgrade` subprocess run), but this scenario IS proven correct through a combination that the missing-doc scenario lacks: `antigravity.test.mjs:203` (`1.3`) proves `agentsWritten: false` is reported correctly by `init()`, and the `brain-upgrade.mjs` branch that reads it (`if (!report.agentsWritten) …`, checked FIRST, unconditionally) is a direct, unguarded read of that one boolean — there is no additional logic to get wrong between the two. I am not raising this as a second CRITICAL because the code path has no branch-internal logic left untested (unlike the "different doc" case, which also has to prove the pluralization/join/exclusion-of-HOME.md logic), but it is the same shape of gap and a WARNING: the design's own Testing Strategy table promised "`brain-upgrade.mjs` wording per scenario" at the `runBrainUpgrade()` level for all four scenarios, and two of the four never got that level of test.

## Correctness (Static + Dynamic Evidence)

### 1. Does the new wording ever lie?

Walked all four branches in `brain-upgrade.mjs:686-696` against `init()`'s actual guarantees:

- `!report.agentsWritten` → "Could not write AGENTS.md — the regeneration did not complete." Checked FIRST, unconditionally — correct per spec's explicit "regardless of `missingDocs`." True whenever `writeAgents` threw; never printed when it succeeded (verified: `agentsWritten` is set `true` before the try and only flipped `false` inside the `catch`, `antigravity.mjs:245-251`).
- `report.missingDocs.length === 0` (write already proven to have succeeded by branch order) → byte-identical success line. Only reachable when every one of the 5 `SOURCE_DOCS` was read AND the write succeeded. Verified byte-identical against the pre-change literal via `git diff` (only the `ok(...)` call site changed control flow, not the string).
- `report.missingDocs.includes('brain/HOME.md')` → HOME.md-specific message, correct naming and correct recovery command (`REGENERATE_HINT`, imported not re-typed, so it can't drift from the compiled banner's copy at `antigravity.mjs:170-173`).
- `else` (some other doc(s) missing) → generic message. Logically correct by inspection (reuses the same array), but **UNTESTED at runtime** — see CRITICAL above.

I found no path where a stale `AGENTS.md` reads as a clean "Regenerated" claim. Every branch that claims success requires both `missingDocs.length === 0` and `agentsWritten === true` to be literally true at the moment `init()` resolved. This directly fixes the defect the proposal describes (verified by re-reading `antigravity.mjs`'s pre-change and post-change `init()`: the read/write outcomes were always computed, just never returned — this diff is a pure "carry the already-known facts out" change, not new detection logic that could itself be wrong).

### 2. Backward compatibility

Grepped every caller of `init()` and `antigravity.mjs`'s exports (excluding tests):
- `brain-upgrade.mjs:673,679` — the one caller that inspects the return value; updated correctly (see diff review below).
- `brain-promote.mjs:49` and `__fixtures__/promote-repo.mjs:19` — import `SOURCE_DOCS`/`AGENTS_EMIT_PATH`/`compileAgentsMd` only, never `init()`. Unaffected.
- `harness/cli.mjs:212` — `dispatch()` calls `backend[fn](...args)` generically and returns whatever the backend resolves, with zero antigravity-specific code. Its `isMain` block (`cli.mjs:266`) does `results.find((r) => r && r.ok === false)`. Read directly: an object `{missingDocs, agentsWritten, geminiWritten}` has no `ok` key, so `r.ok === false` evaluates `undefined === false` → `false`. `failed` stays `undefined`, so the CLI does not exit 1. This is exactly the design's claimed backward-compatibility argument, and I verified it by reading the actual comparison, not by trusting the design doc.
- `bootstrap.sh:292` — `node brain/scripts/harness/cli.mjs init || warn ...`; gates on the **node process's exit code**, not the resolved value's shape, and the exit code is unchanged (see above) — before this change `init()` returned `undefined`, which also has no `ok` key; behavior is identical before and after for this caller.
- No other day-start/self-heal path calls `antigravity.mjs`'s `init()` directly (`rg` across `brain/scripts/*.mjs` for `antigravityInit|backends/antigravity` found only the two files above and `brain-promote.mjs`'s narrower import).

Confirmed: `init()` still never throws under any combination I tried (including all-reads-fail + all-writes-fail, live-run against `/fake/repo` — see note in Issues below), and its "never throws" contract is intact.

### 3. The tests — are the RED proofs real?

- `antigravity.test.mjs` tests `1.2`–`1.5`: each asserts a field the OLD `init()` (which returned `undefined`) could not have produced — genuinely RED before the implementation, GREEN after. Confirmed by reading the pre-change `antigravity.mjs` (via `git show origin/main:...`) — `init()` had no return statement at all.
- `brain-upgrade.test.mjs`'s missing-HOME test (task 2.1): genuinely RED against old code — the old code always printed the byte-identical line unconditionally, so `assert.ok(!out.includes(...))` would have failed. Confirmed by re-reading the pre-change `brain-upgrade.mjs` diff hunk: the old code was a single unconditional `ok(...)` call with no branching.
- The byte-identical happy-path assertion (task 2.2) **does pin the exact literal string** — I compared it character-for-character against the pre-change `ok(...)` argument in `git diff`; identical.
- **Real filesystem / live-entrypoint check**: `antigravity.test.mjs` tests `1.2` and `1.3` (new) do **not** inject `_writeGeminiSettings`, so `init()`'s real default writer runs against `_repoRoot: '/fake/repo'`. I reproduced this directly: `mkdirSync('/fake/repo/.gemini', {recursive:true})` throws `EACCES: permission denied, mkdir '/fake/repo'` on this machine (no `/fake` directory exists, and this user cannot write to `/`), so the attempted write fails safely and is caught by `init()`'s own `try/catch` (`geminiWritten` becomes `false`, which neither test asserts on, so it doesn't affect their pass/fail). **This is not new**: `git show origin/main:brain/scripts/harness/backends/antigravity.test.mjs` shows the pre-existing tests `2.1` and both `2.3` cases already used `_repoRoot: '/fake/repo'` without injecting `_writeGeminiSettings` — tasks `1.2`/`1.3` explicitly "reuse test 2.3's fixture" (tasks.md) and inherited the same pattern. The ONE test that WAS given a fake writer to stop this side effect is `2.1`, per apply-progress deviation 4 — and I confirmed that fix is real (`_writeGeminiSettings: () => {}` added at `antigravity.test.mjs:176`) and does not weaken any assertion (it only makes the happy-path fixture actually behave like a happy path so `geminiWritten: true` can be asserted truthfully). Tests `1.2`/`1.3` were not part of that fix and still touch the real filesystem at a path outside any temp dir, on every run, in a way that fails only because of ambient permissions rather than because the test is hermetic by construction. Flagged as a **SUGGESTION** below, not new to this change, and not something that changes any test's pass/fail today.
- No test spawns a live entrypoint outside `brain-upgrade.test.mjs`'s existing `spawnSync(node, BRAIN_UPGRADE_SCRIPT, {cwd: dir})` pattern (pre-existing, and confined to `mkdtempSync(tmpdir())` directories with `t.after(() => rmSync(dir, {recursive:true,force:true}))` cleanup). No test touches the real `.git`.

### 4. The sweep

Re-read `brain-upgrade.mjs` end to end myself (not just trusting apply-progress's claim). Every `ok(...)` call site:
- `brain-upgrade.mjs:103,107` (recover) — gated on `result.restored.length`/`result.removed.length` counts computed just above, not behind a swallowed catch.
- `brain-upgrade.mjs:443,446` (install) — gated directly on `r.status !== 0`/`rf.status !== 0` checks that `die()` on failure; `ok()` is only reached on the success path of an explicit status check, not a try/catch that discards a thrown error.
- `brain-upgrade.mjs:596,598` (copy) — the whole `copyManaged(...)` call is wrapped in a `try { … } catch (err) { … die(...) }` (`:472-520`) whose every branch calls `die()` (which exits), so control can never fall through to the `ok()` calls after a failure — verified by reading the full catch block, not assuming.
- `brain-upgrade.mjs:632,638` (config migration) — gated on `applied.length`/an explicit up-to-date check, no swallowed catch precedes them.
- `brain-upgrade.mjs:690` (the one this change fixes) — was the only instance of an unconditional claim following code that could silently no-op on failure.

I independently confirm apply-progress's claim: **only the one instance existed**, and it is the one this change fixes.

**Other harness backends**: checked `plain.mjs` and `gentle-ai.mjs`.
- `plain.mjs`'s `init()` has no try/catch and no fallible operation behind its output — not applicable.
- `gentle-ai.mjs`'s `init()` (`:251-320`) already gets this right: every fallible step (`_runDoctor`, `_runInstall`, `_refreshRegistry`) is wrapped in a `try { x = fn() } catch { /* treat as unhealthy/failed */ }` that sets an explicit boolean BEFORE the corresponding `console.log`/`console.warn` branches on that boolean — i.e., it already distinguishes "ran and failed" from "succeeded" at the point of the claim. It does not share this defect shape.

Task's premise ("look for the same shape in the other harness backends") is answered: **no**, neither `plain.mjs` nor `gentle-ai.mjs` has the swallow-then-claim shape; `gentle-ai.mjs` was already written correctly.

### 5. Spec/design fidelity, `geminiWritten`

- Interface (`InitReport` shape) matches `antigravity.mjs`'s actual return exactly, field-for-field.
- `geminiWritten` is not dead weight: it is independently exercised by `antigravity.test.mjs:214` (`1.4`), and `brain-upgrade.mjs` legitimately never branches on it because it always passes a no-op `_writeGeminiSettings` — a real, previously-documented reason (neutralizing the seam so `init()` can't re-clobber the `.gemini/settings.json` merge `brain-upgrade.mjs` just performed). Matches design's own stated rationale; verified by reading `brain-upgrade.mjs:679` and confirming the no-op is indeed passed on every call.
- The one design deviation worth independent scrutiny — branch order (write-failure checked first, ahead of `missingDocs`) — I confirmed is REQUIRED by `spec.md`'s own text ("regardless of `missingDocs`"), not merely a stylistic choice; the tasks.md literal enumeration order would have produced spec-non-compliant code if implemented as a naive if/else-if chain in the listed order. This is a correct, spec-driven deviation, not a coherence gap.

## Coherence (Design)

| Decision | Followed? | Notes |
|---|---|---|
| Additive report object, not `{ ok: false }` | ✅ Yes | No `ok` field anywhere in the returned object; proven by `1.5` and by direct `cli.mjs` reading above |
| Track `agentsWritten`, not just `missingDocs` | ✅ Yes | Both tracked and both used in `brain-upgrade.mjs`'s branching |
| `geminiWritten` returned for symmetry, unused by `brain-upgrade.mjs` | ✅ Yes | See analysis above |
| Export `REGENERATE_HINT` | ✅ Yes | `antigravity.mjs:63`; consumed via the existing dynamic `import()` in `brain-upgrade.mjs`, a reasonable deviation from "static import" (documented, smaller diff, preserves lazy-load intent) |

## Strict TDD Compliance

| Check | Result | Details |
|---|---|---|
| TDD Evidence reported | ✅ | `apply-progress.md`'s TDD Cycle Evidence table, RED/GREEN/TRIANGULATE/REFACTOR columns filled |
| All tasks have tests | ✅ (tasks as planned) | But tasks.md itself under-planned one spec scenario — see CRITICAL |
| RED confirmed | ✅ | Verified against `git show origin/main:...` pre-change source for both files |
| GREEN confirmed | ✅ | 27/27, 21/21, 6342/6342 all independently reproduced in this session |
| Triangulation adequate | ✅ | 4 distinct failure-combination cases in `antigravity.test.mjs` (`1.2`-`1.5`) |
| Safety Net for modified files | ✅ | Apply-progress reports baseline green (23/23, 20/20) before RED |

**TDD Compliance**: 5/6 — the process was followed faithfully for every task that existed, but the task list itself did not enumerate a test for one spec scenario, so "TDD done right" for the tasks as written does not equal "spec fully covered."

## Governed Diff

```
$ git diff --numstat origin/main...HEAD -- . ':(exclude)**/*.test.mjs' ':(exclude).memory/**' ':(exclude)openspec/**' ':(exclude)AGENTS.md'
20      3       brain/scripts/brain-upgrade.mjs
14      2       brain/scripts/harness/backends/antigravity.mjs
```
2 files, 34 insertions(+), 5 deletions(-) — 39 governed changed lines. Matches `apply-progress.md`'s own reported figures exactly. Well inside the 400-line review budget; no chained PRs warranted regardless of the CRITICAL finding above (the fix is additive: one new test).

## Issues Found

**CRITICAL**:
1. Spec scenario "A different source doc is missing" (Requirement: "brain-upgrade's Regen Claim Matches the Report") has **zero covering test** anywhere in the repo. The implementing line (`brain-upgrade.mjs:695`) is new code with no runtime proof it does what it claims. `tasks.md` never planned this test. Fix: add a `brain-upgrade.test.mjs` case that omits a non-HOME methodology doc and asserts the "compiled without N missing source doc(s)" wording, with the byte-identical line absent.

**WARNING**:
1. Spec scenario "The AGENTS.md write itself failed," at the `brain-upgrade.mjs` wording level (as opposed to the `antigravity.mjs` `init()` level, which IS tested), also has no `runBrainUpgrade()`-level test, contrary to the design's Testing Strategy table which promised "`brain-upgrade.mjs` wording per scenario" for all four scenarios. Lower severity than the CRITICAL above because the reading branch has no additional logic to get wrong (a direct, unguarded boolean check), but it is the same category of gap.

**SUGGESTION**:
1. `antigravity.test.mjs` tests `1.2` and `1.3` (new) do not inject `_writeGeminiSettings` and so attempt a real `mkdirSync`/`writeFileSync` against `/fake/repo/.gemini/settings.json` on every run. It currently fails safely (`EACCES` on this machine, caught internally by `init()`), but this is incidental to ambient filesystem permissions, not to the test being hermetic by construction. This pattern is inherited from pre-existing tests `2.1`(pre-change)/`2.3` and was NOT introduced by this change, and one instance of it (`2.1`) was correctly hardened by this change's own deviation 4 — but `1.2`/`1.3` still carry it. Not blocking; worth a follow-up to inject the no-op writer everywhere `/fake/repo` is used.
2. `evidence_revision`'s derivation is a manual convention (same one used in `openspec/changes/archive/936/verify-report.md`), not a `gentle-ai`-issued digest. Prefer a dedicated command's evidence digest if one ships for non-runtime-bearing manual verify passes.

## Verdict

**FAIL** — 3/4 spec requirements and 8/9 scenarios map to passing runtime tests; all 12/12 tasks-as-written are complete; `npm test` is 6342/6342 green; both build gates pass with zero side effects; the implementation itself is minimal, additive, and I found no case where its new wording overclaims what happened on disk. The one CRITICAL is a coverage gap, not a functional defect: one spec-required scenario ("a different source doc is missing") was never planned into `tasks.md` and has no covering test anywhere in the repo, so per strict-TDD rules it cannot be marked spec-compliant on inspection alone. Recommended: add the missing test (small, additive, does not touch shipped code), then re-run this verify pass — expected to clear to PASS once that scenario has runtime evidence, since the underlying branch already reads as correct.
