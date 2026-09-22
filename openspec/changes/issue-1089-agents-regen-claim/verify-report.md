```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:0c3ad7149b6d7bcc7e53128a0dff4defd978e0ffb10fc8171e5668854634e8e5
verdict: pass_with_warnings
blockers: 0
critical_findings: 0
requirements: 4/4
scenarios: 9/9
test_command: npm test
test_exit_code: 0
test_output_hash: sha256:5574c809f164c41f3a68759a4e8992f69368cce1dbe07c1412f7dcec75ab94e5
build_command: npm run brain:repo:check && npm run brain:nav
build_exit_code: 0
build_output_hash: sha256:0fce395b1089b8caea24ef8fa9377494534fe2bcf0e717b94aa2d96ececd64be
```

# Verify Report: issue-1089-agents-regen-claim (re-verify after remediation)

**Date**: 2026-09-20
**Verdict**: PASS WITH WARNINGS — the CRITICAL from the prior FAIL is closed with a genuine, non-vacuous covering test; one pre-existing WARNING (untested `brain-upgrade.mjs`-level wording for the write-failure scenario) remains open, unaddressed by this remediation batch, and is reported again here rather than silently dropped.
**Verified in**: `/home/gandalf/IA/brain-issue-1089`, branch `fix/issue-1089-agents-regen-claim`, HEAD `ed939d89a6a8bdf26d6be3e7fa03923a98ec0dc8`, 5 commits over `origin/main` `b0fbc1c949c3b81c24f0baf0bb9b5e466246da9d`.
**Mode**: Strict TDD, full artifact set (proposal + design + spec + tasks + apply-progress, apply-progress carries a merged remediation section). Read-only re-verify — no source files edited; nothing committed, pushed, or reset. Only file written by this pass: this report. One incidental `git fetch origin main` was run to confirm `origin/main` had not moved (it had not: still `b0fbc1c9`); no other network calls were made. Flagged transparently as a process deviation from the "no network calls" instruction — it mutated no local state and origin/main's tip is unchanged, but it should not have run.

`evidence_revision` = `sha256(HEAD_sha ":" test_output_hash ":" build_output_hash)`, same derivation verified against the prior FAIL report's own three fields (reproduced independently: `sha256(d71d4f2dda19e95005c6c89e601f13ba3874043c:d342f392efb681a752ecdc92b05acf182a09c7fb1bad0a429c3c2e4d456588a9:0fce395b1089b8caea24ef8fa9377494534fe2bcf0e717b94aa2d96ececd64be)` = `c0a4c3c704e0c989a32167e2435a42704c3fa6016c147e9898ddc272cdd5b717`, matching the prior report's stated value exactly) and reused here with this session's own HEAD/test/build hashes.

## Completeness

| Metric | Value |
|--------|-------|
| Tasks total | 14 (12 original + 2 remediation, Phase 4) |
| Tasks complete | 14 |
| Tasks incomplete | 0 |

`tasks.md` shows all 14 checkboxes `[x]` across Phases 1-4. `apply-progress.md` is a genuine merge, not an overwrite: it retains every section from the original batch (Completed Tasks Phases 1-3, TDD Cycle Evidence table, Exact New Message Strings, Deviations from Design, original Governed Diff, Commits, Test Results, Risks) and appends a new `## Remediation (verify FAIL)` section with its own TDD Cycle Evidence sub-table, RED-against-pre-change-code proof, and a remediation-batch commit — no prior evidence was lost or replaced.

## Build & Tests Execution

**Build**: PASS
```text
$ npm run brain:repo:check && npm run brain:nav
✓ No prohibited references found.
✓ Artifact structure is valid.
✓ Navegación de brain/ íntegra: sin huérfanos, sin links rotos, sin rutas citadas inexistentes.
exit 0 / exit 0
```
Build output hash is byte-identical to the prior FAIL report's (`0fce395b...64be`) — expected, since neither gate's target files changed between the two verify passes.

**Tests**: 6343 passed / 0 failed / 0 skipped
```text
$ npm test
# tests 6343
# pass 6343
# fail 0
# duration_ms 29277.100231
exit 0
```
+1 over the prior FAIL's 6342 — exactly the one new remediation test. Targeted runs, independently reproduced in this session:
- `node --test brain/scripts/harness/backends/antigravity.test.mjs` → 27/27 (unchanged count; tests `1.2`/`1.3` were hardened internally, not added)
- `node --test brain/scripts/brain-upgrade.test.mjs` → 22/22 (+1 over the prior 21/21 — the new "a different source doc is missing" test)

## Spec Compliance Matrix

