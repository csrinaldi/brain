# Exploration: #814 — the SDD_ENGINE adapter (M5, n=2)

Read-only investigation in worktree `/home/gandalf/IA/brain-issue-814`
(branch `feat/issue-814-featharness-sddengine-is-an-axis-with-no`, off
`origin/main @ 55700da` — #817 merged). Treats the Compuerta 3 and 4 rulings
and #312's shipped slice A as settled.

## What exists NOW that did not when #814 was filed

#312 slice A landed the port this ticket plugs into, and the ticket's own
"Measured" section is stale in brain's favor:

| #814 said | today (`main @ 55700da`) |
|---|---|
| no contract | `role-port.mjs` — `resolveRoles({config, engine, inhabitant})`; an inhabitant is `declareRoles(stages) → Record<stage, {agent, model_tier, chooses_model}>` |
| `grep model_tier … → nothing` | `ROLE_TIERS = ['cheap','balanced','deep']`, `model_tier: null` = "a human executes" (a CHECKED value, Compuerta 2) |
| no parity test | `roles.contract.test.mjs` — parameterized suite over `INHABITANTS`, with a TRIPWIRE test that FAILS when a second entry lands |
| no capability | `chooses_model` is declared per stage and drives `resolveModelSelection`'s three paths (`no-agent` / `engine-chooses` / `brain-fixes`) |

n=2 is literally "entry two is one line" (`roles.contract.test.mjs:15`) — the
work is everything that makes that line honest.

## The gap, precisely

`gentle-ai.mjs` (`harness/backends/`) exports `AGENT_RUNTIME = null`,
`_toEngramProject`, `init` — **no `declareRoles`**. And the axis inversion
`#312-design.md:320` recorded is the heart of the matter:

> `gentle-ai`'s declarations are Claude Code's (`~/.claude/agents/*.md`), on
> the **AGENT_PLATFORM axis**, unreadable to brain until #814.

Verified live: `~/.claude/agents/sdd-apply.md` carries `model: sonnet` —
a CONCRETE id, in another tool's file, on the wrong axis. Three translation
problems in one:
1. concrete id → abstract tier (`sonnet` → `balanced`);
2. another tool's on-disk layout → a brain-owned declaration;
3. AGENT_PLATFORM's files → SDD_ENGINE's contract.

## Constraints already ruled (not open for design)

- **Compuerta 4 (#323, 28/08)**: ONE config verb, `brain:config`, paths by
  key; migration belongs to the verb. **Measured today: `brain:config` still
  does not exist in package.json.** Any "discovery verb that records into
  config" would have to build or wait for it — or not write config at all.
- **Compuerta 3**: parity pairing is `plain` + `gentle-ai` — the two
  engine-axis inhabitants, never the four backends (would re-mix ADR-0024's
  axes).
- **ADR-0019 Am.1 cond. 2**: verification stays neutral — an adapter must not
  expose a way to route who VERIFIES.
- **#312 design D1**: `roles/` and `stage-engine.mjs` never import each other.
- The inhabitant rule: an inhabitant may not import the port; the contract is
  imposed ON it by the test.

## Hooks #312 left FOR this ticket (named debts it discharges)

1. `roles.contract.test.mjs:130` TRIPWIRE — fails when `INHABITANTS` gains
   entry two; instructions say to delete the debt statement with it.
2. `#312-design.md:75` — when #814 lands, the registry may become a directory
   scan scoped by `SDD_ENGINES` (platform.mjs, the ONE declaration).
3. `ROLE_DEBT_TICKET` (`cold-review-prompt.mjs:136`) — discharged only when an
   inhabitant can carry role INSTRUCTIONS; the port deliberately shipped
   without an `instructions` field ("adding it then is additive").
4. `#312-design.md:302` — `state: 'disabled'` has a writer but no production
   reader; the coordinator that declines to call a disabled stage is named as
   #814/#323's.

## Scope boundary with #815 (filed the same day, same family)

#815 = brain does not OWN the stage→agent→model mapping (it lives in Claude
Code's files). #814 = the CONTRACT through which an engine states what it
offers. The adapter can declare gentle-ai's roles with recorded provenance
WITHOUT owning the general mapping problem — mapping ownership is #815's,
and folding it in here would re-create the scope creep #576 was rescoped for.

## Open questions (for the proposal round)

1. **Static-recorded vs installed-files**: the ticket already argues the
   adapter is brain-owned and recorded (its "Why an adapter and not 'just
   read the installed files'" section). What provenance discipline? The
   fixture's `_provenance {recorded|derived, endpoint, date}` pattern exists.
2. **The discovery verb vs C4**: `brain:config` does not exist. Does #814's
   verb (a) report-only, write nothing; (b) build the first slice of
   `brain:config` (big scope); (c) record outside config (engram/memory)?
3. **`instructions` field now or later**: discharging `ROLE_DEBT_TICKET`
   requires it; gentle-ai can carry instructions. Additive per #312's design.
   In-scope or follow-up?
4. **Slice shape**: one PR (adapter + parity) with the verb split out? The
   tier is `lite` (1000-line budget), and #816's precedent says the closing
   target must be chosen so #814 does not close prematurely — or does it
   close? (n=2 landing closes the tripwire debt; the verb may be the part
   that stays open.)
