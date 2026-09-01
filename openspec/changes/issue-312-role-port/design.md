# Design: the role port keys on stages — a pure contract, one real inhabitant, and a parity loop that measures one thing honestly

**Issue:** #312 (M5) · **Tier:** `lite` · **Worktree:** `/home/gandalf/IA/brain-issue-312`, off `origin/main @ 9193a13`
**Implements:** `specs/sdd-role-port/spec.md` (7 requirements, 14 scenarios), under `proposal.md` §"Decisions taken by the maintainer, 31/08/2026" — Option A, `sdd.configs`, named/dated debt, key field `stage`.
**Does not re-open:** the maintainer's ruling of 2026-08-31, Compuerta 2/3, the scoping ruling of 05/08, #806's migration-numbering ruling.

---

## Technical approach

Four artefacts, in dependency order:

```
brain/scripts/lib/stage-config.mjs      resolveStageConfigs(config)  — PURE, sibling of resolveStageEngine
brain/scripts/roles/role-port.mjs       resolveRoles(...)            — PURE, one injectable loader seam
brain/scripts/harness/backends/plain.mjs  + declareRoles(stages)     — the one real inhabitant
brain/scripts/roles/roles.contract.test.mjs                          — the parameterized loop, n=1, debt named
```

Nothing in the shipped tree calls any of it. That is not an oversight, it is how REQ *Zero-config identity* is met at its strongest: **behaviour is byte-identical today because there is no production caller to change behaviour.** The limit that comes with it is named in §"What has a writer and what has a reader" below, out loud, rather than left for a cold review to find.

---

## Architecture decisions

### D1 — `brain/scripts/roles/`, PURE, with exactly one injectable loader

**Choice.** The port is a pure module in the discipline `sdd-layout.mjs:92-98` states in as many words — *"PURE — `config` is RECEIVED, never read"*. `resolveRoles` takes `{ config, engine, inhabitant }` and returns a value. The single I/O act — turning an engine NAME into a module — is one injectable function, `loadInhabitant(engine, { _load })`, defaulting to `import(new URL('../harness/backends/<engine>.mjs', import.meta.url))`. That is `agentRuntimeReport`'s `_loadBackend` seam (`agent-runtime.mjs:325-327, 345`), not `cli.mjs`'s `dispatch`.

**Alternatives rejected.**

| option | cost that rejected it |
|---|---|
| Dynamic dispatch like `harness/cli.mjs` | `cli.mjs` has a **top-level await** (`:216-219`). `platform.mjs`'s header records what that cost: a one-edge cycle through it exited 13 and shipped a consumer with no `.claude/settings.json`. A port that dynamically loads inside its own resolution path invites the same shape. |
| Fully pure, caller supplies the module | Honest, but it pushes `import()` into every caller and duplicates the seam-absent refusal at each one. One seam, one refusal. |
| Under `harness/` | `roles/` for symmetry with `vcs/` and `memory/` — the repo's only two ports with a contract test. The draft ADR already leaned this way (`brain-drafts/adr-0023-sdd-role-port.md:77-78`); the stage ruling does not disturb it. |

**Import graph — a diamond, not a cycle.**

```
              sdd-layout.mjs  (leaf: node:fs, node:path only)
               ↑        ↑        ↑
   stage-engine.mjs  stage-config.mjs  roles/role-port.mjs ──→ harness/platform.mjs (leaf)
                                                  ┊
                        harness/backends/plain.mjs ┊ (declares data; imports NOTHING from roles/)
```

`roles/` and `stage-engine.mjs` are both consumers of `sdd-layout.mjs`. Neither imports the other; `sdd-layout.mjs` imports neither. No cycle exists and none can form as long as two rules hold, and the second is new:

1. **A backend may not import the dispatcher** (`platform.mjs:35-38`, existing).
2. **An inhabitant may not import the port.** `plain.mjs` declares literal values — `'human'`, `null`, `false` — and never imports the vocabulary that validates them. This is how `github.mjs` relates to `vcs.contract.test.mjs`: the contract is imposed *on* the inhabitant by a test, not imported *by* it. An inhabitant that imported the port's vocabulary would close the one edge that could reach `harness/` from `roles/` and back.

### D2 — `declareRoles(stages)`, a function; the map is the rejected alternative

**Choice.** The inhabitant surface is one export:

