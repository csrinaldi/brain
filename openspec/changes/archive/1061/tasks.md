# Tasks: Heal the Engram Store's Pre-Guard Duplicate Rows (#1061, #864 task 1.2a)

## Review Workload Forecast

| Field | Value |
|---|---|
| Estimated changed lines | Governed ~220 (`lib/engram-heal.mjs` ~70, `backends/engram.mjs` ~75, `cli.mjs` ~45, i18n ~26, `package.json` 1, CHANGELOG ~4); raw (tests + `openspec/changes/**`, both ignored by `brain.config.json:23-34`) large — 3 new test files + 1 allowlist entry |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending (not needed — risk is Low) |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

`brain.config.json:23-34` ignores `**/*.test.mjs` and `openspec/changes/**`, so all four new/edited test files and this openspec folder are unraveled from governance. Governed diff is `lib/engram-heal.mjs` + `backends/engram.mjs` + `cli.mjs` wiring + i18n + `package.json` + CHANGELOG, ~220 lines against the design's own estimate (`design.md:86-98`), well under the 400-line budget.

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Rollback boundary |
|---|---|---|---|---|
| 1 | RED coverage (planner, executor, cli spawn test + allowlist entry) | PR #1 (only PR) | `node --test brain/scripts/memory/lib/engram-heal.test.mjs brain/scripts/memory/backends/engram.heal.test.mjs brain/scripts/memory/cli.heal-duplicates.test.mjs` | Revert test files + allowlist entry only; no runtime change yet |
| 2 | Planner + executor + i18n + cli wiring + `package.json` GREEN | same PR | same as above | Revert the four implementation files together (single behavior) |
| 3 | Integration coverage against a throwaway store | same PR | `node --test brain/scripts/memory/backends/engram.heal.integration.test.mjs` | Revert integration test only |
| 4 | Full verification | same PR | `npm test`, `npm run brain:repo:check` | N/A — gate, not a commit |

### Proposed Commit Plan (work-unit-commits, conventional, `(#1061)`, no attribution trailers)

Tests travel with the code they cover, so no commit in the PR is red (the RED phase happens in the working tree, not in history):

1. `feat(memory): plan the engram duplicate heal as a pure function (#1061)` — `lib/engram-heal.mjs` with `lib/engram-heal.test.mjs`.
2. `feat(memory): the engram adapter heals its own duplicate rows, dry-run by default (#1061)` — `backends/engram.mjs` `healDuplicates`, `backends/engram.heal.test.mjs`, the i18n keys, `cli.mjs` wiring with `cli.heal-duplicates.test.mjs` and its `test-spawn-hygiene.test.mjs` entry, `package.json`, CHANGELOG.
3. `test(memory): prove the hard delete against a throwaway engram store (#1061)` — `backends/engram.heal.integration.test.mjs`.
4. `docs(sdd): issue-1061 change folder (#1061)` — `openspec/changes/issue-1061-engram-duplicate-heal/`.

The maintainer runbook below uses plain bullets, not checkboxes, so the native SDD status counts only the agent's 14 tasks and can reach verify and archive before the real run.

## Phase 1: RED Coverage

