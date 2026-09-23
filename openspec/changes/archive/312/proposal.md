# The role port keys on stages — a contract, a real first inhabitant, and a parity test that names what it cannot yet measure

**Issue:** #312 (M5) · **Tier:** `lite` · **Worktree:** `/home/gandalf/IA/brain-issue-312`, off `origin/main @ 9193a13`
**Authority:** the maintainer's ruling of 2026-08-31 on #312 — *"the role port keys on STAGES, and the conceptual division that decides it"*. Everything below builds on it; nothing below re-opens it.

## What is missing, measured on this tree

```
Glob  brain/scripts/roles/**                                   → no files
grep  'model_tier|tools:|reads:|writes:'  brain/scripts/harness → 0 matches
brain/scripts/harness/backends/plain.mjs      → exports AGENT_RUNTIME (:26), init (:33)
brain/scripts/harness/backends/gentle-ai.mjs  → exports AGENT_RUNTIME (:25), _toEngramProject (:86), init (:233)
brain/scripts/harness/backends/claude.mjs     → the only backend with runStage (:153)
brain.config.json (this worktree)             → no `sdd` key at all
```

The role port has **n=0 inhabitants in-repo**. The 2026-08-11 measurement still holds on `9193a13`, re-measured here rather than inherited.

Two consumers are already waiting, in code and not in prose:

- `brain/scripts/review/lib/resolve-challenger.mjs:5-26` — a dated provisional header binding `reviewer.inferential.challenger.{axis, agent, model}`, instructing *"WHEN #312 LANDS: delete the binding half and call the port instead. Keep the AXIS resolution."*
- `brain/scripts/review/lib/cold-review-prompt.mjs:136` — `export const ROLE_DEBT_TICKET = 312`, asserted by `cold-review-prompt.test.mjs:359` (*"the role is on loan from #312 until its port lands"*).

The debt is coded. Nothing today can discharge it, because there is no port to call.

## What the ruling settled, and what this change inherits from it

**The conceptual division.** Methodology roles exist because the methodology defines them; orchestrator roles survive a methodology change. The test: *if SDD were replaced tomorrow, which roles still exist?* Survivors belong to the orchestrator. **This port serves methodology roles only.**

