```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:8fc4abf172294e05986bc01d49bd5065f4c1dc81efbb827e97a957e96715fa27
verdict: pass
blockers: 0
critical_findings: 0
requirements: 5/5
scenarios: 10/10
test_command: "npm test"
test_exit_code: 0
test_output_hash: sha256:c5ee8bc44660183664b01fb8028124769b433e9b2778e2016a392fc135ee48bd
build_command: "npm run brain:repo:check && npm run brain:nav"
build_exit_code: 0
build_output_hash: sha256:5d349d135d140a7dbd5ff1e0f5dfe706481d9ce03ffdde3a35163ae96e7c343c
```

# Verify Report: issue-1012-lane-ship-invoker-guard (POST-MERGE)

**Date**: 2026-09-18
**Verdict**: PASS
**Verified in**: `/home/gandalf/IA/brain-issue-1012-archive` (branch `docs/issue-1012-archive`, clean checkout of `origin/main` @ `2c0cead1`, containing PR #1027's squash-merge `0253f4bd`)
**Mode**: Strict TDD (active for this run) · full artifact set (proposal + design + tasks + apply-progress + specs delta `governance-v3`) · read-only verify, no source files modified.

## Summary

This is the post-merge verification that precedes archive. Issue #1012 / PR #1027 is fully
merged to `main` at `2c0cead1`. All 24/24 tasks remain complete on `main`. All 5 spec
requirements (REQ-SHIP-1..5) and 10 scenarios in `specs/governance-v3/spec.md` map to
implemented code and a passing runtime test (REQ-SHIP-5's structural scenario is verified
by source inspection, since it is an intentionally test-free docs task per `tasks.md`'s own
work-unit table). The full suite is **5852/5852 passing** (up from 5632/5632 recorded at
apply time — the branch point already sits after #1004 and #1028, which both merged after
#1012's own apply batch and added 220 net tests). The invoker guard's own 35 `#1012`-tagged
subtests are all green, including the REQ-SHIP-4 meta-test (`ok 4348`) that scans every spawn
in `brain/scripts/**/*.test.mjs` and `test/**/*.test.mjs` — including the 39 new UI/governance
test files #1004 and #1028 introduced. I independently confirmed those new files carry no
runtime-entrypoint spawn (`spawnSync`/`spawn(`/`execFileSync`/`execFile(`/`.fork(`), so the
meta-test's pass on `main` is a genuine "nothing new to allowlist" result, not a scan gap.
Lane safety held: `git ls-remote origin 'refs/heads/memory/*'` and the open-PR list were
byte-identical before and after the full `npm test` run — no real lane ref or PR was created.
`npm run brain:repo:check` and `npm run brain:nav` both pass. Zero CRITICAL, zero WARNING.
Two SUGGESTIONs carried forward from the apply-progress record (both are documented,
pre-existing, out-of-scope follow-ups, unchanged by this change).

## Completeness

| Metric | Value |
|--------|-------|
| Tasks total | 24 |
| Tasks complete | 24 |
| Tasks incomplete | 0 |

`tasks.md` shows all 24 checkboxes `[x]` across Phases 1-5. `apply-progress.md` corroborates
with a matching per-phase breakdown and a "Batch 2 — cold-review fixes" addendum (guard
reordered to be the ship block's first statement; two MINOR findings and one NIT from a
cold review, all fixed and re-verified in that same batch, before this PR ever merged).

## Build & Tests Execution

**Build**: PASS
```text
$ npm run brain:repo:check
> node ./brain/scripts/check-refs.mjs
✓ No prohibited references found.
✓ Artifact structure is valid.
(exit 0)

$ npm run brain:nav
> node ./brain/scripts/check-brain-nav.mjs
✓ Navegación de brain/ íntegra: sin huérfanos, sin links rotos, sin rutas citadas inexistentes.
(exit 0)
```

**Tests**: 5852 passed / 0 failed / 0 skipped
```text
$ npm test
> node --test "brain/scripts/**/*.test.mjs" "test/**/*.e2e.test.mjs"
1..5852
# tests 5852
# suites 0
# pass 5852
# fail 0
# cancelled 0
# skipped 0
# todo 0
(exit 0)
```

**Coverage**: Not available — no coverage tool detected in this repo's toolchain (consistent
with prior verify runs for this project).

## Spec Compliance Matrix

| Requirement | Scenario | Test | Result |
|---|---|---|---|
| REQ-SHIP-1 | Missing or unknown invoker refuses before any VCS work | `ship-invoker.test.mjs > ...invokerMissing` (ok 2995), `cli.ship-invoker.test.mjs > case (a)` (ok 2482) | ✅ COMPLIANT |
| REQ-SHIP-1 | Each declared invoker value proceeds | `ship-invoker.test.mjs > --invoker hook/sweep/manual is allowed` (ok 2978-2980); e2e reaches fake port (ok 5794, 5796, 5798) | ✅ COMPLIANT |
| REQ-SHIP-1 | Either bypass excuses a missing invoker | `ship-invoker.test.mjs > BRAIN_VCS_TEST_MODULE...allowed` (ok 2989), `...--dry-run with no --invoker is allowed` (ok 2990) | ✅ COMPLIANT |
| REQ-SHIP-2 | A valid invoker under a test context is refused, unless bypassed | `cli.ship-invoker.test.mjs > case (b)` (ok 2483); `ship-invoker.test.mjs > invokerUnderTest, unless bypassed` (ok 2992-2994); e2e no-port cases (ok 5795, 5797) | ✅ COMPLIANT |
| REQ-SHIP-3 | SessionEnd hook path reaches the fake VCS port | `test/lane-ship-invoker.e2e.test.mjs > (1) npm run brain:memory:session-end...invoker:'hook'` (ok 5794); `session-end-ship.test.mjs` argv pin + A2 `env: process.env` identity (source-verified `session-end-ship.mjs:180,185`) | ✅ COMPLIANT |
| REQ-SHIP-3 | Day-start sweep path reaches the fake VCS port | `test/lane-ship-invoker.e2e.test.mjs > (3) the sweep chain...invoker:'sweep'` (ok 5796); `day-start-sweep.test.mjs` argv pin, no `env` key (source-verified `day-start-sweep.mjs:42-45`, no `env` key) | ✅ COMPLIANT |
| REQ-SHIP-3 | Manual ship keeps today's behavior | `test/lane-ship-invoker.e2e.test.mjs > (4a)/(4b)` (ok 5798, 5799); `package-scripts.test.mjs > brain:memory:ship and its alias run cli.mjs ship (#961 R4)` (ok 3122) | ✅ COMPLIANT |
| REQ-SHIP-4 | An unallowlisted, seamless spawn fails the scan | `test-spawn-hygiene.test.mjs > self-proving: a planted fixture...returns exactly the two real hits, both uncovered` (ok 4350) | ✅ COMPLIANT |
| REQ-SHIP-4 | A closed-set reason passes; an out-of-set reason fails | `test-spawn-hygiene.test.mjs > every...spawn...allowlisted with a closed-set reason` (ok 4348); `...validateAllowlist rejects a reason outside the closed set` (ok 4349); self-proving reason-rejection + stale-entry (ok 4351) | ✅ COMPLIANT |
| REQ-SHIP-5 | Draft exists in the change's drafts folder, not under the governed path | Source-inspected: `brain-drafts/anti-patterns/test-spawns-a-live-entrypoint.md` (Problem/Why/Rule/Detection, no Status/Registered section) and `README-index-line.md` (promotion note, README `## Registered` line); `git log --diff-filter=A -- brain/core/anti-patterns/` shows no new file added there | ✅ COMPLIANT (structural — no runtime test by design; `tasks.md`'s own work-unit table lists this task's focused test command as "none (docs only)") |

**Compliance summary**: 10/10 scenarios compliant (9 runtime-test-covered, 1 structural/source-verified by design).

## Correctness (Static Evidence)

| Requirement | Status | Notes |
|---|---|---|
| REQ-SHIP-1 | ✅ Implemented | `ship-invoker.mjs` `decideShipInvoker()`; `cli.mjs:476` calls it as the ship block's first statement, before `await import(` at `:482-484,516` (source-order test `ok 2495`) |
| REQ-SHIP-2 | ✅ Implemented | Same guard call; `NODE_TEST_CONTEXT` check independent of a valid `--invoker`, per module header's documented check order |
| REQ-SHIP-3 | ✅ Implemented | `session-end-ship.mjs:180,185` (`--invoker hook`, `env: process.env` unchanged — A2); `day-start-sweep.mjs:42-45` (`--invoker sweep`, no `env` key); `package.json:77,89` (`memory:ship`/`brain:memory:ship` both end `--invoker manual`) |
| REQ-SHIP-4 | ✅ Implemented | `test-spawn-hygiene.test.mjs` (525 lines) — closed `REASONS` set, `validateAllowlist`, staleness check, two self-proving fixtures |
| REQ-SHIP-5 | ✅ Implemented | `brain-drafts/anti-patterns/test-spawns-a-live-entrypoint.md` + `README-index-line.md`, both present, no scaffolding, nothing added under `brain/core/anti-patterns/` |

## Coherence (Design)

| Decision | Followed? | Notes |
|---|---|---|
| Guard is the ship block's first statement (pre-dynamic-import) | ✅ Yes | Fixed in apply-progress "Batch 2" after a cold-review MINOR finding; confirmed at `cli.mjs:476` vs. first `await import(` at `:482` |
| A2 — hook caller passes `env: process.env` unchanged; sweep caller passes no `env` key | ✅ Yes | `session-end-ship.mjs:185` (`env: process.env`), `day-start-sweep.mjs:42-45` (no `env` key in the options object) |
| Anti-pattern draft lives under the change's own `brain-drafts/`, never under `brain/core/**` | ✅ Yes | Confirmed by file location and `git log --diff-filter=A` on `brain/core/anti-patterns/` |
| Meta-test allowlist is closed and self-proving | ✅ Yes | `REASONS` array closed-set; `validateAllowlist` rejects `'looks-safe'`; two self-proving fixtures assert the scanner isn't vacuous |

## Issues Found

**CRITICAL**: None

**WARNING**: None

**SUGGESTION**:
1. `--dry-run` still runs `collect()` unconditionally before the dry-run branch returns (`lane/ship.mjs:254,276`) — a real `--dry-run` invocation without `BRAIN_MEMORY_TEST_ROOT` still writes a local commit on a `refs/heads/memory/*` ref in the real repository. This is a pre-existing, explicitly out-of-scope follow-up documented in `tasks.md`'s "Notes (not tasks)" section; unchanged by #1012. The meta-test's `vcs-port-substituted` review remains the only current control for tests that exercise this path.
2. Scanner gaps named by the prior cold review remain unaddressed by design, not regression: aliased imports of spawn functions, spawns performed inside shared non-test helper modules (rather than directly in a `*.test.mjs` file), and multi-hop path construction that the scanner can only resolve to `<unresolved>` (which still counts as a hit, failing closed, per the scenario "An unallowlisted, seamless spawn fails the scan"). No evidence found that #1004 or #1028 introduced any spawn matching these gap shapes — confirmed via `rg` across their new test files.

## TDD Compliance

| Check | Result | Details |
|---|---|---|
| TDD Evidence reported | ✅ | `apply-progress.md` reports RED-before-GREEN per phase, with two disclosed deviations (1.2, 1.7 — guard/callers already implemented before those specific files were first run; both compensated with a manual revert-and-rerun documented in the report) |
| All tasks have tests | ✅ | 24/24 tasks map to a test file or (for 4.1/4.2) a docs artifact with no test by design |
| RED confirmed (tests exist) | ✅ | All 8 test files from Phase 1 exist on `main`: `ship-invoker.test.mjs`, `cli.ship-invoker.test.mjs`, `cli.ship.test.mjs`, `session-end-ship.test.mjs`, `day-start-sweep.test.mjs`, `package-scripts.test.mjs`, `test-spawn-hygiene.test.mjs`, `test/lane-ship-invoker.e2e.test.mjs` |
| GREEN confirmed (tests pass) | ✅ | All 35 `#1012`-tagged subtests pass in this run's full `npm test` (5852/5852) |
| Triangulation adequate | ✅ | `decideShipInvoker` alone has ~19 dedicated unit cases across the full check-order matrix; REQ-SHIP-4 has 4 dedicated subtests including 2 self-proving fixtures |
| Safety Net for modified files | ✅ | `chunk-boundary.test.mjs`'s pre-existing line-pinned allowlist was updated twice (665→666) as an incidental consequence of the guard's insertion and later reorder — both disclosed in `apply-progress.md` |

**TDD Compliance**: 6/6 checks passed

**Assertion quality**: ✅ All assertions verified as behavior-asserting on inspection of the invoker-guard and meta-test files (`ship-invoker.test.mjs`, `cli.ship-invoker.test.mjs`, `test-spawn-hygiene.test.mjs`, `test/lane-ship-invoker.e2e.test.mjs`) — no tautologies, no ghost loops over possibly-empty collections, no assertion-free test bodies found.

## Lane Safety

**Before** `npm test`:
- `git ls-remote origin 'refs/heads/memory/*'` → (empty)
- `gh pr list --repo csrinaldi/brain --state open` → `1017 feat/issue-1014-featreview-add-gemini-engine-support-for`

**After** `npm test`:
- `git ls-remote origin 'refs/heads/memory/*'` → (empty)
- `gh pr list --repo csrinaldi/brain --state open` → `1017 feat/issue-1014-featreview-add-gemini-engine-support-for`

Identical before/after. No real lane ref or PR was created by this run.

## Validator Output

```text
$ gentle-ai sdd-verify-validate --input openspec/changes/issue-1012-lane-ship-invoker-guard/verify-report.md --requirements 5 --scenarios 10
{
  "valid": true,
  "verdict": "pass",
  "evidence_revision": "sha256:8fc4abf172294e05986bc01d49bd5065f4c1dc81efbb827e97a957e96715fa27"
}
```

Note: the validator was run once more, after this section itself was written, to catch any
self-referential drift; the second run reported the same `valid: true` result (the envelope
block at the top of this file — the only part the validator inspects — was unchanged by
this section's edit).

## Attempt Runtime

`gentle-ai sdd-attempt status` showed the apply objective (`lane-ship-invoker-guard`, generation 1) already `complete` with `outcome: passed`. A new bounded objective was acquired for this post-merge verification:

```
$ gentle-ai sdd-attempt acquire --cwd /home/gandalf/IA/brain-issue-1012-archive \
  --change issue-1012-lane-ship-invoker-guard \
  --request-id verify-1012-postmerge-a1 \
  --work-unit post-merge-verify \
  --evidence-goal "post-merge verification of issue 1012 on main before archive" \
  --max-attempts 1 --max-changed-lines 3000
{"state":"proceed","token":"sha256:bc7d66e707c78910b8127f187fffabc6e502a7ac3b7f718d668e5561cab70254"}
```

Canonical untracked inventory (required for settle, since this run left one new untracked
file — the report itself):

```
$ gentle-ai review status --cwd /home/gandalf/IA/brain-issue-1012-archive \
  --contract gentle-ai.review-integration/v2 --agent claude-code --next-transition
"eligible_untracked_inventory": "sha256:e552d671ea082d3f2962b77c1935f4079214a1061c68b1674533fbf675801a84"
```

Settle:
```
$ gentle-ai sdd-attempt settle --cwd /home/gandalf/IA/brain-issue-1012-archive \
  --change issue-1012-lane-ship-invoker-guard \
  --token sha256:bc7d66e707c78910b8127f187fffabc6e502a7ac3b7f718d668e5561cab70254 \
  --request-id verify-1012-postmerge-a1-settle \
  --outcome passed \
  --evidence-revision sha256:8fc4abf172294e05986bc01d49bd5065f4c1dc81efbb827e97a957e96715fa27 \
  --diagnosis "Post-merge verification of issue 1012 on main: 24/24 tasks, 5/5 requirements, 10/10 scenarios compliant, full suite 5852/5852 passing, meta-test confirmed genuine against 1004/1028 new test files, no CRITICAL/WARNING findings" \
  --harness-disposition reused \
  --cleanup-evidence "No scratch state left in repo; only verify-report.md written as a new tracked-scope file" \
  --process-evidence "npm test 5852/5852 pass exit 0; brain:repo:check and brain:nav exit 0; lane-safety guard identical before/after" \
  --untracked-scope select \
  --expected-untracked-inventory sha256:e552d671ea082d3f2962b77c1935f4079214a1061c68b1674533fbf675801a84 \
  --intended-untracked openspec/changes/issue-1012-lane-ship-invoker-guard/verify-report.md
```

Settle result:
```json
{
  "state": "complete",
  "exit": "this change's runtime objective (post-merge-verify) is complete; to continue with the next ordered work unit, run `gentle-ai sdd-attempt acquire --cwd <repo> --change <change> --request-id \"<unique-request-id>\" --work-unit \"<a different label>\" --evidence-goal \"<stable-goal>\" --max-attempts <count> --max-changed-lines <count>`; rescope applies only to an objective that is not complete, and reset discards this scope instead of succeeding it"
}
```

Outcome: `passed`, `evidence_revision: sha256:8fc4abf172294e05986bc01d49bd5065f4c1dc81efbb827e97a957e96715fa27`,
`harness_disposition: reused`. The `post-merge-verify` runtime objective for this change is
now complete.

## Verdict

**PASS**

All 24 tasks complete, all 5 requirements and 10 scenarios compliant (9 by runtime test, 1
structural by design), full suite green (5852/5852), build proxy green, lane safety intact,
zero CRITICAL, zero WARNING, two carried-forward SUGGESTIONs (both pre-existing, documented,
out of this change's scope). Ready for `sdd-archive`.
