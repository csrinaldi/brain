---
issue: 124
phase: proposal
---

# Proposal — the identity that may DO the work may not GRANT the approval

## Intent

Close #124's central ask: an approval applied by a registered agent identity
must not count. The machinery for that refusal already exists and already
works — it is simply not pointed at the one identity the ticket is about.

## Measured on main (e49faf60), not assumed

Four of the ticket's five asks are already shipped:

| ask | state |
|---|---|
| the convention, documented | ✓ `brain/core/anti-patterns/ia-promueve-sus-propios-artefactos.md` |
| the port reads the label's actor | ✓ `labelEvents` returns `{actor:{login}, action, label}` |
| a configurable non-human list | ✓ `governance.reviewActors` → `denyActors` |
| fail closed on an unreadable actor | ✓ eighteen uncomputable/fail-closed paths in `actor-check.mjs` |
| **the agent's own approval is refused** | ✗ **this change** |

The gap, measured through `evaluateActor` with everything else held equal:

```
labelled by csrinaldi (human)                 -> pass
labelled by claude, in governance.agentActors -> pass      <-- the gap
labelled by claude, in governance.reviewActors -> fail     <-- the machinery works
```

And this repository's own config reads
`agentActors: ["claude"]`, `reviewActors: ["csrinaldibot"]`. The agent's real
identity is registered, the deny path is built and tested, and the two never
meet.

## Why this is not a one-line list merge

`agentActors` earns its exemption for a DIFFERENT question. ADR-0026
Amendment 3 rules that an agent's commits, made under the approver's
instruction, do not re-arm an existing approval — because they are not work the
approver has not seen. That ruling is correct and stays.

Two questions, one identity, opposite answers:

- **May this identity's COMMITS ride an existing approval?** Yes — Amendment 3.
- **May this identity GRANT an approval?** No — ADR-0013 Tier 3, and #124.

So the fix is not to move `agentActors` into `denyActors`; it is to make the
LABELING deny-set the union of both, while the COMMIT exemption keeps reading
`agentActors` alone. Collapsing the lists would silently repeal Amendment 3.

## Scope

1. The labeling deny-set becomes `reviewActors ∪ agentActors`, read at the one
   place `denyActors` is sourced.
2. The refusal names which list caught it, so an operator learns whether they
   configured a bot or an agent.
3. Tests: an agent-applied approval fails; the same agent's commits still do
   not re-arm (Amendment 3 intact); a human's approval still passes; an
   unreadable actor still fails closed.

## Non-goals

No new config key — both lists exist. No change to Amendment 3's commit rule.
No change to the tier matrix: `actor-check` is already `required` everywhere.

## A note on how this was found

This session ran under "status:approved is human-only" as doctrine, with the
human applying every label. Had the agent applied one instead, `actor-check`
would have said `pass`. The convention held because it was honoured, not
because it was enforced — which is precisely the sentence #124 opens with.

## Two things found while implementing, both worth the reader's time

**The doctrine was already written; only the wiring was missing.** An existing
test — `evaluateActor: an agent identity that is ALSO a review identity may
still never APPLY the label (§9 unchanged, #454)` — carries this comment:

> Exemption from re-arming and permission to approve are DIFFERENT POWERS;
> #454 grants only the first.

That is exactly this change's argument, written before it. The deny branch was
built, the phrase was chosen, the test was passing — and the one identity the
rule is about was never in the list the branch consults. A rule can be
correct, tested and inert at the same time, and that is harder to notice than
a rule that is absent.

**#124's "fail closed" collides with REQ-L5-2, and this PR does not resolve
it.** The ticket asks that an undeterminable actor be treated as not
human-approved. The shipped behaviour is `warn`, and it is specified —
REQ-L5-2, "never failing on missing evidence", named in the reason string
itself. This change asserts the property #124 actually needs (the approval is
not waved through) without repealing a requirement that predates it. Whether
missing evidence should harden from `warn` to `fail` is a doctrine question
for the maintainer, and deciding it silently inside an implementation PR is
precisely the move this repository's tier rules exist to prevent.
