---
status: draft
issue: 750
---

# Proposal — the softening reads the CAUSE, and an undeclared cause cannot soften (issue 750)

## What

`buildVerdict`'s #483 REVISE-to-APPROVE softening decides on the **shape** of the
finding list and knows nothing about **why** the evaluator said REVISE. So a
verdict whose `conditions` says `evidence uncomputable: TDD-RED reversion (base
sha unresolvable)` renders `verdict: APPROVE` whenever every finding happened to
route out to `follow_ups[]`. That is protocol §10 exactly inverted, and it is
pinned as a KNOWN GAP in our own suite today.

This change gives the evaluator a way to **declare the cause of its REVISE**, and
makes the softening read that declaration. An evaluator that declares no cause
**cannot** be softened — fail-closed by construction, not by a list of blocked
strings.

The maintainer already ruled this in #750, acceptance criterion 1, option (b)
([ruling comment](https://github.com/csrinaldi/brain/issues/750#issuecomment-5357386695)).
This proposal is that ruling's implementation shape, not a re-litigation of it.

## Why now

The defect is live on this branch and on `main`:

```js
// verdict.mjs:260 — the guard, verbatim
} else if (protocol === 'brain-review/2' && processed.length > 0
           && candidateFindings.length === 0 && raisedConclusion === 'REVISE'
           && !escalatesWithoutBlocking) {
  finalVerdict = 'APPROVE';
```

Five conjuncts. Not one of them can see `conditions`, and `conditions` is where
"I could not compute my evidence" lives (`cli.mjs:676` merges the evaluator's
conditions into the verdict; the branch never reads that parameter). The gap is
**structural**, not a missing case.

`checkpoint.mjs:239-240` derives REVISE from three causes in one boolean:

```js
const conclusion =
  tranche.conclusion === 'REVISE' || anyBlocker || uncomputableReasons.length > 0 ? 'REVISE' : 'APPROVE';
```

By the time that single string reaches `buildVerdict` the three causes are one
word. The softening then treats them all as "a blocker that got routed out".

Doctrine already forbids the outcome. §10's lock table, `reviewer-protocol.md:419`:

> **Uncomputable evidence** (`gh` down) | never APPROVE on uncomputable evidence
> — emit REVISE with `conditions: [evidence uncomputable]`; fail-closed

The rule is signed. The code does not implement it on this route. That is the
whole ticket.

## The ruling, restated as one verifiable sentence

> **A `/2` verdict softens REVISE to APPROVE iff protocol is `brain-review/2`,
> `processed.length > 0`, `candidateFindings.length === 0`,
> `raisedConclusion === 'REVISE'`, `!escalatesWithoutBlocking`, AND
> `conclusionCauses` is non-empty and every entry is `'blocker'`.**

Six conjuncts. The first five are today's, byte-for-byte unchanged. The sixth is
the whole change.

### The vacuous-truth trap, named before it is written

`[].every(c => c === 'blocker')` is **`true`** in JavaScript. Write the sixth
conjunct as `conclusionCauses.every(...)` alone and "no cause declared" becomes
"all causes are blockers" — the exact fail-**open** the ruling forbids, produced
by the idiomatic spelling of the fix.

`conclusionCauses.length > 0` is therefore **not defensive padding, it is the
fail-closed half of the requirement**, and it gets its own born-red pin (test ii
below) whose mutation is *delete the length check*.

This costs nothing on the APPROVE path, and the argument is short: the softening
only runs when `raisedConclusion === 'REVISE'`. Either the evaluator said REVISE
— in which case it declares why — or the raise (`verdict.mjs:214-217`) produced
it, and the raise fires only when `blockerRemains`, which makes
`candidateFindings` non-empty and kills the third conjunct anyway. **No existing
APPROVE route reaches the new conjunct with an empty cause list.**

## The cause field

**`conclusionCauses: Array<'blocker' | 'uncomputable'>`**, declared by the
evaluator alongside `conclusion`.

| producer | site | causes |
|---|---|---|
| `evaluateTranche` — rollup not an array | `tranche.mjs:154-166` | `['uncomputable']` |
| `evaluateTranche` — budget uncomputable | `tranche.mjs:192-202` | `['uncomputable']` + `'blocker'` if the gate loop already pushed one |
| `evaluateTranche` — normal exit | `tranche.mjs:249` | `['blocker']` on REVISE, `[]` on APPROVE |
| `evaluateCheckpoint` | `checkpoint.mjs:238-240` | union of tranche's propagated causes, `'blocker'` if `anyBlocker`, `'uncomputable'` if `uncomputableReasons.length > 0` |
| `evaluateRuling` — malformed fork | `ruling.mjs:125-139` | `['blocker']` (for completeness; its REVISE is always blocker-backed by `fork-malformed`) |

Threaded by `cli.mjs:658-682` as `conclusionCauses: evalResult.conclusionCauses ?? []`
into `buildVerdict`, **consumed only in the softening guard**. Never rendered,
never round-tripped through `parse-verdict.mjs`.

Why "never rendered" is coherent rather than a shortcut: `conclusion` itself is
already an unrendered input — `renderVerdict` emits only the derived `verdict:`
line. `conclusionCauses` is evaluator-to-builder plumbing of the same kind, and
the reader already sees the cause in `conditions:`, in prose, on the wire.

Why REQ-682-4 ("no reasoning leaks to the challenger") does not apply: that
boundary gates **finding-level** fields reaching the refuter (`inferential.mjs`
`CARRIED_FIELDS`). `conclusionCauses` never touches a finding object and never
reaches a challenger.

### The alternatives, and why not

- **`cause: { kind, reasons[] }` — a single object.** Checkpoint can be
  simultaneously blocker-caused and uncomputable-caused, so `kind` needs a
  `'mixed'` sentinel, and every reader must then remember that `'mixed'` is
  non-softenable. The array expresses multi-causality for free and the guard
  reads as one clause.
- **Restructure `conditions` into tagged objects.** `conditions` is plain
  strings today (`yamlScalar`, `verdict.mjs:398`) and is **never parsed back** —
  `parse-verdict.mjs` has no `conditions` reader at all. Tagging it forces every
  producer to change (`rollupUncomputableCondition`, checkpoint's per-reason
  push, `applyCausalAdmission`'s unchallenged count, and both of
  `base-comparison.mjs`'s at `:249` and `:277`) plus the render surface — a far
  larger blast radius for the same fix.
- **String-match `conditions` for `/uncomputable/` inside the guard.** Rejected
  outright: it makes a control depend on prose, and `base-comparison.mjs:277`
  emits `evidence uncomputable: {gate} could not be re-run at base` on a route
  where the affected finding is deliberately left **blocking** — a naive string
  match would change behaviour on a route that is not broken.

### And what this change must NOT do

It must **not widen `candidateFindings.length === 0`**. That widening — to
`!blockerRemains` — is #682 round 1's own regression, reverted in round 2, and
the reverted code's comment (`verdict.mjs:268-274`) explains why in the reviewer's
own words. "Every blocker was routed out" is already carried by the existing
conjunct. The cause gate is **added**, nothing is loosened.

## The risk model is the ticket's own history

#682 took **four consecutive rounds of fixes**, and each round introduced a
defect the previous one did not have. This branch stacks on that. So the strategy
is deliberately the smallest one that satisfies the ruling: one new conjunct, one
new field, five untouched conjuncts, zero behaviour changes to routing.

## Scope

### In

1. `conclusionCauses` declared by `tranche.mjs`, `checkpoint.mjs`, `ruling.mjs`.
2. Threaded through `cli.mjs`'s single `buildVerdict` call.
3. Consumed in `buildVerdict`'s softening guard as the sixth conjunct.
4. `reviewer-protocol.md` §6.2 (`:330-333`) amended to state the cause-gated rule.
5. The born-red pins below, including the **replacement** of the KNOWN GAP pin.

### Out

- **Changing `candidateFindings.length === 0`.** Out on purpose — see above.
- **`inferential.mjs` and `refuter.mjs`.** Neither ever sets `conclusion`
  (inferential returns `conclusion: null`; the refuter and `applyCausalAdmission`
  touch only `findings`/`escalate`/`conditions`). Nothing to declare.
- **`renderVerdict` / `parse-verdict.mjs`.** The field is not on the wire.
- **`base-comparison.mjs`.** Audited: its two uncomputable conditions never empty
  the blocking set — the affected finding stays blocking — so it is not a live
  route to this bug.
- **`main`'s copy of `verdict.mjs`.** This branch stacks on `feature/issue-682`;
  the fix reaches `main` through the tracker's terminal PR.
- Any third cause bucket. Every "gate" failure already materialises as a
  `severity: 'blocker'` finding (`tranche.mjs:174-180`), so `'blocker'` and
  `'uncomputable'` are the complete set. The ruling's prose used
  "blocker/gate/uncomputable" as example labels; the audit found no functional
  need for the third.

## Tests — every behavioural change is born red

`strict_tdd: true`, `npm test`, `node:test`. Each pin below fails before the
change and passes after, and each names the mutation it kills.

| # | pin | born red because | kills the mutation |
|---|---|---|---|
| i | **closure pin** replacing `KNOWN GAP` at `verdict.test.mjs:864` — same fixture (routed-out blocker + `evidence uncomputable` condition), asserting **not APPROVE** | today's code softens it; that is the bug | dropping the cause conjunct entirely |
| ii | no-cause / empty-cause: an otherwise-softenable fixture with `conclusionCauses: []` (and a sibling with the field omitted) → no APPROVE | the field does not exist yet | deleting `conclusionCauses.length > 0` (the `[].every` trap) |
| iii | mixed causes `['blocker','uncomputable']` → no APPROVE | ditto | changing `.every` to `.some`, or to `.includes('blocker')` |
| iv | **real-verb e2e**: in-process `main()` (the `cli.test.mjs:298` pattern — `--mode checkpoint`, `deps.loadCiContext → { baseSha: null }`, injected `checkpointDeps`) with an uncomputable base **and** a blocker whose disposition resolves to `pre-existing` | the composed route approves today | proving the fix only at `buildVerdict` level while `cli.mjs` drops the field |
| v | `verdict.test.mjs:923` (#483's own case) updated to pass `conclusionCauses: ['blocker']` | **required fixture change** — see below | a fix that makes nothing softenable ever |
| vi | evaluator-level: tranche declares `['uncomputable']` on each short-circuit and `['blocker']` on the normal REVISE exit; checkpoint unions tranche's causes with its own on each of its three routes | the field does not exist yet | checkpoint dropping tranche's propagated cause |

**Test (v) is a required fixture change, not a regression.** `verdict.test.mjs:923`
passes no `conclusionCauses` today; under fail-closed semantics it flips APPROVE →
REVISE unless the fixture declares `['blocker']`. Changing it is correct — the
test's subject is "#483's softening still fires", and after this change that
scenario is *by definition* a blocker-caused REVISE. It is called out here so no
reviewer mistakes it for a silently-edited pin.

Must stay green, unchanged: `verdict.test.mjs:657`, `:715`, `:827`, `:842`,
`:891`, `:910`, `:936`, `:963`; `tranche.test.mjs:54`, `:125`;
`checkpoint.test.mjs:323`; and the process-spawned
`test/review-regulated/regulated-review.e2e.test.mjs:516-538`, whose APPROVE is
purely blocker-caused and must survive.

## Doctrine amendment (Tier-2 write)

`reviewer-protocol.md:419` (§10) **needs no change** — it already states the rule
correctly. `reviewer-protocol.md:330-333` (§6.2, "REVISE-to-APPROVE softening")
**does**: it documents the shape-only rule with no cause restriction, so it
currently describes the defect as if it were the design. It gains the cause
clause and the fail-closed sentence.

`brain/core/**` is a **Tier-2 write: the maintainer's merge is the signature.**

No new ADR. This records no new decision — it closes the gap between §6.2's prose
and §10's already-signed rule.

## Requirements the spec will formalise

| REQ | statement |
|---|---|
| **REQ-750-1** | Every evaluator that can conclude REVISE declares `conclusionCauses`, drawn from `{'blocker','uncomputable'}`, covering every cause that contributed to that conclusion. |
| **REQ-750-2** | The softening fires only when `conclusionCauses` is **non-empty** and **every** entry is `'blocker'`. An undeclared or empty cause list never softens. |
| **REQ-750-3** | A verdict carrying an `evidence uncomputable:` condition never renders `APPROVE` by any route, proven through the real verb (`main()`), not `buildVerdict` alone. |
| **REQ-750-4** | #483's own case still softens: every finding routed out, no uncomputable evidence, blocker-caused REVISE → APPROVE. |
| **REQ-750-5** | `conclusionCauses` is builder-internal: never rendered by `renderVerdict`, never read by `parse-verdict.mjs`, and read at exactly one site in `buildVerdict`. |
| **REQ-750-6** | §6.2 of `reviewer-protocol.md` states the cause-gated softening rule, including its fail-closed clause. |

## Delivery

`delivery_strategy: auto-chain`, `chain_strategy: feature-branch-chain`. Branch
`fix/issue-750-softening-reads-the-cause` off `feature/issue-682`; PR targets
`feature/issue-682`, body says **"Part of #682"** and mentions #750. The tracker's
terminal PR closes.

**Diff estimate, excluding tests: ~55 changed lines** — `verdict.mjs` ~20
(destructure, conjunct, comment), `tranche.mjs` ~10 (three return sites),
`checkpoint.mjs` ~12 (union + return), `cli.mjs` ~5, `ruling.mjs` ~2,
`reviewer-protocol.md` ~8. Tests add ~150-200. **Comfortably inside the 400-line
budget; no `size:exception` and no slice needed.** If cold review forces the
estimate over 400 anyway, the natural cut is `[evaluators + their unit pins]` →
`[buildVerdict guard + verdict pins + e2e]` → `[doctrine]`, in that order, since
the guard is inert until a producer declares a cause and the doctrine text is
inert entirely.

## Risks, and the convergence rule

1. **The `[].every` trap.** Highest-probability mutation-surviving bug in any
   naive implementation of ruling (b). Mitigated by pin (ii), which exists for
   exactly this and nothing else.
2. **Fixture (v) flips.** Named above so it is reviewed as a deliberate change.
3. **A cause path missed at an evaluator return site.** The failure mode is
   fail-**closed** (a softening that should fire does not) — annoying, never
   unsafe. Pin (vi) covers each path.
4. **Fifth-round fatigue on this stack.** `convergence.maxRounds: 2`. If the cold
   review returns blockers twice, the change **stops and escalates to the
   maintainer** — it does not get a third blind round. Rounds 3 and 4 on #682 are
   what this branch exists to repair; repeating the pattern here would be the
   same defect one ticket over.

### Open for the maintainer

The audit found only two structurally distinct causes, `'blocker'` and
`'uncomputable'`, where the ruling's prose named three ("blocker/gate/
uncomputable"). This proposal ships two, because every gate failure already **is**
a blocker finding. Say so if the third bucket was meant to carry something the
audit did not see.

## References

- #750 (`status:approved`) · [ruling comment](https://github.com/csrinaldi/brain/issues/750#issuecomment-5357386695) · #682 (tracker) · #483 (the softening's origin)
- `brain/core/methodology/reviewer-protocol.md:330-333` (§6.2, amended) · `:419` (§10, unchanged)
- `brain/scripts/review/verdict.mjs:260` · `:214-217` · `:268-274` · `cli.mjs:658-682`
- `brain/scripts/review/evaluators/tranche.mjs:154-166` · `:192-202` · `:249`
- `brain/scripts/review/evaluators/checkpoint.mjs:226-242` · `ruling.mjs:125-139`
- `brain/scripts/review/verdict.test.mjs:864` (KNOWN GAP, replaced) · `:923` (fixture updated) · `cli.test.mjs:298` (e2e harness pattern)
