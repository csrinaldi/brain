---
status: draft
issue: 575
---

# Design — the cold review is a stage, not an event (issue 575)

## §1 Why rulings can land while the stage cannot

The five decisions are about **shape**: where the stage sits, what it emits, how
its two controls compose, who runs it, what the gate does. None of them requires
the stage to exist, and all of them constrain how it gets built.

Writing them now is what stops the next attempt from re-litigating the ordering
question, and — more usefully — from picking the answers that look obvious and
are wrong: a fifth artefact-producing rung (breaks Rule B's monotonicity), a
review file in the change folder (the author can write it), a mechanically-only
stage that doesn't say so (reads as judgment finding nothing).

## §2 The measurement that changed the ticket

#575's body listed `reviewer-protocol.md` as unsigned and #555 as an open
dependency. Both moved before this change was picked up:

- `brain/core/methodology/reviewer-protocol.md` frontmatter reads
  `status: current | last-reviewed: 2026-08-12 | owner: @crinaldi` (#580).
- #555 closed 2026-08-13, `state_reason: completed`, PR #597 merged.

`#552` and `#456` were checked the same way and are **open**.

This is recorded because the ticket body is now the least reliable source about
its own dependencies, and the next reader should check the tracker rather than
the prose — including this prose.

## §3 What #555 closing actually bought this ticket

Not just a shorter blocker list. `requiredArtifactsFor(tier)` resolves the
artefact set from `tierParams`, and `missingRequiredArtifacts` now **requires**
its `artefacts` argument:

```
missingRequiredArtifacts: `artefacts` is required — pass requiredArtifactsFor(tier).
```

The default was removed deliberately, so a consumer cannot quietly reconstitute
a second set. Any stage added under #456 inherits a single tier-resolved
authority rather than having to unify one first. That is why #575's original
sequencing — "#555 should land before this" — was right, and why the remaining
sequencing should be trusted for the same reason.

## §4 The loop/ladder distinction, concretely

Rule B compares `STATUS_LADDER.indexOf(before)` against `indexOf(after)` and
reports only backwards movement. Two consequences shape Ruling 1:

- A rung for "under review" would have to be exited backwards on a `REVISE`,
  which Rule B would flag. Modelling the loop as a status is therefore not a
  style preference — it is unrepresentable in the existing gate.
- Unknown statuses are a **no-op** (`idx === -1` → `continue`), so an
  implementation could sneak a `reviewing` status past Rule B without failing
  anything. It would pass by being invisible, not by being correct. Ruling 1
  forecloses it explicitly so that silence is not mistaken for permission.

## §5 Why the label index is sufficient, and where it is not

Ruling 2 leans on `reviewed:*` labels as the gate-readable index. Its limits,
stated rather than discovered later:

- **The index can lag.** §9 already names label desync as a failure mode and
  `brain:review:board` as the repair. A gate reading a stale label reads a stale
  index, never a wrong verdict — the verdict comment remains the authority.
- **Labels are writable by humans.** `deny-set.mjs` constrains what the
  *reviewer* may write (`seq:*`, `reviewed:*` only); it does not stop a human
  from applying `reviewed:approved` by hand. That is not a new hole — it is the
  same human-keystroke escape as `override:*`, and it is the reason Ruling 5
  keeps the verdict rather than the label as the thing being attested.

If that escape ever needs closing, the gate re-derives from the verdict comments
the way `brain:review:board` does. That is a cost worth paying only if it is
ever observed being abused, and it should not be pre-paid.

## §6 Ruling 4 and #604 are the same mechanism arriving from two directions

#575 asks "who runs it, and as whom" for a **lock** reason: a stage running as
the author dissolves the two-key split.

#604 asks it for an **evidence** reason: a run whose identity is ambient cannot
establish whose it was.

Both land on a CI job holding the PAT as a repository secret. That convergence
is the strongest signal in either ticket about what to build next, and it is why
`tasks.md` sequences the runner ahead of the stage rather than alongside it:
the runner is the precondition for the stage being *honest*, not merely for it
being *automated*.

It is also the mechanism that would close #604 half 2 — abstention comparing
provenance rather than identity — by construction rather than by convention.
One job, three tickets.

## §7 Doctrine impact — deferred, and named

None of these rulings edits `brain/core/methodology/reviewer-protocol.md`. It is
Tier 2 and signed; amending it is ADR → HOME.md → regenerate AGENTS.md.

When the stage is built, the amendments it will need are:

- **§6 (the verdict schema)** — if provenance lands (#604 Ruling 3).
- **§10 (failure modes)** — a row for a skipped stage, per Ruling 5.
- **A new section, or an extension of §13** — the stage's input contract.

Named here so the eventual change budgets for a three-step doctrine amendment
instead of discovering it mid-slice. Per #580/#586, any citation those
amendments add names **symbols, never line numbers**.
