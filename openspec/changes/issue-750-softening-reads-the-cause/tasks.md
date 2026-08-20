---
status: draft
issue: 750
---

# Tasks

One PR onto `feature/issue-682` (`feature-branch-chain`; only the tracker's
terminal PR merges to `main`). Design's own measurement: ~34 production lines
(tranche +6, checkpoint +8, ruling +2, cli +6, verdict +12) + ~8 doctrine
lines + ~200 test lines — well inside the 400-line budget. One PR, no split.

`strict_tdd: true`. Every task that changes behaviour is an ordered pair: a
RED task (write the pin, run `npm test`, confirm the named assertion fails)
followed by a GREEN task (make it pass, rerun `npm test` clean). Work unit 3
is the one place the design forbids splitting the RED→GREEN pair further —
see its note.

---

## Work unit 1 — evaluators declare `conclusionCauses` per return path

Delivers REQ-750-1. Commit pair: `test(review): pin the cause each evaluator
declares (#750)` (RED) → `feat(review): evaluators declare conclusionCauses
(#750)` (GREEN).

- [x] 1.1 RED — In `brain/scripts/review/evaluators/tranche.test.mjs`, pin
      `evaluateTranche`'s three return paths: rollup-not-an-array →
      `conclusionCauses: ['uncomputable']` (site `tranche.mjs:154-166`,
      kills deleting the literal); budget-uncomputable with a blocker
      finding already pushed → `conclusionCauses` contains BOTH
      `'uncomputable'` and `'blocker'` (site `tranche.mjs:192-202`, kills
      collapsing to a single-cause literal); normal exit with / without a
      blocker → `['blocker']` / `[]` (site `tranche.mjs:249`, kills dropping
      the `anyBlocker` ternary). Run `npm test`, confirm each new assertion
      fails with the field absent — RED confirmed.
