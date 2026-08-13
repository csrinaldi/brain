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

## D3 — Six in-place anchors, each verified unique

The Context bullet for `git tags + npm install`, the rejected-registry bullet,
the Decision line, the install command, the Positive and the Negative. Each
occurs exactly once in ADR-0006; `planAmendment` resolves all six and returns
9 acts.

The Context bullet was **missing from the first version** and is the one that
matters most: it carries *"compatible with private repos"*, the property the
whole decision rested on. It was quoted in the appended section and left
unannotated in the original — exactly what §1c forbids.

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
- **Twice now a validation harness guessed at a return shape instead of
  inspecting it**: `edits` sits at the top level of `parseAmendmentDraft`'s
  result (not inside `contract`), and `acts` sits at `plan.plan.acts` (not
  `plan.acts`). Both produced a confident 0 against a healthy draft. The habit
  that fixes it is dumping `Object.keys()` first, not reading harder.
- The npm facts in ADR-0030 were lifted from #435's body and stated as measured.
  One half was right (the `description` is verbatim), one was invented
  (*"deprecated since 2023"* — `1.0.0` published **2018-02-17**, name created
  **2011-04-29**). Now measured against the registry, and the real facts carry
  the argument better: npm holds the name *"to avoid malicious use"*, which is
  why it is not obtainable by asking.
