# Tasks: #920 — lane reconciliation (push-succeeded/PR-missing retry)

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~70 counted (production); ~250 reviewer-visible test lines |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | `surveyRef` returns `tip`; `surveyDelivery()` added; split predicate wired; outcome shape gains 3 fields on all 5 return paths | PR 1 (only PR) | `ship.mjs`, tests same commit |
| 2 | `laneSweepLine` + `shipOutcomeKey` + i18n `en`/`es` reconciled keys | PR 1 (same) | small, depends on unit 1's outcome shape |
| 3 | `ship.test.mjs` split/new cases + `ship.integration.test.mjs` M1 repro + squash repro | PR 1 (same) | RED before each GREEN task above |
| 4 | File R10 follow-up issue | orchestrator, not this PR | tracked separately, referenced from code comment |
| 5 | Record-first closing commit (`memory:save`) + tick epic 4.6 | PR 1, last commit | positional args per #928 |

## Phase 1: Tests first (RED) — `ship.mjs` unit surface

- [x] 1.1 RED: `ship.test.mjs` — split `:93-117` into (a) *delivered no-op* (same fixture + empty delivery diff; keep every current assertion verbatim; add `delivered:true, deliveredReason:null, reconciled:false`). Design test #1, R6/R13.
- [x] 1.2 RED: `ship.test.mjs` — new (b) *ahead:0, undelivered ⇒ no push, find/create+arm run*: `pushed:false, reconciled:true, pr.number===42`, `{mrList:1, mrCreate:1, mrAutoMerge:1}`, no `push` argv. Design test #2 (M1 pin).
- [x] 1.3 RED: `ship.test.mjs` — row 7: `remoteRefPresent:false`, `ahead:'3'`, delivered ⇒ zero push/list/create/arm calls. Design test #3, R7.
- [x] 1.4 RED: `ship.test.mjs` — `baseFetched:false` ⇒ zero delivery-diff calls, run acts, `delivered:null, deliveredReason:'baseStale'`. Design test #4, R5.
- [x] 1.5 RED: `ship.test.mjs` — delivery diff exits non-zero ⇒ acts, `deliveredReason:'diffFailed'`. Design test #5, R5.
- [x] 1.6 RED: `ship.test.mjs` — argv-collision pin: on a pushing run both the three-dot and the `--` pathspec diff argvs appear, distinct. Design test #6, Risk 4.
- [x] 1.7 RED: `ship.test.mjs` — reconcile-only path still throws `prLookupFailed` when `mrList` throws, `mrCreate:0`. Design test #7 (invariant: fatal PR-lookup failure preserved).
- [x] 1.8 RED: `ship.test.mjs` — `:119-143` cold-1 case unchanged, plus `delivered:null, deliveredReason:'noRef'`; `:145-161` (A1 recovery) unchanged. Design test #8, R2/R13.
- [x] 1.9 RED: `ship.test.mjs` — `--dry-run`: no delivery call, `delivered:null, deliveredReason:'dryRun', reconciled:false`. Design test #9, R12.
- [x] 1.10 Verify: `node --test ship.test.mjs` — all 1.1–1.9 fail for the *right* reason (missing `surveyDelivery`/fields), not a typo. Do not proceed to Phase 2 until confirmed red.

## Phase 2: Production — `ship.mjs`

