# Tasks: Lane-Ship Invoker Guard (#1012)

## Review Workload Forecast

| Field | Value |
|---|---|
| Estimated changed lines | Governed ~85 (guard module ~45, cli.mjs ~20, callers ~4, package.json 4, i18n 6, CHANGELOG ~4); raw (tests + drafts, ignored) large — meta-test allowlist alone ~45-55 entries |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | auto-chain |
| Chain strategy | feature-branch-chain (preselected; unused for one PR) |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: feature-branch-chain
400-line budget risk: Low

`brain.config.json:23-34` ignores `**/*.test.mjs`, `.memory/**`, `openspec/changes/**` — so all test files, the e2e file, the meta-test, its allowlist, and both `brain-drafts/**` files are unraveled from governance. Governed diff is `ship-invoker.mjs` + `cli.mjs` guard wiring + two caller argv edits + `package.json` + i18n + CHANGELOG, well under the 400-line budget.

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Rollback boundary |
|---|---|---|---|---|
| 1 | RED coverage (matrix, spawn, e2e, meta-test skeleton) | PR #1 (only PR) | `node --test brain/scripts/memory/lib/ship-invoker.test.mjs brain/scripts/memory/cli.ship-invoker.test.mjs` | Revert test files only; no runtime change yet |
| 2 | Guard module + `cli.mjs` wiring + caller markers GREEN | same PR | `node --test brain/scripts/memory/cli.ship.test.mjs brain/scripts/memory/session-end-ship.test.mjs brain/scripts/memory/day-start-sweep.test.mjs brain/scripts/memory/package-scripts.test.mjs` | Revert guard + caller diffs together (single behavior) |
| 3 | Meta-test + allowlist | same PR | `node --test brain/scripts/test-spawn-hygiene.test.mjs` | Revert meta-test + allowlist together |
| 4 | Anti-pattern draft | same PR | none (docs only) | Revert draft files |
| 5 | Full verification | same PR | `npm test` | N/A — gate, not a commit |

### Proposed Commit Plan (work-unit-commits, conventional, `(#1012)`, no attribution trailers)

1. `test(memory): add RED coverage for the ship-op invoker guard (#1012)` — Phase 1 tasks.
2. `feat(memory): refuse cli.mjs ship without a declared or test-context invoker (#1012)` — Phase 2 tasks (guard module, `cli.mjs` wiring, i18n, both callers, `package.json`, CHANGELOG).
3. `test(scripts): enforce a closed spawn-hygiene allowlist for runtime spawns (#1012)` — Phase 3 tasks.
4. `docs(anti-patterns): draft test-spawns-a-live-entrypoint for maintainer promotion (#1012)` — Phase 4 tasks.

## Phase 1: RED Coverage

