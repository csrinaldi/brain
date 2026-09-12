# Verify Report — #920 lane ship reconciliation

**Change**: issue-920-ship-reconcile
**Branch measured**: docs/issue-920-archive @ 8ec69885 (== origin/main tip, PR #938 merged)
**Mode**: Full artifact verification (proposal, spec, design, tasks, apply-progress all present)
**Verdict**: PASS

## Task completeness

`tasks.md`: 30/30 items `[x]` across Phases 1–5. `apply-progress.md` documents
Batch 1 (all 30) + Batch 2 (G1/G2 adversarial-review fixes, test-only). No
unchecked task found.

## Test evidence (measured on this branch, `GIT_CONFIG_GLOBAL=/dev/null node --test <file>`)

| File | Result |
|---|---|
| `brain/scripts/memory/lane/ship.test.mjs` | 38/38 pass |
| `brain/scripts/memory/lane/ship.integration.test.mjs` | 7/7 pass |
| `brain/scripts/memory/day-start-sweep.test.mjs` | 17/17 pass |
| `brain/scripts/memory/cli.ship.test.mjs` | 23/23 pass |
| `brain/scripts/memory/chunk-boundary.test.mjs` | 15/15 pass (collateral line re-pin) |

No full `npm test` run per instructions; apply-progress already records 5254/5254 green including these files.

## Spec scenario compliance (measured)

1. **Failed PR lookup recovers on next run** — `ship.mjs:326-390` reconcile tail runs whenever `delivered !== true`, independent of `pendingPush`. Covered by `ship.test.mjs:181-` reconcile-only-mrList and `ship.integration.test.mjs` M1 repro (mrList throws once, run 2 with zero new records reconciles). PASS.
2. **Failed auto-merge arming is retried** — `ship.mjs:400-405` re-attempts `mrAutoMerge` every non-delivered run (catches internally, never blocks). Design row 5 covers "stuck arm". PASS.
3. **Delivered lane is a true no-op, branch kept AND deleted** — `ship.mjs:337-343` returns on `delivered === true` before any push/list/create/arm, for both `remoteRefPresent: true` (row 6) and `false` (row 7, R3 the load-bearing row). `ship.test.mjs` splits (a) delivered no-op and row-7 test; `ship.integration.test.mjs` real-squash repro. PASS.
4. **Ref that never existed is a no-op, `title`/`body` present-`null`** — `ship.mjs:301-312`, `tip === null` returns before `surveyDelivery`; `title:null, body:null` explicit keys (not absent). Covered by unchanged `:119-143` cold-1 test plus new `deliveredReason:'noRef'` assertion. PASS.
5. **Unreadable delivery is `unknown`, run still reconciles** — `ship.mjs:99-107` (`surveyDelivery`): `baseFetched===false` → `{delivered:null, reason:'baseStale'}` with no git call; a non-zero diff exit → `{delivered:null, reason:'diffFailed'}` for BOTH the three-dot diff (`:104-107`) and the `--` pathspec diff (`:113-116`, Batch-2 G1 pin). All `null` cases fall through to push (if pending) + reconcile tail — `delivered !== true` never short-circuits. PASS.
6. **`behind > 0` refuses before the network** — `ship.mjs:349-353` throws `diverged` right after the `delivered===true` check and strictly before the `push`/`findOrCreatePr` calls; `surveyDelivery` (the only read done before this point) is local git only (`git diff`), never a network call. PASS — and this is why R3 in the report below matters: containment reads never touch the port, so the "refuse before network" invariant survives untouched.
7. **`mrList` throwing is still fatal** — `findOrCreatePr` (`ship.mjs:190-198`) wraps `vcs.mrList` and rethrows as `prLookupFailed`; untouched by the reconcile-only path — same function, same throw. `ship.test.mjs:181-199` and `:709` both assert `err.prLookupFailed === true`. PASS.
8. **Reconciliation without a push is reported as work** — `laneSweepLine` (`day-start-sweep.mjs`) and `shipOutcomeKey` (`cli.mjs`) both gained a `reconciled` branch checked BEFORE falling to "nothing"/"done"; `day-start-sweep.test.mjs` (17/17) and `cli.ship.test.mjs` (23/23) cover it, both catalogs (`en.mjs:83/342`, `es.mjs:74/313`) carry the keys. PASS.
9. **`delivered`/`reconciled`/`deliveredReason` present on every return path, including `--dry-run`** — verified by reading all 5 `return` statements in `ship.mjs` (dryRun `:270-278`, tip-null no-op `:307-311`, delivered no-op `:338-342`, pr.number-null `:386-389`, final `:407-410`) — every one carries all three keys. R11 satisfied on all paths, not just the "happy" ones. PASS.
10. **Out-of-scope lines honoured** — no edits to `session-end-ship.mjs`'s date computation or any cross-midnight sweep logic (#936, filed and OPEN per `gh issue view 936`, referenced at `ship.mjs:319`); no VCS port signature change, `mrList`/`mrCreate`/`mrAutoMerge` untouched, #930 referenced in comment only (`ship.mjs:323`); `--dry-run` (R12) gains only `delivered:null, deliveredReason:'dryRun', reconciled:false` for shape uniformity and makes zero port calls (`ship.mjs:268-278`, unchanged early-return shape). PASS.

## Why delivery is content-containment, never commit ancestry (R3)

Both VCS providers hardcode `--squash` on auto-merge (github.mjs, gitlab.mjs), so a merged lane commit is never an ancestor of `main` — an ancestry check (`--is-ancestor`) would read every merged lane as forever-pending, re-creating a duplicate PR each run (row 6) and re-pushing a deleted branch (row 7) indefinitely. The content-containment diff (`origin/main...ref` then `ref origin/main -- <lanePaths>`) asks the actual question — "did these bytes land on main" — which survives a squash because only the file contents are preserved, not the commit. `ship.mjs:76-95`'s own doc comment states this identically; verified against `surveyDelivery`'s implementation at `ship.mjs:99-118`.

## Design coherence

Decision table (design.md rows 1–D) matches the implemented predicate order exactly: `tip===null` → `pendingPush` calc → `surveyDelivery` → `delivered===true` no-op → `behind` pre-check → push → `buildTitleAndBody` → `findOrCreatePr` → `mrAutoMerge`. No deviation found beyond the one already documented in apply-progress (chunk-boundary.test.mjs line re-pin, a pure line-number chore with no behavior change — re-verified green here, 15/15).

## Findings

**CRITICAL**: none.

**WARNING**: none.

**SUGGESTION**:
- None beyond what apply-progress already tracked as resolved (G1/G2 were adversarial-review gaps from a prior verify pass — both closed with mutation-tested pins in Batch 2, re-confirmed green here).

## Verdict

**PASS.** All 30 tasks complete, all ten named spec scenarios hold with measured passing tests on this branch, R3's containment-over-ancestry design is implemented and explained, all three outcome fields are present on every return path, both call sites and both i18n catalogs report reconciliation as work, and the three named out-of-scope boundaries (#936, #930, dry-run reconciliation preview) are honoured. Ready for archive.
