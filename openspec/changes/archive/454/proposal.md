---
status: draft
issue: 454
epic: 313
---

# Proposal — an agent identity inside the approved loop does not re-arm the approval

## What is wrong

At `lite`, `actor-check` compares the approved-label event against the latest **foreign**
commit — one authored by neither the approver nor a registered `governance.reviewActors`
identity (ADR-0026 Amendment 1). An agent's commits are foreign, so every agent push
invalidates an approval the agent is *executing*.

Measured, not assumed: #454 recorded five label re-applications in one day. On the day this
was built, three consecutive PRs — #514, #515, #507 — were green on every other gate and red
on `actor-check` for this reason alone. #507's refusal listed four stale `brain-decision/1`
signatures, one per push. A gate whose normal failure mode is noise on correct work trains
people to ignore it.

## What the ticket got wrong, and how we know

Its premise was that agent commits resolve to **no account** and are foreign because
unattributable. Driving the API refutes it — `GET /repos/…/commits/54aa5ff` returns
`author.login` populated. The commit is foreign only because the identity is not in the
exempt set. Task 1 ("commit with a resolvable identity") was therefore already satisfied for
the attributable identity; what remained was the exempt set and the config.

The correction matters beyond bookkeeping: it means proposal (1) — *"make authorship
attributable"* — buys **no security property at all**, because providers attribute by email
match and git authorship is unauthenticated. That is exactly what #418 rejected as
"exempting by commit-header email (anyone can spell it)", and it is why the accepted loss is
written into the amendment rather than glossed.

## What changes

`governance.agentActors`: a third exempt set, read with `?? []`, **absent by default**, with
**no migration** — the precedent `reviewActors` set (its 0.8.0 migration says it "stays
absent"). A key that weakens a gate may never arrive by upgrade.

**Platform-agnostic by construction**, which is the constraint that shaped the design: no
vendor name in the governance decision path. The identity lives in the consumer's
`brain.config.json`, on the untouchable side of the upgrade manifest. Swapping agent
platforms is editing one array, not editing brain.

## Out of scope

- **Signature verification** (#454 option B) — the `standard`-tier upgrade. `prCommits`
  discards `commit.verification`, so it is a port-contract change (ADR-0020), and agent
  commits are unsigned today. Named in the amendment, not built here.
- **The unattributable identity.** Some agent commits land as `brain-agent <agent@local>`,
  which resolves to nothing and keeps re-arming. Correct — fail-closed is the feature — but
  it means the friction is only removed for sessions committing under the attributable
  identity. Environmental, not a repo change.
