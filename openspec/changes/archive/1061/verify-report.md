```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:99083298d6a68d57f27dbac6b2ed2a2db4740b3de37d2d7e7712ef4e1f7a879b
verdict: pass
blockers: 0
critical_findings: 0
requirements: 5/5
scenarios: 10/10
test_command: npm test
test_exit_code: 0
test_output_hash: sha256:7819880ef8d04af98d764797c5568e378e6e1be7b5755c53b5bf6ae4d1278116
build_command: npm run brain:repo:check && npm run brain:nav
build_exit_code: 0
build_output_hash: sha256:5d349d135d140a7dbd5ff1e0f5dfe706481d9ce03ffdde3a35163ae96e7c343c
```

# Verify Report: issue-1061-engram-duplicate-heal (POST-MERGE)

**Date**: 2026-09-19
**Verdict**: PASS
**Verified in**: `/home/gandalf/IA/brain-issue-1061-archive` (branch `docs/issue-1061-archive`, clean checkout of `origin/main` @ `c061b2a7`, containing PR #1063's squash-merge)
**Mode**: full artifact set (proposal + design + tasks + apply-progress + specs delta `memory-backend`) · read-only verify, no source files modified. `git status --porcelain` was empty before and after every command.

## Summary

Post-merge verification preceding archive. Issue #1061 / PR #1063 (memory 2.0 task 1.2a) is
fully merged to `main` at `c061b2a7`. All 14/14 agent tasks in `tasks.md` are checked, and
`apply-progress.md` documents Batch 1 (14 tasks) plus Batch 2 (cold-review remediation: 2
MAJOR + 2 MINOR + 1 NIT-pair), all resolved with RED-first evidence.

All 5 spec requirements (REQ-MB-1..5) and all 10 scenarios in
`openspec/changes/issue-1061-engram-duplicate-heal/specs/memory-backend/spec.md` map to
implemented code (`brain/scripts/memory/lib/engram-heal.mjs`,
`brain/scripts/memory/backends/engram.mjs`'s `healDuplicates`/`HEAL_DELETE_ARGS`,
`brain/scripts/memory/cli.mjs`'s `heal-duplicates` op) and to passing runtime tests. The
4 dedicated heal test files (`engram-heal.test.mjs` 15, `engram.heal.test.mjs` 12,
`cli.heal-duplicates.test.mjs` 8, `engram.heal.integration.test.mjs` 3 — the integration file
ran unskipped against the real engram 1.20.0 binary) total 38/38 passing, confirmed by a
fresh isolated `node --test` run in this checkout. The full repo suite is 6085/6085, matching
`apply-progress.md`'s Batch 2 count exactly.

The maintainer's Post-Merge Runbook (R.1–R.8, #1061 comment thread) is independently
confirmed: the live `MEMORY_BACKEND=engram npm run brain:memory:audit` re-run in this session
reads `backend engram export · rows 2448 · distinct 2448 · duplicated 0`, matching the
"after" state posted on the issue and the second dry-run's `memory.heal.none`. Zero CRITICAL,
zero WARNING. Three SUGGESTIONs carried forward, all pre-existing/documented/out-of-scope per
`tasks.md`'s Notes section and `design.md`'s Open Questions.

## Completeness

| Metric | Value |
|--------|-------|
| Tasks total | 14 |
| Tasks complete | 14 |
| Tasks incomplete | 0 |

`tasks.md` shows all 14 agent-task checkboxes `[x]` across Phase 1 (1.1–1.4), Phase 2
(2.1–2.6), Phase 3 (3.1), and Phase 4 (4.1–4.3). The Post-Merge Runbook (R.1–R.8) is
explicitly a maintainer-only, Tier 2, post-merge item — not an agent task, and not counted
against completeness. `apply-progress.md` corroborates with matching per-task TDD evidence
(RED/GREEN/TRIANGULATE/REFACTOR) for every task with a test.

## Build & Tests Execution

**Build**: PASS
```text
$ npm run brain:repo:check
> node ./brain/scripts/check-refs.mjs
✓ No prohibited references found.
✓ Artifact structure is valid.

$ npm run brain:nav
> node ./brain/scripts/check-brain-nav.mjs
✓ Navegación de brain/ íntegra: sin huérfanos, sin links rotos, sin rutas citadas inexistentes.
(exit 0)
```

**Tests**: 6085 passed / 0 failed / 0 skipped
```text
$ npm test
1..6085
# tests 6085
# pass 6085
# fail 0
# cancelled 0
# skipped 0
# todo 0
(exit 0)
```

**Focused heal suite** (independent re-run in this checkout, isolated from the full-suite run):
```text
$ node --test brain/scripts/memory/lib/engram-heal.test.mjs \
    brain/scripts/memory/backends/engram.heal.test.mjs \
    brain/scripts/memory/cli.heal-duplicates.test.mjs \
    brain/scripts/memory/backends/engram.heal.integration.test.mjs
1..38
# tests 38
# pass 38
# fail 0
# cancelled 0
# skipped 0
(exit 0)
```
38 = 15 (`engram-heal.test.mjs`) + 12 (`engram.heal.test.mjs`) + 8 (`cli.heal-duplicates.test.mjs`,
4 Batch 1 + 4 Batch 2 cold-review additions) + 3 (`engram.heal.integration.test.mjs`, unskipped —
the real engram 1.20.0 binary was available and in the tested range). Exactly matches
`apply-progress.md`'s Batch 2 per-file counts.

**Coverage**: not tracked as a percentage gate in this repo; behavioral coverage is
demonstrated per-scenario in the Spec Compliance Matrix below. ➖ Not applicable.

## Spec Compliance Matrix

| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| REQ-MB-1 | two rows, one key | `lib/engram-heal.test.mjs` (ordering / lowest-id keeper cases) | ✅ COMPLIANT |
| REQ-MB-1 | non-record keys are ignored | `lib/engram-heal.test.mjs` (non-`rec-` key case) | ✅ COMPLIANT |
| REQ-MB-2 | dry-run on the measured store | `lib/engram-heal.test.mjs` (3 measured pairs → `[3092,3093,3094]`) + live evidence (dry-run posted on #1061 listed exactly those ids; audit re-run this session confirms healed state) | ✅ COMPLIANT |
| REQ-MB-3 | divergent copies refuse | `lib/engram-heal.test.mjs` (content/title/type divergence cases) + `backends/engram.heal.test.mjs` (divergent refusal) + `cli.heal-duplicates.test.mjs` (divergent refusal via shim) | ✅ COMPLIANT |
| REQ-MB-3 | more than two rows refuse | `lib/engram-heal.test.mjs` (`tooMany` case) + `backends/engram.heal.integration.test.mjs` T-INT-3 (3 live rows, real binary) | ✅ COMPLIANT |
| REQ-MB-3 | unrecognized export shape refuses | `lib/engram-heal.test.mjs` (shape cases, missing `id`/`content`/`title`/`type`, `observations` not array/null) + `backends/engram.heal.test.mjs` (count-mismatch shape refusal) | ✅ COMPLIANT |
| REQ-MB-3 | untested engram version refuses before any export/delete | `lib/engram-heal.test.mjs` (`parseEngramVersion`/`isTestedVersion` for `1.20.0` in-range, `2.0.0` out, garbage → null) + `backends/engram.heal.test.mjs` (version-outside-range / absent-probe → no export, no delete calls) | ✅ COMPLIANT |
| REQ-MB-4 | apply removes the duplicate | `backends/engram.heal.test.mjs` (apply+verify → `healed`, ascending one-at-a-time delete with `HEAL_DELETE_ARGS`) + `backends/engram.heal.integration.test.mjs` T-INT-1 (real hard-delete, `.memory/` untouched) + `cli.heal-duplicates.test.mjs` Batch-2 `--apply` test (exit 0, correct id named) | ✅ COMPLIANT |
| REQ-MB-4 | second apply is a no-op | `backends/engram.heal.test.mjs` (second-run 0 deletes) + `backends/engram.heal.integration.test.mjs` T-INT-1 (second apply no-op against real binary) + `cli.heal-duplicates.test.mjs` Batch-2 test (second `--apply` → `memory.heal.none`) | ✅ COMPLIANT |
| REQ-MB-5 | audit confirms the heal | `backends/engram.heal.integration.test.mjs` (post-apply `distinct = rows` against the real binary) + live evidence: this session's `MEMORY_BACKEND=engram npm run brain:memory:audit` reads `rows 2448 · distinct 2448 · duplicated 0`, matching the maintainer's posted "after" state and second-run `memory.heal.none` | ✅ COMPLIANT |

**Compliance summary**: 10/10 scenarios compliant.

## Correctness (Static Evidence)

| Requirement | Status | Notes |
|------------|--------|-------|
| REQ-MB-1 (planner: group by `topic_key`, `rec-` prefix, lowest-id keeper) | ✅ Implemented | `lib/engram-heal.mjs` `planDuplicateHeal` |
| REQ-MB-2 (dry-run by default) | ✅ Implemented | `cli.mjs:728-806` `heal-duplicates` block; no `--apply` ⇒ plan-only branch |
| REQ-MB-3 (refusals delete nothing) | ✅ Implemented | planner's `refused: 'divergent'\|'tooMany'\|'shape'` + version guard (`TESTED_ENGRAM = {major:1,minor:20}`) in `engram.mjs:1490-1520` |
| REQ-MB-4 (apply deletes only non-keeper rows via the backend, ascending, stop-on-first-failure) | ✅ Implemented | `healDuplicates` delete loop `engram.mjs:1563-1623`; `HEAL_DELETE_ARGS(id)` = `['delete', String(id), '--hard']` |
| REQ-MB-5 (post-apply verification) | ✅ Implemented | `healDuplicates`'s re-export + re-plan verify step; live audit confirms |

## Coherence (Design)

| Decision | Followed? | Notes |
|----------|-----------|-------|
| Planner in `lib/engram-heal.mjs`, executor `healDuplicates` in `backends/engram.mjs` | ✅ Yes | Matches `design.md`'s architecture table |
| Dedicated `if (op === "heal-duplicates")` block before `selectBackend`, refusing `memory.heal.notEngram` off-engram | ✅ Yes | `cli.mjs:728` |
| `--apply` only; any other flag refused `memory.heal.badFlag` | ✅ Yes | `cli.mjs:736` |
| Exit 0 for none/planned/healed; exit 1 for every refusal/partial/unverified | ✅ Yes | `cli.mjs:772-806` |
| No `MANAGED_SCRIPT_KEYS` entry (matches `split-records`/`migrate-v1` precedent) | ✅ Yes | `package.json:88`; `managed-script-keys-doctrine.test.mjs` stayed green per `apply-progress.md` |
| Hard delete (`--hard`), not soft, per the orchestrator's T-INT-0 measurement | ✅ Yes | `HEAL_DELETE_ARGS` in `engram.mjs:1519` |
| Batch 2 cold-review additions (try/catch defense-in-depth, CLI `--apply` coverage, delete-loop rationale comment, spec's explicit version-refusal scenario, NIT cleanups) | ✅ Yes | All 5 items documented with RED-first (or revert-then-restore) evidence in `apply-progress.md`'s Batch 2 section; confirmed present in `cli.mjs`/`engram.mjs`/spec.md in this checkout |
| Governance budget (`lite` tier, 1000 governed lines) | ✅ Yes | `apply-progress.md` records final governed diff 447/1000; the tasks.md forecast's "400-line" label was the generic SDD guard, corrected mid-Batch-2 |

## Guards (this verification session)

Lane-safety and store-safety guards, before/after `npm test`:

```text
BEFORE                                                          AFTER
git ls-remote origin 'refs/heads/memory/*':
  a2326871…  memory/gandalf-…-2026-09-18                        (identical)
  1a21ee96…  memory/gandalf-…-2026-09-19                        (identical)
gh pr list (open):
  1064 memory/gandalf-…-2026-09-19                               (identical)
  1058 fix/issue-1026-fixtest-engrampulltestmjs-reindexes-the    (identical)
  1050 memory/gandalf-…-2026-09-18                               (identical)
git rev-parse --is-shallow-repository: false                     false
engram projects list: 7 projects, brain=3486 obs                 7 projects, brain=3486 obs
  (issue-1061-heal-it never appears in either list)
```

`diff` of the full before/after guard capture is byte-identical except for the
`BEFORE`/`AFTER` label line itself — no new memory-lane ref, no new open PR, repository stayed
non-shallow, and the real engram store's `brain` project observation count did not move
(no test-project leakage into the real store).

## Live Evidence Re-Run (read-only)

```text
$ MEMORY_BACKEND=engram npm run brain:memory:audit
records      lines 2423 · distinct 2421 · excess 2 · repeated rec-4a22e13fd3c3aebd×2 rec-95740755792f0f1c×2
backend      engram export · rows 2448 · distinct 2448 · duplicated 0
```

This matches the maintainer's posted "after" line on #1061 (`rows 2448 · distinct 2448 ·
duplicated 0`) exactly, and confirms the second dry-run's `memory.heal.none` result held.
`git status --porcelain` was empty before and after this command — no source file was
touched.

## Issues Found

**CRITICAL**: None

**WARNING**: None

**SUGGESTION** (carried forward, out of scope for this change, not blocking archive):
1. The `records` layer of `brain:memory:audit` counts a soft-deleted row as live (excess 2:
   `rec-4a22e13fd3c3aebd`×2, `rec-95740755792f0f1c`×2). This is the record-layer excess,
   explicitly out of scope for this heal (ADR-0017, ties to epic #864 task 1.2a's follow-up
   task 6.1) — the audit line the maintainer must read for this heal's own acceptance is the
   `backend` line, which is `rows = distinct = 2448`.
2. `tasks.md`'s Notes section flags that epic #864 task 6.1 must state its "distinct = rows"
   criterion measures backend rows, not `.memory/records/` — a documentation follow-up for
   that task, not this change.
3. engram 2.0.0 is available (`engram projects list` shows an update banner) but the heal's
   version guard (`TESTED_ENGRAM = {1,20}`) refuses anything outside `1.20.x`, including
   2.0.0, by design — widening the range is explicitly deferred to a future code change plus
   re-run of the T-INT integration suite (`design.md`'s Architecture Decisions table).

## Verdict

**PASS**

All 14/14 tasks complete, all 5/5 spec requirements and 10/10 scenarios compliant with
passing runtime tests (38/38 focused, 6085/6085 full suite, exit 0), build proxy green (exit
0), lane/PR/shallow/real-store guards byte-identical before and after, and live maintainer
evidence on #1061 independently reconfirmed by a read-only audit re-run in this session. Zero
CRITICAL, zero WARNING. Ready for `sdd-archive`.

## Validator Output

```text
$ gentle-ai sdd-verify-validate --input <this report> --requirements 5 --scenarios 10
{"state":"valid"}
```

## Native Attempt Settlement

```json
// acquire
{"state":"proceed","token":"sha256:79b6c4d2dc2c69aa83c12719662cddb8822d11efe13746493e1e29953ab05e61"}

// settle
{"state":"complete","exit":"this change's runtime objective (post-merge-verify) is complete; to continue with the next ordered work unit, run `gentle-ai sdd-attempt acquire --cwd <repo> --change <change> --request-id \"<unique-request-id>\" --work-unit \"<a different label>\" --evidence-goal \"<stable-goal>\" --max-attempts <count> --max-changed-lines <count>`; rescope applies only to an objective that is not complete, and reset discards this scope instead of succeeding it"}
```

## Native SDD Status

```json
{
  "dependencies": {
    "proposal": "all_done",
    "specs": "all_done",
    "design": "all_done",
    "tasks": "all_done",
    "apply": "all_done",
    "verify": "ready",
    "archive": "blocked"
  },
  "nextRecommended": "verify",
  "blockedReasons": []
}
```

`archive` shows `blocked` because this verify-report did not yet exist at status-check time
(it is a prerequisite the dependency graph checks for); once this report is persisted, a
fresh `sdd-status` call should show `archive: ready`.