- [x] 1.1 Create `brain/scripts/memory/lib/engram-heal.test.mjs` (RED — module missing). Cover: rows out of order still keep the lowest `id`; non-`rec-` keys ignored; a `content`, `title` or `type` difference each refuses `divergent`, naming the key and field; 3+ live rows refuse `tooMany`; a missing `id` or `content`/`title`/`type` refuses `shape`; `observations: null` gives zero groups; the fixture of the three measured pairs (`rec-35e09fc539447742`, `rec-4d99842973ef6c5b`, `rec-d2ded214bc5d66c1` from `proposal.md:9-13`) plans deletes `[3092,3093,3094]`; `parseEngramVersion` handles `1.20.0` (in range), `2.0.0` (out) and garbage (`null`); a soft-deleted row (`deleted_at` set) is never a candidate. Satisfies REQ-MB-1, REQ-MB-3. Done when: file exists and fails on module-not-found.
- [x] 1.2 Create `brain/scripts/memory/backends/engram.heal.test.mjs` (RED), seams in the style of `audit-io.test.mjs:85-91` (`_probe`/`_exec`/`_read`). Cases: dry-run makes 0 delete calls; apply deletes ascending, one id at a time, with `HEAL_DELETE_ARGS`; a throw on the 2nd delete gives `outcome:'partial'`, `deleted:[a]`, `notDeleted:[b,c]`, no further calls; a post-apply re-export that still shows a duplicate gives `unverified`; a version outside 1.20.x or an absent probe means no export and no delete calls; an export count mismatch (`topicKeysFromExport` throws) is a shape refusal; a second run makes 0 deletes; `_read` throws if called on any path under `.memory`. Satisfies REQ-MB-2, REQ-MB-4, REQ-MB-5. Done when: file exists and fails on the missing `healDuplicates` export.
- [x] 1.3 Create `brain/scripts/memory/cli.heal-duplicates.test.mjs` (RED — spawns `cli.mjs` with a fake `engram` shell shim first on `PATH`, plus `ENGRAM_DATA_DIR`/`HOME` under `testTmp`). Cases: `MEMORY_BACKEND=plainfiles` → exit 1, stderr `memory.heal.notEngram`; an unknown flag (e.g. `--bogus`) → exit 1, stderr `memory.heal.badFlag`; a dry-run against the shim's fixture export → exit 0, stdout shows the plan text; a refusal case (divergent copies in the shim's export) → exit 1, deletes nothing. Satisfies REQ-MB-2, REQ-MB-3. Done when: file exists and fails (op `heal-duplicates` does not exist in `cli.mjs`).
- [x] 1.4 Add the required `test-spawn-hygiene.test.mjs` allowlist entry for 1.3: `{ file: 'brain/scripts/memory/cli.heal-duplicates.test.mjs', entrypoint: 'brain/scripts/memory/cli.mjs', reason: 'no-vcs-capability' }`, next to the existing `cli.audit.test.mjs`/`cli.backend-fallback.test.mjs` entries (`test-spawn-hygiene.test.mjs:367-368`). Done when: the hygiene meta-test does not flag 1.3's spawn as uncovered.

## Phase 2: Planner + Executor + CLI GREEN

- [x] 2.1 Create `brain/scripts/memory/lib/engram-heal.mjs` exporting `planDuplicateHeal(parsed)` and `parseEngramVersion(stdout)`/`isTestedVersion(v)` (`TESTED_ENGRAM = { major: 1, minor: 20 }`, first `\d+.\d+.\d+` on stdout only) per the interface contract (`design.md:59-71`). Satisfies REQ-MB-1, REQ-MB-3. Done when: 1.1 is GREEN.
- [x] 2.2 Add `memory.heal.*` (13 keys: `none`, `plan`, `deleted`, `done`, `partial`, `unverified`, `notEngram`, `badFlag`, `failed`, `refused.divergent`, `refused.tooMany`, `refused.shape`, `refused.version`) to `brain/scripts/i18n/en.mjs` and `brain/scripts/i18n/es.mjs`, next to `memory.splitRecords.*` (`en.mjs:351-355`), each refusal ending "Nothing was deleted." Add a coverage test (or extend the existing i18n-parity test) asserting all 13 keys exist and match between locales. Satisfies message contracts consumed by 2.3/2.4.
- [x] 2.3 In `brain/scripts/memory/backends/engram.mjs`, add `healDuplicates({ apply = false, _probe, _exec, _read, _log, _warn })` and `HEAL_DELETE_ARGS = ['delete', String(id), '--hard']`, reusing `topicKeysFromExport` (`:1383`) and `explainEngramFailure` (`:1349`) for the count/shape cross-check. Default `_probe` runs `engram version`; default delete execs one id at a time ascending, stopping on first failure. Satisfies REQ-MB-2, REQ-MB-4, REQ-MB-5. Done when: 1.2 is GREEN.
- [x] 2.4 In `brain/scripts/memory/cli.mjs`, add `"heal-duplicates"` to `VALID_OPS` (`:120-128`), a header usage line, and a dedicated block before `selectBackend` (`:742`), mirroring `split-records` (`:250-283`): refuse `memory.heal.notEngram` when `MEMORY_BACKEND !== "engram"`; accept only `--apply`, refusing anything else as `memory.heal.badFlag`; call `healDuplicates`; print the plan/results to stdout, refusals/failures to stderr prefixed `memory/cli:`; exit 0 for `none`/`planned`/`healed`, exit 1 for `refused`/`partial`/`unverified`/`failed`. Satisfies REQ-MB-2, REQ-MB-3. Done when: 1.3 is GREEN.
- [x] 2.5 Add `"brain:memory:heal-duplicates": "node ./brain/scripts/memory/cli.mjs heal-duplicates"` to `package.json`, next to `brain:memory:split-records` (`:87`). No `MANAGED_SCRIPT_KEYS` entry, matching the `split-records`/`migrate-v1` precedent (`design.md:42`). Done when: script runs the new op.
- [x] 2.6 Add a one-paragraph `CHANGELOG.md` Unreleased entry describing the heal verb, its dry-run default, and the hard-delete decision (`design.md:118-135`). Done when: entry exists and mentions `heal-duplicates` and `--apply`.

