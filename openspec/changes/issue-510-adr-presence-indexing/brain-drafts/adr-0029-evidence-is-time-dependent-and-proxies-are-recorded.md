# ADR-0029 — Evidence is time-dependent, and a proxy is recorded rather than trusted

**Status**: Draft — pending human signature
**Date**: 2026-08-09 — drafted by an agent for promotion (Tier 2)
**Issue**: #510 (indexing) · #511 (content governance, merged as PR #512) · **Epic**: #313

> **Drafting note, kept deliberately.** An earlier revision of this ADR asserted that the
> content invariant "already exists — it is L6". That was **false**, and it was disproved by
> running L6's evaluator rather than by reading it. The claim survived a full ticket re-scope
> and an ADR draft before anyone drove it. It is recorded here because the error is the same
> class the decision below is about: a check that *looks* like it answers a question.

## Context

`brain-audit` re-verifies governance on merged history and is the enforcing guarantee for any
repository that cannot reach rung 1 — brain's own included.

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

So one function answered two questions:

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

That finding became #511, which shipped `writesGoverned` — L6's evaluator, called by the audit,
with the post-merge reading of absence made explicit. **I2 has an owner as of PR #512.** This
ADR is written after that landed, so the sequencing question the ticket agonised over is
settled rather than open.

## Decision

**1. Evidence is time-dependent.** A PR-time gate and a post-merge audit may share a question
and must not assume they can share an evidence rule. The same absence — no review, no label,
no artifact — means *not yet* before the merge and *never* after it. Any check reused across
those two moments states which reading it takes, or it is two checks.

**2. An invariant is enforced by the check that owns it.** A check answers one question. Where
a surface cannot see an invariant, the blindness is **recorded** — as a limitation, a ticket, or
both — and never covered by a proxy whose real meaning lives in another module's docstring.

**3. A frozen fixture follows the invariant, not the mechanism.** When the owner of a property
changes, the fixture that pins the property is **re-pointed at the new owner and asserts that
it is the one reporting**. It is not retired, and it is not left passing for a reason its own
comment no longer describes — that is an apparent protection, the defect class #499 closed in
the doctrine.

**4. Applied here.** `adrPresence` keeps I1 and takes an added-only path list. I2 is
`writesGoverned` (#511). A10 is reinforced under (3): a resolvable PR, a non-approving review,
and an assertion naming `writesGoverned`.

## Never do

- **Never let one check answer two invariants.** If a second question is being answered, it is
  answered by name, on every surface, or it is recorded as unenforced.
- **Never reuse a PR-time evidence rule in a post-merge audit** without restating what absence
  means there. This is how a fail-open designed for "not yet" becomes a fail-open for "never".
- **Never collapse absent evidence into negative evidence**, in either direction. An
  uncomputable read fails closed; an unanswerable question abstains. Neither is a verdict.
- **Never claim an invariant is covered because a check with a similar name exists.** Drive it.
  This ADR's own first revision is the cautionary case.
- **Never disarm a frozen fixture to unblock a change.** If the mechanism it pins has moved,
  re-point it at the mechanism that now does the work, by ruling, and make it assert that.
- **Never accept a guard that only holds for injected dependencies.** The shipped reader is
  what runs in CI; a fail-closed path proven only through an injected stub proves nothing about
  it. (Mutation M3 on this change: the shipped reader could be gutted with the suite green.)

## Consequences

- **Positive.** A PR correcting an existing ADR stops being blocked, and a blocked PR's reason
  stops asserting more than its evidence supports.
- **Positive.** I2 stopped being a coincidence. It was never enforced on merged history; it was
  covered by an accident that any correct fix to `adrPresence` would have removed silently.
- **Negative, and the reason this needs a signature — the audit's MODIFY-channel guarantee is
  now CONDITIONAL on being able to read review evidence.** Two paths forfeit it:
  1. `writesGoverned` **abstains** when no PR resolves (a direct push, a squash outside the PR
     flow, an offline run, an adapter without `prReviews`). #474 and #511 settled that this is
     the right answer — failing every unresolvable merge turns the audit red on history it
     cannot judge — but the consequence is that such a merge is not reported.
  2. The **pre-evaluation resolved-skip** (`resolvedSkipLine`, design §3.5 / REQ-D2-10) drops a
     merge whose own contribution is net-absent at the tip *before any check runs*. So an
     ungoverned `brain/` write that someone later reverted never reaches the human-gate check
     at all. This is documented, deliberate, and predates both #510 and #511 — what was never
     written down is that it now also governs **review evidence**, whose remedy is a human
     reviewing the change rather than the tree no longer holding it. Recorded here; whether the
     skip should be narrowed for non-tree-keyed classes is a separate decision, not this one.
- **Neutral.** `adrPresence` keeps its pre-#510 behaviour when the added-only list is omitted,
  so `brain-promote` and `postmerge/resolution` are untouched.

## Rejected

- **A new gate for I2** (nine coupling points: a `GATE_MATRIX` row, a `governance.yml` job, the
  order drift-guard, a branch-protection re-arm, a tier decision) — before establishing what
  its evidence rule even is. Scope belongs after the question, not before it. #511 needed none
  of them.
- **An L6-shaped audit check that reuses L6's reading.** Measured above: it catches A10 at no
  tier. What #511 shipped shares L6's *evaluator* and states its own *reading*.
- **Keying on the ADR title** (`brain/HOME.md` indexes by title). Deterministic and cheap, and
  it does not cover A10 — the offending text returns while the title never moves.
- **Letting A10 pass and accepting that its reason changed.** Explicitly rejected in the
  maintainer's ruling on #510: a fixture whose comment describes a mechanism that no longer
  runs is an apparent protection.
- **Splitting added from modified while keeping the audit surface coarse**, so CI unblocks and
  A10 keeps its old proxy. The surfaces would deliberately disagree, and every merge touching
  an ADR would trip a tree-keyed audit failure — rung 3 opening an auto-revert against it, with
  `cursor.mjs accept` becoming routine. A remedy that has to be run routinely stops being one.

## References

- Issues #510 (I1) · #511 (I2, merged as PR #512) · PR #507 (#499) · epic #313
- A10 / A10b / A10c / A10d: `brain/scripts/brain-audit.test.mjs` (A10 frozen, governance #297)
- L6: `brain/scripts/vcs/brain-writes-reviewed.mjs` — `evaluateBrainWritesReviewed`
- I2's owner: `brain/scripts/governance/checks/writes-governed.mjs`
- The proxy documented elsewhere: `brain/scripts/governance/postmerge/resolution.mjs`
- `uncomputable` vs failed: #474 · one rule two surfaces: #340 · apparent protection: #499
