---
status: draft
issue: 653
---

# Design — ADR-0030 Amendment 2, the organisation scope (issue 653)

## D1 — It opens by proving the ADR is being followed

An amendment that changes a package name reads as a reversal, and a reader who
concludes "they changed their mind about the scope" will discount the next
decision too. So the first section quotes ADR-0030's own *"Deferred, not
rejected"* and shows the condition it named has come true.

The distinction is not cosmetic: a decision that **anticipated** its own revision
and set the cost asymmetry correctly is evidence the method works. Presenting it
as a flip-flop would throw that away.

## D2 — Five edits, because a reader lands anywhere

Context, the install line, Decision 1, Alternatives considered, and Amendment 1's
sentence. §1c's test is *"a reader who never scrolls to the amendment must not be
left with the superseded rule"*, and each of those five is a plausible landing
point — the install line most of all, since it is the one people copy.

## D3 — One edit lands inside a previously signed section, deliberately

Amendment 1's paragraph says the registry must carry `@csrinaldi/brain`. Left
alone, a reader lands there and reads a scope the project does not use.

The line: **an amendment section is current doctrine and gets corrected in place;
`openspec/changes/**` is an archived record and does not** — which is the rule
#648 applied in the other direction, leaving 51 occurrences of a stale name
untouched because they record what was true then. Both follow from the same
question: *is this text making a claim about now, or recording a claim about
then?*

The original scope is named in parentheses rather than erased, so the correction
does not hide what Amendment 1 said when it was signed.

## D4 — The `access: public` requirement belongs in the record, not only in code

`npm publish` on a scoped package without it fails asking for a paid plan — or
publishes **private**, which is the outcome that looks like success. Putting it
only in the workflow leaves a manual publish from a laptop doing the wrong thing,
so the record states it belongs in `publishConfig` **and** the flag.

A requirement that lives only in the implementation is a requirement the next
implementation forgets.

## Hot micro-decisions

- **The install line's replacement keeps the old line as a shell comment.** It is
  inside a ```bash fence, so a bracketed `**[Amended…]**` would render as code.
  Keeping the superseded line commented also makes the edit idempotent (`k:1`).
- **`@csrinaldi/brain`'s 404 is kept in Context, annotated rather than replaced.**
  It is a measurement that was taken and is still true; deleting it would remove
  the evidence the original decision rested on.
- **No claim about which npm account owns the org.** The maintainer states the
  organisation exists; that is not something an agent container can measure —
  npm returns 403 on org pages to non-members. Recording it as measured would be
  inventing evidence.
