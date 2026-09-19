# Tasks: memory-gate receives the PR context and reads the default branch (#1024)

## Review Workload Forecast

| Field | Value |
|---|---|
| Estimated changed lines | Governed ~310 (workflow env ~12, `default-branch-records.mjs` ~95, `memory-gate-override.mjs` ~45, `run-check.mjs` ~80, provider `kind` param ~10, metrics ~35, `contributor-scaffold.mjs` ~16, stale-comment updates ~8, CHANGELOG ~12); raw (tests + `brain-drafts/**`, ignored by `brain.config.json:23-34`) large and unraveled from governance |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | auto-chain |
| Chain strategy | feature-branch-chain (preselected; unused for one PR) |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: feature-branch-chain
400-line budget risk: Low

`brain.config.json:23-34` excludes tests, `openspec/changes/**`, `AGENTS.md` and `.memory/**` from governed diff. Governed lines (~310) sit well under the `lite`-tier budget of 1000 and the default 400. The D7 tier-honor conflict was resolved by the maintainer on 2026-09-18 (follow `TIER_PARAMS`), so no split/exception decision is needed before apply.

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Rollback boundary |
|---|---|---|---|---|
| 1 | RED coverage (drift-guard, default-branch-records unit+integration, override, parity, T2.1 block, provider/metrics/scaffold) | PR #1 (only PR) | `node --test brain/scripts/vcs/ci-context-drift-guard.test.mjs brain/scripts/governance/default-branch-records.test.mjs brain/scripts/governance/default-branch-records.integration.test.mjs brain/scripts/governance/memory-gate-override.test.mjs` | Revert test files only; no runtime change yet |
| 2 | Wiring + reader + override + output GREEN | same PR | `node --test brain/scripts/governance/run-check.test.mjs` | Revert workflow env + `run-check.mjs` + the two new modules together (single behavior) |
| 3 | Provider `kind` param + metrics honored-count GREEN | same PR | `node --test brain/scripts/vcs/providers/gitlab.test.mjs brain/scripts/lib/metrics-aggregate.test.mjs brain/scripts/brain-metrics.test.mjs` | Revert provider + metrics diffs together |
| 4 | Scaffold text + regenerated templates GREEN | same PR | `node --test brain/scripts/vcs/contributor-scaffold.test.mjs` | Revert scaffold source + both emitted files together |
| 5 | Doctrine draft (Tier 2, non-runtime) | same PR | none (dry-run only) | Revert `brain-drafts/**` |
| 6 | CHANGELOG + full verification | same PR | `npm test` | N/A — gate, not a commit |

### Proposed Commit Plan (work-unit-commits, conventional, `(#1024)`, no attribution trailers)

1. `test(governance): add RED coverage for memory-gate's PR context and default-branch read (#1024)` — Phase 1 tasks.
2. `feat(governance): wire memory-gate to the PR context and union the default branch into scoped evidence (#1024)` — Phase 2 tasks (workflow env, `default-branch-records.mjs`, `memory-gate-override.mjs`, `run-check.mjs`, path output).
3. `feat(vcs): read merge-request label events for the memory-gate override (#1024)` — Phase 3 tasks (`gitlab.mjs` `kind` param, `brain-metrics.mjs`/`metrics-aggregate.mjs`/`merge-walk.mjs` honored counting).
4. `docs(vcs): drop the stale "no gate reads it" claim from the contributor scaffold (#1024)` — Phase 4 tasks (scaffold text + regenerated templates).
5. `docs(governance): draft the workflow-governance amendment for memory-gate's tier-scoped override (#1024)` — Phase 5 tasks.
6. `docs: note the memory-gate PR-context change in CHANGELOG (#1024)` — Phase 6's CHANGELOG task.

## Phase 1: RED Coverage