- [x] 2.1 GREEN: `surveyRef()` (`ship.mjs:47`) also returns `tip` (sha or `null`); `tip === null` is the cold-1 no-op condition (R2). Satisfies 1.8.
- [x] 2.2 GREEN: Add `surveyDelivery({ git, root, ref })` on the existing injected `git` seam (R4): `baseFetched === false` short-circuits to `{delivered:null, reason:'baseStale'}` with no git call; else run `['diff','--name-only','origin/main...<ref>']` (`{cwd: root}`), non-zero exit ⇒ `{delivered:null, reason:'diffFailed'}`, empty output ⇒ `{delivered:true}`; else run `['diff','--name-only', ref, 'origin/main', '--', ...lanePaths]`, non-zero ⇒ `diffFailed`, empty ⇒ `delivered:true`, else `delivered:false`. Satisfies 1.4, 1.5, 1.6.
- [x] 2.3 GREEN: Update `surveyOkRules()`'s fake-git matcher ordering so the `--`-pathspec rule is checked before the `a[0] === 'diff'` three-dot rule (first-match-wins); default `undeliveredPaths = diffPaths`. Wires 1.6, keeps existing tests' behavior verbatim.
- [x] 2.4 GREEN: Replace `commit === null && ahead === 0` early return (`ship.mjs:243`) with the split predicate: `pendingPush = commit !== null || ahead > 0`; call `surveyDelivery` after the `tip===null` no-op and before the `behind` pre-check; no-op (zero push/list/create/arm) only when `delivered === true`. Satisfies 1.1, 1.3.
- [x] 2.5 GREEN: Gate `push` on `pendingPush && delivered !== true`; gate `findOrCreatePr` + `mrAutoMerge` (reconcile tail) on `delivered !== true` (runs whenever not-yet-delivered, including `unknown`/`null`). Preserve `behind > 0` refusing before any network call, and keep `buildTitleAndBody` deferred until push-or-reconcile is known. Satisfies 1.2, 1.7.
- [x] 2.6 GREEN: Add `delivered`, `deliveredReason` (`null|'noRef'|'baseStale'|'diffFailed'|'dryRun'`), `reconciled` (boolean, true iff find/create+arm tail ran) to EVERY return path, including cold-1, `--dry-run`, and the two no-op rows (6/7). Satisfies 1.1, 1.8, 1.9, and all decision-table rows.
- [x] 2.7 Verify: `node --test ship.test.mjs` green, all of 1.1–1.9 pass. No unrelated assertion changed.

## Phase 3: Integration tests + squash repro

- [x] 3.1 RED: `ship.integration.test.mjs` — M1 repro on `buildFixtureRepo()`: `recordingVcs()` whose `mrList` throws on the first call only; run 1 rejects `prLookupFailed` with the remote ref present; run 2 (zero new records) ⇒ `pushed:false, reconciled:true, pr.number` set, `mrCreate:1`, remote sha unchanged. Design test #10. Never a real remote/provider, never `.memory/index.jsonl`.
- [x] 3.2 RED: `ship.integration.test.mjs` — R3 under a real squash: squash-merge the lane into `main`, push, re-run ⇒ zero push/list/create/arm, `delivered:true`. Design test #11.
- [x] 3.3 Verify: `node --test ship.integration.test.mjs` — 3.1/3.2 fail for the right reason (pre-2.x changes), then pass after Phase 2 lands (already applied). Confirm both are green now.

## Phase 4: Callers + i18n

