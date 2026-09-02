# Role Archetypes Specification

## Purpose

The four archetypes exist as first-party content ON #312's port; the reviewer
projects byte-deterministically into both agent platforms; the port's doctrine
is signed; the challenger's binding debt retires. Built from proposal D1–D4.

## Requirements

### Requirement: An archetype owns only what the port does not

An archetype declares `archetype`, `escalation`, `output_contract` — and
NOTHING the port already defines. Each contract field is labelled
`mechanical` or `doctrinal`, and the label is data, not prose.

#### Scenario: No field duplication
- **WHEN** an archetype or instance declares `writes`, `reads`, `model_tier`,
  `chooses_model` or `instructions` at the ARCHETYPE layer
- **THEN** the definition is refused by test — those belong to the port's
  role contract, and a second declaration is the rescope's named failure

#### Scenario: Labels are checked values
- **WHEN** a contract field carries a label other than `mechanical`/`doctrinal`
- **THEN** it is refused — an unlabelled protection is an apparent one (#499)

### Requirement: The four archetypes, characterized by write/see

Coordinator (sees everything, executes nothing irreversible), Constructor
(writes under constraints it cannot loosen), Adversary (blind by design to
what it attacks), Verifier (read-only, re-derives from the server, never
approves). The existing Adversary instance re-seats on its archetype.

#### Scenario: The seed survives
- **WHEN** `firstPartyRole('cold-review')` resolves after the re-seat
- **THEN** its served surface is unchanged for existing consumers, and it now
  names its archetype

### Requirement: The reviewer instance carries §2's locks by symbol

The Verifier instance for the review role cites `reviewer-protocol.md` §2's
three locks by SYMBOL, never line number, and each lock's label states its
kind: COMMENT-state posting is mechanical; blindness is doctrinal.

#### Scenario: A verdict still cannot approve
- **WHEN** a review runs from the projected role
- **THEN** the posting path has no APPROVE arm — proven by the same tests
  that guard it today, exercised against the projection

### Requirement: Projection is byte-deterministic, guarded, and namespaced

`projectRole(role, platform)` renders the SAME bytes for the same inputs.
Targets: `claude` → `.claude/agents/brain-<role>.md` (the `brain-` prefix
never collides with operator files); `antigravity` → a roles section through
`compileAgentsMd`'s pipeline (additive parameter, its strictness intact).
Each target has a drift guard: hand-edits fail.

#### Scenario: Same input, same bytes
- **WHEN** projection runs twice over one role
- **THEN** outputs are byte-identical — no dates, no environment

#### Scenario: Drift is caught
- **WHEN** a projected file is hand-edited
- **THEN** the guard fails naming the source of truth

### Requirement: The challenger calls the port

`reviewer.inferential.challenger.{agent, model}` binding is DELETED;
the challenger's role content resolves from the first-party Adversary. The
AXIS resolution (`RUNNERS`, `IMPLEMENTED_AXES`, the `human` default) stays
byte-for-byte — reviewer policy, as the header always said.

#### Scenario: The debt header is gone because the debt is
- **WHEN** the change lands
- **THEN** no "WHEN #312 LANDS" text remains in the tree

### Requirement: The doctrine is signed (ADR-0023)

The draft is written FROM what exists and promoted by the maintainer within
this PR (Ruta A). `decision-gate`'s pair (ADR + HOME.md index) rides the
promotion ceremony.

#### Scenario: jd-* stay out, and the reason is in the ADR
- **WHEN** ADR-0023 is read
- **THEN** it records the D3 double reason: framework content is DECLARED to
  the port, never inherited from installed files; and a second Adversary
  pipeline would collide with the reviewer and verify in authority