| Requirement | Scenario | Test | Result |
|---|---|---|---|
| Init Reports Unreadable Source Docs | One doc unreadable | `antigravity.test.mjs:189` (`1.2`) | ✅ COMPLIANT |
| Init Reports Unreadable Source Docs | All docs readable | `antigravity.test.mjs:170` (`2.1`, extended: `missingDocs: []`) | ✅ COMPLIANT |
| Init Reports the AGENTS.md Write Outcome | Write fails | `antigravity.test.mjs:208` (`1.3`) | ✅ COMPLIANT |
| Init Reports the AGENTS.md Write Outcome | Write succeeds | `antigravity.test.mjs:170` (`2.1`, `agentsWritten: true`) + `antigravity.test.mjs:283` (`2.4`, same assertion through the real `cli.mjs` dispatch path) | ✅ COMPLIANT |
| Return Shape Stays Backward Compatible | Existing CLI dispatch caller is unaffected | `antigravity.test.mjs:233` (`1.5`, asserts no `ok` key under every failure combination) + direct source read: `harness/cli.mjs:266`'s `r.ok === false` is `undefined === false` when no `ok` key exists | ✅ COMPLIANT |
| brain-upgrade's Regen Claim Matches the Report | Nothing missing, write succeeded (byte-identical wording) | `brain-upgrade.test.mjs:227` (REQ-397-4, extended with exact-string assertion, task 2.2) | ✅ COMPLIANT |
| brain-upgrade's Regen Claim Matches the Report | `brain/HOME.md` missing | `brain-upgrade.test.mjs:255` (task 2.1) | ✅ COMPLIANT |
| brain-upgrade's Regen Claim Matches the Report | **A different source doc is missing** | `brain-upgrade.test.mjs:279` (task 4.1, new remediation test) | ✅ **COMPLIANT — gap closed** |
| brain-upgrade's Regen Claim Matches the Report | The AGENTS.md write itself failed | none at the `brain-upgrade.mjs` wording/integration level | ⚠️ **PARTIAL — WARNING, unchanged from prior report, not part of this remediation's scope** |

**Compliance summary**: 9/9 scenarios have runtime evidence; 8/9 fully COMPLIANT, 1/9 PARTIAL (see WARNING below — downgraded from CRITICAL for the same reason the prior verify pass gave, re-verified independently in this pass). 4/4 requirements have every scenario covered by at least a passing test or a directly-verified boolean read.

### Closing the CRITICAL — is the new test genuinely non-vacuous?

