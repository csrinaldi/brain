---
issue: 860
phase: design
---

# Design — #860

## D1 — pure core, facts injected

`releaseDebt({ packageVersion, migrationVersions, commits, tag })` returns
`{ severity, lines }`. No git, no filesystem, no network — the shape
`stranded.mjs` uses, and the reason its scenarios are testable without a
repository. `gatherReleaseFacts` is the only reader, and its `_run`/`_read`
seams are tested directly, as `stranded.test.mjs` tests its own gatherer.

## D2 — four severities, ranked once

A line that fires on every commit is noise, and noise is how a real signal
stops being read — the same argument #348 used to stay silent at
`requiredReviews: 0`. Internal-only work reports no debt or drift line.

`migration > uncomparable > drift > none`, in that order. `uncomparable` is
not a fourth flavour of debt but the absence of an answer, and it outranks
`drift` because the fact left unread is the strongest signal while drift is
by its own wording the weakest. Both channels degrade together: whenever a
line says a fact could not be read, `severity` says so too. Four review
rounds found that invariant broken in four different input combinations, so
it is held by an exhaustive matrix over all 48, not by chosen cases.

## D3 — reports, never refuses

`brain:status` is a report surface. A repo mid-cycle is HEALTHY, and a gate
here would make the honest state look like a failure — #713's ruling, applied
to the same surface it was made on.

## D4 — the comparison degrades in band

No tag is not "up to date": it is "not comparable", and saying otherwise would
be the strongest claim made from the weakest evidence. Same discipline as
`uncomputable` in the gates and `undeclared` in the port audit.
