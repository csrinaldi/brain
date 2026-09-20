---
change: issue-906-lane-triggers
status: PASS
verified_at: 2026-09-10T18:45:00Z
head: 8d15024614b113659bd31123fd33a9596d1ac411
merge_commit: 51ff915f5656137b5bb16a63f8b98395209239cc
---

# Verification Report — #906 the lane's triggers: two thin callers of one verb

**Mode**: Strict TDD. PR #910 (`Closes #906`) merged as `51ff915f`; one post-merge fix
(`8d150246`, an fd-leak on a post-check `_spawn` throw, found by cold review of the merged
code) landed on top in worktree `/home/gandalf/IA/brain-issue-906-archive`, branch
`docs/issue-906-archive`. Ruling D1–D7 (`sdd/issue-906-lane-triggers/ruling`, 2026-09-10)
confirmed against the current tree.

## Completeness

| Metric | Value |
|---|---|
| tasks.md — Sections 0–6 (measurements + 6 TDD work units) | all `[x]` |
| tasks.md — Section 7 (wrap-up: record-first, epic note, npm test evidence, cold review) | all `[x]` (7.1, 7.3, 7.4) |
| tasks.md — Section 9 (PR opened, `brain:review`) | all `[x]` (9.1, 9.2) |
| tasks.md — Section 10 (post-merge maintainer acts) | `[ ]` 10.1–10.3 — **intentional handover, not a gap** |
| Epic `openspec/changes/issue-864-memory-2-0/tasks.md` 3.1b | one-line note added, `[x]` unaffected (correctly not flipped — 3.1b/3.1c cover governance, not the triggers themselves) |

