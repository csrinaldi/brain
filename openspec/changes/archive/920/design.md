---
status: designed
issue: 920
---

# Design — #920 the lane reconciles

Within rulings R1–R14 (`proposal.md`, ratified 2026-09-11). No deviations.

## Technical approach

`shipLane()` keeps its shape (`collect → survey → [no-op?] → pre-check → push → title → find/create → arm`).
Two edits: `surveyRef()` also returns `tip` (R2), and a new local-only `surveyDelivery()` (R4) runs
between the cold-1 return and the `behind` pre-check. The single `commit === null && ahead === 0`
escape becomes two independent questions (R1): `pendingPush = commit !== null || ahead > 0`, and
`delivered` from `surveyDelivery`. Nothing else in the module moves.

```
collect ──► surveyRef ──► tip===null? ──yes──► NO-OP (cold-1, R2)
                               │no
                               ▼
                        surveyDelivery  (2 local git diffs, no network)
                               │
                    delivered===true? ──yes──► NO-OP (R6/R7)
                               │no|null
                               ▼
              behind pre-check ──► push (iff pendingPush) ──► buildTitleAndBody
                               ──► findOrCreatePr ──► mrAutoMerge      [reconciled=true]
```

## Decision table (every ruled row)

`P = pendingPush`. `—` = not consulted. Every row's `title/body` is `null` on no-op rows and set on acting rows.

| # | tip | commit | ahead | behind | remoteRefPresent | delivered | push? | title? | find/create? | arm? | outcome fields |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 (R2, cold-1) | null | null | 0 | 0 | null | — (never surveyed) | no | no | no | no | `pushed:false, pr:null, autoMerge:null, delivered:null, deliveredReason:'noRef', reconciled:false` |
| 2 | sha | non-null | any | 0/null | any | false | **yes** | yes | yes | yes | `pushed:true, delivered:false, reconciled:true` |
| 3 (A1 recovery) | sha | null | >0 | 0/null | true/false | false | **yes** | yes | yes | yes | `pushed:true, delivered:false, reconciled:true` |
| 4 (M1) | sha | null | 0 | 0 | true | false | no | yes | **yes** | yes | `pushed:false, delivered:false, reconciled:true, pr.number` set |
| 5 (stuck arm) | sha | null | 0 | 0 | true | false | no | yes | yes (find) | **yes** | as row 4 |
| 6 (merged, branch kept) | sha | null | 0 | 0 | true | **true** | no | no | no | no | `pushed:false, pr:null, autoMerge:null, delivered:true, reconciled:false` |
| 7 (merged, branch deleted) | sha | null | >0 | 0 | **false** | **true** | **no** | no | no | no | as row 6 |
| 8 (closed unmerged) | sha | null | 0 or >0 | 0 | true/false | false | iff P | yes | yes (fresh PR) | yes | `delivered:false, reconciled:true` |
| 9 (new records, branch kept) | sha | non-null | any | 0 | true | false | yes | yes | yes (new PR) | yes | as row 2 |
| 10 (new records, branch deleted) | sha | non-null | full count | 0 | false | false | yes | yes | yes | yes | as row 2 |
| 11 (date change) | — | — | — | — | — | — | — | — | — | — | out of scope, R10 follow-up issue |
| U (unreadable, R5) | sha | any | any | 0/null | any | **null** | iff P | yes | yes | yes | `delivered:null, deliveredReason:'baseStale'|'diffFailed', reconciled:true` |
| D (`--dry-run`, R12) | — | — | — | — | — | — | no | yes | no | no | `delivered:null, deliveredReason:'dryRun', reconciled:false` |
| behind>0 | sha | any | any | >0 | any | false/null | throws `diverged` before any network call | | | | — |

Structural note (not an added check): `ahead === 0` is reachable **only** from `surveyRef`'s
fetch-success branch, so every reconcile-only row has `remoteRefPresent === true` — a PR is never
created for a branch that is absent from origin.

`behind > 0` keeps its exact position (after the no-op returns, before push **and** before `mrList`),
so the invariant "refuses before any network call" holds on the new reconcile-only path too.

## `surveyDelivery({ git, root, ref })` — exact calls, in order

Runs on the existing injected `git` seam (R4). No new seam, no network.