## Phase 3: Integration Coverage (throwaway store)

- [x] 3.1 Create `brain/scripts/memory/backends/engram.heal.integration.test.mjs`. Skip (with a reason naming which) when `probeBinary(ENGRAM_BIN).available !== true` or the installed version is outside `1.20.x`. Build `isolatedExec(dir)` merging `{ ENGRAM_DATA_DIR: dir, HOME: dir }`; before every call assert `dir` is under the `testTmp` run root and is not `join(homedir(), '.engram')`. Reproduce a real-shaped duplicate by importing a `sync_id`-rewritten copy of an export (`design.md:118-129` — re-importing the same export does not duplicate on 1.20.0). T-INT-1: two records imported once, then a `sync_id`-rewritten copy imported again → one duplicate pair; dry-run leaves the export unchanged; apply hard-deletes the non-keeper, `engram export` afterward confirms the row is gone (proves hard delete removes the row) and `distinct = rows`; a second apply is a no-op. T-INT-2: two rows sharing a key with different content refuse, row count unchanged. T-INT-3: 3 live rows sharing a key refuse `tooMany`. Assert `~/.engram/engram.db` mtime and size are unchanged before/after the whole file. Satisfies REQ-MB-1 through REQ-MB-5. Done when: all scenarios pass or the file reports a clear skip reason.

## Phase 4: Verification

- [x] 4.1 Run the focused suite: `node --test brain/scripts/memory/lib/engram-heal.test.mjs brain/scripts/memory/backends/engram.heal.test.mjs brain/scripts/memory/cli.heal-duplicates.test.mjs brain/scripts/memory/backends/engram.heal.integration.test.mjs brain/scripts/test-spawn-hygiene.test.mjs`. Done when: all green (integration file may report a skip).
- [x] 4.2 Lane-safety and store-safety guarded full run: record `git ls-remote origin 'refs/heads/memory/*'`, the list of open PRs (`gh pr list`), and `~/.engram/engram.db` mtime+size BEFORE `npm test`; run `npm test`; record all three again AFTER. Fail this task on any difference (a real lane push, PR, or a mutation of the real engram store would mean a test seam or isolation guard regressed). Done when: `npm test` is green and all three before/after snapshots are identical.
- [x] 4.3 Run `npm run brain:repo:check` and confirm the governed diff stays under the 400-line budget, consistent with the design's ~220-line estimate. Done when: check passes and diff size is recorded.

## Notes (not tasks)

- Task 6.1 (epic #864) must state that its "distinct = rows" criterion measures backend rows, not `.memory/records/`; the audit currently counts a soft-deleted row as live, which is a candidate follow-up for that task, not this one.
- Record-layer excess (`rec-4a22e13fd3c3aebd`, `rec-95740755792f0f1c`; ADR-0017) stays out of scope and is never collapsed by this heal.
- engram 2.0.0 exists and is untested; the version guard refuses it rather than silently widening the range.

### Post-Merge Runbook (MAINTAINER, Tier 2 — not the agent, not part of this PR)

- R.1 Run `engram version`; expect `engram 1.20.0` on stdout. Otherwise stop.
- R.2 Run `engram doctor --json` and confirm no pending mutation on the six known sync_ids (`obs-9229525d73068f1b`, `obs-41d07c12dfe03bd1`, `obs-9ed0ba42b887011f`, `obs-93acd79f338334ba`, `obs-24accc8cd4b8356c`, `obs-13a6bb5c7e7c3431`).
- R.3 Run `MEMORY_BACKEND=engram npm run brain:memory:audit`; keep the before backend line.
- R.4 Take a recovery snapshot (read-only): `engram export ~/engram-pre-1061.json`.
- R.5 Dry-run: `npm run brain:memory:heal-duplicates`; expect exactly `3092`, `3093`, `3094` listed.
- R.6 Apply: `npm run brain:memory:heal-duplicates -- --apply`.
- R.7 Re-run the audit; expect `rows 2447 · distinct 2447`.
- R.8 Re-run step R.5; expect `memory.heal.none`; confirm `.memory/` is byte-unchanged; paste version, doctor count, dry-run output, apply output, before/after audit lines, second-run output, and delete mode on #1061.