- [x] 1.1 Create `brain/scripts/memory/lib/ship-invoker.test.mjs` (RED — module does not exist). Cover the full matrix from the design's testing strategy: `hook`/`sweep`/`manual` allowed; `--invoker`/`--invoker --json`/`--invoker=hook`/`--invoker ci`/a repeated flag refused as `invokerInvalid` including under the seam; seam or `--dry-run` without a marker allowed; a blank seam allowed here (refused downstream); `NODE_TEST_CONTEXT` with a valid marker refused as `invokerUnderTest`; no variable and no marker refused as `invokerMissing`. Satisfies REQ-SHIP-1, REQ-SHIP-2. Done when: test file exists and fails on module-not-found.
- [x] 1.2 Create `brain/scripts/memory/cli.ship-invoker.test.mjs` (RED — spawns with a defanged env: seam, `BRAIN_MEMORY_TOKEN`, `GH_TOKEN`, `GITHUB_TOKEN`, `GITLAB_TOKEN` removed; `GH_CONFIG_DIR`/`BRAIN_MEMORY_TEST_ROOT` point at an empty non-git dir). Case (a) no `NODE_TEST_CONTEXT`, no marker, `BRAIN_MEMORY_TOKEN=''`, `--json` → exit 1, stderr matches `invokerMissing` and NOT the blank-token error, stdout `''`; (b) `NODE_TEST_CONTEXT` set with `--invoker manual` → `invokerUnderTest`; (c) `--dry-run --json` against a local git fixture, no seam → exit 0, `dryRun:true`. Satisfies REQ-SHIP-1, REQ-SHIP-2. Done when: cases fail safely (child currently dies at `collect` on the non-git root, not with the expected guard message).
- [x] 1.3 In `brain/scripts/memory/cli.ship.test.mjs`, add RED assertions: `--json` output carries `invoker:null` without a marker and `invoker:'manual'` with one; a source-order check that the guard call precedes both `process.env[MEMORY_TOKEN_ENV]` and `.getVcs(`; update the `:603` pinned body assertion to the post-guard expected body. Satisfies REQ-SHIP-1, REQ-SHIP-3. Done when: the new assertions fail against current `cli.mjs`.
- [x] 1.4 In `brain/scripts/memory/session-end-ship.test.mjs:101-149`, change the RED assertion to `argv.slice(1)` deep-equals `['ship','--json','--invoker','hook']` and keep the strict-identity check `opts.env === process.env` (A2). Satisfies REQ-SHIP-3. Done when: assertion fails against current argv (missing `--invoker hook`).
- [x] 1.5 In `brain/scripts/memory/day-start-sweep.test.mjs:39-53`, change the RED assertion to `argv.slice(1)` deep-equals `[...,'--invoker','sweep']` and keep `'env' in opts === false`. Satisfies REQ-SHIP-3. Done when: assertion fails against current argv.
- [x] 1.6 In `brain/scripts/memory/package-scripts.test.mjs:53`, change the RED assertion so the expected `ship` script body ends with `--invoker manual`, for both the canonical script and its alias. Satisfies REQ-SHIP-3. Done when: assertion fails against current `package.json`.
- [x] 1.7 Create `test/lane-ship-invoker.e2e.test.mjs` (RED) with the four scenarios: (1) real `npm run brain:memory:session-end` against a `BRAIN_MEMORY_TEST_ROOT` git fixture with a candidate, fake port, `mrCreate:999`, `TMPDIR`/`TEMP=testTmp` — poll the log up to 30s, assert `invoker:'hook'`, `pr.number:999`, lane ref on local origin; (2) same chain without the fake port and a non-git root — log contains `invokerUnderTest`; (3) sweep chain via a `node -e` child importing `runLaneSweep` with a real-`spawnSync`-wrapping `_spawnSync` — assert `invoker:'sweep'`, and in the no-port variant exit 1 + `invokerUnderTest`; (4) `npm run brain:memory:ship -- --json` returns `invoker:'manual'`, and `-- --dry-run --json` works with no seam. Skip the hook-chain assertion on win32 (POSIX mode bits). Satisfies REQ-SHIP-2, REQ-SHIP-3. Done when: scenarios (1) and (3) fail (no `--invoker` yet on either caller).

## Phase 2: Guard + Caller Markers GREEN