```js
export function declareRoles(stages) → Record<string, { stage, agent, model_tier, chooses_model }>
```

**Why not `export const ROLES = {…}`.** The key space is **config-dependent** (REQ: the key is the resolved stage set). A static map is written before the consumer's custom stage exists, so every custom stage would resolve seam-absent — and seam-absent is a REFUSAL. A static map therefore refuses every repo that uses the `sdd.stages` feature #456 shipped. The port's whole key decision would be defeated by its own inhabitant surface.

`plain` answers a stage that did not exist when `plain.mjs` was written because a human executes any stage, which is a **real property of `plain`**, not a gap: `AGENT_RUNTIME = null` (`plain.mjs:21-26`) and one manual flow (`MANUAL_FLOW_STEPS`, `:9-19`).

**The anticipated objection, answered here rather than in review.** *"`declareRoles` returns the same entry for all five stages — that is the stub the draft ADR rejects."* No. A stub is a shape with empty values. Each of `plain`'s three values is checked and falsifiable: `agent: 'human'`, `model_tier: null`, `chooses_model: false` would every one change the day `plain` gained a runtime. Uniformity here is information about `plain`, not absence of information.

**Seam-absence is enforced twice, and the two catch different things.**

| mechanism | catches |
|---|---|
| Runtime, in `resolveRoles` | `Object.hasOwn(mod, 'declareRoles')` is false → throw `roles: engine '<e>' exports no declareRoles`. The exact `?? null`-would-hide-it reasoning at `agent-runtime.mjs:366-376`. |
| Runtime, per stage | `declareRoles(stages)` returns no entry for a stage that was in `stages` → throw naming the stage. This is the row-3 refusal, and it MUST NOT read as `disabled`. |
| Contract test | The registry assertion, mirroring `agent-runtime.test.mjs:338-353`, plus a synthetic seamless module fed to `resolveRoles` so the refusal is **measured**, not asserted about a case that cannot occur. |