- [x] 4.1 RED: `day-start-sweep.test.mjs` — `outcome.reconciled` ⇒ `{level:'ok', key:'day.memory.laneSweep.reconciled'}` with `ref`/`number` params, rendered after the `outcome.pushed` branch and before `nothing`; `pushed` still wins when both true; all-false still `nothing`. Design test #12.
- [x] 4.2 RED: cli ship test (`brain/scripts/memory/cli.mjs`'s ship suite) — `pushed:false && reconciled:true` ⇒ `"reconciled"`; `autoMergeRefused` and `nothing` keep precedence. Design test #13.
- [x] 4.3 GREEN: `laneSweepLine()` (`day-start-sweep.mjs:76`) — after the `outcome.pushed` branch, add `if (outcome?.reconciled) return {level:'ok', key:'day.memory.laneSweep.reconciled', params:{ref, number: outcome.pr?.number ?? '?'}}`, then fall through to `nothing`. Satisfies 4.1.
- [x] 4.4 GREEN: `shipOutcomeKey()` (`brain/scripts/memory/cli.mjs:539`) — insert `if (result.pushed === false && result.reconciled === true) return "reconciled";` immediately before the final `return "done"`, after the existing `autoMergeRefused` check. Satisfies 4.2.
- [x] 4.5 GREEN: Add `memory.ship.reconciled` (`{ref}`, `{number}`) and `day.memory.laneSweep.reconciled` (`{ref}`, `{number}`) to BOTH `brain/scripts/i18n/en.mjs` and `brain/scripts/i18n/es.mjs`. Neutral/professional Spanish for the `es` copy.
- [x] 4.6 Verify: `node --test day-start-sweep.test.mjs`, the cli ship test file, and the i18n catalog key-parity test — all green.

## Phase 5: Traceability + closing

- [x] 5.1 Add a code comment beside `ship.mjs`'s split-predicate (R1) naming the R10 follow-up issue number and #930 (VCS port limitation), per proposal Scope/Success-criteria.
- [x] 5.2 **[ORCHESTRATOR TASK — not the apply agent]** File the R10 follow-up issue: "the lane sweep must revisit unreconciled lane refs from prior days." Must contain: the unreachability proof (`day-start-sweep.mjs` and `session-end-ship.mjs` always compute `date = today` via `cli.mjs:488`); the cost (a lane stranded by M1 across midnight stays stranded); the fix shape (caller-side enumeration of `refs/heads/memory/<host>-*` + a staleness/retention policy); the explicit non-goal that #920 already delivers same-day reconciliation; links to #920, this design, and audit finding M1. Update 5.1's comment with the real issue number once filed.
- [x] 5.3 Run `npm run memory:save -- "<title>" "<content>" --issue 920 --type <type>` — `title` and `content` are POSITIONALS, not flags (#928: flag form dies with a `canonicalJson` error). Parse the `rec-` id from stdout.
- [x] 5.4 Stage only the new record file from 5.3 and `.memory/index.jsonl`; verify the index delta is exactly one net new id (`git diff --stat .memory/index.jsonl` shows one line added, none removed unless a legitimate reindex).
- [x] 5.5 Tick `openspec/changes/issue-864-memory-2-0/tasks.md`'s item 4.6 (`- [ ] 4.6 #920 ...` → `- [x]`).
- [x] 5.6 Full suite: `npm test` green. Confirm proposal Success Criteria checklist items all hold (delivered no-op, M1 retry, cold-1 no-op, reconciled rendering both catalogs, `--dry-run` zero network, R10 issue filed and referenced).

## Commit plan (work-unit commits, STRICT TDD, never `Co-Authored-By`)

1. `test(memory): pin ship.mjs reconciliation cases before the fix (#920)` — Phase 1 (1.1–1.9), confirmed red (1.10).
2. `feat(memory): shipLane splits pendingPush from pendingReconcile (#920)` — Phase 2 (2.1–2.6), tests from commit 1 now green (2.7).
   - Verify: `node --test ship.test.mjs`
   - Rollback: revert this commit + commit 1 together; no schema/ref/config touched.
3. `test(memory): integration-pin the M1 retry and a real squash-merge no-op (#920)` — Phase 3 (3.1–3.3).
   - Verify: `node --test ship.integration.test.mjs`
   - Rollback: revert alone; adds tests only.
4. `feat(memory): day-start sweep and ship CLI report reconciliation as work (#920)` — Phase 4 (4.1–4.6).
   - Verify: `node --test day-start-sweep.test.mjs` + cli ship suite + i18n catalog test
   - Rollback: revert alone; outcome shape only gains keys, callers degrade to pre-#920 rendering.
5. `docs(memory): comment the R10/#930 follow-ups on the split predicate (#920)` — Phase 5.1.
6. `chore(memory): record #920's reconciliation fix and tick epic 4.6 (#920)` — Phase 5.3–5.5, closing commit.
   - Verify: index delta is one net new id; `npm test` green (5.6)
   - Rollback: revert alone; record is additive, epic checkbox reverts cleanly.

All commit subjects end `(#920)`, ≤ 72 chars for the subject line proper (excluding the trailing issue tag where unavoidable — keep prefix+scope+description tight).
