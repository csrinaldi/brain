---
status: draft
issue: 750
---

# Spec — the softening reads the CAUSE, and an undeclared cause cannot soften (issue 750)

`buildVerdict`'s #483 REVISE-to-APPROVE softening decides on the shape of the
finding list and cannot see why the evaluator said REVISE. This spec formalises
the maintainer's ruling on #750, acceptance criterion 1, option (b): the
softening must read a declared cause, and an evaluator that declares no cause
cannot be softened.

## Ruling — restated as one verifiable sentence

> A `/2` verdict softens REVISE to APPROVE iff protocol is `brain-review/2`,
> `processed.length > 0`, `candidateFindings.length === 0`,
> `raisedConclusion === 'REVISE'`, `!escalatesWithoutBlocking`, AND
> `conclusionCauses` is non-empty and every entry is `'blocker'`.

The first five conjuncts are today's, unchanged. The sixth is this change.

## REQ-750-1 — Every evaluator declares `conclusionCauses` on every return path

Every evaluator that can reach a `REVISE` conclusion MUST declare
`conclusionCauses: Array<'blocker' | 'uncomputable'>` on every return path,
covering every cause that contributed to that conclusion. The complete set of
producers audited for this change:

| producer | site | causes |
|---|---|---|
| `evaluateTranche` — rollup not an array | `tranche.mjs:154-166` | `['uncomputable']` |
| `evaluateTranche` — budget uncomputable | `tranche.mjs:192-202` | `['uncomputable']` plus `'blocker'` if a blocker finding was already pushed |
| `evaluateTranche` — normal exit | `tranche.mjs:249` | `['blocker']` iff a blocker finding exists, else `[]` |
| `evaluateCheckpoint` | `checkpoint.mjs:226-240` | union of tranche's propagated causes, plus `'blocker'` iff `anyBlocker`, plus `'uncomputable'` iff `uncomputableReasons.length > 0` |
| `evaluateRuling` — malformed fork | `ruling.mjs:125-139` | `['blocker']` |
| `evaluateRuling` — valid fork | `ruling.mjs` | STOP path; no conclusion reached, `conclusionCauses` declared `[]` for completeness |

`inferential.mjs`, `refuter.mjs`, and `applyCausalAdmission` never set
`conclusion` — they touch only `findings`/`escalate`/`conditions`. They MUST
NOT declare `conclusionCauses`; there is nothing for them to declare.

#### Scenarios
- WHEN tranche's rollup value is not an array THEN `evaluateTranche` returns `conclusionCauses: ['uncomputable']`.
- WHEN tranche's budget check is uncomputable and no blocker finding was already pushed THEN `conclusionCauses` is `['uncomputable']` only.
- WHEN tranche's budget check is uncomputable and a blocker finding was already pushed THEN `conclusionCauses` contains both `'uncomputable'` and `'blocker'`.
- WHEN tranche's normal exit has at least one blocker finding THEN `conclusionCauses` is `['blocker']`.
- WHEN tranche's normal exit has no blocker finding THEN `conclusionCauses` is `[]`.
- WHEN checkpoint evaluates THEN its `conclusionCauses` is the union of the inherited tranche causes, `'blocker'` iff `anyBlocker`, and `'uncomputable'` iff `uncomputableReasons.length > 0`.
- WHEN ruling's fork is malformed THEN `conclusionCauses` is `['blocker']`.
- WHEN inferential, the refuter, or `applyCausalAdmission` run THEN none of them ever set `conclusion`, so none ever declare `conclusionCauses`.

## REQ-750-2 — Fail-closed default: softening requires a non-empty, all-`'blocker'` cause list

The softening's sixth conjunct MUST check `conclusionCauses.length > 0` before
checking `conclusionCauses.every(c => c === 'blocker')`. `[].every(...)` is
vacuously `true` in JavaScript — the length check is not defensive padding, it
is the fail-closed half of the rule.

