# Proposal: #576 — the four archetypes, the reviewer projected, the doctrine signed

Tier `lite`. Change `issue-576-archetypes`, worktree
`/home/gandalf/IA/brain-issue-576` off `origin/main @ 4cde50e`.

**Authority**: the maintainer's question round of 02/09/2026 (D1–D4 below),
the 2026-08-12 rescope of #576 itself, #312's contract as shipped (n=2,
`instructions`), `reviewer-protocol.md` (signed doctrine, §2's three locks),
the D6 axis vocabulary, and #284's nine-roles-into-four compression.

## Intent

M5 closes. The four archetypes — Coordinator, Constructor, Adversary,
Verifier — exist as first-party roles ON the port (never a second contract
beside it); the reviewer, the one role with signed doctrine, projects
byte-deterministically into both agent platforms with a drift guard; the
port's missing doctrine (ADR-0023) is finally written from what exists; and
the last standing debt of #312's class is retired. #754 closes with it.

## Decisions taken by the maintainer, 02/09/2026

- **D1 — projection targets: `claude` + `antigravity`.** The two AGENT
  platforms with native formats in-repo (`.claude/agents/<role>.md`
  frontmatter; an AGENTS.md section through the existing `compileAgentsMd`
  pipeline and its drift guard). SDD_ENGINE frameworks DECLARE to the port
  (D6); they are never projection targets.
- **D2 — ADR-0023 is drafted HERE, from what exists.** The port (n=2,
  `instructions`), the first-party shelf, and the archetype taxonomy get
  their signed doctrine in `brain-drafts/adr-0023-sdd-role-port.md`, promoted
  by the maintainer via `brain:promote` within this PR (Ruta A — the #312
  plan that never happened, executed one milestone late and said so).
- **D3 — the jd-* agents are LEFT, with a double reason recorded.** They are
  gentle-ai framework content installed on one machine: brain inherits
  nothing from installed files without an agnostic contract — #814's own
  rule; if gentle-ai wants them exposed, it declares them through
  `declareRoles`. And they collide in authority with brain's reviewer and
  the verify stage — two parallel Adversaries would compete with the cold
  review. Adoption would import a conflict, not a capability.
- **D4 — the resolve-challenger binding half retires here.** Its header's own
  instruction ("delete the binding half and call the port instead; keep the
  AXIS resolution"), executed at last — the S4 residual, the final debt of
  its class.

## Scope

1. **The archetype layer on `first-party/`**: four archetype definitions
   carrying ONLY the three fields the port does not own — `archetype`,
   `escalation` rule, `output_contract` — each labelled `mechanical` or
   `doctrinal` (#499). Write surface stays `writes`; blindness stays `reads`
   inverted. The existing Adversary instance is re-seated on its archetype.
2. **The reviewer instance (Verifier)** built from `reviewer-protocol.md`,
   §2's three locks cited by symbol.
3. **Projection**: `projectRole(role, platform)` → bytes; targets claude
   (`.claude/agents/`) and antigravity (AGENTS.md section via
   `compileAgentsMd`'s pipeline); byte-deterministic, drift-guarded — the
   document precedent applied to roles.
4. **Lock survival proven**: `reviewer-protocol.citations.test.mjs`'s
   discipline extended — a verdict from the projected role still cannot count
   as approval; the three locks tested after the move, not assumed.
5. **ADR-0023 draft** (D2).
6. **The challenger becomes a caller of the port** (D4); AXIS resolution kept.

## Non-goals

- Routing lifecycle stages (M8 S1/S2 — the doctrine gate stands).
- jd-* adoption (D3 — the reason IS the deliverable).
- A `brain/core/roles/` doctrine tree with its own schema — the rescope's
  explicit prohibition; the port is the schema.
- Mechanical blindness enforcement — labelled doctrinal where it is, per the
  L6 precedent (#584): written down, never implied.

## Risks, named

- **Two platforms' native formats change under us** — the drift guards are
  the answer, and they are the deliverable, not an accessory.
- **ADR promotion inside the PR** touches `brain/project/decisions/` +
  `HOME.md` → `decision-gate` demands the pair and the `decision` label; the
  promotion is the maintainer's ceremony on this branch before merge.
- **The challenger rewire touches the verdict path** — the same neutrality
  discipline as #814's D3: content served, routing untouched.
