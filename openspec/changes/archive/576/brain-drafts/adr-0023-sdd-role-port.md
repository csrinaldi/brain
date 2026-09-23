# ADR-0023 — The role port: engines declare, platforms receive, brain's own roles live on a shelf

> **status:** proposed — pending human promotion | **date:** 2026-09-02 | **owner:** @crinaldi

## Context

Written FROM what exists — the #312 plan promised this ADR "rewritten from
what exists" and #312 closed without it; #576 executes that promise one
milestone late, and says so. As of `main @ 4cde50e` plus #576's change:

- `roles/role-port.mjs` — the contract: an inhabitant is
  `declareRoles(stages) → { agent, model_tier, chooses_model, instructions }`
  per resolved stage; `model_tier ∈ {cheap, balanced, deep} | null` (null is
  CHECKED: "a human executes"); `instructions` is a non-empty string or a
  checked null; refusals throw, absence is never read as disabled.
- **n=2 measured**: `plain` and `gentle-ai` inhabit the port; the parity suite
  runs one assertion body over both; the tripwire died by failing (#814).
- `roles/first-party/` — brain's own role content: the four archetypes and
  their instances; `brain:engines` surveys; `brain:config` writes.

## Decision

1. **Two axes, two verbs** (the D6 vocabulary, ruled 02/09/2026):
   `SDD_ENGINE` members are FRAMEWORKS — skill, doctrine, hooks (`gentle-ai`,
   `plain`, a future `brain-sdd-engine`). `AGENT_PLATFORM` members are AGENTS —
   executing runtimes (Claude, Antigravity, openCode). **Frameworks DECLARE
   roles to the port; platforms RECEIVE projections from it.** Nothing is ever
   inherited from another tool's installed files: an engine states what it
   offers through `declareRoles`, with recorded provenance, or it states
   nothing.
2. **The archetype layer owns only what the port does not**: `archetype`,
   `escalation`, `output_contract`, each labelled `mechanical` or `doctrinal`
   as a CHECKED value (#499 — an unlabelled protection is an apparent one).
   The write surface is the port's `writes`; blindness is `reads` inverted.
   Redeclaration at the archetype layer throws.
3. **Four archetypes** (nine observed roles compressed, #284): Coordinator
   (sees everything, executes nothing irreversible), Constructor (writes under
   constraints it cannot loosen), Adversary (blind by design to what it
   attacks), Verifier (read-only, re-derives from the server, can never
   approve — reviewer-protocol.md §2's three locks, cited by symbol).
4. **Projection is byte-deterministic, guarded, namespaced.** `projectRole`
   renders a first-party role into a platform's native format: claude as
   `.claude/agents/brain-<role>.md` (the `brain-` prefix guards operator-owned
   space; `model` is OMITTED — tier and selection belong to routing, and a
   projected file carrying a model id would be a second router nothing reads);
   antigravity as a `## First-party roles` section through
   `compileAgentsMd(docs, { roles })` — additive, byte-identical when absent.
   Committed goldens are the drift guard, cutting both ways.
5. **The challenger's binding lives on the shelf.**
   `reviewer.inferential.challenger.{agent, model}` were reserved since #682
   and — measured — never read; they stay unread and documented inert (#229's
   post-release retirement). `resolveJudgment` serves `challengerRole` from
   `firstPartyInstance('adversary-challenger')`; the AXIS stays reviewer
   policy where it always was.

## What is deliberately NOT decided here

- **Emission wiring.** Which init writes the projected files, and any
  `managed-paths` declaration for `.claude/agents/brain-*.md`, is a separate,
  human-approved step — this ADR records that the projection FUNCTIONS exist
  and that writing them into a consumer's tree is not to be done silently.
- **jd-\* adoption — refused, twice over** (the maintainer, 02/09/2026): the
  judgment-day agents are gentle-ai framework content installed on one
  machine — inheriting them would violate rule 1's "declared, never
  inherited"; and a second Adversary pipeline would collide in authority with
  brain's reviewer and the verify stage. If gentle-ai wants them on the port,
  it declares them.
- **Routing lifecycle stages** — M8's decision (#323), gated on its own
  doctrine; `assertRoutableStage` still refuses, and this ADR does not touch
  that boundary.

## Consequences

- A fifth archetype or a third inhabitant lands validated or not at all — the
  shapes are throws, the parity suite is parameterized, the goldens are
  committed.
- The port's `declared vs active` seam for config-backed keys (#806 family)
  is NAMED here and ruled elsewhere: this ADR does not adjudicate it.
- #754 closes: the cold-reviewer role exists — as the Adversary instance for
  the stage, with the Verifier holding the review's own role.
