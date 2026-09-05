---
issue: 124
phase: design
---

# Design — #124

## D1 — one union, and it took a review round to find the second reader

This section first said `defaultReadDenyActors` "is the single source of
`denyActors`". That was ASSERTED, not verified, and it was false:
`brain/scripts/approve/cli.mjs` carried its own reader of the same name,
documented in its own comment as *"the write-side twin of L5's read rule 15"*.
Widening only L5 left the twin silently no longer a twin — `brain:approve`
would have let a registered agent post a signed block, and only the PR gate
would have caught it afterwards.

So the rule is now a pure exported `approvalDenySet(config)` with two
consumers, and a test asserts this file states it by IMPORTING rather than
restating. One rule, one implementation — the shape
`brain/core/anti-patterns/` names, which I reproduced while writing a PR about
enforcement. It returns
`governance.reviewActors`; it returns the union with `governance.agentActors`
now. Nothing downstream changes: `evaluateActor`'s deny path, its message, and
its precedence over the tier's evidence forms are all already built and tested
— this change only widens the set they consult.

That is why the diff is small and the finding was not: the refusal machinery
was complete, and the identity it existed to catch was in a different list.

## D2 — the lists stay separate at the source

`defaultReadAgentActors` keeps returning `agentActors` alone. Merging the two
readers would repeal ADR-0026 Amendment 3 by accident — the commit exemption
and the approval deny are opposite answers to different questions about the
same identity, and a single list cannot hold both. A test asserts the commit
exemption still passes for an agent-authored commit under a human approval.

## D3 — the refusal names the key it read

An operator told only "denied" must open the code to learn which of two config
keys to edit. The reason names the list, so the message is actionable by the
person who receives it.

## D4 — no new config key, deliberately

Both keys exist and both are already populated in this repository. Adding a
third ("approvalDenyActors") would be a second declaration of who is not a
human, and this session has spent several PRs removing exactly that shape.