- [x] 1.2 RED — In `brain/scripts/review/evaluators/checkpoint.test.mjs`, pin
      `evaluateCheckpoint` (site `checkpoint.mjs:226-240`): inherited-only
      (tranche's `conclusionCauses` propagate untouched), observed-only
      (checkpoint's own `anyBlocker`/`anyUncomputable` add a cause tranche
      never had), and the union case (both fire, deduped via `[...new
      Set(...)]`, asserted with `.sort()` against a sorted expectation —
      never raw insertion order, per the design's test rule). Run `npm
      test`, confirm RED.
- [x] 1.3 RED — In `brain/scripts/review/evaluators/ruling.test.mjs`, pin
      `evaluateRuling`'s two returns: malformed fork → `conclusionCauses:
      ['blocker']` (`ruling.mjs:125-139`); valid fork (STOP) →
      `conclusionCauses: []`. These are shape assertions, not verdict-level
      behaviour (neither ruling path is reachable by the softening). Run
      `npm test`, confirm RED.
- [x] 1.4 GREEN — Implement Decision 1 (a literal `conclusionCauses` array
      at each of tranche's three returns and ruling's two returns — no
      shared `causesOf` helper, per the design's rejected-alternative
      reasoning) and Decision 2 (checkpoint's dedup-union). Run `npm test`,
      confirm 1.1-1.3 pass and nothing else regresses.

## Work unit 2 — the non-producers stay silent (verification, no edit)

Delivers the negative half of REQ-750-1. No RED/GREEN pair.

- [x] 2.1 Confirm by reading, and record in the PR body: `inferential.mjs`,
      `refuter.mjs`, and `applyCausalAdmission` (in `cli.mjs`) never set
      `conclusion` and therefore MUST NOT declare `conclusionCauses`. Grep
      those three sources for `conclusionCauses` and confirm zero matches,
      both before and after work unit 1 lands.

## Work unit 3 — the softening reads the cause: guard + threading, one red→green pair

Delivers REQ-750-2, REQ-750-3, REQ-750-4, REQ-750-5. Commit pair:
`test(review): pin the cause-gated softening (#750)` (RED) →
`fix(review): the softening reads the cause, not the finding-list shape
(#750)` (GREEN).

**This unit ships Decisions 3 (cli.mjs threading) and 4 (verdict.mjs guard)
together, as a single GREEN commit — it may NOT be split into "thread then
guard" or "guard then thread" in either order.** Guard-first leaves an
intermediate commit where every CLI-produced verdict carries `causes: []`,
the #483 softening never fires through the real verb, and
`test/review-regulated/regulated-review.e2e.test.mjs:536` (asserts
`APPROVE`) goes RED. Thread-first has no observable behaviour change to pin
— its "red" test could only spy on call arguments, not on behaviour. They
are one behaviour change; the RED tests for it are written once, below.

- [x] 3.1 RED — In `verdict.test.mjs`, REPLACE the `KNOWN GAP` pin at
      `verdict.test.mjs:864` (same fixture: routed-out blocker +
      `evidence uncomputable:` condition) with a closure pin asserting the
      rendered verdict is `REVISE`. Do NOT delete it — this is pin (i), the
      unique home for the mutation "delete the sixth conjunct
      (`&& causeIsBlockerOnly`)". Run `npm test`, confirm it fails against
      today's five-conjunct guard.
- [x] 3.2 RED — Add pin (ii) in `verdict.test.mjs`: `conclusionCauses: []`
      explicit, otherwise softenable → `REVISE` (kills deleting
      `conclusionCauses.length > 0`, the vacuous-`every` trap:
      `[].every(...)` is `true` in JS). Confirm RED.
- [x] 3.3 RED — Add pin (iii) in `verdict.test.mjs`:
      `conclusionCauses: ['blocker','uncomputable']`, otherwise softenable →
      `REVISE` (kills `every` → `some`). Confirm RED.
- [x] 3.4 RED — Add pin (iv) in `verdict.test.mjs`: field OMITTED entirely
      (legacy caller shape), otherwise softenable → `REVISE` (kills the
      destructuring default `= []` flipping to `= ['blocker']`). This pin
      re-adds the un-updated `:923` fixture under a new name — see 3.5.
      Confirm RED.
- [x] 3.5 RED — Update the EXISTING fixture at `verdict.test.mjs:923` to
      pass `conclusionCauses: ['blocker']` (pin vii) so it keeps asserting
      `APPROVE` under the new sixth conjunct. This is a REQUIRED, deliberate
      edit to a verbatim pin, justified by 3.4: without it, `:923` flips
      `APPROVE` → `REVISE` and reads as an unexplained regression. Both
      statements are now on the record — "an evaluator that says
      `'blocker'` still gets #483's softening" (`:923`, updated) and "an
      evaluator that says nothing does not" (iv, new). **This edit lands in
      the RED commit (3), not the GREEN one** — at this point the sixth
      conjunct does not exist yet, so the extra argument is inert and
      `:923` stays green through this step; it is what keeps it green once
      3.7 ships.
- [x] 3.6 RED — Add the cli.test.mjs differential (pattern established at
      `cli.test.mjs:298`, appended after `:320`): ONE test, TWO arms,
      driving the real `main()` in-process with `deps.loadCiContext`,
      `deps.fetchPr`, `trancheDeps.fetchRollup`, and `deps.probeBase`
      substituted, `--mode checkpoint`, `--dry-run`, asserting on the
      **rendered** block. Arm A (`baseSha` resolves) → rendered
      `verdict: APPROVE` + `follow_ups:` present (the blocker WAS routed
      out) — MUST stay green today; it is what makes arm B mean anything.
      Arm B (`baseSha: null`, same rollup/probe/routed-out blocker) →
      rendered `verdict: REVISE` + `evidence uncomputable` +
      `assert.doesNotMatch(outB, /verdict: APPROVE/)`. Run `npm test`,
      confirm arm B fails today and arm A still passes.
- [x] 3.7 GREEN — Implement Decision 3: in `cli.mjs:658`'s single
      `buildVerdict` call, thread `conclusionCauses: evalResult
      .conclusionCauses` as a plain pass-through (no `?? []` — that would be
      a second, untested home for the same default). Implement Decision 4:
      in `verdict.mjs`, add the `conclusionCauses = []` destructuring
      default directly under `conclusion`, with the comment naming the
      fail-closed intent and #750; add
      `const causeIsBlockerOnly = conclusionCauses.length > 0 &&
      conclusionCauses.every((c) => c === 'blocker')` between `:251` and
      `:253`, with the comment stating the length check is half the rule,
      not padding, and naming the vacuous-truth trap; append
      `&& causeIsBlockerOnly` as the SIXTH, LAST conjunct at
      `verdict.mjs:260`, leaving the first five conjuncts byte-for-byte
      unchanged. Run `npm test`, confirm 3.1-3.6 all pass and
      `regulated-review.e2e.test.mjs:516-538` (the #483 case, spawned,
      untouched) stays green.

## Work unit 4 — pins that must stay green, unchanged (verification, no edit)

- [x] 4.1 Run and confirm still green, with no edits required:
      `verdict.test.mjs:657` (schema-invalid → STOP via `unknownCausality`,
      above the ladder), `:715` (all findings inadmissible, second
      conjunct), `:842` (a surviving `introduced` finding, third conjunct),
      `:827`/`:891`/`:910`/`:936`/`:963` (untouched paths);
      `tranche.test.mjs:54`/`:125`, `checkpoint.test.mjs:323` (additive
      field only).

## Work unit 5 — doctrine: `reviewer-protocol.md` §6.2

Delivers REQ-750-6. Commit: `docs(brain): §6.2 states the cause-gated
softening (#750)` (GREEN — prose, not behaviour, so no RED pin precedes it).

- [x] 5.1 Replace the current shape-only bullet at
      `brain/core/methodology/reviewer-protocol.md` §6.2 (around
      `:330-333`) with the design's drafted paragraph (Decision 6): the
      softening reads the shape AND the cause; a `REVISE` that any
      uncomputable evidence contributed to is never softened (§10's rule,
      restated for the mechanism); an evaluator that declares no cause is
      not softened either — silence fails closed by construction, not by
      luck.
- [x] 5.2 Confirm §10 (around `:419`) is byte-for-byte unchanged — verify
      with `git diff` on that file limited to §6.2's line range.
- [x] 5.3 Add a scenario or grep task confirming the new §6.2 text states
      the cause-gated language, e.g.
      `rg "cause.*blocker|blocker-only|conclusionCauses"
      brain/core/methodology/reviewer-protocol.md` matches inside §6.2 —
      so the requirement is machine-checkable, not only eyeballed.
- [x] 5.4 Note in the PR body: `brain/core/**` is Tier 2 — no ADR is minted,
      the maintainer's merge of this PR is the signature. Expect
      `tranche.mjs:219-227`'s `tier2-frontier` correction (non-blocking, expected)
      and `checkpoint.mjs:165-178`'s `decision-surface` blocker unless the
      PR carries the `decision` label (see P.4).

## Work unit 6 — the producer audit record

Delivers the audit trail behind REQ-750-1.

- [x] 6.1 Paste the producer audit table from `spec.md` REQ-750-1 (the
      six-row `producer | site | causes` table: tranche rollup, tranche
      budget, tranche normal exit, checkpoint, ruling malformed, ruling
      valid) into the PR body verbatim, so review can check it against the
      diff line by line.

## Pre-PR verification (mutation-per-pin discipline)

- [x] P.1 On a clean, stable baseline (no pending mutations, working tree
      clean), run the full `npm test` TWICE and confirm identical green
      results — establishes the baseline before any mutation is applied.
- [x] P.2 For EACH mutation named in the design's test plan — delete the
      sixth conjunct; delete `conclusionCauses.length > 0`; `every`→`some`;
      destructuring default `[]`→`['blocker']`; drop `'uncomputable'` from
      each evaluator return path; drop the checkpoint union; remove
      `conclusionCauses:` from the `buildVerdict` call at `cli.mjs:658`;
      ship the guard without the threading; ship the threading without the
      guard — apply it, confirm with `git diff --stat` that only the
      intended line changed, run `npm test` and confirm the SPECIFIC named
      pin fails (not just "something" fails), then restore with
      `git checkout -- <file>` (never `cp` a snapshot back — that silently
      discards any work done after the snapshot was taken).
- [x] P.3 Run `npm run brain:check` and confirm no new blocker beyond the
      expected `tier2-frontier` correction (5.4).
- [ ] P.4 Confirm the `decision` label exists (`gh label list`) — touching
      `brain/core/methodology/reviewer-protocol.md` raises
      `decision-surface` unless the PR carries it. Create the label at PR
      creation if `gh label list` doesn't show it.
- [ ] P.5 Confirm exactly one `type:bug` label is applied at PR creation.
- [ ] P.6 PR body includes "Part of #682" and "Addresses #750" — base is
      `feature/issue-682` (non-default base), so GitHub closing keywords do
      not auto-close #750; the tracker's terminal PR closes it. State this
      explicitly so a reviewer doesn't expect auto-close.
- [ ] P.7 Run cold review. **Stop rule**: if cold review blocks this change
      twice, STOP and escalate to the maintainer rather than opening a
      third fix round — `convergence.maxRounds: 2`, and #682 already spent
      four rounds of fixes-on-fixes on this exact branch, producing two
      regressions.

## Work unit 7 — memory sync

- [x] 7.1 As a final `chore(memory): sync engram records for #750` commit,
      run the repo's memory-share verb (`npm run memory:share`, per
      `package.json`) and commit only what THIS worktree
      (`/home/gandalf/IA/brain-issue-750`) materialises. The 26 stale
      untracked records reported in OTHER worktrees are out of scope for
      this commit — do not pull them in.

## Review workload forecast

| unit | production lines (est.) | test lines (est.) | notes |
|---|---|---|---|
| 1 (evaluators) | ~16 (tranche +6, checkpoint +8, ruling +2) | ~80 (shape pins across 3 files) | |
| 3 (guard + threading) | ~18 (cli +6, verdict +12) | ~90 (4 verdict pins + 1 fixture edit + cli.test.mjs 2-arm differential) | non-splittable pair |
| 5 (doctrine) | ~8 doctrine lines | 0 (grep confirmation, not a test file) | Tier 2, no ADR |

Estimated total: ~34 production lines + ~8 doctrine lines + ~200 test lines
(design's own "Measure first" estimate). **400-line budget risk: Low** —
well inside on production code, the only thing `governance.ignoreList`
counts against `diff-size` (`**/*.test.mjs` and `openspec/changes/**`
excluded).

**Chained PRs recommended: No.** One PR, stacked on `feature/issue-682`
under `feature-branch-chain` — only the tracker's terminal PR merges to
`main`. `delivery_strategy: auto-chain` degenerates to a single slice here:
the guard is meaningless without the threading (work unit 3's non-split
constraint), and the doctrine commit depends on the guard existing, so there
is no independently-mergeable earlier boundary.

**Decision needed before apply: No.** `delivery_strategy`, `chain_strategy`,
and base are fixed by the tracker branch that already exists. The only
conditional is the `decision` label (P.4), which is a checklist item, not a
strategy fork.

## Not in this change

- `cross-family` axis work — orthogonal, tracked under #682 slice 3.
- A third `'gate'` cause bucket — audited and rejected in design (every gate
  failure already materialises as a `severity: 'blocker'` finding).
- Widening `candidateFindings.length === 0` — #682 round 1's own reverted
  regression; `verdict.mjs:268-274` records why in the file itself.
- Restructuring `conditions` into tagged objects, or string-matching
  `/uncomputable/` over `conditions` in the guard.
- Rendering `conclusionCauses` on the wire, or reading it back in
  `parse-verdict.mjs` — one consumer, at build time, same process.
- `fixture.mjs` surgery to reproduce arm B inside the spawned e2e harness
  (`regulated-review.e2e.test.mjs`) — the in-process differential through
  `main()` already drives the shipped verb end to end; that spawned test
  stays untouched and is pinned as the threading's strongest witness (work
  unit 3, 3.7).
- A new ADR for the §6.2 amendment — Tier 2, the maintainer's merge is the
  signature.
- Auditing consumer repos for direct `buildVerdict` callers outside this
  repo — judged acceptable risk in design (fail-closed default, no
  published API surface, failure direction is a false block, never a false
  approve).