Section 10's three items are explicitly the maintainer's post-merge acts (flag flip gated on
#889 D7.2, recording the first automatic lane PR, and the adopter-upgrade note) — tasks.md's own
section header frames them as "no code," matching this verify pass's Handover section below.

## Build & Tests Execution

**Focused** (8 named files — `session-end-ship.test.mjs`, `day-start-sweep.test.mjs`,
`day-start.test.mjs`, `settings-hooks.test.mjs`, `antigravity.drift.test.mjs`,
`managed-paths.test.mjs`, `config-migrations.test.mjs`, `pre-push.test.mjs`):
**85 pass / 0 fail**.

**CI-parity re-run**, isolated identity (`GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1
HOME=$(mktemp -d)`), same 8 files: **85 pass / 0 fail**, identical.

**Full suite** (`npm test`): **5140 pass / 0 fail / 0 todo**, ~28.4s — matches apply-progress's
post-merge-fix figure exactly (5140/5140).

**`check-refs.mjs`**: `✓ No prohibited references found.` / `✓ Artifact structure is valid.`
(exit 0).

## Spec Compliance Matrix

| Requirement | Scenario | Test | Result |
|---|---|---|---|
| SessionEnd hook byte-identical (D2) | shape + drift | `harness/backends/settings-hooks.test.mjs`, `antigravity.drift.test.mjs` | ✅ COMPLIANT |
| Launcher silent/inert when flag off (D1) | disabled, absent, real-run | `memory/session-end-ship.test.mjs` | ✅ COMPLIANT |
| Launcher detaches when flag on (D1) | enabled, detached, env-inherited, failure-safe | `memory/session-end-ship.test.mjs` | ✅ COMPLIANT |
| `day:start` sweep synchronous, gated, non-fatal (D4) | gated, non-fatal, TOTAL=6 | `memory/day-start-sweep.test.mjs`, `day-start.test.mjs` | ✅ COMPLIANT |
| `memory.lane.enabled` migration-managed, default false (D3) | additive migration, round-trip | `core/config-migrations.test.mjs` (relocated to `scripts/lib/`), `config/cli.test.mjs` | ✅ COMPLIANT |
| `pre-push` never invokes `ship` (D6 re-pin) | pre-push stays on `share` | `hooks/pre-push.test.mjs` | ✅ COMPLIANT (pre-existing assertion, confirmed still green, not duplicated — see Correctness) |

**Compliance summary**: 6/6 spec-derived requirement rows fully COMPLIANT with passing covering
tests (85/85 focused, reconfirmed identically under CI-parity identity isolation).

## Correctness (Static + Runtime Evidence)

| Requirement | Status | Evidence |
|---|---|---|
| D1 — flag guard first | ✅ | `session-end-ship.mjs:139-142` — `_loadConfig()` then `config?.memory?.lane?.enabled !== true` returns `{spawned:false}` before any fs/spawn work. |
| D1 — private per-uid dir, `lstat`-verified | ✅ | `ensurePrivateDir` (`:75-94`) — `mkdirSync(dir, {mode:0o700})`, then unconditional `lstatSync` refusing symlink / non-directory / wrong uid / any group-other bit, whether created or pre-existing. |
| D1 — fd `fstat`-verified | ✅ | `ensureTrustedFd` (`:115-120`) — `fstatSync(fd)` refusing non-regular / wrong uid / group-other bits / `nlink !== 1`, called after open, before spawn. |
| D1 — detached + unref | ✅ | `:176-186` — `_spawn(..., {detached:true, stdio:['ignore',fd,fd], cwd:REPO_ROOT, env:process.env})` then `child.unref()`. |
| D1 — env inherited unchanged | ✅ | `env: process.env` (`:183`), no scrub; A2 rationale documented at `:35-39`. |
| D1 — exit 0 always | ✅ | Outer `try/catch` (`:138-195`) — every path returns; main-module guard (`:200-203`) calls `process.exit(0)` unconditionally after `shipOnSessionEnd()`. |
| D1 — one close site (post-merge fix `8d150246`) | ✅ | `:174-189` — single unconditional `finally { _closeSync(fd); }` around `ensureTrustedFd`+`_spawn`+`.unref()`; `ensureTrustedFd` no longer closes `fd` itself. New regression test `_spawn throws AFTER the fd was trusted: the fd is closed exactly once` passes, asserting `closeCalls.length===1` and post-call `fstatSync` throws `EBADF`. |
| D2 — `SessionEnd` block byte-identical, both platforms | ✅ | `compileSettingsHooksJson()` output diffed byte-for-byte against committed `.claude/settings.json` and `.gemini/settings.json` in this verify pass — **IDENTICAL** both. Sole hook `command === 'npm run brain:memory:session-end'` (`settings-hooks.mjs:44,81`), no `matcher`/`timeout`/`async` key present in the emitted object. |
| D3 — migration `1.6.0`, `buildDefaultConfig` exception named | ✅ | `config-migrations.mjs:165-199` — additive `1.6.0` entry, description names the `buildDefaultConfig()` unfiltered-walk exception and both consequences (release-debt severity, downgrade trap) verbatim. `brain:config get memory.lane.enabled` in this repo: exit 1, `'memory.lane.enabled' is not set (undefined)` — dormancy confirmed live (package.json still `1.5.0`). |
| D4 — `day:start` sweep synchronous, 60s timeout, one line, TOTAL=6 | ✅ | `day-start-sweep.mjs` `runLaneSweep` uses its own `spawnSync(..., {timeout:60_000})`; `day-start.mjs` step 5 computes `laneSweepEnabled(config)` once, prints one `t()`-rendered line, warns (never fails) on non-zero/unparseable; `day-start.test.mjs`'s smoke pin confirms `6/6` unchanged. |
| D5 — `MANAGED_SCRIPT_KEYS` carries the key, count 10 | ✅ | Live import in this pass: `MANAGED_SCRIPT_KEYS.length === 10`, includes `'brain:memory:session-end'` as the 10th entry. |
| D6 — non-goals: no touch to `lane/ship.mjs`, `collect.mjs`, `credential-env.mjs`, `memory-gate`, `hooks/pre-push` in the merge | ✅ | `git show --stat 51ff915f \| rg -i "lane/ship\|collect.mjs\|credential-env\|memory-gate\|pre-push"` — **empty**, confirming none of those paths appear in the merge diff. `memory.lane.enabled` confirmed **not set** in this repo's `brain.config.json` (exit 1 above). |
| Epic 3.1b note | ✅ | `openspec/changes/issue-864-memory-2-0/tasks.md` — one-line pointer to #906 added under 3.1b; 3.1c's own `[x]`/scope untouched (correctly — it covers governance, not the triggers). |

## PR & Review Evidence

- `gh pr view 910 --json reviews`: two rounds posted by `csrinaldibot` — round 1 **REVISE** at
  `head_sha bc7f76ca` (2026-09-10T18:12:26Z, a pre-created 0666 regular file defeating
  `O_NOFOLLOW`/create-mode — the C7 blocker, fixed in `1f04e993`/carried through to `9ea9b6c0`);
  round 2 **APPROVE** at `head_sha 9ea9b6c0` (2026-09-10T18:30:35Z), with one correction (the fd
  left open when `_spawn` throws after the fd was trusted — this is exactly the defect the
  post-merge commit `8d150246` fixes, confirming the review's own note was carried into the
  archive PR with its test, as apply-progress states).
- Merge commit `51ff915f`, `.memory/` scope: `git show --stat 51ff915f -- .memory/` →
  exactly `.memory/index.jsonl` (+1) and `.memory/records/2026-09-rec-d8ab89bef71f56e3.jsonl`
  (+1) — minimal, matches the record-first task 7.1.
- **Release-debt consequence, confirmed live**: `npm run brain:status -- --issue 906` reports
  `release DEBT — 1 migration(s) promoted above the published 1.5.0 → 1.6.0 are declared and
  UNREACHABLE until a release cut` — the exact `severity:'migration'` consequence design.md's
  Risks table (cold review C1) predicted, now live on `main` as of this merge. This is the
  maintainer's handover, not a defect: cutting `1.6.0` is the stated remedy, not a code change.

## TDD Compliance

| Check | Result | Details |
|---|---|---|
| TDD evidence reported | ✅ | apply-progress (engram #3310) reports RED→GREEN per unit across batch 1 (units 1–6), batch 3 (C7 private-dir/fstat fix), and the post-merge fix (fd-leak-on-throw). |
| All tasks have tests | ✅ | Every implementation task (1.1–6.1) preceded by its RED task in tasks.md; unit 6 correctly recorded as a pin-only finding (no new diff needed — assertion pre-existed from #902). |
| RED confirmed | ✅ | apply-progress documents RED states for units 1, 2, 3, 4, 5 (module-absent / length-mismatch / import-error failures), the C7 batch (5/10 failing against unfixed code), and the post-merge fix (10/11 passing, 1 failing — `closeCalls.length===0`). |
| GREEN confirmed | ✅ | 85/85 focused (both normal and identity-isolated runs), 5140/5140 full suite — this verify pass. |
| Triangulation adequate | ✅ | `session-end-ship.test.mjs` covers flag-off/absent/on/throw/post-check-throw as distinct cases (11 tests just for the launcher's control flow + C7's 5 defense-in-depth cases); `day-start-sweep.test.mjs` covers skip/ok-shipped/ok-nothing/warn as four distinct branches via `laneSweepLine`. |
| Safety net for modified files | ✅ | Full `npm test` green before every commit per apply-progress; reconfirmed 5140/5140 in this pass. |

**TDD Compliance**: 6/6 checks passed.

### Test Layer Distribution

| Layer | Tests | Files | Tools |
|---|---|---|---|
| Unit | 85 (focused set) | 8 | `node:test` |
| Integration | 0 | 0 | not installed |
| E2E | 0 | 0 | not installed |
| **Total** | **85** | **8** | |

Real-process/real-fs checks (private-dir permissions, fd fstat, byte-identical settings-JSON
diff, live `brain:status`/`brain:config` invocations) are exercised as unit-level `node:test`
cases plus this verify pass's own direct source/CLI checks — no integration/E2E harness is
installed or required by this change's scope.

### Changed File Coverage

Coverage analysis skipped — no coverage tool detected/configured for this project.

### Assertion Quality

Scanned all 8 focused test files for tautologies (`expect(true).toBe(true)` / equivalent):
**none found**. No smoke-test-only, ghost-loop, or mock-heavy patterns observed in
`session-end-ship.test.mjs` (407 lines) or `day-start-sweep.test.mjs` (189 lines) — both use
injected seams (`_spawn`, `_closeSync`, `_uid`, `_now`) with direct value/call assertions per
case, not implementation-detail coupling.

**Assertion quality**: ✅ All assertions verify real behavior.

### Quality Metrics

**Linter**: not run — no linter invocation configured for this verify pass; no lint failures
reported by apply-progress.
**Type Checker**: not applicable — plain `.mjs`, no TS build step.

## Handover

The following are explicitly **not gaps** — they are the maintainer's post-merge acts, recorded
here for `sdd-archive` to carry forward, not blockers to archiving this change:

1. **tasks.md 10.1–10.3** — flip `memory.lane.enabled` to `true` only after #889 D7.2's first
   manual lane PR merges (`npm run brain:config -- set memory.lane.enabled true`); record the
   first **automatic** lane PR's number and the `memory:audit` p50/p90 latency measured after it
   merges; note that every adopter receives the inert hook automatically on their next
   `brain:upgrade`, no action required to receive it, only to arm it.
2. **Cut `1.6.0` promptly** — `npm run brain:status -- --issue 906` confirms `release DEBT` is
   live now (1 migration promoted above the published `1.5.0`). This is the stated remedy from
   design.md's Risks table (cold review C1), not a code defect; no fix belongs in this change.
3. **#889's own D7 sequence remains open** (D7.1–D7.4 — `brain:protect` re-run, the first real
   `memory:ship` lane PR merged by hand, the same-day `--json` capture, and `brain:audit`
   confirmation over that window) — carried forward from `archive/889/verify-report.md`'s own
   Handover section, unchanged by this change. #906 supplies the automatic triggers D7.2 will
   eventually exercise; it does not itself perform any D7 step.
4. **Two docs corrections from #909's review** (the change that archived #889), noted here for
   process continuity: verify-report line citations should be checked against the actual current
   tree rather than assumed stable across batches, and "archive report" wording should be used
   consistently rather than mixed with other terms — both are documentation-only corrections
   from #909's own review trail, unrelated to #906's code, recorded here only because #909's
   review happened in the same session and flagged them for future SDD docs.

## Issues Found

**CRITICAL**: None.

**WARNING**: None.

**SUGGESTION**:
1. `release-debt` severity is now `migration` on `main` (confirmed live via `npm run
   brain:status -- --issue 906`) as a direct, documented, and accepted consequence of the
   `1.6.0` migration entry landing while `package.json` still reads `1.5.0`. Not a defect —
   `sdd-archive` should surface this in the archive report as an open handover item (cut `1.6.0`)
   rather than letting it go unrecorded once this change closes.
2. tasks.md section 10 (10.1–10.3) and the D7 sequence inherited from #889 both remain
   unticked by design — `sdd-archive` should preserve both as explicit open handover items in
   the archive report rather than treating an all-`[x]` code-task completeness as "nothing
   left."

## Verdict

**PASS**

All 6 spec-derived requirement rows have passing covering tests (85/85 focused, reconfirmed
85/85 identically under CI-parity identity isolation); full suite 5140/5140 green, matching
apply-progress's post-merge-fix count exactly; `check-refs.mjs` clean; every code-bearing
tasks.md item `[x]` (sections 0–7, 9); D1–D6 confirmed by live source inspection and direct
runtime checks against the current tree (byte-identical settings JSON, live `MANAGED_SCRIPT_KEYS`
count, live `brain:config`/`brain:status` output, empty diff on D6's excluded paths); the
post-merge fd-leak fix (`8d150246`) is itself TDD-evidenced and covered by a new regression test,
green. Two cold-review rounds posted on PR #910 (REVISE then APPROVE), the round-2 correction
directly explaining the post-merge fix's necessity. Zero CRITICAL, zero WARNING — nothing blocks
archive. Two SUGGESTIONs, both about carrying forward known, already-disclosed handover items
(the live `migration` release-debt severity, and tasks.md section 10 / #889's D7 sequence) into
the archive report rather than letting them silently drop. Section 10 (10.1–10.3) is correctly
treated as an intentional handover per tasks.md's own framing — not a gap.