| # | condition | argv (`{cwd: root}`) | non-zero exit means |
|---|---|---|---|
| 0 | `baseFetched === false` | *no git call at all* | stale base → `{delivered:null, reason:'baseStale'}` (R5) |
| 1 | always | `['diff','--name-only',` `` `origin/main...${ref}` ``  `]` | `origin/main` or `ref` unresolvable → `{delivered:null, reason:'diffFailed'}` |
| 2 | only if #1 printed ≥1 path | `['diff','--name-only', ref, 'origin/main', '--', ...lanePaths]` | same → `{delivered:null, reason:'diffFailed'}` |

- #1 empty ⇒ `{delivered:true}` (the lane adds nothing over `main`); #2 is skipped.
- #2 empty ⇒ `{delivered:true}`; non-empty ⇒ `{delivered:false}`.
- `reason` is `null` whenever `delivered` is a boolean.

**Argv collision (proposal Risk 4).** #1 is byte-identical to `buildTitleAndBody`'s diff — same
question, same answer, so satisfying both with one fake rule is correct. #2 is distinguished by the
`--` pathspec. `surveyOkRules()` therefore replaces its single `a[0] === 'diff'` rule with an ordered
pair, `--`-first (`fakeGit` is first-match-wins):

```js
{ match: (a) => a[0] === 'diff' && a.includes('--'), result: ok(undeliveredPaths.join('\n')) },
{ match: (a) => a[0] === 'diff' && a[2] === `origin/main...${REF}`, result: ok(diffPaths.join('\n')) },
```

Default `undeliveredPaths = diffPaths` (undelivered), so every existing test keeps its current
behaviour and its assertions verbatim.

**The staleness guard.** `surveyDelivery` reads the local `origin/main` remote-tracking ref; the only
thing that refreshes it in this call graph is `collectLane`'s best-effort `git fetch origin main`
(`collect.mjs:211-212`), whose result `shipLane` already carries as `baseFetched`. When that fetch
failed, `origin/main` may be arbitrarily old — a merged lane still reads as pending (duplicate PR of
merged bytes) **and** an unmerged one could read as delivered (memory stranded forever). The two
errors are not symmetric, so the precondition is named rather than resolved: `baseFetched === false`
short-circuits to `delivered:null` **without diffing**, the run acts, and the outcome says
`deliveredReason:'baseStale'`. This is `cursor.mjs:48-51`'s fail-closed discipline — an unreadable
git precondition becomes an explicit `unknown` state, never a convenient boolean.

## Outcome shape and call sites (R11)

New keys on **every** return path: `delivered: true|false|null`, `deliveredReason: string|null`
(R5 requires a named reason; the four values are `noRef | baseStale | diffFailed | dryRun`),
`reconciled: boolean` (true iff the find/create + arm tail ran, with or without a push).
`tip` stays internal to `surveyRef` — the `--json` surface gains exactly the three keys above.

| file | edit |
|---|---|
| `lane/ship.mjs` | `surveyRef` returns `tip`; `surveyDelivery()`; split predicate; 3 new fields on the 5 return paths |
| `day-start-sweep.mjs#laneSweepLine` | after the `outcome.pushed` branch: `if (outcome?.reconciled) → {level:'ok', key:'day.memory.laneSweep.reconciled', params:{ref, number: outcome.pr?.number ?? '?'}}`, then `nothing` |
| `cli.mjs#shipOutcomeKey` | `if (result.pushed === false && result.reconciled === true) return "reconciled";` immediately before the final `return "done"` |
| `i18n/en.mjs` + `i18n/es.mjs` | `memory.ship.reconciled` (`{ref}`, `{number}`) and `day.memory.laneSweep.reconciled` (`{ref}`, `{number}`) — both catalogs, key-parity is covered by the existing catalog test |

## Test plan (STRICT TDD, `node --test`, red first)

No test touches the real clone, invokes a real remote or provider, or writes `.memory/index.jsonl`;
unit tests are pure fakes, integration uses `testTmp()` + a bare `origin` + `recordingVcs()`.

