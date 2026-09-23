---
status: draft
issue: 575
---

# Proposal — the cold review is a stage, not an event (issue 575)

## What this change is, and what it is not

**It is the five rulings #575 asks for.** Its own body says the ticket "rules,
it does not assume", and the rulings can be written now.

**It is not the stage.** Two dependencies are open and both are load-bearing;
building the stage on top of them would produce exactly the defect each one
describes. The honest scope today is: decide, record, sequence.

## The dependency claims in #575's body, re-measured

The ticket was filed 2026-08-12 and two of its stated blockers have moved.
Verified on `main` rather than taken from the body:

| #575 says | measured now |
|---|---|
| `reviewer-protocol.md` is **"pending human signature"** | **signed** — `status: current`, owner `@crinaldi` (#580). Stale. |
| **#555** is an open dependency | **closed** 2026-08-13, PR #597 merged. Stale. |
| **#552** blocks the LLM-judgment half | **open**. Still blocks. |
| **#456** — the stage set is hardcoded | **open**. Still blocks. |

#555 closing matters more than its removal from a list. The artefact set is now
resolved by tier through one accessor, and `missingRequiredArtifacts` takes
`artefacts` as a **mandatory** parameter — a default was deliberately removed so
a caller cannot silently re-introduce a second set. Any stage added later
inherits that discipline instead of fighting it.

## Why the two remaining blockers are not paperwork

**#456 — the stage set is hardcoded.** A fifth hardcoded stage is the same
defect with one more entry, in the ticket's own words. The set now lives in
`tierParams(tier).artefacts`; it is single-sourced but not configurable.

**#552 — no evaluator emits `evidence_class: inferential`.** The LLM-judgment
half of the stage has a declared slot in the `/2` schema, a refuter wired to
fork on it, and no producer. #575 says the stage "cannot be built honestly"
until this closes, and that is right.

## What this change observes about #552 — it is now unblocked in principle

#552 recommends **"neither, until (a) has a reason to exist that is not 'a fork
is unreachable'."**

**#575 is that reason.** The stage's second control — judgment over the change
*in the context of what this ticket is for* — is not a fork looking for a
producer; it is a product requirement that happens to need one. #552's own
blocking condition is therefore satisfied by this ticket's existence, and the
recommendation it was guarding can be revisited on its merits.

That is the observation the ordering note asked for: **it is what destrabs the
interesting half.** It is *not* a ruling on #552 — that ticket is `status:
approved` and owns its own decision, and ruling (a) from inside #575 would be
this change deciding another ticket's scope. Recorded here so #552's next
reader finds the motivation rather than re-deriving it. See `tasks.md` T1.

## Scope

Rulings only. No stage is added, no verb changes, no file in `brain/` moves.
The five decisions are in `spec.md`; the sequencing is in `tasks.md`.
