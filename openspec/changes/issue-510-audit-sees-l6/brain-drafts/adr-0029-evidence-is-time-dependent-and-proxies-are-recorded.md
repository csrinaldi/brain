# ADR-0029 — Evidence is time-dependent, and a proxy is recorded rather than trusted

**Status**: Draft — pending human signature
**Date**: 2026-08-08 — drafted by an agent for promotion (Tier 2)
**Issue**: #510 (indexing) · #511 (the unowned invariant) · **Epic**: #313

> **Drafting note, kept deliberately.** An earlier revision of this ADR asserted that the
> content invariant "already exists — it is L6". That was **false**, and it was disproved by
> running L6's evaluator rather than by reading it. The claim survived a full ticket re-scope
> and an ADR draft before anyone drove it. It is recorded here because the error is the same
> class the decision below is about: a check that *looks* like it answers a question.

## Context

`brain-audit` re-verifies governance on merged history and is the enforcing guarantee for any
repository that cannot reach rung 1 — brain's own included. It evaluates four checks:
`diffSize`, `issueLink`, `adrPresence`, `memoryPresence`.

`adrPresence` decides on file names from `git diff --name-only`, which cannot distinguish an
added path from a modified one. Two things followed from that single imprecision:

1. **A false positive with a live cost.** A PR correcting one dead citation inside an ADR from
   months ago — already indexed — fails `decision-gate` (PR #507), with a reason
   (*"ADR file added"*) that the check never measured.
2. **A protection nobody had named.** The imprecision is what catches **A10**, the frozen
   finder fixture from the #297 finder≠patcher ruling: *an ungoverned ADR edited back in and
   live at HEAD must always be reported.* On the audit surface `adrPresence` had quietly become
   a content tripwire — documented only in a docstring belonging to another module and another
   ruling (`postmerge/resolution.mjs`).

So one function answers two questions:

| | invariant | keys on |
|---|---|---|
| **I1** | a NEW ADR arrives with its `brain/HOME.md` entry | added paths |
| **I2** | an ADR's content does not change without a human gate | governance evidence |

The obvious owner for I2 was `brain-writes-reviewed` (L6), which requires human evidence for
any write to `brain/core/**` or `brain/project/**` at every tier. Driving its pure evaluator
with A10's exact inputs settles it:

| tier | verdict | why |
|---|---|---|
| `lite` | **PASS** | the evidence is *agent-authorship exclusion*; reviews are never consulted |
| `standard` · `regulated` | **WARN** | *"no PR reviews found … never failing on missing evidence (REQ-L6-1)"* |

**L6 catches A10 at no tier.** And its fail-open is not a defect: at PR time, absent review
evidence means *"not reviewed **yet**"*, and failing on it would block every freshly-opened PR.
An audit reads merged history, where the same absence means *"never reviewed"*.

## Decision

**1. Evidence is time-dependent.** A PR-time gate and a post-merge audit may share a question
and must not assume they can share an evidence rule. The same absence — no review, no label,
no artifact — means *not yet* before the merge and *never* after it. Any check reused across
those two moments states which reading it takes, or it is two checks.

**2. An invariant is enforced by the check that owns it.** A check answers one question. Where
a surface cannot see an invariant, the blindness is **recorded** — as a limitation, a ticket, or
both — and never covered by a proxy whose real meaning lives in another module's docstring.

**3. Applied here.** `adrPresence` keeps I1 and takes an added-only path list. **I2 has no
owner** and that is the honest state of the system: it is tracked in #511, not asserted as
covered. A10 keeps guarding the MODIFY channel until #511 gives I2 a real owner, and the
sequencing between the two is chosen deliberately rather than implied.

## Never do

- **Never let one check answer two invariants.** If a second question is being answered, it is
  answered by name, on every surface, or it is recorded as unenforced.
- **Never reuse a PR-time evidence rule in a post-merge audit** without restating what absence
  means there. This is how a fail-open designed for "not yet" becomes a fail-open for "never".
- **Never collapse absent evidence into negative evidence**, in either direction.
- **Never claim an invariant is covered because a check with a similar name exists.** Drive it.
  This ADR's own first revision is the cautionary case.
- **Never disarm a frozen fixture to unblock a change.** If the mechanism it pins has moved,
  re-freeze it by ruling, with its comment updated to the mechanism that now does the work.

## Consequences

- **Positive.** A PR correcting an existing ADR stops being blocked, and a blocked PR's reason
  stops asserting more than its evidence supports.
- **Positive.** I2 becomes visible. It was never enforced on merged history; it was covered by
  an accident that any correct fix to `adrPresence` would have removed silently. It now has a
  ticket instead of a coincidence.
- **Negative, and the reason this needs a signature.** Between this landing and #511 closing,
  the MODIFY channel is enforced only at PR time. The audit's guarantee genuinely narrows, and
  A10's fate depends on the sequencing chosen on #510 — hold, keep the audit coarse, or record
  the loss in `KNOWN-LIMITATIONS`.
- **Neutral.** `adrPresence` keeps its pre-#510 behaviour when the added-only list is omitted,
  so `brain-promote` and `postmerge/resolution` are untouched.

## Rejected

- **A new gate for I2** (nine coupling points: a `GATE_MATRIX` row, a `governance.yml` job, the
  order drift-guard, a branch-protection re-arm, a tier decision) — before establishing what
  its evidence rule even is. Scope belongs after the question, not before it.
- **An L6-shaped audit check.** Measured above: it catches A10 at no tier.
- **Keying on the ADR title** (`brain/HOME.md` indexes by title). Deterministic and cheap, and
  it does not cover A10 — the offending text returns while the title never moves.
- **Silently accepting the loss of A10.** Disarming a frozen attack fixture to unblock a
  documentation PR. If the loss is accepted it is written down, which is decision (3) on #510.

## References

- Issues #510 (I1) · #511 (I2, unowned) · PR #507 (#499) · epic #313
- A10: `brain/scripts/brain-audit.test.mjs` (frozen, governance #297)
- L6: `brain/scripts/vcs/brain-writes-reviewed.mjs` — `evaluateBrainWritesReviewed`
- The proxy documented elsewhere: `brain/scripts/governance/postmerge/resolution.mjs`
- `uncomputable` vs failed: #474 · one rule two surfaces: #340