| # | file | test | pins |
|---|---|---|---|
| 1 | `ship.test.mjs` | (a) split of `:93-117` — *"ref exists, remote matches, lane delivered ⇒ no-op"*: same fixture + empty delivery diff; **all current assertions verbatim** plus `delivered:true, reconciled:false` | R6, R13 |
| 2 | `ship.test.mjs` | (b) NEW — *"ref exists, ahead:0, records absent from origin/main ⇒ no push, find/create + arm run"*: `pushed:false, reconciled:true, pr.number===42`, `{mrList:1, mrCreate:1, mrAutoMerge:1}`, no `push` argv | M1 regression pin |
| 3 | `ship.test.mjs` | row 7 — `remoteRefPresent:false`, `ahead:'3'`, delivered ⇒ zero push/list/create/arm | R7 |
| 4 | `ship.test.mjs` | `baseFetched:false` ⇒ **zero** delivery-diff calls, run acts, `delivered:null, deliveredReason:'baseStale'` | R5 |
| 5 | `ship.test.mjs` | delivery diff exits non-zero ⇒ acts, `deliveredReason:'diffFailed'` | R5 |
| 6 | `ship.test.mjs` | argv-collision pin: on a pushing run both diff argvs are present and distinct (`--` vs three-dot) | Risk 4 |
| 7 | `ship.test.mjs` (`mrList`-fatal section) | the reconcile-only path also throws `prLookupFailed`, `mrCreate:0` | invariant |
| 8 | `ship.test.mjs` | `:119-143` cold-1 unchanged, plus `delivered:null, deliveredReason:'noRef'`; `:145-161` unchanged | R2, R13 |
| 9 | `ship.test.mjs` | `--dry-run`: no delivery call, `delivered:null, reconciled:false` | R12 |
| 10 | `ship.integration.test.mjs` | **M1 repro** on `buildFixtureRepo()`: `recordingVcs()` whose `mrList` throws on the **first call only**; run 1 rejects `prLookupFailed` yet the remote ref exists; run 2 (zero new records) ⇒ `pushed:false, reconciled:true, pr.number` set, `mrCreate:1`, remote sha unchanged | M1 |
| 11 | `ship.integration.test.mjs` | **R3 under a real squash**: squash-merge the lane into `main`, push, re-run ⇒ zero push/list/create/arm, `delivered:true` | R3/R6 |
| 12 | `day-start-sweep.test.mjs` | `reconciled` ⇒ `ok` + `day.memory.laneSweep.reconciled`; `pushed` still wins; all-false still `nothing` | R11 |
| 13 | cli ship test | `pushed:false && reconciled:true` ⇒ `reconciled`; `autoMergeRefused` and `nothing` keep precedence | R11 |

## The R10 follow-up (a task of this change)

File one issue, *"the lane sweep must revisit unreconciled lane refs from prior days"*, referenced
from `ship.mjs`'s predicate comment. It must contain: the unreachability proof (`day-start-sweep.mjs`
and `session-end-ship.mjs` always compute `date = today` via `cli.mjs:488`, so yesterday's branch is
never addressed by anything in this call graph); the cost (a lane stranded by M1 across midnight
stays stranded — this change repairs same-day retries only); the shape of the fix (caller-side
enumeration of `refs/heads/memory/<host>-*` plus a staleness/retention policy — a different module,
a different risk surface); the explicit non-goal that #920 already delivers same-day reconciliation;
and links to #920, this design, and audit finding M1.

## Line budget (R14)

`ship.mjs` ~+55, `day-start-sweep.mjs` ~+8, `cli.mjs` ~+3, `i18n/{en,es}.mjs` ~+4 ⇒ **~70 counted**
(tests and `openspec/**` excluded by `brain.config.json`), ~250 reviewer-visible test lines.
Well inside the 400-line budget: **one PR, no `size:exception`, no chaining.**

## Failure modes

| failure | detected by | behaviour | why safe |
|---|---|---|---|
| `origin/main` stale (`baseFetched:false`) | `collect`'s fetch status | no diff, `delivered:null`, act | never silently delivered (R5); `mrList` still blocks a duplicate **open** PR |
| delivery diff exits non-zero (bad rev, huge `ARG_MAX` pathspec) | diff status | `delivered:null`, act | degrades to today's behaviour, one wasted `mrList` |
| `mrList` throws on the reconcile-only path | `findOrCreatePr` | fatal `prLookupFailed` | unchanged; never a blind `mrCreate` |
| a human closes a lane PR to reject records | — | a new PR next run (R8) | sanctioned rejection is a record scrub; named, not absorbed |
| duplicate PR of already-merged bytes under `unknown` | — | identical additions | #888 Risk 3's harmless shape; `lane-paths` passes |
| `reconciled` true but a caller missed | tests 12 & 13 | — | both call sites enumerated and pinned in the same PR |

## Open questions

None. R3's content-containment read replaces `--is-ancestor`, R5 fixes the bias, R8/R10 are ruled.