#### Scenarios
- WHEN `conclusionCauses` is undefined or omitted THEN the softening does not fire.
- WHEN `conclusionCauses` is `[]` THEN the softening does not fire, even though `[].every(c => c === 'blocker')` is `true` — the guard MUST short-circuit on the length check first.
- WHEN `conclusionCauses` contains any entry other than `'blocker'` (e.g. `['uncomputable']` or `['blocker','uncomputable']`) THEN the softening does not fire.
- WHEN `conclusionCauses` is non-empty and every entry is `'blocker'` THEN the softening fires, subject to the five pre-existing conjuncts also being true.

## REQ-750-3 — Uncomputable evidence never renders APPROVE, proven through the real verb

The guarantee MUST be proven end-to-end through `main()` in
`brain/scripts/review/cli.mjs`, not through `buildVerdict` called in
isolation — the field must survive the whole pipe from evaluator to renderer.

#### Scenarios
- WHEN the fixture that produced the `KNOWN GAP` pin at `verdict.test.mjs:864` (a routed-out blocker finding plus an `evidence uncomputable:` condition) is evaluated by `buildVerdict` THEN the rendered verdict is `REVISE`, not `APPROVE` — this closure pin REPLACES the `KNOWN GAP` pin at that same location; it MUST NOT be deleted without a replacement assertion.
- WHEN `main()` in `cli.mjs` runs end-to-end (`--mode checkpoint`, `deps.loadCiContext` resolving to `{ baseSha: null }`, injected `checkpointDeps`) with an uncomputable base comparison and a blocker finding whose `causal_disposition` resolves to `pre-existing` THEN the process's rendered verdict is `REVISE`.

## REQ-750-4 — #483's own case still softens

#### Scenario
- GIVEN every candidate finding is routed out (`causal_disposition` is `'pre-existing'` or `'base-only'` for each), `conclusionCauses` is `['blocker']`, and no `evidence uncomputable:` condition is present
  WHEN `buildVerdict` evaluates the `/2` verdict
  THEN it renders `APPROVE`.

## REQ-750-5 — `conclusionCauses` is builder-internal plumbing

`conclusionCauses` MUST be threaded unchanged from the evaluator's result to
`buildVerdict`, MUST NOT be rendered on the wire, and MUST NOT be read back
from a rendered verdict.

#### Scenarios
- WHEN `cli.mjs` constructs its single `buildVerdict` call THEN it threads `conclusionCauses: evalResult.conclusionCauses ?? []` unchanged — nothing between the evaluator's return and `buildVerdict`'s input rewrites it.
- WHEN `renderVerdict` emits the rendered verdict text THEN `conclusionCauses` does not appear in the output.
- WHEN `parse-verdict.mjs` parses a rendered verdict THEN it has no reader for `conclusionCauses` — the field is never round-tripped.
- WHEN `buildVerdict`'s softening guard evaluates THEN `conclusionCauses` is read at exactly that one site and nowhere else in `buildVerdict`.

## REQ-750-6 — `reviewer-protocol.md` §6.2 states the cause-gated rule

#### Scenarios
- WHEN `brain/core/methodology/reviewer-protocol.md` §6.2 (around `:330-333`) is read THEN its text states the cause-gated softening rule (`conclusionCauses` non-empty and every entry `'blocker'`) and the fail-closed default (undeclared or empty cause never softens) — verifiable by grepping that section for the cause-gated language.
- WHEN §10 (`:419`) is read THEN its text is unchanged — the uncomputable-evidence lock table entry it already states is not touched by this change.

## Out of scope

- The `candidateFindings.length === 0` conjunct is unchanged — this change adds a sixth conjunct, it does not widen the third.
- `inferential.mjs` and `refuter.mjs` are untouched — neither ever sets `conclusion`.
- `main`'s copy of `verdict.mjs` is reached only through the tracker's (#682) terminal PR; this change stacks on `feature/issue-682`.
- `renderVerdict` / `parse-verdict.mjs` are not modified — `conclusionCauses` never touches the wire.
- `base-comparison.mjs` is unmodified — audited, not a live route to this bug.
- Any third cause bucket beyond `'blocker'` and `'uncomputable'`.

## Open for the maintainer

The audit found only two structurally distinct causes, `'blocker'` and
`'uncomputable'`, where the ruling's prose named three
(`"blocker/gate/uncomputable"`). This spec formalises two, because every gate
failure already materialises as a `severity: 'blocker'` finding
(`tranche.mjs:174-180`).