- **The key is the RESOLVED stage set** — `resolveStageSet(config).stages` (`brain/scripts/lib/sdd-layout.mjs:125-195`): the four lifecycle stages plus any custom stage declared in `sdd.stages` (#456, shipped). Not the frozen four. Not gentle-ai's nine phases.
- **Every stage, standard or custom, has an AGENT with a ROLE** that executes it, or calls for it to be executed.
- **`cold-review`, `verify` and `apply` are CUSTOM SDD STAGES, not exceptions.** Each is routable, has an agent and a declared model, and writes to a file the engine adapter places. This is why `verify-report.md` and `apply-progress.md` are the artefacts *of stages* rather than orphans — and why `ARTEFACT_FILE.verification → verify-report.md` (`sdd-layout.mjs:33`) was never an anomaly.
- **A stage's agent/model configuration may be DISABLED**; a disabled stage is not called by the coordinator. This is **new surface** — `sdd.stages` has no notion of it today, and this worktree's own `brain.config.json` declares no `sdd` key at all.
- **#576's four archetypes are an ATTRIBUTE of a role, never a key.** Coordinator is labelled `(orchestrator)` in #576's own text and is **out of scope here** — it hangs off no stage, because it decides which stages run at all.
- **Compuerta 2:** `model_tier` is ABSTRACT (`cheap | balanced | deep`). Concrete model ids stay in #323's `sdd.map` as an opaque pass-through, exactly as `stage-engine.mjs:16-26` already refuses to interpret them.
- **Compuerta 3:** parity is proven over the **SDD_ENGINE** axis — `plain` + `gentle-ai` — not over all four backends. See *Why two and not four* below.
- **Scoping ruling, 05/08:** model selection is a **DECLARED CAPABILITY**. An engine states whether it can choose its own model. If it can, brain delegates; if it cannot, brain fixes the id from #323's map.

### Two different things are called "verification", and reading them as one produces a false conflict

ADR-0019 Amendment 1 condition 2's *"who VERIFIES"* names the **four shared gates**. `ARTEFACT_FILE.verification` names the **`sdd-verify` stage's output file**. They are different objects with the same word on them. Read as one, they look like a contradiction — a stage that is routable and a gate that must stay neutral. Read apart, they were always compatible: the gates stay neutral about which engine produced a change, and the stage that writes `verify-report.md` is routed like any other. This proposal carries that distinction forward so the next reader does not re-discover the false conflict.

## What this change does

A module at **`brain/scripts/roles/`** — for symmetry with `vcs/` and `memory/`, the repo's only two ports that have a contract test and more than one inhabitant. The draft ADR already leaned this way (`brain-drafts/adr-0023-sdd-role-port.md:77-78`); the ruling's key decision does not change the location.

**1. The contract is keyed on the resolved stage set, not on a constant.**

The key space is config-dependent and additive-only. That is a real consequence, not a detail: a contract test cannot enumerate a fixed key set the way `vcs.contract.test.mjs` enumerates verbs. It must **resolve** one from a config fixture, and then assert every resolved stage is answered. A custom stage a consumer declares is therefore covered by the same assertions as `proposal` — which is the whole point of keying on the resolved set.

The role's own field for its key follows the key: the draft ADR's `action` was written on 2026-07-24, before the stage ruling existed. **The field is `stage`** — confirmed by the maintainer on 31/08/2026, see §"Decisions taken". A field named for one thing and keyed on another is how the next reader learns the wrong model, and this session has a fresh example of exactly that cost.

**2. Three states, never collapsed into one another.**

`brain/scripts/harness/backends/agent-runtime.mjs:39-49` is the precedent and it is explicit about why (`:20-23`): *"a reader that answers 'nothing' to both 'there is nothing' and 'I could not look' reports a silence it never measured."* The role port needs the same discipline, one level up:

| state | meaning | who acts |
|---|---|---|
| **declared, enabled** | this engine executes this stage with this role | the coordinator calls it |
| **declared, disabled** | an explicit, checked value — the configuration exists and is off | the coordinator does **not** call it, and can say why |
| **seam absent** | the inhabitant answers nothing for a resolved stage | **refused** by a registry-style test, never silently read as "disabled" |

The third row is the one the repo has learned to insist on: `agent-runtime.test.mjs:351` already asserts that every backend implementing `init()` declares `AGENT_RUNTIME`, precisely so an omission cannot pass as a declaration of nothing.

The "disabled" state is new surface and it needs a writer. A state with no writer is the defect this repo has now named five times (`RECOGNISED_OUTCOMES`, #759). So the contract defines the state, and the config key that flips it lands with it — or the two land in adjacent slices of one chain, never split across a PR boundary that closes. Which of those is a delivery decision for `tasks`, not a doctrine question.

**3. `model_tier` for a zero-AI engine.**

`plain` is the zero-AI backend *by definition*, not by omission: `AGENT_RUNTIME = null` is a checked value (`plain.mjs:21-26`, asserted at `plain.test.mjs:74`). Its role for a stage is not "which model" — a human executes, following the npm verbs `MANUAL_FLOW_STEPS` already names (`plain.mjs:9-19`).

So `model_tier: null` — meaning *no model is chosen because none runs* — distinct from an unset or missing field, checked the same way `AGENT_RUNTIME = null` is checked. Adding a fourth vocabulary member (`human`) is **rejected**: Compuerta 2 fixed the vocabulary at `cheap | balanced | deep`, and extending a ruled vocabulary to describe the absence of the thing it ranks is a different fact wearing the vocabulary's clothes.

**4. Model selection dispatches on a declared capability.**

`brain-protect.mjs:96-102` is the shape the rulings point at:

```js
if (typeof providerModule.checkRuns === 'function') { …verify… }
else { log(await t('protect.verify.unsupported', { provider })); }
```

Its own header states why (`:82-89`): a provider that will *never* report runs must get a **distinct, honest note** rather than a shared one that is misleading for it. The role port inherits that: an engine that can choose its own model gets the delegated path; an engine that cannot gets brain's fixed id from `sdd.map[stage].model`, passed through opaquely per #323; an engine for which no model runs at all (`plain`) gets a third path that says so. Three facts, three paths — collapsing the last two would tell an operator that brain picked a model for a stage nobody will run.

**5. The parity test's shape follows `vcs.contract.test.mjs`.**

That suite is the repo's reference and its shape is load-bearing: an `INHABITANTS`-style map (`vcs.contract.test.mjs:141-187`), **one** loop emitting the **same** test bodies for each entry (`:189`), fixtures carrying provenance that is never ambiguous (`assertProvenance`, `:55-64`), and divergences between inhabitants **locked and named** rather than silently harmonised. A roles equivalent asserts, for every stage in a resolved set, that each inhabitant answers with a role or with an explicit checked absence; that `model_tier` is drawn from the abstract vocabulary or is the checked `null`; and that no concrete model id leaks through the contract.

### Why two and not four

Parity is measured over `plain` + `gentle-ai` — the **SDD_ENGINE** axis. `claude` and `antigravity` sit on the **AGENT_PLATFORM** axis, which ADR-0024 exists to keep separate. Binding all four inhabitants into one parity test would mix the two axes inside the assertion set, which is the exact failure the ADR was written to prevent.

This is stated because it was asked for: the 2026-08-11 measurement warned that *"any parity test binds all four, or states why it does not"*. This states why it does not.

## Why now

M5 has been at zero implementation across four handoff cuts. Two live consumers carry the debt in code with #312's number on it, and M8 (#323) depends on M5. The ruling has now settled the key — the question that blocked every previous attempt — so the contract can be written against a decided model rather than against three candidate key spaces.

## The open question this change RECORDS rather than resolves

**#312's title promises n=2 parity. `gentle-ai` cannot be an honest second inhabitant today.**

The only readable per-phase declarations live in `~/.claude/agents/sdd-*.md` — `model:` and `tools:` frontmatter. **Those are Claude Code's bindings, on the AGENT_PLATFORM axis.** gentle-ai's own `~/.claude/skills/sdd-*/SKILL.md` declares neither. Reading Claude Code's files as gentle-ai's engine data is exactly the axis conflation ADR-0024 exists to prevent — the port would be born with a category error inside its second inhabitant.

Three lossy edges make it worse, and each is measured rather than argued:

- **`model_tier`** — gentle-ai's `model:` is a concrete alias (`sonnet` / `opus` / `haiku`), never abstract. Any `sonnet → balanced` translation would be **invented by the reader**, owned by nobody, and untestable against a tool that updates out of band.
- **`tools`** — Claude Code's own tool-name vocabulary, not a portable taxonomy. `plain` has no equivalent vocabulary to declare anything in.
- **`reads` / `writes`** — not fields at all. They are prose inside numbered steps. Extracting them is interpretation, not reading.

Two open tickets own the missing halves: **#814** (no engine adapter, so brain cannot ask an engine what it offers) and **#815** (brain does not own the stage→agent→model mapping; it lives only in Claude Code's files, unreadable to any other platform).

**What this slice can deliver without them:** the contract, keyed on the resolved stage set, with the three states and the capability dispatch; `plain` as a real first inhabitant (not a stub — the draft ADR's own rejected alternatives already refuse a stub `plain`); and the parity test written in its final, parameterized shape.

**What n=2 requires:** #814, or an explicit declared absence. The choice is the maintainer's:

| option | what it buys | what it costs |
|---|---|---|
| **A — ship n=1 now.** The contract test is parameterized over an inhabitant map that currently holds one entry; the second is added when #814 lands. | Nothing is invented. The test's shape is proven and the second entry is a one-line addition. | #312's own title is unmet, so #312 stays open behind #814. "Parity test" names a suite that measures no parity yet. |
| **B — `gentle-ai` as an explicit declared absence.** A checked value meaning *"brain cannot see my roles without #814"*, following the `AGENT_RUNTIME = null` precedent exactly. | The loop really runs over two inhabitants and the refusal discipline (row 3 of the state table) is measured, not asserted. | The parity proven is over the **declaration** contract, not over role **content**. A reader can mistake "n=2 green" for "both engines have roles" — mitigated only if the assertion message names the state out loud. |

**This proposal did not choose. The maintainer did, on 31/08/2026: option A** — see §"Decisions taken" below. n=2 is proven by real role content, so this change delivers the contract plus one inhabitant and **#312 stays open behind #814**. The table above is kept as written because the option-B row states the cost that decided against it, and a decision whose rejected alternative is deleted reads as though there never was one.

## Not in this change

- **#576's four archetypes** (Coordinator / Constructor / Adversary / Verifier) — roadmap Etapa 3 · S5. They are an attribute of a role, built *on* this port, reusing `reads`/`writes` with no duplicate fields (already ruled 12/08 — verified in review, not re-decided).
- **The `resolve-challenger` debt absorption** — Etapa 3 · S4. The binding half is deleted and becomes a caller *after* the port exists.
- **The engine adapter (#814)** and **the mapping ownership (#815)**.
- **The ADR.** Per #599's rule, `brain-drafts/adr-0023-sdd-role-port.md` is rewritten *from shipped code*, not ahead of it — Etapa 3 · S3.
- **Lifting `assertRoutableStage`'s refusal of the four** (`stage-engine.mjs:91-98`). That is M8's decision under ADR-0019 Amendment 1 condition 4. This port declares who executes a stage; it does not decide that a lifecycle stage may be routed to an engine.

## Constraints

- Tier `lite` → **1000-line diff budget**. The contract, `plain`, the parity test and `sdd.configs` together sit close to it; slicing is `tasks`' call.
- **Strict TDD.** `npm test`, baseline **4520 pass / 0 fail**.
- **Tier 3:** no writes to `brain/core/**` or `brain/project/**`. ADR-0023 stays a DRAFT under `brain-drafts/`. `brain/scripts/roles/` is outside the restricted paths.

## Decisions taken by the maintainer, 31/08/2026

The three open decisions above were put to the maintainer and answered. They are recorded here rather than folded silently into the text, because two of them change what this change *is*.

**1 — Option A. `gentle-ai` as a declared absence does NOT count as the second inhabitant.**

n=2 is proven by real role **content**, not by the refusal discipline alone. The reasoning the option-B row already anticipated is the one that decided it: a green "parity" badge meaning *"one engine declared it has nothing"* is a claim a future reader will over-read, and this repository has spent too much of its own history removing claims that read stronger than their evidence.

**Consequence, stated plainly: this change does NOT close #312.** It delivers the contract and one real inhabitant, and #312 stays open behind **#814** — which now sits on M5's critical path rather than beside it. The PR for this slice therefore cannot carry a closing keyword against `main`, and a follow-up issue must exist before it merges (the sequencing hazard #557, #800 and #456 each hit in turn).

**2 — A new `sdd.configs` key, not `sdd.stages`.**

Per-stage configuration general to all stages — the agent, the enabled/disabled state, and whatever else a stage needs to be run — lives in a new `sdd.configs`, organised per stage. The three keys then divide cleanly:

| key | declares | status |
|---|---|---|
| `sdd.stages` | **which** stages exist | shipped (#456) |
| `sdd.map` | stage → `{engine, model}` | shipped (#323, migration `0.10.0`) |
| `sdd.configs` | per-stage configuration: agent, enabled, … | **new** |

This also answers the engine-incapability question the option raised: `sdd.configs` is consumer-side and says *"I turned this off"*. An engine that is structurally incapable of a stage is a different fact and belongs to the inhabitant's own declaration — the third state of the declaration table, not this key.

**Note for #815, which owns the mapping's ownership:** Compuerta 4's *"decide ONE surface"* constrains the **verb** that writes `brain.config.json`, not the number of keys under it. Three keys under `sdd.*` are one surface; three verbs would be three. That distinction should be inherited explicitly rather than re-derived.

**3 — Named, dated debt.** The suite keeps the name `roles.contract.test.mjs` and carries, in the file, a named and dated statement that it measures no parity until the second inhabitant lands. This repository has now used that pattern twice — `resolve-challenger.mjs`'s *"WHEN #312 LANDS"* and `cold-review-prompt.mjs`'s `ROLE_DEBT_TICKET`, the latter pinned by a test so the debt cannot be quietly reassigned. This is the third.

**4 — `action` → `stage`.** Confirmed. The contract's key field is `stage`.

The rename is one edit now, while nothing consumes the field, and a migration later. It is taken now for a reason this session earned the hard way: `verification` names both the `sdd-verify` stage's artefact and the shared gates, and reading the two as one cost both an agent and a subagent real time in the session that produced the ruling above. A field named for one thing and keyed on another is the same defect, planted deliberately.

## Corrections to prior measurements, recorded rather than left standing

- Engram (`#2851`, 2026-08-16) reports `brain-drafts/adr-0023-sdd-role-port.md` as malformed with **two `**Status**:` lines**, which `promote-guards.mjs` would refuse. **Not true on this tree:** the file carries exactly one (`:3`). The draft is promotable as far as that guard is concerned.
- The same draft's premise *is* stale in a different way: it names `gentle-ai` as *"the existing rich roles"* (`:20-22`) and `plain` as the one that must be built. The 2026-08-31 measurement inverts it — `plain` is buildable today and `gentle-ai` is the one brain cannot read. Its "Open questions" section (`:73-78`) is also answered: Compuerta 2 fixed `model_tier` as abstract, and this proposal takes `roles/`.
