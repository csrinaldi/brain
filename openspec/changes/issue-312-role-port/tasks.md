# Tasks: Role Port — Slice A (Option A), ONE PR, three work-unit commits

## Review Workload Forecast

> **Delivery changed 01/09/2026: a single PR, not a chain.** The design forecast **1005 countable lines vs tier `lite`'s 1000** and called the budget risk *High*, and the chained delivery was chosen on that number. **It counted test files.** This repo's live `governance.ignoreList` excludes `**/*.test.mjs` and `openspec/changes/**`, so `diff-size` never sees them. Recomputed the way the CI gate actually measures, the whole change is **~405 countable lines against a 1000 budget** — never near the ceiling.
>
> The chain was solving a problem that did not exist. Recorded rather than quietly re-planned, because the wrong number reached a delivery decision, and that is the same defect this change's own proposal had to correct once already.

| Work unit | Countable (code only) | Excluded (tests / draft) |
|---|---|---|
| 1 — `stage-config.mjs` | ~120 | test 180, migration draft 90 |
| 2 — `role-port.mjs` + `SDD_ENGINES` | `role-port` 200 + `platform.mjs` +15 + `cli.mjs` ±5 ≈ **220** | tests 160 |
| 3 — `plain.declareRoles` + fixture | ~65 | tests 260 |
| **total** | **≈405** | — |

```
Decision needed before apply: No
Chained PRs recommended: No — ~405 countable vs 1000 budget
Delivery: ONE PR, three work-unit commits
400-line budget risk: Low (405 total, and 400 is the STANDARD tier's number; this repo is lite → 1000)
```

**The three units survive as COMMITS, not PRs.** The design built them autonomous — each with its own verification and rollback — and that property is worth keeping inside one PR. Per `work-unit-commits`: each commit is a reviewable unit that leaves the suite green.

### Work units

| Unit | Goal | Commit leaves green | Rollback |
|---|---|---|---|
| 1 | `stage-config.mjs` + tests + `1.3.0` migration draft | its own suite; zero-config identity | delete two files; nothing imports them |
| 2 | `role-port.mjs` + tests + `SDD_ENGINES` extraction | its own suite + `cli.test.mjs` | revert; `resolveEngine` returns to its literal |
| 3 | `plain.declareRoles` + `roles.contract.test.mjs` + fixture | parity loop n=1, debt tripwire | revert; `plain.mjs` returns to two exports |

Baseline `npm test`: 4520 pass / 0 fail. Strict TDD — every behaviour change is RED-first.

**No tracker branch.** Work lands on the existing worktree branch `feat/issue-312-featsdd-role-as-port-per-action-executor`, one PR to `main`.

**The closing-keyword hazard still applies, unchanged by the delivery shape.** The `issue-link` gate refuses `Part of #N` against the default branch, so this PR must carry a closing keyword — but Option A keeps **#312 open behind #814**. The follow-up sub-issue in Phase 4 must therefore exist BEFORE the PR is opened, and the PR closes that issue, not #312. Same hazard #557, #800 and #456 each hit in turn.

## Phase 1: Unit 1 — `stage-config.mjs`

- [x] 1.1 Work on the existing worktree branch; no tracker, no slice branches.
- [x] 1.2 RED: zero-config identity, absent ≡ `{}` [Zero-config identity].
- [x] 1.3 RED: 3 refusals — unresolved stage, unknown field, `enabled` non-boolean (D3).
- [x] 1.4 RED: `enabled:false` → declared-disabled [Explicit disable via `sdd.configs`].
- [x] 1.5 GREEN: `resolveStageConfigs(config)` in `lib/stage-config.mjs`, pure.
- [x] 1.6 Draft migration `1.3.0` (`brain-drafts/config-migrations-1.3.0.md`); state D6 ordering constraint vs #456's `1.2.0`.
- [x] 1.7 `npm test` green.
- [ ] 1.8 Commit unit 1. Suite green at this boundary; nothing imports the new module yet. — NOT DONE: apply run is instructed not to commit (Tier 2, human-gated). Working tree left uncommitted; see apply-progress.

## Phase 2: Unit 2 — `role-port.mjs` + `SDD_ENGINES`