**Registry scope — the trap.** `agent-runtime.test.mjs:341-347` scans the backends directory and binds *every* backend implementing `init()`. Doing that here binds `claude` and `antigravity` (AGENT_PLATFORM axis) and `gentle-ai` (SDD_ENGINE, no roles until #814) into the role port. The first mixes the two axes ADR-0024 exists to separate; the second turns the suite red on day one or forces an exemption list — a state whose only writer would be "we have not built it yet". So the registry assertion iterates **`INHABITANTS`**, and the in-file debt statement says so. When #814 lands, the scan can become the directory scan scoped by `SDD_ENGINES`.

**Supporting change:** `resolveEngine` (`cli.mjs:59`) holds the engine-axis membership as an inline literal `['gentle-ai', 'plain']`. Extract it to `harness/platform.mjs` as `export const SDD_ENGINES`, read by `resolveEngine` and by `roles/`. One declaration, two readers — `CLI_OPS`-from-`OPS` (`cli.mjs:136-145`) and `IMPLEMENTED_AXES`-from-`RUNNERS` (`resolve-challenger.mjs:64-74`) are the house pattern. It lands in `platform.mjs` and not `cli.mjs` for the reason `platform.mjs` exists at all.

### D3 — `sdd.configs`: shape, defaults, and three refusals

```jsonc
"sdd": {
  "stages":  { /* #456 — WHICH stages exist */ },
  "map":     { /* #323 — stage → { engine, model } */ },
  "configs": {                       // NEW
    "verify": { "agent": "cold-reviewer", "enabled": false }
  }
}
```

| field | type | default | resolves to |
|---|---|---|---|
| `agent` | non-empty string | absent | the inhabitant's declared `agent` for that stage |
| `enabled` | strict boolean | `true` | `state: 'enabled' \| 'disabled'` |

Absent `sdd.configs`, and `sdd.configs: {}`, resolve identically — the same absent-or-empty rule `resolveStageSet` states at `sdd-layout.mjs:100-105`.

**The three refusals, and which of `resolveStageSet`'s they mirror.**

| refusal | mirrors | why not the alternative |
|---|---|---|
| An entry for a stage **not in** `resolveStageSet(config).stages` → throw, naming the stage and listing the resolved set | `resolveStageSet`'s **omits-a-lifecycle-stage** refusal (`sdd-layout.mjs:136-145`), inverted: both are set-membership refusals against the resolved set that name the offending names. | Ignoring it is `artefactFiles`'s own argument verbatim (`:38-41`): *"a name with no file behind it is a config error, and inventing one hides it until a consumer cannot satisfy a gate."* Here it hides a stage the operator misspelled and believes they configured. |
| An **unknown field** inside an entry → throw, naming the field and the known set | `artefactFiles`'s **unknown-name** refusal (`:50-61`) | `sdd.configs` is where per-stage config will grow. An ignored unknown field is a config the operator wrote and brain silently did not apply — `resolveStageEngine`'s *"`{}` is not 'no opinion' once the key exists"* (`:132-140`). |
| `enabled` not a strict boolean → throw, naming the received type | `resolveStageEngine`'s **model-must-be-a-string-or-absent** type refusal (`:141-146`) | Coercion is the dangerous branch, not the strict one. `"yes"` is truthy and so is **`"false"`** — an operator who typed the string `"false"` meaning off would get a stage that runs. A boolean field that accepts strings has a value whose meaning inverts silently. |

`resolveStageSet`'s third refusal — **relative order** (`:147-163`) — has **no mirror here and gets none.** `sdd.configs` is a lookup keyed by stage; it has no order to violate. Recorded so a later reader does not add an order check to "complete the symmetry" and invent a rule nothing needs.

### D4 — `chooses_model`: the capability field, and the three-path dispatch

```js
/** Does this engine pick its own model for this stage? Strictly boolean, never absent. */
chooses_model: boolean
```

Absent is **not** `false`. A missing capability declaration is refused for the same reason `AGENT_RUNTIME` may not be `?? null`-ed: *"a reader that answers 'nothing' to both 'there is nothing' and 'I could not look' reports a silence it never measured"* (`agent-runtime.mjs:20-23`).

Snake_case beside `model_tier` (which the spec pins literally) rather than repo-wide camelCase: these two fields are one **declared data shape**, and a shape half in each convention reads as two shapes.

The dispatch is `verifyAfterArm`'s (`brain-protect.mjs:96-102`), one branch deeper:

```js
export function resolveModelSelection({ engine, stage, role, routed }) {
  // ORDER IS LOAD-BEARING — see below.
  if (role.model_tier === null) {
    return { path: 'no-agent', tier: null, model: null,
      note: `${engine} declares model_tier: null for stage "${stage}" — a human executes it. `
          + 'No id was read from sdd.map and none was delegated.' };
  }
  if (role.chooses_model === true) {
    return { path: 'engine-chooses', tier: role.model_tier, model: null,
      note: `${engine} chooses its own model for stage "${stage}"; brain fixed none.` };
  }
  return { path: 'brain-fixes', tier: role.model_tier, model: routed?.model ?? null,
    note: `${engine} does not choose its own model; brain fixed sdd.map["${stage}"].model.` };
}
```

**`model_tier === null` is tested FIRST, and that is the whole decision.** `plain` also declares `chooses_model: false`. Capability-first would send `plain` down `brain-fixes` and report a model id from `sdd.map` for a stage nobody will run — `verifyAfterArm`'s header names exactly this failure: a provider that will *never* report runs *"gets a distinct, honest note rather than a shared one that is misleading for it"* (`:82-89`).

**What the incapable path REPORTS.** It does not consult `sdd.map` at all, and the note says so (*"no id was read"*). This is a claim about a read that did not happen; reading the map and then discarding the value would let an operator's routed model appear in a log line beside a stage brain will never run.

**Rejected: `chooses_model: null` for `plain`.** Attractive — it mirrors `AGENT_RUNTIME = null` — but it makes two fields in one object carry the same fact, and two carriers of one fact drift. `plain` declares `chooses_model: false` and the contract test pins the invariant `model_tier === null ⟹ chooses_model === false`, so the redundancy is checked rather than trusted.

**Rejected: `agent: null` for `plain`.** `agent: 'human'`. `null` in this object already means *"no model runs"* (`model_tier`); a second `null` meaning *"no agent"* leaves the port unable to distinguish `plain` from a field somebody forgot to fill. `'human'` is not an invented vocabulary member — `resolve-challenger.mjs:96` already ships `DEFAULT_AXIS = 'human'` with the reasoning *"`human` is what actually happens"*. `agent` has no ruled closed vocabulary, so this extends nothing; Compuerta 2 fixed `model_tier`'s, and adding a fourth tier there stays rejected.

### D5 — The three states, and where `disabled` gets its reason

`resolveRoles` returns, per stage, exactly one of two VALUES; the third state is a THROW. That asymmetry is the point — the spec says seam-absence is *refused*, and a refusal is not a value you can accidentally read as another one.

```js
{ stage, agent, model_tier, chooses_model, state: 'enabled' | 'disabled',
  reason: string | null, selection: { path, tier, model, note } }
```

`reason` is non-null exactly when `state === 'disabled'`, and names its author: `'disabled by sdd.configs["verify"].enabled = false'`.

**Rejected: a `disabledBy: 'config' | 'inhabitant'` discriminator.** Today `sdd.configs` is the only writer of `disabled`. A discriminator with one reachable member is the "state with no writer" defect (`RECOGNISED_OUTCOMES`, #759) wearing an enum. When #814's inhabitant can declare structural incapability, adding the discriminator is additive and its second member arrives with its writer.

### D6 — Migration `1.3.0`, and the ordering constraint against #456

The package is at `1.1.0`. #806's ruling (signed 31/08/2026): **a migration is numbered with the release it ships in, never with a sequence counter**, and numbers are never reused (`config-migrations.mjs:139-145`, uniqueness pinned at `stage-engine.test.mjs:87`).

**This change's `sdd.configs` migration takes `1.3.0`,** as a DRAFT at `openspec/changes/issue-312-role-port/brain-drafts/config-migrations-1.3.0.md`, defaults `{ sdd: { configs: {} } }`.

**The ordering constraint, stated as a rule and not only as a number.** `1.2.0` is claimed by #456's unpromoted `sdd.stages` draft. `1.3.0` is correct **only if #456's `1.2.0` promotes in an earlier release.** If `sdd.configs` ships first, this draft renumbers to `1.2.0` and #456's to `1.3.0` — the number is the release, never a queue position. The draft carries that sentence, because a number without its precondition is exactly the stale-measurement shape this change's proposal already had to correct once.

The dependency is real and not merely administrative: **every `sdd.configs` entry is refused unless its stage is in the resolved set**, so a consumer configuring a custom stage needs `sdd.stages` to exist first. A dependency in code is best mirrored by a dependency in release order.

**Can the two ship in one release? No.** One release, two migration numbers, and #806 says the number *is* the release — one of the two could not be numbered honestly, and `stage-engine.test.mjs:87`'s uniqueness check would refuse the duplicate.

**Should they, if a mechanism allowed it? Still no.** Both defaults are `{}` and both are no-ops for every existing consumer, so fusion buys nothing; and it would leave `migrateConfig`'s window arithmetic unable to distinguish a config sealed after `sdd.stages` from one sealed after `sdd.configs` — the archaeology the `0.6.0` retirement note (`config-migrations.mjs:147-150`) says the numbers exist to serve.

**Conflict to sequence, not to discover later.** #456's draft Edit 2 rewrites `brain-config.test.mjs`'s `schemaVersion` assertion to `'1.2.0'`; this draft rewrites the same line to `'1.3.0'`. The two drafts touch one identical line and MUST be promoted in order. Named here so the second promoter reads it before the merge does.

### D7 — `assertRoutableStage` is untouched, and the port must not call it

The port declares **who executes** a stage; it does not decide a stage **may be routed**. `assertRoutableStage` (`stage-engine.mjs:68-99`) and its tests stay byte-identical.

This is also a trap worth naming: an implementation that validated stage names *through* `assertRoutableStage` would refuse `proposal` — one of the four the port must answer for. A test asserts `resolveRoles` answers for `proposal`, so the trap has an oracle rather than a comment.

---

## Data flow

```
brain.config.json ──(read by the EDGE, never by these modules)──┐
                                                                 ▼
                       resolveStageSet(config) ──────────► stages: [proposal, spec, design, tasks, cold-review]
                                                                 │
                        ┌────────────────────────────────────────┴──────────────┐
                        ▼                                                       ▼
        resolveStageConfigs(config)                        loadInhabitant(engine) → declareRoles(stages)
        per stage: { agent?, enabled }                     per stage: { stage, agent, model_tier, chooses_model }
                        │                                                       │
                        └──────────────► resolveRoles(...) ◄────────────────────┘
                                              │   config.agent wins over the declared default
                                              │   missing entry for a resolved stage → THROW (row 3)
                                              ▼
                       { state: enabled|disabled, reason, selection }
                                              │
                                 resolveModelSelection(role, sdd.map[stage])
                                              ▼
                       no-agent  |  engine-chooses  |  brain-fixes
```

---

## File changes

| File | Action | Description | ~lines |
|---|---|---|---|
| `brain/scripts/lib/stage-config.mjs` | Create | `resolveStageConfigs(config)` — PURE, three refusals, zero-config identity. Beside `stage-engine.mjs` because `sdd.map` and `sdd.configs` are the same kind of object and splitting them across directories would split one concept. | 120 |
| `brain/scripts/lib/stage-config.test.mjs` | Create | Refusals, defaults, identity | 180 |
| `brain/scripts/roles/role-port.mjs` | Create | `ROLE_TIERS`, `resolveRoles`, `resolveModelSelection`, `loadInhabitant` | 200 |
| `brain/scripts/roles/role-port.test.mjs` | Create | Three states, dispatch order, `proposal` is answered | 150 |
| `brain/scripts/roles/roles.contract.test.mjs` | Create | The parameterized loop + the dated debt | 220 |
| `brain/scripts/roles/fixtures/stage-set-custom.json` | Create | The config fixture the key set is resolved FROM | 20 |
| `brain/scripts/harness/backends/plain.mjs` | Modify | `+ declareRoles(stages)`. Additive; `AGENT_RUNTIME`/`init` untouched | +45 |
| `brain/scripts/harness/backends/plain.test.mjs` | Modify | `plain`'s own declaration, incl. a custom stage | +40 |
| `brain/scripts/harness/platform.mjs` | Modify | `+ export const SDD_ENGINES` | +15 |
| `brain/scripts/harness/cli.mjs` | Modify | `resolveEngine` reads `SDD_ENGINES` instead of its inline literal | ±5 |
| `brain/scripts/harness/cli.test.mjs` | Modify | `SDD_ENGINES` is the one declaration | +10 |
| `openspec/changes/issue-312-role-port/brain-drafts/config-migrations-1.3.0.md` | Create | Tier 3 DRAFT — not countable, not applied | (90) |
| `brain/scripts/harness/backends/gentle-ai.mjs` | **Untouched** | Option A. No invented roles, no declared-absence inhabitant. | 0 |

---

## Interfaces / contracts

```js
// brain/scripts/roles/role-port.mjs
export const ROLE_TIERS = Object.freeze(['cheap', 'balanced', 'deep']); // Compuerta 2. `null` is a CHECKED value, not a member.

/** @typedef {{ stage: string, agent: string, model_tier: 'cheap'|'balanced'|'deep'|null, chooses_model: boolean }} RoleDeclaration */
/** @typedef {RoleDeclaration & { state: 'enabled'|'disabled', reason: string|null, selection: ModelSelection }} ResolvedRole */
/** @typedef {{ path: 'no-agent'|'engine-chooses'|'brain-fixes', tier: string|null, model: string|null, note: string }} ModelSelection */

export function resolveRoles({ config, engine, inhabitant }) → Record<string, ResolvedRole>
export function resolveModelSelection({ engine, stage, role, routed }) → ModelSelection
export async function loadInhabitant(engine, { _load } = {}) → module

// brain/scripts/harness/backends/plain.mjs — the inhabitant surface
export function declareRoles(stages) {
  return Object.fromEntries(stages.map((stage) => [stage, {
    stage, agent: 'human', model_tier: null, chooses_model: false,
  }]));
}
```

---

## Testing strategy

Strict TDD. Baseline **4520 pass / 0 fail**; every step RED before GREEN.

| Layer | What | How |
|---|---|---|
| Unit — `stage-config` | 3 refusals, `agent` default, `enabled` default, absent ≡ `{}` | Pure calls, literal configs |
| Unit — `role-port` | seam-absent throws (synthetic module with no `declareRoles`); per-stage omission throws naming the stage and NOT reading as disabled; dispatch order (`model_tier: null` beats `chooses_model`); `proposal` is answered (the `assertRoutableStage` trap) | Pure calls + a hand-built fake inhabitant |
| Contract — `roles.contract.test.mjs` | The parity loop | See below |
| Regression | `assertRoutableStage` tests byte-identical; `plain.test.mjs:74`'s `AGENT_RUNTIME` assertion untouched | `git diff` is the oracle |

**The parity suite's final shape.**

```js
// ── PARITY DEBT — #312, dated 2026-08-31. THIS SUITE MEASURES NO PARITY. ──
// `INHABITANTS` holds ONE entry. n=2 needs #814 (the engine adapter); until it
// lands, every assertion below is a single-inhabitant assertion wearing a
// parity loop's shape. The loop is here because the SHAPE is the deliverable —
// entry two is one line. Do not read a green run as "both engines have roles".
// Third recorded debt of this class: resolve-challenger.mjs's "WHEN #312 LANDS"
// header and cold-review-prompt.mjs's ROLE_DEBT_TICKET are the first two.
const INHABITANTS = { plain: { module: plain } };

const FIXTURE = JSON.parse(readFileSync(new URL('./fixtures/stage-set-custom.json', import.meta.url)));
assertProvenance(FIXTURE, 'stage-set-custom.json');
const STAGES = resolveStageSet(FIXTURE).stages;   // ← RESOLVED, never enumerated

for (const name of Object.keys(INHABITANTS)) { /* one body, every entry */ }
```

The fixture declares the four **plus a custom `cold-review` stage** with its own `artefact`, so REQ *"a custom stage is covered like a lifecycle stage"* is measured rather than argued. Its `_provenance` is `derived` and can never be `recorded` — there is no API to record a config from — and saying so keeps `assertProvenance` (`vcs.contract.test.mjs:55-64`) meaningful here instead of ceremonial.

Asserted **today**, per inhabitant × per resolved stage: every stage answered; `model_tier ∈ ROLE_TIERS ∪ {null}`; `chooses_model` strictly boolean; `plain` → `model_tier === null` on all five including the custom one; selection `path === 'no-agent'` with `model === null`; a synthetic entry declaring `model_tier: 'sonnet'` is refused **naming the field**; a synthetic module with no `declareRoles` is refused.

Abstraction is asserted by **membership**, never by a denylist of model aliases. A denylist would be the catalogue #323 ruled brain must not hold (`stage-engine.mjs:16-23`) — and model ids change monthly, so it would be a contract that goes stale on someone else's release schedule. Membership is the mirror of `vcs.contract.test.mjs:221-223`'s *"no provider-specific field name may leak through the contract"*.

**What turns on when entry two lands.** Adding `gentle-ai: { module: gentleAi }` runs the identical bodies against it, and turns two things RED on purpose:

```js
assert.equal(Object.keys(INHABITANTS).length, 1,
  'TRIPWIRE, not a ceiling: when this fails, n=2 landed — delete the debt statement above and this line');
assert.match(readFileSync(import.meta.filename, 'utf8'), /PARITY DEBT — #312, dated 2026-08-31/);
```

The tripwire is the mechanism `cold-review-prompt.test.mjs:359` uses on `ROLE_DEBT_TICKET`: a debt that only lives in a comment is a debt someone can quietly reassign. Here the debt cannot be discharged without deleting the statement that says it is outstanding.

---

## What has a writer and what has a reader

`disabled` HAS a writer in this slice: `sdd.configs[stage].enabled = false`, and its migration draft ships with it. What it does **not** have is a production **reader** — the coordinator that would decline to call a disabled stage does not exist in this repo and is #814/#323's. This is stated rather than left implicit, because it is the inverse of the defect #759 named and a cold review will look for it. The mitigation is that the reader is real, just not in production: `resolveRoles` returns `state: 'disabled'` and the contract test consumes it, so the state is *measured* here and *acted on* later. Shipping the port without `sdd.configs` was the alternative, and the proposal already refused it: a state defined with no writer at all is worse than a state whose first caller is one ticket away.

## The debts S4 must discharge — what this contract covers, and what it does not

Read both files. The finding is split.

**`resolve-challenger.mjs` — dischargeable, with one precondition.** The header (`:5-26`) promises to *"delete the binding half and call the port instead. Keep the AXIS resolution."* The binding half is `reviewer.inferential.challenger.{agent, model}` — and grep confirms neither is read in code today; only `axis` is (`:207`). The contract's `agent` field plus `resolveModelSelection` supply both. **The precondition is a consequence of the STAGE key:** the challenger is not a stage, so under a stage-keyed port there is no key to hang `{agent, model}` on unless the consumer declares the challenger's work as a stage (`sdd.stages.challenge`, or reuse of `cold-review`). `resolveStageSet` is additive and open, so this needs no doctrine change — but S4 cannot start without deciding it, and this design names it rather than letting S4 discover it.

**`ROLE_DEBT_TICKET` (`cold-review-prompt.mjs:136`) — NOT dischargeable by this contract, and the gap is named.** That module's header (`:1-25`) says the debt is the *whole file*: *"delete this module and read the role from the port. Keep nothing."* The thing to be read from the port is **role instructions** — what the reviewer is, what it may look at, what it must produce. This contract has **no instructions field**, deliberately: `plain`, the only inhabitant, has no prompt to declare (a human reads `MANUAL_FLOW_STEPS`), and shipping an `instructions` field no inhabitant fills and no consumer reads is the unread-field defect. So `ROLE_DEBT_TICKET` stays owned by #312 and is discharged when an inhabitant exists that can carry instructions — #814. Adding the field then is additive.

Same reasoning retires `tools` / `reads` / `writes` from the draft ADR's shape for this slice: explore measured that `gentle-ai` declares none of them as data (`reads`/`writes` are prose inside numbered steps) and `plain` has no vocabulary to declare `tools` in. #576's archetypes reuse `reads`/`writes` — that is S5, and it extends the contract, which is cheap. Shipping three fields nobody writes is not.

## Where the ADR-0023 draft is stale

ADR-0023 is **not written in this slice** (#599: from shipped code, S3). The draft at `brain-drafts/adr-0023-sdd-role-port.md` survives on its Decision (`:31-38`: a port, not a harness-private detail; ≥2 inhabitants held to parity by a test; `plain` real, never a stub) and its Rejected alternatives (`:63-71`). It is stale in three measured places, recorded so S3 does not inherit them:

| line | stale claim | measured today |
|---|---|---|
| `:20-23`, `:36` | `gentle-ai` is *"the existing rich roles"*; `plain` is the one to be built | **Inverted.** `plain` is buildable now; `gentle-ai`'s declarations are Claude Code's (`~/.claude/agents/*.md`), on the AGENT_PLATFORM axis, unreadable to brain until #814. |
| `:34` | the field is `action` | The field is **`stage`** (maintainer, 31/08/2026). |
| `:73-78` | open: abstract vs concrete `model_tier`; `harness/` vs `roles/` | Both answered — Compuerta 2 and this design's D1. |

## Budget, and the slice boundary `tasks` should take

Countable (`governance.ignoreList` excludes `openspec/changes/**`, so the migration draft does not count): **≈ 1005 lines** against tier `lite`'s **1000**. At the line, and 2.5× the 400-line review budget.

`Chained PRs recommended: Yes` · `400-line budget risk: High` · `Decision needed before apply: Yes`

Proposed boundary — three slices, each with a clear start, finish, verification and rollback:

| slice | contents | ~lines | verification | rollback |
|---|---|---|---|---|
| **S1** | `lib/stage-config.mjs` + tests + the `1.3.0` migration draft | 320 | its own suite; zero-config identity | delete two files; nothing imports them |
| **S2** | `roles/role-port.mjs` + tests + the `SDD_ENGINES` extraction | 400 | its own suite + `cli.test.mjs` green | revert; `resolveEngine` returns to its literal |
| **S3** | `plain`'s `declareRoles` + `roles.contract.test.mjs` + fixture | 330 | the parity loop, n=1, debt tripwire green | revert; `plain.mjs` returns to two exports |

S1 is autonomous. S2 depends on S1 only for the `enabled`/`agent` input. S3 is where `#312`'s deliverable becomes visible. **No slice may carry a closing keyword against `main`** — Option A keeps #312 open behind #814, and the follow-up must exist before the terminal merge (the sequencing hazard #557, #800 and #456 each hit in turn).

## Open questions

- [ ] Chain strategy (`stacked-to-main` vs `feature-branch-chain`) — the orchestrator's call, not this design's.
- [ ] S4 precondition: which stage key the challenger binds to (`sdd.stages.challenge` vs reuse of `cold-review`). Named above; decided in S4, not here.
- [ ] Whether the `1.3.0` draft renumbers — resolved by which of #456/#312 promotes first. The draft carries the rule, so no re-derivation is needed.
