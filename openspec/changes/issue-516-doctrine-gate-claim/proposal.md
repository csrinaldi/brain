---
status: draft
issue: 516
---

# Proposal — the doctrine promises a gate that no longer fires

## What was wrong

`consolidation-protocol.md` §1c, on amending a signed ADR, tells the human executing the
cascade:

> The `brain/HOME.md` entry for that ADR is updated in the same commit to carry the amendment
> marker — **`decision-gate` requires an ADR change and a `brain/HOME.md` change to co-occur, so
> omitting it fails the gate** as well as leaving the index wrong.

It does not. #510 (PR #515) taught `adrPresence` to distinguish an **added** ADR from a
**modified** one, because the previous behaviour forced a re-index for correcting a line in an
ADR from months ago — it blocked PR #507 for months. Correct fix. An amendment modifies an
existing ADR, so since #510 the missing marker passes.

That sentence is load-bearing in a way an ordinary stale line is not: **it is what a human
reads while deciding whether the step is skippable**, and the amendment path has no tool behind
it. `brain:promote` stages the ADR, the `HOME.md` entry and a regenerated `AGENTS.md` together
for a NEW ADR, so the human cannot forget; for an in-place amendment it refuses by design and
#509 is unbuilt. The human is the only enforcement, and the doctrine tells them they are not.

The two remaining nets do not close it: `brain:nav` passes because `HOME.md` already links the
ADR — it is the *marker* that goes missing, not the link — and `phase-order` is detection-only
at `lite`. An apparent protection, which is the class #499 closed.

## There are five sites, not four

#516 listed four. Measuring turned up a fifth, and it is the worst of them:
`workflow-governance.md` describes `decision-gate` as a **two-step, label-conditional** gate —
step 1 hard *"if the PR carries the `decision` label"*, step 2 a heuristic scanning
architectural surfaces and emitting a warning.

**Neither step has ever existed.** `adrPresence` takes two file lists; no call site passes
labels; the workflow job carries no condition; nothing scans any surface. And that file is one
of the five `SOURCE_DOCS` compiled into `AGENTS.md`, so the fiction is in the agent's own
instructions.

It falls inside #516's first acceptance criterion on its own terms: step 1 as written claims
co-occurrence for a `decision`-labelled PR that modifies an ADR.

## What the gate actually does

Driven on `main` at `eb8810d`, 2026-08-11:

| condition | verdict |
|---|---|
| an ADR is **added**, no `brain/HOME.md` | **fail** |
| an ADR is added **+** `HOME.md` | pass |
| a **modified** ADR, no `HOME.md` | **pass** ← the case §1c claimed was caught |
| a modified ADR + `HOME.md` | pass |
| `HOME.md` alone, no ADR touched | **fail** |

The two failing branches are keyed differently — the first on the ADDED list, the second on the
TOUCHED list — and that asymmetry is #510's content, not an oversight. All three enforcement
surfaces (`run-check.mjs`, `brain-check.mjs`, `merge-walk.mjs`) pass the added list, so there is
no surface on which the old behaviour survives.

## What lands

Option **(1)** — correct the prose — as #516 recommends, across all five sites, plus the one
thing a prose correction can leave behind.

**Two tests pin the claims the doctrine makes.** The code half was already well guarded (#510's
own tests). What had no guard at all was the doctrine's claim, so the two could drift for as
long as nobody read both — which is how this was found. The pins assert that `decision-gate`'s
verdict is identical with and without the `decision` label, and that an architectural change
with no ADR simply passes. Each is proven a real detector by a mutation that **implements** the
claim: label-conditionality turns 4 tests red, the surface heuristic turns 1 red. Their failure
messages name the doctrine files that must move in the same change.

## Option (2) stays rejected, in writing

Restoring co-occurrence for modified ADRs re-creates the exact defect #510 removed and
re-blocks PR #507's whole class. A protection whose first act is to block routine correction
teaches that gates are obstacles — the argument #529's ruling turned on.

## Option (3) is right and belongs in #509

The content-keyed guard #516 sketches — *"the Status line's amendment count increased ⇒ that
ADR's `HOME.md` line changed"* — is the only option that leaves a net where the tool is absent.
It belongs in the amendment-promotion verb, because **a tool that performs the cascade cannot
forget it**, which is a better guarantee than a check that catches the omission afterwards.
That is #516's own recommendation and it is followed here rather than expanded on. The shape and
this change's measurement are posted on #509.

## What this change accepts, and it is worth reading before signing

Until #509 ships, the amendment marker is **convention with nothing mechanical behind it**.
This change buys only that nobody reads a guarantee that is not there.

**This PR is itself an instance.** It amends a signed ADR (ADR-0026 Amendment 4) by hand,
because `brain:promote` refuses the amendment path — and nothing but the human would catch the
marker being omitted. The promotion script beside the drafts performs the cascade
deterministically and regenerates `AGENTS.md`, which is the step a hand-written checklist
missed in #529 and CI caught on the signing commit.

## What stays open, deliberately

The **label divergence**. ADR-0026 already recorded `decision-gate` as a doctrine/code
divergence and said *"this divergence must be resolved before that row means anything."* Half of
it closes here; the label half does not, because the gate is still label-blind while the
`standard` evidence row still promises a hard `decision`-label step. Retiring the whole note
would claim a resolution that has not happened.
