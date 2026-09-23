# Design: #576 — archetypes, projection, doctrine, the last debt

Tier `lite`. Implements `specs/role-archetypes/spec.md` under proposal D1–D4.

## T1 — the archetype layer: `roles/first-party/archetypes.mjs`

Four frozen definitions: `{ archetype, may_write_summary, must_not_see_summary,
escalation: {rule, label}, output_contract: {shape, label} }` — labels strictly
`'mechanical' | 'doctrinal'`. A validation helper (`assertArchetypeShape`)
refuses port-owned fields at this layer; the contract test walks all four.
Instances (`adversary-cold-review`, the new `verifier-review`, and the
challenger's Adversary instance) gain `archetype: '<name>'` and are re-checked
against their archetype's constraints.

`first-party/index.mjs`: `BY_STAGE` stays; adds `firstPartyInstance(name)`
for non-stage-keyed roles (the challenger). One shelf, two doors, both read-only.

## T2 — the reviewer instance: `first-party/verifier-review.mjs`

Text from `reviewer-protocol.md`'s own sections, §2 locks cited by symbol
(`prReviewComment`, the two-key split, cold boot). Zero protocol literals —
the assemble-review-prompt split's rule, applied again.

## T3 — projection: `roles/first-party/project-role.mjs`

`projectRole(role, platform)` → `{relPath, text}`:
- `claude`: `.claude/agents/brain-<role>.md` — frontmatter (name,
  description from the role, model omitted: chooses_model/tier belong to
  routing, not the projected file) + the role text. The `brain-` namespace
  is the collision guard for operator-owned `.claude/agents/`.
- `antigravity`: `compileAgentsMd(docs, { roles })` — a NEW OPTIONAL second
  parameter; omitted = today's bytes (the existing drift test proves
  backward identity); provided = a `## First-party roles` section appended
  from projections. `antigravity.drift.test.mjs` extends to the roles arm.
Determinism: no dates, no env reads — pinned by the same-bytes-twice test.
Emission wiring (which init writes them) is Tier-2-adjacent: the projection
FUNCTIONS land here; wiring them into `env:init` emission and any
`managed-paths` declaration ships as a NOTE in the ADR draft — a hand the
maintainer plays with the promotion, not silently.

## T4 — the challenger rewire: `resolve-challenger.mjs`

The PROVISIONAL header and the `challenger.{agent, model}` binding go; the
role content resolves via `firstPartyInstance('challenger')` (Adversary).
`RUNNERS` / `IMPLEMENTED_AXES` / `DEFAULT_AXIS` byte-untouched. Config keys
`reviewer.inferential.challenger.agent/model` become UNREAD — noted in the
ADR (retire-by-deprecation is #229's post-release doctrine; the read is
removed, the keys are documented as inert, no migration deletes them).

## T5 — ADR-0023 draft: `brain-drafts/adr-0023-sdd-role-port.md`

Written FROM: the port contract as shipped (n=2, instructions, derived),
the D6 axis vocabulary, the archetype taxonomy + labels, D3's jd-* reason,
the projection rule (platforms receive, frameworks declare), and the
declared-vs-active note where it touches roles. Promoted by the maintainer
via `brain:promote` on this branch (Ruta A); `decision` label; the pair
(ADR + HOME.md) satisfies decision-gate.

## Order for tasks

T1 → T2 → T3 (each RED-first) → T4 → T5 last (the draft describes what
exists by then). Lock-survival tests ride T2/T3.