- [x] 1.1 In `brain/scripts/vcs/ci-context-drift-guard.test.mjs`, add `#1024: the memory-gate job supplies every input the scoped check consumes`, modelled on `:477-494`, asserting the `memory-gate` job block declares `VCS_TOKEN`, `PR_NUMBER`, `PR_BODY` and `DEFAULT_BRANCH`. Satisfies REQ-L3-6. Done when: it fails against `governance.yml` as it stands at `02896d69` (DEFAULT_BRANCH only), naming the missing keys. **RED confirmed** (ran against base, failed naming `VCS_TOKEN`).
- [x] 1.2 Create `brain/scripts/governance/default-branch-records.test.mjs` with an injected git runner: exact fetch/ls-tree/cat-file argv (D1, D2); batch parsing incl. embedded newlines and a `missing` line; each cause string verbatim; empty listing → `[]`; corrupt line skipped; `unionRecordsById` PR-first-wins/counts-once/id-less-kept (D4). Satisfies REQ-L3-4. **Deviation**: the module was written before this test (see apply-progress.md TDD evidence) — RED was proven retroactively by temporarily moving `default-branch-records.mjs` aside and confirming module-not-found failure, then restoring byte-identical.
- [x] 1.3 Parity case vs `store.mjs#readRecords` on an identical fixture (D4). Satisfies REQ-L3-4. Same RED-proof caveat as 1.2 (same file/module).
- [x] 1.4 Create `brain/scripts/governance/default-branch-records.integration.test.mjs` (real git in a `testTmp()` dir, no network): bare origin + `--depth 1 --branch feature file://` clone; a second case removes `main` and asserts the fetch-failure cause. Satisfies REQ-L3-4. Written after the module existed (functional verification of an already-implemented reader against real git), not a RED-first unit test — flagged in the TDD evidence table.
- [x] 1.5 Create `brain/scripts/governance/memory-gate-override.test.mjs`: honored at `standard` w/ distinct applier; refused for author/reviewActors/agentActors; latest `add` wins; `events === null` never honored; `labels === null` never skips; not consulted at `lite`; refused at `regulated`. Satisfies REQ-L3-5. **Same deviation as 1.2**: module written first; RED proven by temporarily moving the module aside (confirmed module-not-found), then restored and GREEN.
- [x] 1.6 T2.1 block added to `brain/scripts/governance/run-check.test.mjs` (default-branch-only HIT, PARTIAL-count-once, lazy-union non-call, D5 fail-closed at standard+lite, D6 body-uncomputable by tier, D8 regulated suffix, manifest `true`); the `:175` "prints nothing" assertion updated to expect the `path=` line (now 2 lines on a failing run — path + reason). Satisfies REQ-L3-4, REQ-CIC-3. **RED confirmed** (11 new/changed assertions failed against the pre-2.4 `run-check.mjs`).
- [x] 1.7 T7b mutation tests retargeted from `memory-gate` to `decision-gate` (memory-gate legitimately reaches `getVcs` now, D9); two of the five retargeted cases (cross-file getVcs-injection, arrow-form) build a synthetic temp module + `dir` override, mirroring the existing crossFileClosure-propagates-null fixture pattern, since `decision-gate`'s handler (`adrPresence`) is cross-file, unlike memory-gate's former local handler. `SUBCOMMAND_PORT_REACH['memory-gate'] === true` / `['decision-gate'] === false` assertion added. Satisfies REQ-L3-5. **RED confirmed** as part of the same 1.6 run (T7/T7b tests failed with a manifest-count mismatch before `SUBCOMMAND_PORT_REACH` was flipped).
- [x] 1.8 RED case added to `brain/scripts/vcs/providers.test.mjs` (the real test file — `gitlab.test.mjs`/`github.test.mjs` do not exist as separate files in this repo; gitlab.mjs/github.mjs are both tested from `providers.test.mjs`): `labelEvents({ kind: 'mr' })` requests `merge_requests/:iid/resource_label_events`; default/`'issue'` unchanged; a github `kind`-ignored case added too. Satisfies REQ-L3-5. **RED confirmed** (kind:'mr' case failed against current `gitlab.mjs`).
- [x] 1.9 RED cases added to `brain/scripts/lib/metrics-aggregate.test.mjs` (raw/honored fields + by-author) and `brain/scripts/brain-metrics.test.mjs` (two new integration-style cases: honored-applier distinct from author, and author-applied-never-honored; `kind: 'mr'` asserted on the labelEvents call). Satisfies design item 7. **RED confirmed** on both files against current (raw-only, no `kind`) code.
- [x] 1.10 `brain/scripts/vcs/contributor-scaffold.test.mjs` updated: the "does not promise skip:memory-gate exempts anything" test replaced with "states the tier-scoped reality, never a blanket exempts-nothing claim" (the OLD assertion would now demand a FALSE claim, since skip:memory-gate genuinely does something at `standard`); the verbatim checklist-item regex (was pinning "is named in the docs but no gate reads it") updated to the new tier-scoped sentence, parameterized on `{{abbr}}` (PR/MR) via `scaffoldDelivery(provider)`. Satisfies design's Doctrine touchpoints item. **RED confirmed** against the current template text and stale test text.

