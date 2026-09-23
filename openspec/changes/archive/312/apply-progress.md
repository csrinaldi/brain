# Apply Progress — Role Port, Slice A (issue #312)

**Mode**: Strict TDD (test runner `npm test`).
**Store**: hybrid — this file + engram `sdd/issue-312-role-port/apply-progress`.
**Batch**: first and only batch so far. Phases 1-3 (Units 1-3) implemented and
green, uncommitted. Phase 4 (follow-up issue, `memory:share`, push, PR) is
explicitly OUT OF SCOPE for this apply run — the orchestrator instructed
"Do NOT commit. Do NOT push. Do NOT open a PR." These are Tier 2 actions
requiring a human each time.

## Baseline discrepancy (report this plainly)

The brief's stated green baseline was **4520 pass / 0 fail**. The measured
baseline on this worktree, BEFORE any change in this apply run, was
**4515 pass / 5 fail** — five pre-existing, unrelated failures in
`brain/scripts/memory/backends/plainfiles.save-index-failure.test.mjs`
(issue #637, `save()`/CLI tests on a broken memory store). Confirmed
unrelated: they exist on the untouched worktree before this apply run wrote a
single line, and this change never touches `brain/scripts/memory/**`. Every
`npm test` run below reports 5 failures for this same, unchanged reason — the
suite's pass count grows by exactly the number of tests this change adds, and
the fail count never grows.

## TDD Cycle Evidence

| Task(s) | Scenario | RED | GREEN | REFACTOR |
|---|---|---|---|---|
| 1.2-1.5 | `stage-config.mjs`: zero-config identity, 3 refusals, explicit disable, agent passthrough | `stage-config.test.mjs` written first; ran against a missing module (`ERR_MODULE_NOT_FOUND`) | `resolveStageConfigs` implemented; 8/8 green | Header/doc comments tightened; no logic change |
| 2.2-2.7 | `role-port.mjs`: seam-absent (module + per-stage), concrete `model_tier` refused, `chooses_model` strict, dispatch order, `proposal` answered (D7 trap) | `role-port.test.mjs` written first; ran against a missing module | `resolveRoles`/`resolveModelSelection`/`loadInhabitant`/`ROLE_TIERS` implemented; first run 15/17 (2 test-wording defects, not production defects — see Issues Found); fixed test wording; 17/17 green | None to production code |
| 2.9-2.10 | `SDD_ENGINES` extraction, `resolveEngine` unchanged | Tests added to `cli.test.mjs` first; ran RED (`SDD_ENGINES` import failure) | `SDD_ENGINES` added to `platform.mjs`, `cli.mjs`'s inline literal replaced with the import; 20/20 green | None |
| 3.3 | `plain.declareRoles`: every stage answered incl. custom, checked `model_tier:null`/`chooses_model:false` | Tests added to `plain.test.mjs` first; ran RED (`declareRoles` not exported) | `declareRoles` added to `plain.mjs`, additive; `AGENT_RUNTIME`/`init` untouched; 8/8 green | None |
| 3.5-3.8 | `roles.contract.test.mjs`: parity loop over `INHABITANTS` (n=1), dated debt, membership-based abstraction check, tripwire | No separate RED phase — see note below | Written directly against the already-implemented `role-port.mjs` + `plain.mjs`; 11/11 green on first run | None |

**Note on 3.5-3.8's TDD shape**: `roles.contract.test.mjs` is itself the
"GREEN wiring" task (3.8) — there is no separate production module for it to
drive RED against; its only dependencies (`role-port.mjs`, `plain.mjs`,
`sdd-layout.mjs`) were already built test-first in the tasks above. Writing it
and having it pass immediately is the expected shape for an integration/
contract layer built on units that were each independently RED-first. This is
recorded rather than silently presented as a fourth RED cycle that did not
happen.

## Files Changed

| File | Action | What Was Done | Countable? |
|---|---|---|---|
| `brain/scripts/lib/stage-config.mjs` | Created | `resolveStageConfigs(config)` — pure, 3 refusals, zero-config identity (D3) | Yes — 102 lines |
| `brain/scripts/lib/stage-config.test.mjs` | Created | 8 tests: identity, refusals, disable, agent passthrough | No (`*.test.mjs`) |
| `brain/scripts/roles/role-port.mjs` | Created | `ROLE_TIERS`, `resolveRoles`, `resolveModelSelection`, `loadInhabitant` (D1-D5, D7) | Yes — 174 lines |
| `brain/scripts/roles/role-port.test.mjs` | Created | 17 tests: seam absence (module+stage), model_tier/chooses_model validation, D7 trap, sdd.configs integration, 3-path dispatch, `loadInhabitant` seam | No |
| `brain/scripts/roles/roles.contract.test.mjs` | Created | Parity loop (`INHABITANTS={plain}`), dated debt comment, membership-based abstraction check, n=1/debt tripwire — 11 tests | No |
| `brain/scripts/roles/fixtures/stage-set-custom.json` | Created | 4 lifecycle stages + custom `cold-review`, `_provenance: derived` | Yes — 16 lines |
| `brain/scripts/harness/backends/plain.mjs` | Modified | `+ declareRoles(stages)`, additive; `AGENT_RUNTIME`/`init` untouched | Yes — +24/-0 |
| `brain/scripts/harness/backends/plain.test.mjs` | Modified | Import line widened for `declareRoles`; 3 new tests appended after the existing `AGENT_RUNTIME` test (byte-identical) | No |
| `brain/scripts/harness/platform.mjs` | Modified | `+ export const SDD_ENGINES` | Yes — +12/-0 |
| `brain/scripts/harness/cli.mjs` | Modified | `resolveEngine` reads `SDD_ENGINES` instead of its inline literal; import/re-export widened | Yes — +7/-3 |
| `brain/scripts/harness/cli.test.mjs` | Modified | 3 new tests: `SDD_ENGINES` shape, `resolveEngine` behavior unchanged, no inline literal left in `cli.mjs` | No |
| `openspec/changes/issue-312-role-port/brain-drafts/config-migrations-1.3.0.md` | Created | Tier 3 DRAFT (not applied) — migration `1.3.0` content + D6 ordering constraint vs #456's `1.2.0` | No (`openspec/changes/**`) |
| `openspec/changes/issue-312-role-port/tasks.md` | Modified | Checked off Phases 1-3 (30/36 tasks); Phase 4 marked blocked-by-instruction | No |
| `brain/scripts/harness/backends/gentle-ai.mjs` | Untouched | Option A — no invented roles | — |

## Countable line budget (governance.ignoreList excludes `**/*.test.mjs`, `openspec/changes/**`)

| Unit | Countable | Excluded (tests/draft) |
|---|---|---|
| 1 — `stage-config.mjs` | 102 | 106 |
| 2 — `role-port.mjs` (174) + `platform.mjs` (+12) + `cli.mjs` (+10) | 196 | 258 (`role-port.test.mjs` 223 + `cli.test.mjs` 35) |
| 3 — `plain.mjs` (+24) + fixture (16) | 40 | 172 (`plain.test.mjs` +32 + `roles.contract.test.mjs` 140) |
| **Total countable** | **338** | — |

Against tier `lite`'s 1000-line budget: **338/1000**, well clear. Against the
tasks.md forecast of "~405 countable": measured lower, mostly because the
final implementation's per-file line counts came in under the design's
rough estimates. No workload decision was re-triggered.

## Deviations from Design

1. **`role-port.mjs` does NOT call `stage-engine.mjs`'s `resolveStageEngine`
   for `sdd.map` reads.** The design's data-flow diagram implies `sdd.map[stage]`
   feeds `resolveModelSelection`, but D1's prose is explicit and load-bearing:
   *"`roles/` and `stage-engine.mjs` are both consumers of `sdd-layout.mjs`.
   Neither imports the other."* Honoring that sentence over the diagram, I
   implemented a small, PRIVATE, permissive inline reader
   (`readRoutedModel(config, stage)`) inside `role-port.mjs` that reads
   `config?.sdd?.map?.[stage]?.model` directly, without `stage-engine.mjs`'s
   own validation (that validation is #323's, already exercised by
   `stage-engine.test.mjs`, and duplicating it here would be a second copy of
   one refusal). This is a genuine tension in the design between the diagram
   and the prose — flagging it rather than silently picking one. The prose is
   more specific and states the import-graph invariant as a *fact*, so it
   governed.
2. **The `readRoutedModel` lookup is skipped entirely when `role.model_tier
   === null`.** This is required to make `resolveModelSelection`'s no-agent
   note ("no id was read from sdd.map") literally true rather than a value
   fetched and then discarded — the design's own text warns against exactly
   that ("Reading the map and discarding the value would let an operator's
   routed model appear in a log line beside a stage brain will never run").
   Implemented as a conditional at the call site in `resolveRoles`, not inside
   `resolveModelSelection` itself (which stays pure and takes `routed` as
   given, matching its documented signature).
3. **No separate RED phase for `roles.contract.test.mjs`** (tasks 3.5-3.7) —
   see the TDD Cycle Evidence table note above. This is a structural
   consequence of the task list itself: 3.5/3.6/3.7 are labeled RED but have
   no corresponding "GREEN: implement X" step of their own — 3.8 IS the GREEN
   step and it is the test file. Recorded rather than fabricating a RED run
   that would have been meaningless (the modules it depends on already existed
   and already passed their own tests).
4. **Test wording, not production code, needed two fix-ups in `role-port.test.mjs`**
   after the first GREEN run: one regex was case-sensitive against actual
   output casing ("No id was read" vs. `/no id was read/`), and one asserted
   the refusal message must never contain the substring "disabled" at all —
   too strict, since the message negates it explicitly ("MUST NOT be read as
   disabled"), the same wording pattern `agent-runtime.mjs`'s `seam-missing`
   notice already uses. Both were test-quality fixes, confirmed by reading the
   actual (correct) production output before changing the assertion — not
   loosened to make a broken implementation pass.

No other deviations. D2 (function surface, not a static map), D3 (three
refusals), D4 (dispatch order, `chooses_model` strict), D5 (three-states
asymmetry, `reason` naming its author), D6 (migration draft, ordering
constraint), and D7 (assertRoutableStage untouched, `proposal` answered) all
match the design as written.

## Issues Found

- The stated baseline (4520/0) does not match the measured baseline
  (4515/5) — see "Baseline discrepancy" above. Not a defect introduced by
  this apply run; flagged as a discrepancy between the brief and the repo's
  actual state at the time of this apply run.
- `openspec/changes/issue-456-stage-set/brain-drafts/config-migrations-1.2.0.md`
  is CONFIRMED still unpromoted at the time of this apply run — verified
  directly: `brain/core/config-migrations.mjs`'s last entry is `'0.10.0'`, and
  `brain/scripts/lib/brain-config.test.mjs`'s `schemaVersion` assertion still
  reads `'0.10.0'`. This makes design D6's ordering constraint and this
  change's own `1.3.0` draft's warning live and current, not speculative —
  recorded in the draft itself.

## Migration draft status

`openspec/changes/issue-312-role-port/brain-drafts/config-migrations-1.3.0.md`
is a DRAFT, NOT APPLIED. `brain/core/config-migrations.mjs` and
`brain/scripts/lib/brain-config.test.mjs`/`stage-engine.test.mjs` were NOT
edited (Tier 3 — `AGENTS.md` doctrine, `brain/core/**` is off-limits to this
apply run). The draft carries D6's exact ordering-constraint sentence: `1.3.0`
is valid only if #456's `1.2.0` promotes first, and both drafts rewrite the
same `brain-config.test.mjs` `schemaVersion` line — confirmed by direct
inspection of #456's own draft at
`openspec/changes/issue-456-stage-set/brain-drafts/config-migrations-1.2.0.md`,
which targets that identical line.

## Work-Unit / Commit Boundaries (not yet committed)

Per `work-unit-commits` and the amended (01/09) tasks.md: ONE PR, three
work-unit COMMITS, no chain, no tracker branch. This apply run implemented all
three units but created NO commits (explicit instruction). The three
boundaries, as they will become commits when a human commits them:

1. **Unit 1** — `brain/scripts/lib/stage-config.mjs` + test + the `1.3.0`
   migration draft. Leaves its own suite green; zero-config identity holds.
   Rollback: delete the two files and the draft; nothing imports them yet.
2. **Unit 2** — `brain/scripts/roles/role-port.mjs` + test +
   `SDD_ENGINES` extraction (`platform.mjs`/`cli.mjs`/`cli.test.mjs`). Leaves
   its own suite + `cli.test.mjs` green. Rollback: revert; `resolveEngine`
   returns to its inline literal.
3. **Unit 3** — `plain.mjs`'s `declareRoles` + `roles.contract.test.mjs` +
   fixture. Leaves the parity loop (n=1) and the debt tripwire green, full
   suite green, no regression. Rollback: revert; `plain.mjs` returns to two
   exports.

## Remaining Tasks

- [ ] 1.8, 2.12, 3.11 — commit each unit (BLOCKED: no-commit instruction).
- [ ] 4.1 — create the follow-up sub-issue tracking work pending #814 (BLOCKED).
- [ ] 4.2 — `memory:share` + push (BLOCKED).
- [ ] 4.3 — open the PR, `Closes #<follow-up>`, never `Closes #312` (BLOCKED).
- [ ] 4.4 — label `type:feature`, CI green (BLOCKED — no PR yet).
- [ ] 4.5 — `brain:review` from a checkout carrying `sdd.map` (BLOCKED — no PR yet).

## Status

30/36 tasks complete (Phases 1-3 fully implemented and green). Phase 4 (6
tasks) blocked by explicit instruction not to commit/push/open a PR — human
action required. `npm test`: 4557 pass / 5 fail (5 pre-existing, unrelated).
`npm run repo:check`: green. `npm run brain:nav`: green. Ready for a human to
review the diff and, if satisfied, run the three commits + Phase 4 themselves,
or hand back to `sdd-apply` explicitly authorized to commit.