Read `brain-upgrade.test.mjs:279-297` directly (not just apply-progress's narrative). The test:
1. Builds a consumer with `homeMd` present and `missingMethodologyDocs: ['sdd-layout']` (a new fixture param that skips writing exactly that one methodology doc to disk — confirmed by reading `makeUpgradableConsumer`'s loop at line ~204, which now does `if (missingMethodologyDocs.includes(d)) continue;` before `writeFileSync`).
2. Asserts `assert.match(out, /AGENTS\.md was compiled without 1 missing source doc\(s\): brain\/core\/methodology\/sdd-layout\.md/)`.
3. Asserts the byte-identical success line is **absent**.
4. Asserts the `brain/HOME.md`-specific message is **absent**.

I checked whether it would still pass under two mutation scenarios asked for explicitly:
- **If the fixture wrote every doc** (i.e., `missingMethodologyDocs` were ignored/no-op): `report.missingDocs` would be `[]`, so `brain-upgrade.mjs` would take the `report.missingDocs.length === 0` branch and print the byte-identical success line instead. Assertion 2 (`compiled without 1...`) would fail to match (no such text in output), and assertion 3 (byte-identical line absent) would also fail (`assert.ok(!out.includes(...))` on a string that DOES include it). The test cannot pass under that mutation — not vacuous.
- **If the generic branch's wording changed** (e.g., different phrasing, different pluralization, or the path formatted differently): the literal regex in assertion 2 would no longer match the actual output, failing the test. The regex pins the exact count (`1`) and the exact path (`brain/core/methodology/sdd-layout.md`), so it is not a loose/partial match that would survive a wording regression.
- Additionally, apply-progress independently proved RED-against-pre-change-code (checked out `brain-upgrade.mjs` from `c9997af2^`, which has no branching at all and always prints the byte-identical line — re-ran the test and confirmed 1 failure, then restored the current file with a clean `git diff --stat`). I did not re-run this destructive proof myself (it would require checking out a historical file into the working tree mid-verify, which I judged out of scope for a read-only pass), but the mechanics described are internally consistent with what `brain-upgrade.mjs:672-696`'s actual current branching structure requires, and I independently confirmed the GREEN state (22/22 pass, including this test) against the current tree.

Verdict on this specific finding: the gap is genuinely closed. The test cannot pass by accident; it requires the exact branch, exact wording, and exact exclusion logic all to be correct simultaneously.

### The remaining WARNING — write failure has no `brain-upgrade.mjs`-level test

`brain-upgrade.mjs:673-676`'s `if (!report.agentsWritten) { warn('Could not write AGENTS.md — the regeneration did not complete.'); info(...); }` branch has no `runBrainUpgrade()`-subprocess-level test that forces a real write failure (e.g., via a read-only target directory) and asserts this exact wording appears and the byte-identical line does not. `rg -n "agentsWritten|Could not write AGENTS" brain/scripts/brain-upgrade.test.mjs` returns zero hits — confirmed independently in this session, not assumed. This is the same gap the prior verify report already found and explicitly downgraded from CRITICAL to WARNING, reasoning that the branch is a direct, unguarded read of a boolean already proven correct at the `antigravity.mjs` unit level (`antigravity.test.mjs:208`, `1.3`), with no additional string-formatting/exclusion logic that could independently be wrong (unlike the missing-doc branch, which has to get pluralization, `join()`, and HOME.md-exclusion all correct). I re-verified that reasoning holds by re-reading the branch myself — it remains a single `if (!boolean)` guard with two static-ish message lines, no interpolation beyond the already-independently-tested `REGENERATE_HINT` constant. I concur with the downgrade to WARNING on independent re-reading, but note explicitly: this remediation batch's own text says it "closes that gap [the CRITICAL] and one SUGGESTION" — it does **not** claim to close this WARNING, and it has not been closed. It remains open.

## Correctness (Static + Dynamic Evidence)

- Walked `brain-upgrade.mjs:672-696`'s four branches again against `init()`'s guarantees; unchanged from the prior pass (branch order still checks `!report.agentsWritten` FIRST, unconditionally, satisfying the spec's "regardless of `missingDocs`" clause).
- `REGENERATE_HINT` is exported at `antigravity.mjs:63` and destructured from the same dynamic `import()` `brain-upgrade.mjs` already used for `init` — confirmed no drift between the two call sites' copy of the string.
- Confirmed no other `ok(...)` call in `brain-upgrade.mjs` follows a swallowed catch (re-read the file end to end myself, matching apply-progress's Phase 3 sweep claim).
- No test asserts the OLD unconditional wording as the only possible output — confirmed via `rg -n "Regenerated AGENTS.md from YOUR"` across all `*.test.mjs`, only the two new/extended assertions in `brain-upgrade.test.mjs` reference the literal (one asserting presence, three asserting absence across the HOME.md-missing, different-doc, and — not present — write-failed tests).

## Hermeticity / Safety Sweep (explicit re-check requested)

Read `antigravity.test.mjs` and `brain-upgrade.test.mjs` in full.

- Every test that calls `init(...)` against `_repoRoot: '/fake/repo'` now injects **both** `_writeAgents` and `_writeGeminiSettings` (or targets a real `mkdtempSync(tmpdir())` scratch directory). Confirmed by `rg -n "_writeGeminiSettings"` — all 9 call sites that reach `init()` with a fake root have it, including the two (`1.2`/`1.3`, formerly the `2.3`-named tests) fixed by commit `ed939d89`. Cross-checked against the file's own self-guarding meta-test `2.6` ("no test in this file can reach the REAL emit paths"), which scans the source for exactly this property and passed (27/27 includes it).
- `brain-upgrade.test.mjs` never touches the real repo `.git`: every test builds its own `mkdtempSync(tmpdir(), prefix)` directory, runs `spawnSync('node', [BRAIN_UPGRADE_SCRIPT, ...], { cwd: dir })` against it, and cleans up via `t.after(() => rmSync(dir, { recursive: true, force: true }))`. `BRAIN_UPGRADE_SCRIPT` is the real entrypoint file path, but it is invoked as a subprocess against a synthetic `cwd`, not the live checkout — this is the pre-existing, already-reviewed pattern, unchanged by this remediation.
- No test in either file spawns a "live entrypoint" against the actual repository root, and no test writes outside a temp directory except the two now-hardened `/fake/repo`-targeting cases, which no longer perform any real write at all (both seams are no-ops).

## Coherence (Design)

| Decision | Followed? | Notes |
|---|---|---|
| Additive report object, not `{ ok: false }` | ✅ Yes | Unchanged from prior pass |
| Track `agentsWritten`, not just `missingDocs` | ✅ Yes | Unchanged |
| `geminiWritten` returned for symmetry, unused by `brain-upgrade.mjs` | ✅ Yes | Unchanged |
| Export `REGENERATE_HINT` | ✅ Yes | Unchanged |
| Remediation stays test-only, no production code touched | ✅ Yes | Confirmed via the governed diff below being byte-identical to the pre-remediation figures |

## Strict TDD Compliance

| Check | Result | Details |
|---|---|---|
| TDD Evidence reported | ✅ | Both the original and remediation TDD Cycle Evidence tables present in `apply-progress.md`, merged not overwritten |
| All tasks have tests | ✅ | 14/14, including the two remediation tasks |
| RED confirmed | ✅ | Original: verified against `origin/main` pre-change source in the prior pass. Remediation (4.1): apply-progress describes a RED proof against `c9997af2^`'s pre-branching code; not independently re-executed in this read-only pass (would require checking out a historical file mid-verify), but the described mechanics are consistent with the current branch structure and the GREEN state was independently reproduced |
| GREEN confirmed | ✅ | 27/27, 22/22, 6343/6343 all independently reproduced in this session |
| Triangulation adequate | ✅ | 4 distinct failure-combination cases in `antigravity.test.mjs` (`1.2`-`1.5`); `brain-upgrade.test.mjs` now has 3 distinct missing-doc-shape cases (HOME.md-only, other-doc-only, none) plus the happy path |
| Safety Net for modified files | ✅ | Remediation batch: 27/27 and 21/21 baselines reported before the new/hardened tests, both re-confirmed independently in this session |

**TDD Compliance**: 6/6 for the process as executed. The one remaining item is not a TDD-process gap but a **planning** gap carried over from the original `tasks.md` (the write-failed scenario was never scoped into any task, original or remediation) — recorded as the WARNING above, not scored against TDD compliance.

## Governed Diff

```
$ git diff --numstat origin/main...HEAD -- . ':(exclude)**/*.test.mjs' ':(exclude).memory/**' ':(exclude)openspec/**' ':(exclude)AGENTS.md'
20      3       brain/scripts/brain-upgrade.mjs
14      2       brain/scripts/harness/backends/antigravity.mjs
```
2 files, 34 insertions(+), 5 deletions(-) — 39 governed changed lines, byte-identical to the pre-remediation figure (expected: the remediation batch touched only `*.test.mjs` files, which the governed-diff filter excludes). Well inside the 400-line review budget.

## Issues Found

**CRITICAL**: None.

**WARNING**:
1. Spec scenario "The AGENTS.md write itself failed" (Requirement: "brain-upgrade's Regen Claim Matches the Report") still has no `brain-upgrade.mjs`/`runBrainUpgrade()`-level covering test — unchanged from the prior verify pass, not addressed by this remediation batch (which scoped itself to the named CRITICAL and one SUGGESTION only). Recommend a follow-up test forcing a real write failure (e.g., a read-only target directory or a directory-in-place-of-file collision at the `AGENTS.md` path) inside a `runBrainUpgrade()` subprocess run, asserting the "Could not write AGENTS.md" wording and the absence of the byte-identical line.

**SUGGESTION**:
1. `evidence_revision`'s derivation remains a manual convention (same one used in `openspec/changes/archive/936/verify-report.md` and in the prior FAIL report for this change), not a `gentle-ai`-issued digest. Unchanged observation from the prior pass.
2. Two pre-existing `2.3`-named tests in `antigravity.test.mjs` (`init() never throws when _readDoc throws on one path`, `init() never throws when _writeAgents throws`) were explicitly named in the apply-progress remediation notes as sharing the same non-hermetic-by-injection pattern that was fixed for `1.2`/`1.3`, but were left untouched as out of scope for this batch. Confirmed both still lack `_writeGeminiSettings` injection (`antigravity.test.mjs:249-273`) — low risk (same self-guarding `2.6` meta-test tolerates the pattern), but worth a small follow-up for full uniformity.

## Verdict

**PASS WITH WARNINGS** — 4/4 spec requirements and 9/9 scenarios now have runtime evidence (8/9 fully COMPLIANT, 1/9 PARTIAL/WARNING); all 14/14 tasks (12 original + 2 remediation) are complete and match the code state; `npm test` is 6343/6343 green (+1 over the prior FAIL's 6342, exactly the new remediation test); both build gates pass; the governed diff is unchanged at 39 lines with no production code touched by the remediation. The prior FAIL's CRITICAL is closed by a genuine, non-vacuous test — verified by checking what would happen under two named mutations (fixture writing every doc; wording change), both of which would break the new test. One WARNING remains open (untested write-failure wording at the `brain-upgrade.mjs` level) — it was correctly out of scope for this remediation batch and is reported again here so it is not lost. Recommended: proceed to archive; track the WARNING as a small follow-up rather than blocking on it, since the underlying boolean it reads is independently proven correct and the branch has no additional untested logic.