- [x] 2.1 Create `brain/scripts/memory/lib/ship-invoker.mjs` exporting `INVOKERS`, `REFUSAL`, and `decideShipInvoker({args, env})` per the interface contract (check order: argv syntax → bypass → `NODE_TEST_CONTEXT` → presence of `--invoker`; bypass = `env.BRAIN_VCS_TEST_MODULE !== undefined` or `--dry-run` present). Satisfies REQ-SHIP-1, REQ-SHIP-2. Done when: 1.1 is GREEN.
- [x] 2.2 In `brain/scripts/memory/cli.mjs`, call `decideShipInvoker` once, after argv parsing (`:473-475`) and before the `try` (`:477`); on refusal print one `memory/cli: <t(key)>` line to stderr, exit 1, leave stdout empty even with `--json`; on success continue unchanged. Spread `invoker` into the `--json` result object near `:516`. Keep the guard call and its comments free of the literal strings `.getVcs(` and `process.env[MEMORY_TOKEN_ENV]`. Satisfies REQ-SHIP-1, REQ-SHIP-2, REQ-SHIP-3. Done when: 1.2 and 1.3 are GREEN.
- [x] 2.3 Add `memory.ship.invokerMissing`, `memory.ship.invokerUnderTest`, `memory.ship.invokerInvalid` to `brain/scripts/i18n/en.mjs` and `brain/scripts/i18n/es.mjs` after `memory.ship.badHost`, matching the message contracts (accepted values + `npm run brain:memory:ship`; `NODE_TEST_CONTEXT` + the two seams; the echoed rejected token). Satisfies REQ-SHIP-1, REQ-SHIP-2. Done when: 2.2's refusal messages resolve correctly in both locales.
- [x] 2.4 In `brain/scripts/memory/session-end-ship.mjs:29,178`, append `--invoker hook` to the spawn argv; update the adjacent doc line. Do not change the `env: process.env` pass-through. Satisfies REQ-SHIP-3. Done when: 1.4 is GREEN.
- [x] 2.5 In `brain/scripts/memory/day-start-sweep.mjs:23,42`, append `--invoker sweep` to the spawn argv; update the adjacent doc line. Do not add an `env` key. Satisfies REQ-SHIP-3. Done when: 1.5 is GREEN.
- [x] 2.6 In `package.json:77,89`, update the `ship` script body and its alias to end with `--invoker manual`. Satisfies REQ-SHIP-3. Done when: 1.6 is GREEN.
- [x] 2.7 Add a one-paragraph `CHANGELOG.md` Unreleased entry describing the invoker guard. Done when: entry exists and mentions `--invoker` and the meta-test.
- [x] 2.8 Run 1.7's e2e file to GREEN. Done when: all four scenarios pass (win32 hook-chain assertion skipped).

## Phase 3: Meta-Test With Its Allowlist

- [x] 3.1 Create `brain/scripts/test-spawn-hygiene.test.mjs`, sibling of `brain/scripts/test-hygiene.test.mjs`: scan the same globs (`brain/scripts/**/*.test.mjs`, `test/**/*.test.mjs`), reuse `callArgsText` (`test-hygiene.test.mjs:63-81`), flag `spawn`/`spawnSync`/`execFile`/`execFileSync`/`fork` calls whose first argument is a runtime (`process.execPath`, `'node'`, `'npm'`, `'bash'`, `'sh'`) or resolves under `brain/scripts/`, or whose callee is `fork`; exclude a pure `-e`/`-p`/`--input-type` eval unless its text contains `brain/scripts/`. Resolve the entrypoint per the identifier/literal/`npm run X`→`npm:X`/`<unresolved>` rules; an unresolved entrypoint still counts as a hit (fail closed). Satisfies REQ-SHIP-4. Done when: the scanner runs and reports uncovered hits against an empty allowlist.
- [x] 3.2 In the same file, add `ALLOWLIST = [{file, entrypoint, line?, reason}]` and `REASONS = ['no-vcs-capability', 'fixture-root-local-git', 'vcs-port-substituted', 'refusal-asserted']`; `validateAllowlist` rejects any other reason, naming the allowed list. Classify `cli.ship.test.mjs` as `vcs-port-substituted`; `cli.ship-invoker.test.mjs` as `refusal-asserted` plus a line pin for the dry-run case; the explorer's seven per the design's table (`harness/engines-cli`, `config/cli`, `status/snapshot-cli` → `no-vcs-capability`; `brain-promote.locks`, `brain-promote.amendment` → `fixture-root-local-git`; `approve/locks`, `harness/run-stage` → `refusal-asserted`); `test/lane-ship-invoker.e2e.test.mjs` as `vcs-port-substituted`. Populate the remaining entries for the full inventory (measured on 62100b6a: 141 runtime spawns/38 files + 21 bash/sh/identifier-binary spawns/13 files; expect ~45-55 allowlist entries). Satisfies REQ-SHIP-4. Done when: no hit is left uncovered and no entry is stale.
- [x] 3.3 Add line-pinned `<unresolved>` allowlist entries for `brain/scripts/memory/lib/hydration-guard.processes.integration.test.mjs:40` and `brain/scripts/brain-audit.test.mjs:1859`. Satisfies REQ-SHIP-4. Done when: both spawns resolve to a covered, non-stale entry.
- [x] 3.4 Add self-proving fixtures: (1) a planted fixture test file with a runtime spawn of `cli.mjs ship`, an `npm run` spawn, and a pure eval — scanner returns exactly the two hits, both uncovered against an empty allowlist; (2) `validateAllowlist` rejects `reason:'looks-safe'`, and a line-pinned entry matching nothing is reported stale. Build callee names by concatenation (as in `test-hygiene.test.mjs:132`) so the scanner does not flag its own fixtures as production spawns. Satisfies REQ-SHIP-4. Done when: 3.1 passes fully, including both self-proving assertions.