## Phase 2: Wiring + Reader + Override + Output GREEN

- [x] 2.1 `.github/workflows/governance.yml`'s `memory-gate` job now declares `VCS_TOKEN`/`PR_NUMBER`/`PR_BODY` alongside `DEFAULT_BRANCH`, mirroring `issue-link`; no `fetch-depth: 0` added (D1). 1.1 GREEN.
- [x] 2.2 `brain/scripts/governance/default-branch-records.mjs` created, exporting `readDefaultBranchRecords` and `unionRecordsById` (plus the shared parse/dedupe helper `dedupeJsonlRecords`, exported for the parity test). 1.2/1.3/1.4 GREEN.
- [x] 2.3 `brain/scripts/governance/memory-gate-override.mjs` created, exporting `decideMemoryGateOverride` and a shared `toActorList` helper (also reused by `run-check.mjs` and `brain-metrics.mjs` — one implementation of the config→list coercion, not three). 1.5 GREEN.
- [x] 2.4 `run-check.mjs`'s `runMemoryGateCheck` replaced per the Data Flow (override short-circuit → D6 body-uncomputable → global fallback → D3 lazy union → D5 fail-closed → D8 regulated suffix); `defaultFetchPrLabelEvents` named function added (D9); `SUBCOMMAND_PORT_REACH['memory-gate']` flipped to `true`; `main()`'s print now emits the `memory-gate: path=<p> (<detail>)` line on every run (keyed on `typeof policied.path === 'string'`, not a literal `checkName === 'memory-gate'` comparison, to avoid double-counting in the T7 dispatch-count drift guard). 1.6/1.7 GREEN.

## Phase 3: Provider `kind` Param + Metrics GREEN

- [x] 3.1 `gitlab.mjs`'s `labelEvents` gained `kind: 'issue'|'mr'` (default `'issue'`); `github.mjs`'s `labelEvents` accepts and ignores `kind`. 1.8 GREEN.
- [x] 3.2 `brain-metrics.mjs`: `prAuthor` now destructured from `fetchPrMeta`; the `bypassAuthorCache` fetch (reused for both `size:exception` and `skip:memory-gate`) now passes `kind: 'mr'` unconditionally (it is always the PR/MR's own number, never an issue's); `skipMemoryGateHonoredAuthor` resolved via `decideMemoryGateOverride`. `metrics-aggregate.mjs`: `bypass.skipMemoryGateHonored` + `skipMemoryGateByAuthor` added to `foldMerge`/`newRow`. Markdown/JSON renderers updated (raw/honored column + a new by-author section); stale caveat text rewritten. **Deviation**: `brain/scripts/lib/merge-walk.mjs` was NOT modified — `fetchPrMeta` already returned `prAuthor` before this change (only `brain-metrics.mjs` had failed to destructure it); no `merge-walk.mjs` edit was needed. 1.9 GREEN.

## Phase 4: Contributor Scaffold GREEN

