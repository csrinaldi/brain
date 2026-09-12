# Tasks: A Secret Policy That Cannot Be Read Is Not The Default Secret Policy (#712)

## Review Workload Forecast

| Field | Value |
|---|---|
| Estimated changed lines | ~104 (production only; tests + `openspec/changes/**` excluded by `governance.ignoreList`) |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR, `Closes #712` |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|---|---|---|---|
| 0 | Commit planning artifacts | PR 1 | docs-only, precedes code |
| 1 | `collect.mjs` refuses + `cli.mjs` comment (D5) | PR 1 | RED T-C1/T-C2, GREEN, one commit |
| 2 | `engram.mjs` refuses (both wiring points, D4) | PR 1 | RED T-E1/T-E2, GREEN, one commit |
| 3 | `plainfiles.mjs` refuses | PR 1 | RED T-P1/T-P2, GREEN, one commit |
| 4 | `lane-scrub.mjs` uncomputable arm | PR 1 | RED T-L1/T-L1b/T-L2/T-L3, GREEN, one commit |
| 5 | Mutation-table proof + full-suite verify | PR 1 | `apply-progress.md`, no code change |
| 6 | Epic tick + record-first closing commit | PR 1 | final commit |

## Phase 1: Planning Artifacts (docs commit, precedes code)

- [ ] 1.1 `git add openspec/changes/issue-712-config-scan-fail-closed/{proposal.md,design.md,tasks.md,specs/governance-v3/spec.md}`; commit `docs(sdd): plan #712 config-scan fail-closed (R1-R13 ratified)`. Verify: `git show --stat HEAD` lists exactly these 4 files.

## Phase 2: RED — `collect.mjs` (REQ-SCAN-1,3,4)

- [ ] 2.1 Add `lane/collect.integration.test.mjs::T-C1` — unparseable `brain.config.json` in `root` → `collectLane` throws matching `/brain\.config\.json/` and `/could not be parsed/`. Inject canned `git` seams (`fetch`, `rev-parse`, `worktree list`, `ls-tree`, `status`, per pattern at `:312,:343,:363`); do NOT inject `loadConfig`. Run `node --test lane/collect.integration.test.mjs` — confirm T-C1 fails pre-fix.
- [ ] 2.2 Add `T-C2` — no config → `collectLane` resolves, `result.ref` minted (R12). Same git seams.

## Phase 3: GREEN — `collect.mjs` + `cli.mjs` (D1, D5)

- [ ] 3.1 `memory/lane/collect.mjs` `_defaultLoadConfig`: replace `catch { return {} }` with `loadBrainConfigOrThrow(root)`, no catch; add import edge to `../../lib/brain-config.mjs`; docblock states the per-key direction rule (R1).
- [ ] 3.2 `memory/cli.mjs:365-366`: correct the stale comment ("everything else is a genuine git failure" is now false); `memory.collect.failed` string unchanged (R10, no i18n edit).
- [ ] 3.3 Run `node --test lane/collect.integration.test.mjs` — T-C1 and T-C2 green. Commit `fix(memory): lane collect refuses on unreadable brain.config.json (#712)` (3.1+3.2+tests). Verify: same command. Rollback: `git revert` this commit.

## Phase 4: RED — `engram.mjs` (REQ-SCAN-1,2,3,4)

- [ ] 4.1 Add `backends/engram.save.test.mjs::T-E1` — unparseable config in `root` → `save()` rejects with the primitive's message; assert `_appendRecord` never called. Inject `getGitConfig: () => 'valid-handle'`, `getBranch: () => 'main'`, fixed `getTimestamp`, `getEnv: () => ({})`, no-op `_appendRecord`/`_rebuildIndex`/`_hydrate`, `project: 'brain'`. Do NOT inject `_loadConfig`. Confirm fails pre-fix.
- [ ] 4.2 Add `T-E2` — no config → `save()` resolves, record written (R12). Same seams.

## Phase 5: GREEN — `engram.mjs` (D1, D4)

- [ ] 5.1 `memory/backends/engram.mjs` `_defaultLoadBrainConfig`: replace `catch { return {} }` with `loadBrainConfigOrThrow(root)`, no catch (hardens both wiring points, `:266` and `:939`). Add 2-line D4 docblock note: `:266`'s `dualWriteRecords` has no production caller (O1); hardening is deliberate and covered by T-E1 since it is the same function.
- [ ] 5.2 Run `node --test backends/engram.save.test.mjs backends/save-parity.test.mjs backends/engram.dualwrite-hydrated-gate.test.mjs backends/engram.upstream-scope.test.mjs` — T-E1/T-E2 green, injected-`_loadConfig` tests unaffected. Commit `fix(memory): engram save refuses on unreadable brain.config.json (#712)`. Rollback: revert commit.

## Phase 6: RED — `plainfiles.mjs` (REQ-SCAN-1,3,4,5)

- [ ] 6.1 Add `backends/plainfiles.save.test.mjs::T-P1` — unparseable config → `save()` rejects, `_appendRecord` never called. Seams as T-E1 minus `_hydrate`, plus `_readRecordIds`/`_upstreamRecordEntries` (reached only with `--supersedes`, injected for shape parity). Do NOT inject `_loadConfig`. Confirm fails pre-fix.
- [ ] 6.2 Add `T-P2` — no config → resolves (R12).

