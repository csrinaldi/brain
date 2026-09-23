---
status: draft
issue: 629
---

# Design — ADR-0030 reachability amendment (issue 629)

## D1 — An amendment, not a new ADR

Nothing here contradicts ADR-0030. Its decision is intact and its premise is
intact; what is missing is a cost and a surviving path. A new ADR would create a
second record a reader must find in order to read the first one correctly — which
is the #590 defect approached from the other side.

## D2 — It opens by saying what it does NOT change

An amendment to a *distribution* decision invites the reading "the registry is
being walked back". The section's first heading is *"What this does NOT change"*,
for the same reason ADR-0030 itself carries a *"What ADR-0006 decided that
SURVIVES"* section: a supersession or an amendment read wider than it is does
more damage than the gap it closes.

## D3 — Two of the four edits ADD rules rather than annotate

The install line and the Consequences Positive get bracketed annotations — they
are incomplete as written and a reader must see that in place. But the *Never do*
list gets two **new entries**, and Decision 3's `day-start` bullet gets a
requirement, because §1c's test is *"a reader who never scrolls to the amendment
must not be left with the superseded rule"*. A rule that exists only inside an
amendment section is a rule nobody applies.

## D4 — The escape hatch is stated as a measurement, not as a reassurance

"The git URL still works" is the kind of claim that is true until it quietly is
not. So the amendment carries the numbers: 433 files, 5.5 MB, the six directories
that are absent, and the three consequences that follow — `files` is honoured,
`private: true` does not block it, and it lands under the `name` in
`package.json`. That last one is what makes it *equivalent* rather than merely
*available*, and it is the same mechanic #625 traced when it found the mid-upgrade
break.

## Hot micro-decisions

- **The `amend-find` on the install line anchors the code block's single line**,
  and the replacement adds shell comments rather than prose after the fence. A
  bracketed `**[Amended…]**` inside a ```bash fence renders as code.
- **`brain/HOME.md` is not touched here.** `brain:promote` writes the marker as
  §1c act 4. Editing it in this PR would trip `decision-gate` — HOME.md in the
  diff with no ADR path touched — and would be doing the verb's job by hand.
- **No `type:governance` label.** This adds no gate and changes no process; it is
  a documentation change to a signed record, promoted by a human. `type:docs`.
