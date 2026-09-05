---
issue: 860
phase: design
---

# Design — #860

## D1 — pure core, facts injected

`releaseDebt({ packageVersion, migrationVersions, commits, tag })` returns
lines. No git, no filesystem, no network — the shape `stranded.mjs` uses, and
the reason its four scenarios are testable without a repository.

## D2 — three severities, because one would be unread

A line that fires on every commit is noise, and noise is how a real signal
stops being read — the same argument #348 used to stay silent at
`requiredReviews: 0`. Internal-only work reports nothing.

## D3 — reports, never refuses

`brain:status` is a report surface. A repo mid-cycle is HEALTHY, and a gate
here would make the honest state look like a failure — #713's ruling, applied
to the same surface it was made on.

## D4 — the comparison degrades in band

No tag is not "up to date": it is "not comparable", and saying otherwise would
be the strongest claim made from the weakest evidence. Same discipline as
`uncomputable` in the gates and `undeclared` in the port audit.
