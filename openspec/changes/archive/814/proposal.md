# Proposal: #814 — the SDD_ENGINE adapter, and the config verb it writes through

Tier `lite`. Change `issue-814-engine-adapter`, worktree
`/home/gandalf/IA/brain-issue-814` off `origin/main @ 55700da` (#817 merged).

**Authority**: the maintainer's question round of 2026-09-01 (four decisions,
recorded below), the Compuerta 3 and 4 rulings (#312 / #323, 28/08/2026), the
2026-08-05 scoping ruling on #323, and #312 slice A as shipped.

## Intent

`SDD_ENGINE` becomes the third port. VCS and MEMORY each have a contract, two
inhabitants, and a parity suite; the engine axis has the contract and the suite
since #312 slice A — what it lacks is the second inhabitant that makes the
suite measure parity instead of wearing its shape. This change makes
`gentle-ai` legible to brain through an adapter brain owns, gives brain the
config verb Compuerta 4 ruled and nobody built, and discharges the role-
instructions debt the review pipeline has carried since #682.

After this change:
- `roles.contract.test.mjs`'s TRIPWIRE fails and is deleted per its own
  instructions — `INHABITANTS` holds two entries and every assertion is a
  measured parity assertion.
- `npm run brain:config -- set sdd.map.tasks --engine gentle-ai` exists — the
  ONE way to touch `brain.config.json` that is not a hand edit.
- `cold-review-prompt.mjs` is deleted; the cold review reads the reviewer
  role from the port.
- `npm run brain:engines` (name final in design) reports what each engine
  declares — and records through `brain:config`, never beside it.

## Decisions taken by the maintainer, 01/09/2026

**D1 — the discovery verb writes through the FIRST SLICE of `brain:config`,
built here.** Compuerta 4 ruled one verb with paths by key and migration
belonging to the verb; measured 2026-09-01, it still does not exist. This
change builds the slice it needs: `set`/`get` by key path, validation against
the schema, the additive migration pattern of `config-migrations.mjs` run BY
the verb. Not built here: every key the schema knows — the slice grows by
need, the surface is the ruled one.

**D2 — gentle-ai's declaration is RECORDED, not read from installed files.**
`_provenance { recorded: true, endpoint, date }` — the exact discipline
`fixtures/stage-set-custom.json` already enforces via `assertProvenance`. No
drift guard: when upstream changes its roles, the declaration is re-recorded
by hand. The cost is accepted and stated in the declaration itself.

**D3 — the `instructions` field enters the contract, and `ROLE_DEBT_TICKET`
is discharged now.** gentle-ai can carry instructions; `plain` declares a
CHECKED null (a human executes; there is no prompt), mirroring how
`model_tier: null` is a checked value and not an absence. Consequences owned:
`cold-review-prompt.mjs` is deleted ("delete this module and read the role
from the port. Keep nothing." — its own header), and ADR-0019 Amendment 1
condition 2 becomes an ACTIVE design constraint: the port carries the
reviewer's instructions, it must not become a router of who verifies.

**D4 — `chooses_model: false` on every gentle-ai stage.** Brain fixes the
model via `sdd.map` (the `brain-fixes` path), per the 2026-08-05 ruling and
current practice. Tier mapping recorded from the maintainer's own assignment
table: sonnet → `balanced`, opus → `deep`, haiku → `cheap`.

## Scope

1. **`brain/scripts/config/` — the `brain:config` verb, first slice.**
   `get <path>` and `set <path> <value>`, schema-validated, migrations run by
   the verb (#806's ruling: the migration number is the package version).
   Fails closed on an unknown key.
2. **`gentle-ai.declareRoles`** — the adapter: every resolved stage answered
   in brain's vocabulary, `_provenance` recorded, `chooses_model: false`,
   tiers per D4, `instructions` per role.
3. **Contract growth: `instructions`** — validated by the port
   (`role-port.mjs`), declared by both inhabitants (`plain`: checked null),
   consumed by the review pipeline in place of `cold-review-prompt.mjs`.
4. **The discovery verb** — asks each `SDD_ENGINES` member what it declares,
   reports; records through `brain:config` only.
5. **Parity n=2** — `INHABITANTS` gains `gentle-ai`; the TRIPWIRE and the
   debt statements it names are deleted; the registry may become the
   `SDD_ENGINES`-scoped scan #312's design authorized.

## Non-goals

- **#815** — owning the general stage→agent→model mapping. The adapter
  records ONE engine's declaration; the ownership problem stays #815's.
- **#323 / M8 routing** — `sdd.map` remains routed where it is; this change
  only reads it opaquely, as every reader must.
- **`claude` / `antigravity`** — AGENT_PLATFORM axis; Compuerta 3 rules the
  pairing is the two engine-axis inhabitants only.
- **A capability surface beyond what has a consumer** — no field ships
  without a reader (the unread-field defect, named in #312's design).

## Risks, named

- **Two consumers in one change** (harness + review). The Review Workload
  Forecast at tasks time decides slicing; `ask-on-risk` is cached. The
  natural seam is (config verb + adapter + parity) / (instructions + review
  rewiring).
- **Deleting `cold-review-prompt.mjs` touches the verdict path.** The
  reviewer's own reviewer must confirm neutrality is intact (ADR-0019 Am.1
  c.2) — the port must expose instructions without exposing routing.
- **`schemaVersion` is contested ground** (#806–#809 family). The verb's
  migration slice must follow #806's ruling and must not adjudicate the
  open siblings.

## Close semantics

Learned from #816: the terminal PR's closing target is chosen at tasks time
so nothing closes before its content is real. #814 itself closes only when
the tripwire is deleted because it FAILED — n=2 measured, not declared.

---

## Addendum — maintainer rulings, 02/09/2026

**D5 — full discharge, Option B.** Design surfaced that `cold-review-prompt.mjs`
splits in two: role content (portable) and protocol mechanics interpolated from
the reader's own constants plus per-run parameters (not portable — the port is
pure and knows no PR number). And the cold reviewer's role belongs to no engine
declaration: it is brain's own content, handed to whatever transport runs the
stage. The maintainer ruled **B**: #814 advances a brain-owned **Adversary
role instance for `cold-review`** — only that role, not #576's four-archetype
reference set — served from `brain/scripts/roles/`, and deletes
`cold-review-prompt.mjs` in this change. The review pipeline keeps a thin
assembler that interpolates the machine-checkable protocol block around the
port-served role text. #576 later grows the full archetype set around this
first instance.

**D6 — axis vocabulary, corrected.** `SDD_ENGINE` members are **frameworks**
(skill + doctrine + hooks): `gentle-ai`, `plain`, a future `brain-sdd-engine`.
`AGENT_PLATFORM` members are **agents** (runtimes that execute): Claude,
Antigravity, openCode. An earlier draft of this change's exploration framed
`claude` as "deliberately excluded" from `SDD_ENGINES`; the maintainer
corrected it — these are different kinds, not one list with rejects. A
framework declares WHAT a role is; a platform RUNS it. `sdd.map['cold-review']
.engine = 'claude'` in the field is ADR-0033's transport naming, not an axis
membership.