## Phase 7: GREEN — `plainfiles.mjs` (D1, R5)

- [ ] 7.1 `memory/backends/plainfiles.mjs` `_defaultLoadBrainConfig`: replace `catch { return {} }` with `loadBrainConfigOrThrow(root)`, no catch. Docblock notes `deriveProject` (`:127`) now refuses too (R5) — the read precedes both that and the scan use (`:213`).
- [ ] 7.2 Run `node --test backends/plainfiles.save.test.mjs backends/save-parity.test.mjs` — T-P1/T-P2 green, `:363,:382,:397` injected tests unaffected. Commit `fix(memory): plainfiles save refuses on unreadable brain.config.json (#712)`. Rollback: revert commit.

## Phase 8: RED — `lane-scrub.mjs` (REQ-SCAN-1,3,5,6)

- [ ] 8.1 Add `governance/lane-scrub.test.mjs::T-L1` — direct call `defaultReadConfig(tmpDir)` with an unparseable file → throws, message names the path. No injection (direct unit call). Confirm fails pre-fix (not yet exported/hardened).
- [ ] 8.2 Add `T-L1b` — `defaultReadConfig(tmpDir)` with no file → `{}` (R12). First-ever coverage of this reader — all 8 existing tests inject `readConfig`.
- [ ] 8.3 Add `T-L2` — `main({readConfig: throwing})` → exit 2, stdout matches `/uncomputable/` and `/cannot read the secret config/`. Inject `diffNameOnlyAdded: () => ['.memory/records/2026-09-x.jsonl']` (must match `LANE_PATH_RE`), `readFile: () => '{"clean":true}'`; `execFileSync` never reached. Confirm fails pre-fix (no try/catch exists yet).
- [ ] 8.4 Re-assert `T-L3` (existing `:159-171` test): `main({diffNameOnlyAdded: () => ['docs/x.md'], readConfig: counting})` never calls `readConfig`, after the new arm lands. Must stay green throughout — the R8 ordering proof.

## Phase 9: GREEN — `lane-scrub.mjs` (D2, D3, R8)

- [ ] 9.1 `governance/lane-scrub.mjs`: swap the `loadBrainConfig` import for `loadBrainConfigOrThrow`; export `defaultReadConfig(root)`, forwarding `root` (omitted → the primitive's own `REPO_ROOT` default, production call site at `:119` unchanged).
- [ ] 9.2 Insert a NEW try/catch wrapping `readConfig()` alone, between the `recordPaths.length === 0` early return (`:142-147`) and the pattern-compile block (`:161-173`); on throw return `{pass:false, uncomputable:true}`, reason `lane-scrub: cannot read the secret config — failing closed (uncomputable): {message}`. Do not fold into the existing compile try/catch (D2).
- [ ] 9.3 Run `node --test governance/lane-scrub.test.mjs` — T-L1, T-L1b, T-L2 green, T-L3 (8.4) still green. Commit `fix(governance): lane-scrub refuses as uncomputable on unreadable secret config (#712)`. Rollback: revert commit.

## Phase 10: Mutation Table Proof

- [ ] 10.1 Write `openspec/changes/issue-712-config-scan-fail-closed/apply-progress.md` with one row per reader — mutation, test that must die, proof-run command: M1 `collect.mjs`→T-C1 (`node --test lane/collect.integration.test.mjs`); M2 `engram.mjs`→T-E1 (`node --test backends/engram.save.test.mjs`); M3 `plainfiles.mjs`→T-P1 (`node --test backends/plainfiles.save.test.mjs`); M4 `lane-scrub.mjs` reader→T-L1 (`node --test governance/lane-scrub.test.mjs`); M5 delete the new try/catch at `:149`→T-L2, same file; M6 move the new arm above the early return→T-L3, same file. Note `engram.mjs:266` (`dualWriteRecords`) contributes no row — no production caller (O1/D4); its behaviour is M2's, same function.
- [ ] 10.2 Prove each row: revert exactly ONE reader to `catch { return {} }` (or the M5/M6 shape) at a time, re-run only the named test file, confirm exactly that test fails and nothing else in the suite regresses, then restore. Record actual pass/fail output in `apply-progress.md`.

## Phase 11: Full Verification and Closing

- [ ] 11.1 Run the full suite `node --test` — all green; `i18n/coverage.test.mjs` untouched (no new keys, R10).
- [ ] 11.2 Confirm line budget: `git diff --stat main...HEAD -- '*.mjs' ':(exclude)*.test.mjs'` ≈104 production lines, well under 400.
- [ ] 11.3 Tick epic task 4.3 in `openspec/changes/issue-864-memory-2-0/tasks.md` (`- [ ] 4.3 #712 …` → `- [x]`). Commit together with `apply-progress.md`: `docs(sdd): #712 fail-closed — mutation table proven, epic 4.3 landed`.
- [ ] 11.4 Record-first closing commit: run `npm run memory:save -- "<title>" "<content>" --issue 712 --type decision` (positionals per #928); parse the `rec-*` id from stdout; stage ONLY that new record file under `.memory/records/` and `.memory/index.jsonl`; verify exactly one net-new id (`git diff --stat` shows one new record file + one index delta); commit `chore(memory): record #712 fail-closed decision`.