- [x] 2.1 Same branch, no new branch.
- [x] 2.2 RED: seam-absent throws (no `declareRoles`) [Seam absence refused].
- [x] 2.3 RED: per-stage omission throws naming stage, never disabled.
- [x] 2.4 RED: concrete `model_tier` id refused [Concrete model id refused].
- [x] 2.5 RED: dispatch order — `model_tier===null` beats `chooses_model` [`plain` third path].
- [x] 2.6 RED: `chooses_model:true` → engine-chooses [Engine chooses own model].
- [x] 2.7 RED: `resolveRoles` answers `proposal` (D7 trap oracle).
- [x] 2.8 GREEN: `ROLE_TIERS`, `resolveRoles`, `resolveModelSelection`, `loadInhabitant` in `roles/role-port.mjs`.
- [x] 2.9 RED: `cli.test.mjs` — `resolveEngine` unchanged via `SDD_ENGINES`.
- [x] 2.10 GREEN: `export const SDD_ENGINES` in `platform.mjs`; `cli.mjs` reads it, drops literal.
- [x] 2.11 `npm test` green.
- [ ] 2.12 Commit unit 2. — NOT DONE: apply run is instructed not to commit. See 1.8's note.

## Phase 3: Unit 3 — `plain.declareRoles` + contract test

- [x] 3.1 Same branch, no new branch.
- [x] 3.2 Create `roles/fixtures/stage-set-custom.json` — 4 lifecycle stages + custom `cold-review`, `_provenance: derived`.
- [x] 3.3 RED: `declareRoles` answers every stage incl. custom; `model_tier:null`, `chooses_model:false` [checked null; custom stage covered].
- [x] 3.4 GREEN: `declareRoles(stages)` in `plain.mjs`; `AGENT_RUNTIME`/`init` untouched.
- [x] 3.5 RED→GREEN: registry (`roles.contract.test.mjs`) scans `INHABITANTS` only, n=1, dated debt comment [One inhabitant present]. See apply-progress note: this file had no separate RED phase — it is the wiring itself (3.8), and passed on first write against the already-implemented role-port.mjs/plain.mjs.
- [x] 3.6 Membership assertion catches synthetic concrete leak [Concrete id leaking caught].
- [x] 3.7 Tripwire — length===1 + debt-regex, both fail together at n=2.
- [x] 3.8 GREEN: wire `INHABITANTS`, `STAGES` from fixture, one loop body.
- [x] 3.9 Regression: `stage-engine.test.mjs` byte-identical (`git diff` empty); `plain.test.mjs`'s AGENT_RUNTIME assertion body untouched (only additive lines + one import-line edit).
- [x] 3.10 `npm test` green, full suite, no regression (5 pre-existing, unrelated `#637` memory failures persist unchanged — see apply-progress risk note).
- [ ] 3.11 Commit unit 3. — NOT DONE: apply run is instructed not to commit. See 1.8's note.

## Phase 4: The single PR — closes a follow-up issue, NEVER #312

**BLOCKED BY EXPLICIT INSTRUCTION, not by any defect.** This apply run was told:
"Do NOT commit. Do NOT push. Do NOT open a PR." Commits, the follow-up issue,
push, and the PR are Tier 2 and require the human each time. Phases 1-3 are
implemented and green on the worktree, uncommitted. See apply-progress.

- [ ] 4.1 **Before opening the PR**: create the follow-up sub-issue that tracks the remaining work pending #814 (n=2 parity, the `ROLE_DEBT_TICKET` instructions field). It must exist first — the PR's closing keyword needs a target that is safe to close.
- [ ] 4.2 `npm run memory:share && git add .memory/`, then push.
- [ ] 4.3 Open ONE PR (base=`main`): `Closes #<follow-up>` — **never** `Closes #312`, which stays open behind #814 (Option A). Body states: the three work-unit commits and what each leaves green; D6's `1.2.0`/`1.3.0` ordering constraint against #456's unpromoted draft, including that both rewrite the same `brain-config.test.mjs` line; and that `1.3.0` is a DRAFT under `brain-drafts/`, not applied.
- [ ] 4.4 Label `type:feature`. CI green on all ten checks.
- [ ] 4.5 `npm run brain:review -- --pr <N>` from a checkout carrying `sdd.map` (see #812 — the config that enables the inferential half turns 26 tests red, so it cannot live in the tree that runs the suite).
