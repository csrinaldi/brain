---
issue: 124
phase: spec
capability: human-signature
---

# Spec — an agent may act, and may not approve

## Requirement: an approval applied by a registered agent is refused (R124-1)

`actor-check` MUST refuse when `status:approved` was applied by an identity
listed in `governance.agentActors`, exactly as it already refuses one listed in
`governance.reviewActors`.

### Scenario: the agent applies the label
- GIVEN `governance.agentActors` contains `claude`
- WHEN the approved label's `labeled` event names `claude`
- THEN the gate FAILS, and the reason says the approval must be re-applied by a
  human.

### Scenario: the refusal says which list caught it
- WHEN an identity is denied
- THEN the reason names whether it was configured as a review identity or an
  agent identity — an operator must not have to guess which key to edit.

### Scenario: a human still approves
- WHEN the label's actor is in neither list
- THEN the existing verdict is unchanged in every respect.

## Requirement: Amendment 3 survives intact (R124-2)

The COMMIT exemption MUST keep reading `governance.agentActors` alone. An
agent's commits under the approver's instruction still do not re-arm an
existing approval.

### Scenario: the agent commits under a human's approval
- GIVEN the label was applied by `alice` and the branch carries commits by
  `alice-agent`, a registered agent identity
- THEN the gate PASSES — the exemption is about work the approver has seen,
  and this change does not touch it.

### Scenario: the two lists are not merged at the source
- WHEN the commit-exemption reader is inspected
- THEN it reads `agentActors` only, never the union the labeling deny-set uses.

## Requirement: fail-closed is unchanged (R124-3)

An actor that cannot be determined MUST remain a failure, not a pass.

### Scenario: no labeled event
- WHEN the approved label carries no readable `labeled` event
- THEN the gate does NOT pass. Today that is `warn`, and REQ-L5-2 ("never
  failing on missing evidence") is why — this change asserts the property
  #124 needs without repealing a requirement that predates it. An earlier
  draft of this line said "fails, as it does today", which contradicted the
  implementation, the test and this change's own proposal at once.
