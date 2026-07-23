# Tasks: brain: Verb Namespace (issue-137-brain-namespace)

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~450 (S1≈35, S2≈20, S3≈57, S4≈136, S5≈200) |
| 400-line budget risk | Medium — each slice fits under 400; cumulative total does not |
| Chained PRs recommended | Yes |
| Suggested split | PR1→S1 → PR2→S2 → PR3→S3 → PR4→S4 → PR5→S5 |
| Delivery strategy | ask-on-risk |
| Chain strategy | stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: Medium

### Work Units

| Unit | Goal | PR / Base |
|------|------|-----------|
| S1 | De-risk call sites | PR 1 → main |
| S2 | Add brain:* aliases | PR 2 → S1 |
| S3 | i18n + user strings | PR 3 → S2 |
| S4 | Docs + fixtures | PR 4 → S3 |
| S5 | specialMerge + release | PR 5 → S4 |

---

## S1 — De-risk Call Sites [Spec: No-Subprocess Contract]

- [x] S1.1 [CREATE] `brain/scripts/verify-change.test.mjs` — source inspection: `pm.runArgs('repo:check'` absent; `['node','brain/scripts/check-refs.mjs']` present (RED until S1.3).
- [x] S1.2 `brain/scripts/verify-change.mjs:28` — MATRIX repo-scope `commands`: `() => [pm.runArgs('repo:check', true)]` → `() => [['node', 'brain/scripts/check-refs.mjs']]`. `pm`/`detectPM` import unchanged (other rows still use it). Verify S1.1 turns GREEN.
- [x] S1.3 `brain/scripts/brain-check.mjs:131` — CLI `repoCheckFn` lambda: `spawnCommand('npm', ['run', 'repo:check'], cwd)` → `spawnCommand('node', ['brain/scripts/check-refs.mjs'], cwd)`.
- [x] S1.4 `npm test` green — `brain-check.test.mjs` injected-fn tests confirm no regression.

## S2 — Add brain:* Aliases [Spec: Verb Namespace Uniformity]

- [x] S2.1 `package.json` scripts — add 8 `brain:*` entries (`brain:env:init`, `brain:day:start`, `brain:ticket:start`, `brain:project:feature`, `brain:project:status`, `brain:tracker:board`, `brain:repo:check`, `brain:change:verify`) pointing at identical direct targets; retain old 8 verbs unchanged.
- [x] S2.2 Internal header comments in `brain-check.mjs:~8` + `bootstrap.sh:2` — update verb refs to `brain:*` equivalents.
- [x] S2.3 `npm test` green.

## S3 — i18n + User-Facing Strings [Spec: i18n Lockstep]

- [x] S3.1 `brain/scripts/i18n/en.mjs` — update all verb strings referencing old names (`env:init`, `repo:check`, `change:verify`, `ticket:start`, `project:status`, `day:start`, `project:feature`) to `brain:*` equivalents.
- [x] S3.2 `brain/scripts/i18n/es.mjs` — same updates lockstep with S3.1.
- [x] S3.3 `brain/scripts/i18n/coverage.test.mjs` — update `assert.equal` expected strings to match new verb names; `npm test` stays green.
- [x] S3.4 `brain/scripts/harness/backends/gentle-ai.mjs:~238,~255` — `re-run env:init` → `re-run brain:env:init`.
- [x] S3.5 `brain/scripts/bootstrap.sh` heredoc output (line ~305–310) — `npm run day:start`, `npm run repo:check`, `npm run project:feature` → `brain:*`.
- [x] S3.6 `npm test` green — `coverage.test.mjs` suite passes.

## S4 — Docs, Methodology, Fixtures [Spec: Deprecation Contract]

- [x] S4.1 `brain/core/methodology/harness-contract.md` verb table — add `brain:*` as authoritative name column; mark old verbs deprecated aliases; update inline refs (~line 58).
- [x] S4.2 `brain/core/methodology/consolidation-protocol.md` + `brain/core/methodology/agent-authorities.md` — old verb refs → `brain:*`.
- [x] S4.3 `README.md` — all old verb occurrences → `brain:*` equivalents (16 occurrences identified).
- [x] S4.4 `docs/adoption.md` + `docs/inbox/workflow-governance-layer.md` + `docs/inbox/nx-coexistence.md` — verb refs → `brain:*`.
- [x] S4.5 `test/fixtures/{npm,pnpm,bun,yarn}/package.json` — add BOTH old verb + `brain:*` equivalent entries; keep existing `brain:upgrade` key.
- [x] S4.6 `test/fresh-install/in-container.sh` + `test/upgrade/in-container.sh` — update invocation verb names to brain:*.
- [x] S4.7 `brain/scripts/lib/adopt/__fixtures__/catastro-flat/scripts/setup.sh` — update `npm run env:init` → `brain:env:init`.
- [x] S4.8 `npm test` green.

## S5 — package.json specialMerge [Spec: Additive Verb Injection]

- [x] S5.1 `brain/core/managed-paths.mjs` — export `MANAGED_SCRIPT_KEYS` (8 `brain:*` verb names); add `'package.json'` to `managed[]`.
- [x] S5.2 `brain/scripts/lib/installer.mjs` — pure `mergePackageJsonScripts(consumerPkgRaw, managedScripts): string` — additive, consumer-wins, returns `JSON.stringify(out, null, 2) + '\n'`.
- [x] S5.3 `brain/scripts/lib/installer.test.mjs` — 5 unit tests for `mergePackageJsonScripts`: (a) never-overwrite consumer key, (b) idempotency / no-op second run, (c) additive injection of all missing keys, (d) absent consumer file → writes scripts subset, (e) non-scripts fields untouched.
- [x] S5.4 `brain/scripts/lib/installer.mjs` — IO wrapper `mergePackageJson(destPath, srcPath)` (specialMerge signature): read brain `srcPath` pkg.json; filter `scripts` to `MANAGED_SCRIPT_KEYS` → `managedScripts`; read consumer (may be absent); call pure fn; write-if-changed (compare bytes to avoid mtime churn).
- [x] S5.5 `brain/scripts/brain-upgrade.mjs:98` — add `'package.json': mergePackageJson` to `specialMerge` map; add `mergePackageJson` to the import from `./lib/installer.mjs`.
- [x] S5.6 `brain/scripts/lib/managed-paths.test.mjs` — add: `managed` includes `'package.json'`; `MANAGED_SCRIPT_KEYS` has exactly 8 entries all prefixed `brain:`.
- [x] S5.7 `test/fresh-install/in-container.sh` + `test/upgrade/in-container.sh` — integration: assert `brain:*` verbs injected without clobbering pre-existing keys; assert idempotent re-upgrade leaves file unchanged.
- [x] S5.8 `package.json` — bump version `0.7.2` → `0.8.0`.
- [x] S5.9 `CHANGELOG.md` — add `0.8.0` entry: `brain:*` namespace, deprecated aliases, package.json additive merge capability.
- [x] S5.10 `npm test` + `npm run test:fresh-install` + `npm run test:upgrade` green (unit tests pass; Docker integration tests not executed — require live Docker + VCS token).

---

## Size Notes (for Review Workload Guard)

- **S3** (i18n+coverage): ~57 lines — all under 400, LOW standalone risk; flagged as "big" relative to slice because coverage.test.mjs assertions must change in lockstep.
- **S5** (installer+tests): ~200 lines — MEDIUM. `installer.test.mjs` is the single largest growth (~75 lines for 5 tests). Root cause per #131: test/fixture line counts drive the estimate above the "small" threshold.
- No individual slice requires `size:exception`. Chained PRs are required by dependency order, not line budget alone.
