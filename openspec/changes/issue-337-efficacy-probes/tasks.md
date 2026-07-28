# Tasks: Efficacy Probes Replace Presence Probes (Rung 2)

Issue #337 — M10 Phase 3. Parent #335. Epic #313.

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~180-220 |
| 400-line budget risk | Medium |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Medium

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Efficacy probes + verdict matrix + render caveat | PR 1 | Single PR; 4 files, no new modules |

## Phase 1: Evidence Layer (I/O)

- [x] 1.1 RED: add fixture-based tests in `brain/scripts/vcs/substrate.test.mjs` asserting `evalRung2` receives `{ declared, workflowPresent, workflowText }` evidence (not a boolean) from `probes.releaseGate`
- [x] 1.2 GREEN: refactor `realReleaseGateProbe` (`brain/scripts/brain-governance-status.mjs:88-92`) to return raw evidence — `declared` from `config.governance.releaseGate === true`, `workflowPresent` via `repoFileExists`, `workflowText` via `readFileSync` guarded by try/catch (YAML/read errors → `workflowText: null`)

## Phase 2: Interpretation Layer (Pure)

- [x] 2.1 RED: add unit tests in `substrate.test.mjs` for module-local `classifyReleaseWorkflow(workflowText)` covering post-fact triggers (`push.tags`, `release`, `workflow_run`) and antecedent-capable triggers (`workflow_dispatch`, `push.branches`)
- [x] 2.2 GREEN: implement `classifyReleaseWorkflow` in `substrate.mjs` — line-scan `on:` block (no js-yaml, per D2), return `{ blocking: boolean, reason }`
- [x] 2.3 RED: add the 6-row verdict-matrix tests to `substrate.test.mjs` (declared-only; antecedent+audit+`contents:write`; post-fact-only; audit-present-no-write; absent/not-wired; unparseable evidence)
- [x] 2.4 GREEN: refactor `evalRung2` (`substrate.mjs:78-89`) to consume evidence — `declared` ⇒ `active:true, verifiable:false, mechanism:'release-gate-config-declared'`; text-classified ⇒ `verifiable:true` with `active` per D3 triple (antecedent trigger + audit invocation + `contents: write`); absent ⇒ `active:false, verifiable:true, mechanism:'release-gate-absent'`; unparseable ⇒ `active:false, verifiable:false, mechanism:'release-gate-unparseable'`; every `active:false` row sets `remedy`

## Phase 3: Render Layer

- [x] 3.1 RED: add test in `brain/scripts/brain-governance-status.test.mjs` asserting rung-2 `verifiable:false` renders a caveat line, never the word "verified" (mirrors rung-1 `preReceive` block, `brain-governance-status.mjs:180-184`)
- [x] 3.2 GREEN: extend `printSubstrateReport` to add the rung-2 caveat branch driven solely by `rungs[2].verifiable`/`active`

## Phase 4: Integration Verification

- [x] 4.1 Run full suite (`npm test`) — confirm zero regressions in rungs 1, 3, 4 and in `release-postmerge-workflows.test.mjs` (unchanged, asserts today's shape per D-out-of-scope)
- [x] 4.2 Manually run `npm run brain:governance-status` against brain's own repo; confirm rung demotes 2 → 3 (not 4, since `governance-postmerge.yml` still exists) and capture the output in the PR body

## Phase 5: Documentation

- [x] 5.1 Update rung-2 doc comment block in `substrate.mjs` (currently `:74-77`) to describe the efficacy contract instead of file-presence
- [x] 5.2 PR body: document the brain's-own-repo demotion (2 → 3) as expected and honest; note Phase 4 (#210) will rebuild `release.yml` to reach rung 2 for real
