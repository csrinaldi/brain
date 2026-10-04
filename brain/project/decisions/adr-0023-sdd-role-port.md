# ADR-0023 — The role port: engines declare, platforms receive, brain's own roles live on a shelf

**Status**: Accepted · **amended 04/10/2026** (Amendments 1-2 — see below)
**Date**: 2026-09-02 — Cristian Rinaldi

## Context

Written FROM what exists — the #312 plan promised this ADR "rewritten from
what exists" and #312 closed without it; #576 executes that promise one
milestone late, and says so. As of `main @ 4cde50e` plus #576's change:

- `brain/scripts/axes/sdd-engine/role-port.mjs` (relative path was `roles/role-port.mjs` under `brain/scripts/` until #1141; see Amendment 1) — the contract: an inhabitant is
  `declareRoles(stages) → { agent, model_tier, chooses_model, instructions }`
  per resolved stage; `model_tier ∈ {cheap, balanced, deep} | null` (null is
  CHECKED: "a human executes"); `instructions` is a non-empty string or a
  checked null; refusals throw, absence is never read as disabled.
- **n=2 measured**: `plain` and `gentle-ai` inhabit the port; the parity suite
  runs one assertion body over both; the tripwire died by failing (#814).
- `roles/first-party/` — brain's own role content: the four archetypes and
  their instances; `brain:engines` surveys; `brain:config` writes.
  **[Amended by Amendment 2 (#1114, #1263): this shelf is declared in config as the SDD provider
  `brain`, `sdd.providers.brain = { "version": "self" }` (ADR-0038). Its content still lives here.]**

## Decision

1. **Two axes, two verbs** (the D6 vocabulary, ruled 02/09/2026):
   `SDD_ENGINE` members are FRAMEWORKS — skill, doctrine, hooks (`gentle-ai`,
   `plain`, a future `brain-sdd-engine`). **[Amended by Amendment 2 (#1263): that framework is the
   SDD provider `brain` (ADR-0038). It is a key of `sdd.providers` today, not yet an adapter or a
   selectable `sdd.default`.]** `AGENT_PLATFORM` members are AGENTS —
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
   space; `model` is OMITTED — tier and selection belong to routing **[Amendment 2 (#1263): routing
   is `sdd.roles.<stage>` = `{ agent, engine, model }`, ADR-0038 §4]**, and a
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

## Amendment 1 — the role port moved to `axes/sdd-engine/role-port.mjs` (issue #1141)

**Signed**: 28/09/2026 — Cristian Rinaldi

#1141 moved every adapter into one directory per axis, and the role port with it: it left
brain/scripts/roles/role-port.mjs for `brain/scripts/axes/sdd-engine/role-port.mjs`, with
`git mv`, so `git log --follow` still reaches its history.

The citation above is annotated in place under ruling R6 on #961 as amended (option A) — the
maintainer applied the same ruling to #1141's path moves on 2026-09-28. The `declareRoles`
contract and the engines-declare/platforms-receive split are unchanged.

## Amendment 2 — the shelf is the SDD provider `brain`, and stage routing lives in `sdd.roles` (issue #1263)

**Signed**: 04/10/2026 — Cristian Rinaldi

### What changed

ADR-0038 names this ADR in "Amendments this requires".

- **The shelf has a provider name.** Brain's first-party roles are the SDD provider `brain`. The
  1.11.1 migration (`brain/core/config-migrations.mjs`) writes `sdd.providers.brain` as
  `{ "version": "self" }` on every consumer. `"self"` is the installed brain package's version, the
  one version a migration may write (ADR-0038 Ratified point 3).
- **Routing is `sdd.roles`.** Stage → role routing, including the `model` that decision 4 leaves to
  routing, is `sdd.roles.<stage>` = `{ agent: "<sdd provider>:<role>", engine: "<platform provider>",
  model }`. The provider part of `agent` names the framework that declares the role. `engine` names
  the runtime that executes it.
- **cold-review.** The migration writes `sdd.roles['cold-review'].agent` as `"brain:cold-review"`,
  with the `engine` and `model` it finds in `sdd.map['cold-review']`.
- **Validation.** `validateAxisConfig` (`brain/scripts/lib/axis-config.mjs`) refuses an `agent` whose
  provider is not a key of `sdd.providers`, and an `engine` that is not a key of `platform.providers`
  or cannot execute a stage prompt.

### Why

ADR-0038 ends the two meanings of "engine" in one field: the framework that declares a role is the
`agent`'s provider, and the runtime is the `engine`. Several SDD providers then coexist, with one of
them as `sdd.default`, and the shelf gets a name without displacing `gentle-ai`.

### What this does NOT change

The `declareRoles` contract, the archetype layer, the four archetypes, projection, and decision 1's
rule that frameworks declare and platforms receive.

### What the code does not do yet, said plainly

- **No `brain` adapter exists.** `axes/sdd-engine/adapters/` holds `gentle-ai` and `plain`. `brain` is
  not a member of `SDD_ENGINES`, so `sdd.default: "brain"` or `SDD_ENGINE=brain` is refused.
- **Nothing routes by `sdd.roles` yet.** The cold-review stage still resolves through
  `sdd.map['cold-review']` (`resolveStageEngine`, `review/lib/run-cold-review-stage.mjs`). Nothing
  resolves `brain:cold-review` to the `adversary-cold-review` instance. The reshape and its reader
  are #1132.
- **The `agent` cascade is not checked.** ADR-0038 §4 refuses a stage with no default role that gives
  no `agent`. `validateAxisConfig` does not implement that rule yet.
