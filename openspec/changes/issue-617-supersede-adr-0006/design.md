---
status: draft
issue: 617
---

# Design — supersede-adr-0006 (issue 617)

## D1 — Supersede, do not amend

ADR-0006's Decision chose git tags *because* the repo was private. Amending would
leave a decision whose stated reason no longer exists standing as current. The
premise was deleted; that is a supersession.

## D2 — Two drafts, promoted in order

ADR-0030 first, then the amendment — the amendment's `brain/HOME.md` marker
points at a record that must already exist. Stated in both drafts.

## D3 — Five in-place anchors, each verified unique

The rejected-registry line, the Decision line, the install command, the Positive
and the Negative. Each occurs exactly once in ADR-0006; `planAmendment` resolves
all five and returns 8 acts.

## D4 — Say what survives, at length

The narrow half of a supersession is the half readers get wrong. Both drafts list
what is untouched — three pillars, read-only core, additive migrations,
never-auto-update, `specialMerge` — because "ADR-0006 is superseded" read
literally would repeal a working model.

## Hot micro-decisions

- **Scope `@csrinaldi`**: measured free (`404`); `brain` unscoped is a deprecated
  placeholder (`200`). A user scope needs no organisation. An org scope is
  deferred, not rejected — easy later, awkward to unmake now.
- **`brain:promote` has no supersession shape.** `amendStatusLine` writes
  `**amended <date>** (Amendment N)`; nothing can write `Superseded by ADR-NNNN`.
  No ADR in the repo has ever been marked superseded. The amendment path is used
  and the limitation is recorded in ADR-0030's closing section rather than worked
  around.
- The `edits` array sits at the top level of `parseAmendmentDraft`'s result, not
  inside `contract` — a first validation looked in the wrong place and reported 0
  pairs. Checked against `planAmendment` instead of against a reading of the
  contract.
