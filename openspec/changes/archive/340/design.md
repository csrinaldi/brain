---
status: draft
issue: 340
---

# Design

## Why importing the evaluator beats aligning the checks

#340 offers two candidate directions: give the pure function the missing input, or add a parity
test between two implementations. The first is better and the second is still needed, but the
first has a version the ticket does not name: **stop having two implementations.**

Widening `issueLink(body)` to `issueLink(body, { targetBranch, defaultBranch, fetchIssue })`
would rebuild, inside the pure module, the wrapper `run-check.mjs` already has — including the
approved-label fetch, which is I/O and has no business in a pure check. The policy layer exists
and is tested; the local verb simply was not calling it.

So `brain-check.mjs` imports `runCheck` from `governance/run-check.mjs`. Its `deps` are already
fully injectable (that is how CI's own tests drive it), so the local surface passes a locally
built `ctx` and its own `readRecords`. Nothing new was written for the shared path.

## The two checks that stay behind, and why that is not laziness

`adrPresence` is aligned by construction — #510 gave it `addedFiles`, and `run-check.mjs`,
`brain-check.mjs` and `merge-walk.mjs` all pass it. There is no policy layer for a second
implementation to disagree about.

`diffSize` is the interesting one. CI honours `size:exception` from `ctx.labels`; before a PR
exists there are no labels. Routing it through the evaluator with `labels: []` changes nothing;
routing it with an invented label set would make local **laxer**, which is the one thing
REQ-340-1 forbids. Local staying stricter is the correct answer and the parity suite asserts
the direction rather than the values.

## One context, not two

`memory-gate` resolves the issue number from the same body `issue-link` does. They are built
from **one** `govCtx` object, because two contexts are two chances to disagree about which
issue a change is about — a smaller instance of exactly this ticket.

## The third state, and why it does not exit 1

CI fails closed on `uncomputable` because a merge is at stake. A local verb that refuses to run
offline is a verb people stop running, and #529's ruling already recorded where that leads: a
protection whose first act is to block routine work teaches that gates are obstacles.

The defect in #340 is not "local passed" — it is "local **claimed**". `[UNVERIFIED]` plus the
suppressed *"Ready to brain:ship"* line removes the claim while keeping the verb usable. The
remedy string is what makes it actionable rather than a shrug: `git remote set-head origin -a`
turns the common case back into a real verdict.

## Red-proof

| | mutation | result |
|---|---|---|
| M1 | `brain:check` reverts to the pure `issueLink`/`memoryPresence` calls (the pre-#340 code) | **5 RED** |
| M2 | an unresolvable base assumes `slice` (hazard 1's permissive guess) | **1 RED** |
| M3 | `uncomputable` renders as `PASS` | **2 RED** |

M1 is the whole defect restored, and it is red on five of the seven fixtures — one per shape
the audit found, which is the evidence that the suite covers the class rather than the instance.