## Phase 4: Anti-Pattern Draft

- [x] 4.1 Create `openspec/changes/issue-1012-lane-ship-invoker-guard/brain-drafts/anti-patterns/test-spawns-a-live-entrypoint.md`, shaped like `brain/core/anti-patterns/*.md` (Problem/Why/Rule/Detection): Discovered in #1007 (`npm test` pushed a lane and opened a PR) / Applies to any test that spawns a runtime entrypoint / Cause: test safety depended on configuration (lane flag + an authenticated `gh`) / Solution: the caller declares itself, an independent test-runner signal, and seams that make the real port structurally unreachable / Detection: `brain/scripts/test-spawn-hygiene.test.mjs`. Do not place this file under `brain/core/**`. Satisfies REQ-SHIP-5. Done when: file exists in `brain-drafts/anti-patterns/` with all four sections.
- [x] 4.2 Create `openspec/changes/issue-1012-lane-ship-invoker-guard/brain-drafts/anti-patterns/README-index-line.md` containing the one-line index entry `- [A test spawns a live entrypoint and trusts configuration to keep it harmless](test-spawns-a-live-entrypoint.md)`, marked to go after `brain/core/anti-patterns/README.md:58` (maintainer applies it). Satisfies REQ-SHIP-5. Done when: file exists and names the target insertion line.

## Phase 5: Verification

- [x] 5.1 Run the focused suite: `node --test brain/scripts/memory/lib/ship-invoker.test.mjs brain/scripts/memory/cli.ship-invoker.test.mjs brain/scripts/memory/cli.ship.test.mjs brain/scripts/memory/session-end-ship.test.mjs brain/scripts/memory/day-start-sweep.test.mjs brain/scripts/memory/package-scripts.test.mjs brain/scripts/test-spawn-hygiene.test.mjs test/lane-ship-invoker.e2e.test.mjs`. Done when: all green.
- [x] 5.2 Lane-safety guarded full run: record `git ls-remote origin 'refs/heads/memory/*'` and the list of open PRs (`gh pr list`) BEFORE running `npm test`; run `npm test`; record both again AFTER. Fail this task on any difference between before/after snapshots (a real lane push or PR would mean the guard, a caller marker, or a test seam regressed). Done when: `npm test` is green and both snapshots are identical.
- [x] 5.3 Run `npm run brain:repo:check` (or the project's governed-diff check) and confirm the governed diff stays under the 400-line budget, consistent with the design's ~85-line estimate. Done when: check passes and diff size is recorded.

## Notes (not tasks)

- This PR must merge before the next release that ships `brain:memory:ship` in a consumer's `package.json` (the installer merge at `brain/scripts/lib/installer.mjs:1358-1361` is add-only with no migration path once that script exists in the wild).
- Out of scope: `collect` still runs under `--dry-run` (`lane/ship.mjs:254,276`), so a dry-run spawn without `BRAIN_MEMORY_TEST_ROOT` writes a local commit on a `refs/heads/memory/*` ref in the real repository. Tracked as a follow-up; the meta-test's `vcs-port-substituted` review is the only current control.