- [x] 4.1 `GATE_SUMMARY['memory-gate']` and the header lesson-comment updated (both providers now hand the gate the description); the `SCAFFOLD_TEMPLATE` checklist sentence replaced with the tier-scoped `skip:memory-gate` rule, parameterized on `{{abbr}}`.
- [x] 4.2 `.github/PULL_REQUEST_TEMPLATE.md` and `.gitlab/merge_request_templates/Default.md` regenerated via `renderScaffold()`. 1.10 GREEN.

## Phase 5: Doctrine Draft (Tier 2, non-runtime)

- [x] 5.1 `openspec/changes/issue-1024-memory-gate-pr-context/brain-drafts/workflow-governance-memory-gate.draft.md` created: `target: brain/core/methodology/workflow-governance.md`, `issue: 1024`, 5 edits / 6 amend-find/amend-replace pairs (Edit 5 has two) covering `:23`, `:42-49`, `:55-57`, `:59-62`, `:236`, `:262-267`. **Deviation**: plain ```` ``` ```` fences used throughout, not `~~~` — the quoted content contains only single backticks (inline code), never a nested triple-backtick sequence, matching the existing precedent (`harness-contract.session-start.draft.md`); `~~~` is reserved for acts that would otherwise nest triple-backtick fences, which none of these six do.
- [x] 5.2 Dry-run executed via `runPromote()` against a `makeFixtureRepo()`-built temp repo (real `SOURCE_DOCS` copied from this checkout) with mocked `writeFileFn`/`stageFn` (push to an array, no real write) and `readLineFn` resolving `PROMOTE`. Result: `exitCode: 0`; all 6 anchors resolved exactly once (`free === 1`); plan printed all 6 BEFORE/AFTER pairs plus the `AGENTS.md` regeneration act; "staged 2 file(s)" (`workflow-governance.md`, `AGENTS.md`) — both writes landed only in the mocked array/temp fixture; the fixture's own `git status --porcelain` stayed empty (no real write even inside the fixture); nothing under this repo's real `brain/**` was touched. Full output quoted in apply-progress.md / the return summary.
- [x] 5.3 `brain-drafts/README.md` created noting ADR-0014 `:66` and `evidence-reader-empty-on-failure.md:14` are historical and receive no edit; the draft's own header banner repeats the note.

## Phase 6: CHANGELOG + Verification

- [x] 6.1 `CHANGELOG.md` "Unreleased" entry added, naming the exact `VCS_TOKEN`/`PR_NUMBER`/`PR_BODY` block, the default-branch union (no rebase), and the tier-scoped `skip:memory-gate` rule.
- [x] 6.2 Focused suite green: 479/479 (`ci-context-drift-guard.test.mjs`, `default-branch-records.test.mjs`, `default-branch-records.integration.test.mjs`, `memory-gate-override.test.mjs`, `run-check.test.mjs`, `providers.test.mjs`, `metrics-aggregate.test.mjs`, `brain-metrics.test.mjs`, `contributor-scaffold.test.mjs`, plus `brain-check.test.mjs` and `workflow-auth.test.mjs`, both touched as collateral fixes — see apply-progress.md).
- [x] 6.3 Lane-safety guarded full run: `git ls-remote origin 'refs/heads/memory/*'` (0 refs) and `gh pr list` snapshots taken before and after `npm test`; identical both times (one unrelated external PR-list change — #1040 disappearing, #1043/#1044 appearing — happened between the FIRST baseline check at session start and the SECOND check taken immediately before this run, not during `npm test` itself; the before/after pair bracketing `npm test` itself is byte-identical). `npm test`: 5900/5900 green.
- [x] 6.4 `npm run brain:repo:check` — pass. `npm run brain:nav` — pass. `npm run brain:check` — `diffSize` reports `[PASS]`, but ONLY because it diffs `git diff <base> HEAD` (committed state) and nothing has been committed yet — not a valid signal for this session's uncommitted work. The REAL governed diff, hand-measured (`git diff --numstat` minus `governance.ignoreList`, plus the two new non-test modules), was corrected TWICE: first reported ≈866 here (using an incorrect module-size figure), then Batch 3's re-measurement found the true, current total is **1012 governed lines** — at/over this repo's own `lite`-tier budget (1000). See Batch 3's own note below and apply-progress.md. `issueLink` and `npmTest` sub-checks FAIL for reasons unrelated to #1024 (no commit made yet; `brain-check.mjs`'s `spawnCommand` hits Node's default 1 MB `spawnSync` buffer against `npm test`'s ~1.04 MB of output — a pre-existing tooling limitation, confirmed via direct reproduction). The direct `npm test` run in 6.3 is the authoritative correctness signal: 5900/5900 green (Batch 1), 5910/5910 green (Batch 3).

## Batch 2 (post-6.4): incident fix

A safety incident was found after 6.1-6.4 above: `default-branch-records.mjs`'s targeted
`--depth=1` fetch ran unconditionally, and three test call sites reached it with the real
repo as `cwd` (a scoped MISS/PARTIAL falls through to the default-branch reader per D3),
which shallowed a full clone of this repository during `npm test`. Fixed: the reader now
checks `git rev-parse --is-shallow-repository` first and only fetches on an
already-shallow checkout; the three test sites now inject a hermetic fake. Full detail,
RED-first evidence, and verification (git-spy count, shallow-status before/after,
re-run of 6.2-6.4) in `apply-progress.md`'s "Batch 2" section. `npm test` is now
5904/5904 (4 new cases: 3 unit + 1 integration pair net of existing).

## Batch 3: cold-review fixes (REQUEST_CHANGES, orchestrator-verified)

A cold review found 4 real defects (1 blocker, 1 major, 2 minor) after Batch 2. Fixed,
RED-first, all four:
1. BLOCKER: `defaultFetchPrLabelEvents` never passed `kind: 'mr'` or threaded
   `gitlabApiConfig()` — the skip:memory-gate override could never be honored on GitLab
   (it silently read ISSUE label events for the MR's own numeric IID instead).
2. MAJOR: the override's refusal reason was discarded unless honored — regulated
   refusals, author refusals, deny-listed refusals, and the `lite` not-consulted note were
   computed by `decideMemoryGateOverride` but never surfaced on the final result.
   `runMemoryGateCheck` refactored (`evaluateMemoryGateFallback` + `applyOverrideNote`) so
   the note is appended on every outcome (pass, warning, fail, uncomputable); a
   standard-tier unlabeled scoped miss now also names `skip:memory-gate` as available
   (REQ-L3-5).
3. MINOR: `applier === prAuthor` compared case-sensitively in `memory-gate-override.mjs`;
   now lowercased, matching `isInList`'s discipline for the deny lists.
4. MINOR (visibility): a full clone's local, un-fetched ref could look like fresh evidence;
   `readDefaultBranchRecords` now returns `fetched: boolean`, and the union `pathDetail`
   states `(fetched)` or `(local ref, not fetched)` accordingly.

Also corrected the governed-diff figure to **1012 lines** (at/over this repo's own
`lite`-tier budget of 1000 — see 6.4's note above). Full detail, RED-first evidence,
verbatim reason texts, and verification (git-spy count, shallow-status before/after,
re-run of the focused suite/`npm test`/`brain:repo:check`/`brain:nav`) in
`apply-progress.md`'s "Batch 3" section. `npm test` is now 5910/5910.

## Notes (not tasks)

- File the follow-up issue: "feat(governance): re-run memory-gate on open PRs when their issue's record lands on the default branch" (`governance-relabel.yml` + `brain/scripts/governance/relabel-retrigger.mjs`, per the proposal's Follow-up issue section). Until it ships, a manual re-run heals an affected PR.
- File the follow-up for `regulated` PARTIAL enforcement: whether a PARTIAL coverage pass should count as a MISS to match `issue-linked-session-summary` (proposal question 2, deferred by D8 — this change only makes the gap visible).
- GitLab remains unverified end-to-end for this change (`brain/scripts/ci/gitlab-governance.yml` is unmodified); the `kind: 'mr'` provider change is unit-tested only.
