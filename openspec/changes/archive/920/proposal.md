---
status: proposed
issue: 920
---

# Proposal — #920 the lane reconciles: a push that landed but a PR that never opened must still reach `main`

Fixes audit finding **M1** (`docs/inbox/memory-audit-handoff-2026-09-10.md:76-113`) and answers the
audit's open questions **1** and **2** (`:223-224`). Exploration:
`openspec/changes/issue-920-ship-reconcile/explore.md` — its state-space rows 6-11 are ruled below.
Closes #920.

## What is wrong today

`shipLane()` returns early at `brain/scripts/memory/lane/ship.mjs:243` on
`commit === null && ahead === 0`, **before** `findOrCreatePr()` (`:281`) and `mrAutoMerge` (`:304`).
That predicate answers *"is anything queued to push?"* and then acts as if it had answered *"did
these records reach `main`?"*. When a push succeeds and the PR step fails (`mrList` outage —
reproduced in the audit), the retry collects nothing new, the remote lane ref matches the local one,
and the early return skips the PR forever. The records sit on a remote branch that nothing will ever
merge. The same return also never retries a failed auto-merge arming.

## The rulings

**R1 — The predicate splits into two independent questions.**
`pendingPush = commit !== null || ahead > 0` (unchanged from today's escape condition) and
`pendingReconcile = delivery.state !== 'delivered'`. Push when `pendingPush && !delivered`;
reconcile (find/create PR + arm) whenever `pendingReconcile`. A run is a true no-op only when the
ref never existed **or** the lane is delivered. *Why: "nothing to push" and "nothing to deliver" are
different facts and today one is read as the other.*

**R2 — `surveyRef()` returns `tip` (sha or `null`); `tip === null` is the no-op, not `ahead === 0`.**
The cold-1 case becomes structural instead of inferred. *Why: `ahead === 0` is also true for a ref
that exists and is unreconciled — the exact state #920 is about.*

**R3 — The delivery read asks git, not the port — but it is content containment, NOT
`merge-base --is-ancestor`.** The adopted direction (exploration Approach 2, git over port) stands.
The primitive does not: auto-merge is **`--squash`, hardcoded on both providers**
(`vcs/providers/github.mjs:633` `gh pr merge --auto --squash`; `gitlab.mjs:1192` `squash: true`), and
#888's own Risk 3 states it — *"squash ⇒ merge base unchanged"*
(`openspec/changes/archive/888/proposal.md:234`). A squash-merged lane commit is therefore **never**
an ancestor of `origin/main`, so `--is-ancestor` would report every merged lane as *pending*, on
every run, forever: row 6 would re-`mrCreate` a duplicate PR each run and row 7 would re-push a
deleted branch. The read that is correct under squash **and** under a true merge:

```
lanePaths   = git diff --name-only origin/main...<ref>          # what this lane adds
undelivered = git diff --name-only <ref> origin/main -- <lanePaths>
delivered   ⟺ lanePaths is empty, or undelivered is empty
```

Sound because a lane carries only immutable, content-addressed record files — `index.jsonl` is
excluded by construction (`lane/plan.mjs:34-36`, L3) and a correction is a *new* record, never a
rewrite. *Why: the goal is "did these records reach `main`", and after a squash only their bytes
survive, not their commit.*

**R4 — The check lives in `surveyDelivery({ git, root, ref })` in `ship.mjs`, on the existing
injected `git` seam.** No fifth seam, no new injection point; tests drive it with `fakeGit` rules,
distinguished from `buildTitleAndBody`'s diff by argv (three-dot vs. two-dot + `--`). *Why: A2's
four-seam shape is the module's contract; a local read needs no new one.*

**R5 — An unreadable delivery state is `unknown` and never resolves to "delivered".** `unknown` when
`baseFetched === false` (stale base) or the diff exits non-zero. Under `unknown` the run **acts** —
push if `pendingPush`, reconcile always — and reports `delivered: null` with a reason. Fail-closed in
`cursor.mjs:48-51`'s sense: the unreadable precondition is named in the outcome, never silently
resolved. *Why: the two errors are not symmetric — a spurious `mrList` scan costs one API call, a
false "delivered" strands memory forever.*

**R6 (row 6) — PR merged, remote branch kept ⇒ delivered ⇒ true no-op.** Zero push/list/create/arm.
*Why: the records are on `main`; there is nothing left to deliver.*

**R7 (row 7) — PR merged, remote branch auto-deleted ⇒ delivered ⇒ no push, no new PR** — even
though `surveyRef` reports `ahead = <full ref count>` via the "couldn't find remote ref" branch.
*Why: this is the row where R3 is load-bearing; today's code escapes the early return here and would
re-push a merged, deleted branch and open a second PR for records already on `main`.*

**R8 (row 8) — PR closed unmerged ⇒ pending ⇒ push if needed, then a fresh PR.** *Why: a closed PR
is not delivery, and the lane is append-only — rejecting records is a record-level scrub
(`memory:scrub` / the `lane-scrub` context), not a closed PR.* Residual: a human who closes a lane PR
without scrubbing gets a new one on the next run — named in Risks, not silently absorbed.

**R9 (rows 9 & 10) — New records after a same-day squash-merge, branch kept or deleted ⇒ proceed as
today: push and open a NEW PR.** Kept-branch pushes fast-forward off the merged tip; deleted-branch
takes the ordinary create path. *Why: the new records are genuinely undelivered and the previous PR
is closed — a second PR is the only route to `main`.* The title's record count re-lists
already-merged records after a squash: that is #888's accepted Risk 3, unchanged here, not
re-litigated.

**R10 (row 11) — The date change is OUT of scope and is filed as its own follow-up.**
`day-start-sweep.mjs` and `session-end-ship.mjs` always compute `date = today`
(`cli.mjs:488`), so yesterday's unreconciled branch is unreachable by anything in this call graph.
**Cost of deferring:** a lane stranded by M1 across midnight stays stranded — this change repairs
same-day retries only, and the pre-midnight window is exactly when M1 bites. **Filing a follow-up
issue ("the sweep must revisit unreconciled lane refs from prior days") is a task of this change**,
referenced from the proposal and the code comment. *Why: the fix is a caller-side ref enumeration
plus a staleness policy — a different module, a different risk surface, and it would double this
diff.*

**R11 — The outcome shape gains `delivered: true|false|null` and `reconciled: boolean`; both call
sites and both catalogs change in the same PR.** `reconciled` is true when this run ran the
find/create + arm tail, with or without a push.
- `day-start-sweep.mjs#laneSweepLine`: after the `outcome.pushed` branch, `outcome.reconciled` ⇒ new
  `day.memory.laneSweep.reconciled` (params `ref`, `number`); only then `nothing`.
- `cli.mjs#shipOutcomeKey`: `pushed === false && reconciled === true` ⇒ new key `reconciled`,
  inserted immediately before the final `done`; `nothing` and `autoMergeRefused` keep their meaning.
- `i18n/en.mjs` + `i18n/es.mjs`: `memory.ship.reconciled` and `day.memory.laneSweep.reconciled`.
*Why: both call sites treat `pushed` as the only "something happened" signal, so reconciliation
without a push would be reported as "nothing" — a false negative about memory delivery.*

**R12 — `--dry-run` stays as it is.** It gains the two fields as `delivered: null, reconciled: false`
for shape uniformity (the C3 precedent for `title`/`body`) and nothing else. *Why: `cli.mjs:478`
passes `vcs: null` under `--dry-run` by construction, so a "would reconcile" claim could never
consult `mrList` — it would be a guess, and A7 keeps dry-run off the network.*

**R13 — `ship.test.mjs:93-117` SPLITS; it is not weakened.** Its assertions survive verbatim in (a);
(b) is new.
- (a) *"ref exists, remote matches, lane delivered ⇒ no-op"* — same fixture plus a delivery-diff rule
  returning empty; `pushed:false`, `pr:null`, `title/body:null`, `{mrList:0, mrCreate:0,
  mrAutoMerge:0}` unchanged.
- (b) *"ref exists, `ahead:0`, records absent from `origin/main` ⇒ no push, but find/create + arm
  run"* — `pushed:false`, `reconciled:true`, `pr.number` set. This is M1's regression pin.
`:119-143` (cold-1) and `:145-161` (A1 recovery) are unchanged. A new integration test follows
`ship.integration.test.mjs`'s bare-origin fixture: push succeeds, `mrList` throws on the first call
only, the retry with zero new commits opens the PR.

**R14 — Delivery: ONE PR, no `size:exception`.** Counted diff (tests and `openspec/**` excluded by
`brain.config.json`): `ship.mjs` ~+55, `day-start-sweep.mjs` ~+8, `cli.mjs` ~+3, `i18n/{en,es}.mjs`
~+4 — **~70 counted**, ~250 reviewer-visible test lines. *Why: one predicate and its two honest
reporters are one reviewable idea; splitting them would ship a run that reconciles and reports
"nothing".*

## Invariants that must survive (each named, each asserted)

| Invariant | How R1-R5 preserve it |
|---|---|
| A ref that never existed is never diffed; `title`/`body` are `null`, no `mrList` (`ship.test.mjs:119-143`) | R2's `tip === null` returns before `surveyDelivery` — structural, not inferred |
| `buildTitleAndBody()` stays deferred, never called on a pure no-op | Still called only after "push or reconcile will happen" is known (R1) |
| `behind > 0` refuses before any network call | Pre-check keeps its position relative to push/port; `surveyDelivery` inserted before it is local-only git |
| `mrList` throwing is the one fatal port failure (`prLookupFailed`) | `findOrCreatePr` is untouched; the reconcile path reaches the same throw |
| A delivered lane makes zero port calls | R6/R7 return before the tail |

## Scope

**In**: `lane/ship.mjs` (`surveyRef` + `tip`, `surveyDelivery`, the split predicate, two outcome
fields); `day-start-sweep.mjs#laneSweepLine`; `cli.mjs#shipOutcomeKey`; `i18n/{en,es}.mjs`;
`ship.test.mjs` (split + new cases), `ship.integration.test.mjs` (M1 repro),
`day-start-sweep.test.mjs`, `cli.ship` tests; filing the R10 follow-up issue.

**Out / non-goals**: widening the VCS port — `mrList`'s `{number, title, headBranch}` shape is pinned
by `vcs.contract.test.mjs:391-403` and both providers discard the state the API gives them
(`github.mjs:457-459`, `gitlab.mjs:612-615`) — **filed as #930**, referenced wherever the limitation
bites; any `mrGet` verb; any change to `mrCreate`/`mrAutoMerge` semantics, to `collect`/`plan`, or to
the record format; the first real `memory:ship` run; cross-day/stale-lane sweeping (R10's follow-up);
#888's merged-lane record-count residual.

**Capabilities (contract with `sdd-spec`)**: **New: none. Modified: none.** `openspec/specs/**`
carries no memory-lane capability by repo convention (#888's own ruling); the normative surface is
this change's `spec.md` plus ADR-0034 L5.

## Risks

| risk | likelihood | mitigation |
|---|---|---|
| A stale `origin/main` (`baseFetched:false`) reads delivered records as pending ⇒ a duplicate PR of already-merged bytes | Med | R5 reports `delivered:null` + reason; `mrList` still prevents a duplicate **open** PR; the residual PR is #888 Risk 3's harmless shape (identical additions, `lane-paths` passes) |
| A human closes a lane PR to reject it; every later run reopens one (R8) | Low | named; the sanctioned rejection is a record scrub, documented in the code comment beside the ruling |
| One extra local `git diff` per run, and a second one when the title is built | Low | both local reads, no network; `sdd-design` may fold them into one |
| The new `diff` argv collides with `surveyOkRules`' existing `a[0] === 'diff'` rule and silently satisfies both | Med | fixtures match on the full argv (three-dot vs. `--` pathspec); asserted in the split test |
| `reconciled` lands but a caller is missed ⇒ a real reconciliation prints "nothing" | Low | both call sites are enumerated in R11 and pinned by `day-start-sweep.test.mjs` / the CLI test in the same PR |

## Rollback

Revert the PR. No config key, no hook, no ref is ever deleted, and the outcome shape only **gains**
keys — `--json` consumers are additive-safe. Durable side effects of a reconciling run are a remote
branch and a PR that a human can close and delete; records are append-only and nothing merged needs
undoing.

## Success criteria

- [ ] `npm test` green; the M1 sequence (push OK → `mrList` throws → retry with zero new records)
      opens the PR and arms it, asserted in both the unit and the bare-origin integration suites.
- [ ] A delivered lane (merged, branch kept **and** branch deleted) makes zero push/list/create/arm
      calls — rows 6 and 7 asserted.
- [ ] A ref that never existed is still a pure no-op with no `diff` call and `title/body: null`.
- [ ] `pushed:false, reconciled:true` renders as a reconciliation in `day:start` and in
      `memory:ship`'s own line, in both catalogs — never as "nothing".
- [ ] `--dry-run` still makes zero port calls and zero pushes.
- [ ] The R10 follow-up issue exists and is referenced from `ship.mjs`'s predicate comment; #930 is
      referenced where the port shape is named.

## Proposal question round

Each has a working ruling above; none blocks `sdd-spec` / `sdd-design`.

1. **R3 corrects the ratified primitive.** The fork stands (git, not the port), but `merge-base
   --is-ancestor` cannot answer this question under a hardcoded `--squash` merge — it would report
   every merged lane as pending forever. Confirm the content-containment read replaces it.
2. **R5's bias under `unknown`.** Acting (and reporting `delivered:null`) risks a duplicate PR of
   merged bytes; skipping risks stranded memory. Confirm "never silently delivered" is the intended
   direction.
3. **R8.** Is re-opening a PR for a human-closed lane acceptable, given that the sanctioned
   rejection is a record scrub?
4. **R10.** Deferring the date transition leaves the cross-midnight M1 case unrepaired until the
   follow-up. Acceptable for this slice?
