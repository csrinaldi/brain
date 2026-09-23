---
status: draft
issue: 651
---

# Design — own the public session record (issue 651)

## D1 — Check the claims, not the wording

Five regexes against five things the section must assert, each carrying the
reason it is load-bearing. Pinning phrasing would freeze prose that should be
free to improve, and would fail on an edit that changes nothing that matters.
Pinning claims fails on exactly one thing: the decision quietly reverting.

## D2 — The section admits the bad parts, on purpose

*"reviews that caught real defects, tests that passed for the wrong reason, a
release that merged the paperwork and left the fix behind."* Those are real
events in this repository's own history, and they are named because the first
record a curious reader opens will contradict a README that claims only wins.
A disclosure that oversells is worse than none: it tells the reader the project
is not honest about itself, using the project's own evidence.

## D3 — In `test/`, not `brain/scripts/`

It asserts facts about **this** repository's README. Vendored into a consumer it
would be a check about the wrong project — #397's shape, the same reason brain's
own `AGENTS.md` is `regenerate` and never ships.

## D4 — Dated numbers

*"2,180 records as of the 2026-08-13 audit"*, not "2,180 records". The count
grows every session; the measurement does not. This matters more than usual here
because the README **does** ship — npm always includes it — so a stale number
travels.

## Hot micro-decisions

- **Full URLs for the issue references.** `#435` renders as a link on GitHub and
  as noise on the npm package page. The README reaches both.
- **No claim about consumers' `.memory/`.** The section says explicitly that
  nothing here decides whether a consumer publishes theirs. This repository's
  choice is not doctrine, and a README that blurred that would be making a
  privacy decision on somebody else's behalf.
- **The guard asserts the file is brain's own** (`^# brain`), so a consumer who
  copied the suite gets a clear failure rather than a confusing one.
