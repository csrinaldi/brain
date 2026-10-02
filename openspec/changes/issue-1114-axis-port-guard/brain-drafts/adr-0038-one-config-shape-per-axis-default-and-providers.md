# ADR-0038 — One configuration shape per axis: a `default` that names a key of `providers`, and no axis defaults in code

> **status:** proposed — open points ratified 2026-10-02, pending human promotion | **date:** 2026-10-02 | **owner:** @crinaldi
> **relates to:** ADR-0004 (memory selector), ADR-0008 (VCS provider), ADR-0016 (CI context), ADR-0019 Amendment 1 (routed stages), ADR-0023 (role port), ADR-0024 (three axes), ADR-0026 Amendment 8 (additive migration for existing consumers), ADR-0033 (cold-review transport), ADR-0036 (fresh-consumer done); maintainer rulings on #1114, 2026-10-02; #643, #807, #833, #1129, #1130, #1132

> **Tier 2 draft.** `brain/project/decisions/**` is human-promoted (`agent-authorities.md` Tier 2).
> Promote with `npm run brain:promote -- <this path>`: the verb writes the house header, adds the
> `brain/HOME.md` entry `decision-gate` requires, regenerates `AGENTS.md` and stages all three.
> Committing them is the signature. The number `0038` was free on `origin/main` at `ca6f182a`
> (highest: 0037). The `brain/HOME.md` line the verb derives from this H1 is, as a draft:
>
> - [ADR-0038](project/decisions/adr-0038-one-config-shape-per-axis-default-and-providers.md) — One configuration shape per axis: a `default` that names a key of `providers`, and no axis defaults in code
>
> This ADR names amendments to ADR-0004, ADR-0008, ADR-0023, ADR-0024 and ADR-0033 and edits none
> of them. Each amendment is a separate draft, promoted after this ADR because it cites it by number.

## Context

Brain selects an implementation on four axes: the VCS provider, the memory backend, the agent
platform and the SDD engine. Measured on `feature/issue-1114-axis-ports` after S1 (#1244), paths
under `brain/scripts/` unless noted, each axis has its own resolver, its own config shape and its
own answer to "nothing is declared":

| Axis | Resolver | Precedence | Config key | Undeclared |
|---|---|---|---|---|
| memory | `memory/lib/backend-resolve.mjs:76`, over `lib/axis-selector.mjs:56` | process env > `.env` > config | `memory.backend` (`brain/core/config-migrations.mjs:209-223`) | refuses, naming `brain:config -- set memory.backend …` (`backend-resolve.mjs:35,87-88`) |
| vcs | `vcs/cli.mjs:78` `resolveProviderName` | runtime-detected provider > process env `VCS_PROVIDER` > config; **no `.env` level** | `vcs.provider` (`config-migrations.mjs:42-46`) | throws (`vcs/cli.mjs:84-88`) |
| platform | `harness/platform.mjs:75` `resolvePlatform` | process env > `.env` > `config.platform` > legacy `SDD_HARNESS` | `platform`, **declared by no migration** | `claude` (`platform.mjs:66`, ADR-0024 Amendment 2) |
| sdd | `harness/cli.mjs:56` `resolveEngine` | process env > `.env` > `config.engine` > legacy `SDD_HARNESS` / `config.harness` | `engine` / `harness`, **declared by no migration** (#643) | `gentle-ai` (`harness/cli.mjs:69`) |

Four resolvers, three precedences, two config keys that no schema declares, and three answers to
"undeclared": refuse, throw, or guess. `platform` also has a second resolver in shell,
`bootstrap.sh:499-520`, held to the JS one by a parity test. `axis-selector.mjs` was written for
all four (its header, lines 3-4) and has one consumer.

**The word "engine" means two things, in one config field.**

- `SDD_ENGINE` names a framework that *declares* roles: `gentle-ai` or `plain`
  (`harness/platform.mjs:52`, ADR-0023 decision 1).
- `sdd.map[<stage>].engine` (`lib/stage-engine.mjs:123`) names an SDD framework for a lifecycle
  stage, which `stage-engine.mjs:227-233` enforces. For a custom stage it names a *runtime*: this
  repository's own config routes `cold-review` to `"engine": "codex"` (`brain.config.json:51-52`),
  and `review/lib/run-cold-review-stage.mjs:170` branches on `codex`/`gemini` by name. #833
  recorded the split as "two vocabularies in one map".
- The runtimes live in two adapter directories: `axes/platform/adapters/{claude,antigravity,plain}.mjs`
  and `axes/review-engine/adapters/{claude,codex,gemini}.mjs`. `claude` is in both.

Per-stage configuration is split as well. `sdd.configs[<stage>]` carries `{agent, enabled}`
(`lib/stage-config.mjs:25`) and `sdd.map[<stage>]` carries `{engine, model}`
(`stage-engine.mjs:174`), for the same stage key. #1132 asks for one declaration.

Nothing in config records which version of a provider a team expects, and nothing verifies it.
#1130 (`brain:doctor`) needs that to report "the supplier is present" as pass or fail.

## Decision

### 1. One shape for every axis

Every axis is one object in the tracked `brain.config.json`:

```json
{
  "<axis>": {
    "default": "<name>",
    "providers": {
      "<name>": { "version": "<expected version>" }
    }
  }
}
```

- **`default` is one key at axis level.** It is not a `default: true` flag on a provider, because
  a flag can be set on zero providers or on two, and a single key cannot.
- **`default` must be a key of `providers`.** A config that names a default it does not list is
  invalid and is refused.
- **`providers` is a map.** Each provider has room for its own settings; `version` is the first.
  Settings that belong to the axis and not to a provider stay beside `default` and `providers`
  (for example `memory.lane`).
- **The shape is the same on an axis with one provider.** Adding a second provider then adds a key;
  it never reshapes the axis.
- **Undeclared is `"default": ""`**, the empty-string convention `vcs.provider` and
  `memory.backend` already use (`axis-selector.mjs:20-22`).

### 2. Four axes, one resolver, one precedence

The axes are `vcs`, `memory`, `platform` and `sdd`. Each selector is `<axis>.default`, read by one
`resolveAxis` (#1114 S2) built on `axis-selector.mjs`, with one precedence:

1. the process env, a per-run override;
2. `.env`, a per-machine override;
3. `brain.config.json` `<axis>.default`, the team's choice;
4. otherwise **undeclared**.

**VCS is the single exception: it has no `.env` level.** Its precedence is the process env, then
`brain.config.json` `vcs.default`, then undeclared. The provider is dictated by where the repo lives,
and there is no per-developer freedom: a project lives in one repository (ADR-0008, lines 12 and 18).
A CI-detected provider sits outside this precedence (Ratified point 1).

The env keys keep their names: `VCS_PROVIDER`, `MEMORY_BACKEND`, `AGENT_PLATFORM`, `SDD_ENGINE`.
A value from any level that is not a key of `<axis>.providers` is invalid and is refused. It is
never coerced to another provider.

### 3. Every axis refuses when undeclared

- `memory` (ADR-0004 Amendment 3) and `vcs` (ADR-0008) already refuse.
- `platform` loses its `claude` default. This amends ADR-0024 Amendment 2.
- `sdd` loses its hardcoded `gentle-ai` default (`harness/cli.mjs:69`).
- The refusal is actionable in the way memory's is: it names the axis, says that no level declares
  it, and prints `npm run brain:config -- set <axis>.default <name>` with the provider names.

### 4. `sdd.roles`: a routing table inside the `sdd` axis

`sdd.roles.<stage>` is not an axis selector. Each entry is:

```json
{ "agent": "<sdd provider>:<role>", "engine": "<platform provider>", "model": "<model id>" }
```

Each field is optional and cascades:

| Field | Value when the entry gives none |
|---|---|
| `agent` | `${sdd.default}:<the stage's default role>`, the role that provider declares for the stage through the role port (ADR-0023) |
| `engine` | `platform.default` |
| `model` | the engine's own default; brain passes no model |

An `agent` whose provider part is not a key of `sdd.providers`, or an `engine` that is not a key of
`platform.providers`, makes the config invalid. So does an explicit `engine` whose provider does not
declare the ability to execute a stage prompt (section 5): `plain` can never be an `engine`. It is
**refused, never warned about**. This is how several SDD providers coexist, for example `gentle-ai`
and brain's own first-party roles (ADR-0023's shelf, as the provider `brain`), with one of them as
`sdd.default`.

**A stage with no default role must declare `agent`.** The `agent` cascade is defined only when
`sdd.default` declares, through the role port, a default role of its own for the stage. A role the
provider merely derives for a stage it never declared (`gentle-ai`'s `derivedRole`, marked
`derived: true`, `axes/sdd-engine/adapters/gentle-ai.roles.mjs:66-75`) is not a default role.
`cold-review` and every custom stage are in this case under `gentle-ai`. Such a stage MUST give
`agent` explicitly in `sdd.roles`. A stage that does not is refused, and the message names the
stage. `plain` declares the human role for every stage it is asked about
(`axes/sdd-engine/adapters/plain.mjs:57-62`), so under `"sdd": { "default": "plain" }` the cascade is
always defined.

**`engine` under a human orchestrator.** When `platform.default` is `plain` (section 5), the
`engine` cascade names a provider that cannot execute a stage prompt. A stage that gives no
`engine` then has no runtime and the person runs it by hand, which is what `plain` means today. A
stage that needs a runtime under a human orchestrator names its `engine` explicitly.

In `sdd.roles`, `engine` means one thing: a platform provider, the runtime that executes. The
framework that declares the role is the provider part of `agent`. This ends the two meanings of
"engine" described in Context.

### 5. `platform.providers` is the set of agent runtimes, and `platform.default` is the orchestrator

`platform.providers` holds every runtime that executes a prompt: `claude`, `codex`, `gemini`,
`antigravity`. It unifies today's agent platform with the cold-review engines (#1129, #833). It also
holds `plain`, the human orchestrator, below.

**`platform.default` is the orchestrator.** It is the agent brain talks to and the one that runs
the whole flow: it holds the workspace, the session hooks and the skills, and it delegates to
sub-agents.

- **There is exactly one orchestrator per session.** It is resolved once, when the session starts,
  with the shared precedence of section 2: process env, then `.env`, then `platform.default`. It
  never changes mid-session.
- The team declares its orchestrator in `platform.default`. A person may override it for their own
  machine in their `.env` (`AGENT_PLATFORM`). Every session still has exactly one.
- **A stage runtime is never the orchestrator.** `codex` running the cold review is a process the
  orchestrator spawns. It opens no session of its own and orchestrates nothing.

**Every platform provider declares capabilities, in its adapter.** This ADR names two:
`orchestrate`, and the ability to execute a stage prompt. The rest of the capability vocabulary
belongs to #1129 and #1128.

| Provider | `orchestrate` | Executes a stage prompt | May appear as |
|---|---|---|---|
| `claude` | yes | yes | `platform.default`, `engine` |
| `antigravity` | yes | not until a stage-runtime adapter exists (#1128, #1129) | `platform.default` |
| `codex` | no | yes | `engine` only |
| `gemini` | no | yes | `engine` only |
| `plain` | yes, as a human orchestrator | no | `platform.default` only |

- **`platform.default` must name a provider that declares `orchestrate`.** Otherwise the config is
  invalid and is refused. The same check applies to a value from the process env or `.env`. This is
  why `"platform": { "default": "codex" }` is refused even when `codex` is listed: no workspace or
  hook adapter exists for it (`axes/platform/adapters/` holds `claude`, `antigravity` and `plain`;
  `codex` and `gemini` live only under `axes/review-engine/adapters/`).
- **`platform.default: "plain"` means the orchestrator is a human.** No agent runs, and the person
  runs the verbs by hand. `plain` cannot execute a stage prompt, so it is never an `engine` in
  `sdd.roles` (section 4). `AGENT_PLATFORM=plain` is valid today (`harness/platform.mjs:65`), and
  `bootstrap.sh:513-519` writes it into `.env` from a legacy `SDD_HARNESS=plain`. Keeping `plain`
  is what keeps section 7's promise for those consumers.

**Why one axis.** Each member is an agent CLI that receives a prompt and a model and executes it.
What differs between "the platform a developer works in" and "the engine a stage spawns" is the
caller, not the thing called. Two axes would give `claude` two declarations, two versions to verify
and two adapter directories, which is the state Context measures. What a member can do (orchestrate,
execute a stage prompt, emit session hooks, return a final message, write an artifact) is a
per-provider capability declared by the provider. It is not a reason to put the member on a second
axis.

Consequences for the ADRs this touches:

- **ADR-0024.** Its three axes become four config axes in one shape, with VCS on the same footing.
  `platform.providers` widens from the platforms that emit workspace files to every agent runtime.
  `AGENT_PLATFORM` still selects only the orchestrator, and must name a provider that declares
  `orchestrate`. Per-stage selection (Amendment 1's "per stage rather than per repo") lives in `sdd.roles`, and its
  `engine` field names a platform provider, not an `SDD_ENGINE` framework. The `claude` default
  (Amendment 2) and the `SDD_HARNESS` legacy fallback are retired.
- **ADR-0033.** Decision part 1, `sdd.map['cold-review'] → { engine, model }`, becomes
  `sdd.roles['cold-review'] → { agent, engine, model }`, with `engine` a key of
  `platform.providers`. Parts 2-4 (spawn through the harness, a file as output, only `brain:review`
  touches the forge) and the credential table are unchanged. #833's option C (the SDD framework
  holds the transport) is not taken; the field split replaces it.

### 6. `version` is verified

`providers.<name>.version` is optional. When present, it is what the team expects to run, and
`brain:env:init` and `brain:doctor` (#1130) compare it with the installed provider and report the
mismatch. Each provider entry ends in one of three reported states:

| State | When |
|---|---|
| verified | `version` is declared and the installed provider matches it |
| unverified | `version` is absent: a migration or `brain:config -- set` created the entry as `{}` (Ratified points 2 and 3); when the provider declares a version probe, the detected version and the pin command are printed |
| unverifiable | the provider declares no version probe, so neither a match nor a mismatch can be measured |

For the `brain` provider, `"self"` means the version of the installed brain package, which is
always verifiable.

### 7. Migration: additive, through `brain:upgrade`, and no consumer changes behaviour

Migrations follow ADR-0026 Amendment 8: existing consumers keep what they run today, and a new
consumer is asked.

| Today | After the migration |
|---|---|
| `memory.backend` | `memory.default` plus `memory.providers.<name>` |
| `vcs.provider` | `vcs.default` plus `vcs.providers.<name>` |
| flat `platform`, `engine`, `harness`; legacy `SDD_HARNESS` (#643) | `platform.default` / `sdd.default` plus the matching `providers.<name>` |
| `sdd.configs` + `sdd.map` | `sdd.roles`; #1132 owns this reshape and implements it, and this ADR fixes only its target |

- **`sdd.map.<stage>.engine` is migrated by what it names.**
  - For a lifecycle stage it names a FRAMEWORK: only `gentle-ai` or `plain` are valid there
    (`lib/stage-engine.mjs:227-233`, `assertRoutedStage`). The migration maps it to the provider part
    of `agent`, as `"agent": "<that framework>:<the stage's role>"`, and NEVER adds it to
    `platform.providers`.
  - For a custom stage it names a RUNTIME. It goes to `sdd.roles.<stage>.engine` and is added to
    `platform.providers` as `{}`. The same applies to an engine a custom stage names in
    `sdd.configs`, if present. This repository's own `brain.config.json` routes `cold-review` to
    `codex` (`brain.config.json:51-52`); without this step, the reshaped `sdd.roles['cold-review']`
    would be refused by section 4.
- **The `brain` SDD provider is declared on every consumer.** The migration writes
  `sdd.providers.brain` as `{ "version": "self" }`. It is not a provider to build later: it is what
  brain already runs, given a name. Today `brain:review` itself runs the cold-review stage
  (ADR-0033), so the migration writes `sdd.roles['cold-review'].agent` as `"brain:cold-review"`,
  plus the `engine` and `model` it finds in `sdd.map['cold-review']`.
- **A machine-written `.env` no longer shadows the team's choice.** From S3 on, `env:init` writes no
  axis selector (`AGENT_PLATFORM` or any other) into `.env`. It declares the value in tracked config,
  as memory does since #1165. The writer to change is `bootstrap.sh:511-521`. The migration does not
  edit `.env`. For an existing `.env`, `brain:doctor` warns when an axis selector there shadows the
  axis `default` in config, and prints the command that removes it.
- **The value an existing consumer runs today is written into config.** It is taken from the
  process env or `.env` when either declares it, and otherwise from today's default: `claude` for
  `platform`, `gentle-ai` for `sdd`. An undeclared `memory` or `vcs` stays undeclared, since it
  refuses today too.
- **Old keys keep working as a read-only alias for one minor version**, then refuse with a named
  fix. This covers `memory.backend` and `vcs.provider`. The same window applies to the flat
  `platform`/`engine`/`harness` keys and `SDD_HARNESS`, because a process env that still sets them
  after the upgrade would otherwise change what runs.
- **A new consumer:** `env:init` declares each axis's default or asks for it, as it does for
  `memory` today.

### 8. Order inside #1114

S3 (the shape and the migrations) lands **before** S2 (`resolveAxis` and the refusal). After S3,
every existing consumer has its effective value in config, so S2's refusal fires only where nothing
was ever chosen.

### Example: a valid config under this decision

```json
{
  "vcs": {
    "default": "github",
    "providers": { "github": { "version": "2.63.0" } }
  },
  "memory": {
    "default": "engram",
    "providers": { "engram": { "version": "1.15.3" } },
    "lane": { "enabled": true }
  },
  "platform": {
    "default": "claude",
    "providers": {
      "claude": { "version": "2.1.0" },
      "codex": { "version": "0.50.0" }
    }
  },
  "sdd": {
    "default": "gentle-ai",
    "providers": {
      "gentle-ai": { "version": "1.20.0" },
      "brain": { "version": "self" }
    },
    "roles": {
      "cold-review": { "agent": "brain:cold-review", "engine": "codex", "model": "gpt-5.5" },
      "design": { "model": "claude-opus-5-5" }
    }
  }
}
```

`design` resolves to agent `gentle-ai:<the role gentle-ai declares for design>`, engine `claude`,
model `claude-opus-5-5`. Leaving out `agent` is valid only because `gentle-ai` declares a default
role for `design` (`sdd-design`, `axes/sdd-engine/adapters/gentle-ai.roles.mjs:44-45`).
`cold-review` has no such role, which is why its entry names `agent` explicitly (section 4). A stage absent from `roles` resolves all three fields by the cascade. The
version strings are illustrative.

Two configs this decision refuses:

```json
{ "platform": { "default": "codex", "providers": { "claude": { "version": "2.1.0" } } } }
```

```json
{
  "platform": { "default": "claude", "providers": { "claude": { "version": "2.1.0" } } },
  "sdd": {
    "default": "gentle-ai",
    "providers": { "gentle-ai": { "version": "1.20.0" } },
    "roles": { "cold-review": { "agent": "brain:cold-review", "engine": "gemini" } }
  }
}
```

The first names a default it does not list. Listing `codex` would not save it: `codex` does not
declare `orchestrate` (section 5). The second routes to an SDD provider (`brain`) and a
platform provider (`gemini`) that the config does not declare.

## Consequences

### Positive

- **One reader for every axis.** One precedence, one refusal and one validation rule replace the
  four resolvers in Context and the shell resolver in `bootstrap.sh`.
- **Defaults are declared, not inherited.** A fresh clone, a teammate or CI runs what the tracked
  config names, never what the code happens to default to. This closes the #1165 defect for the two
  axes it did not reach, from the moment `env:init` stops writing axis selectors into `.env`
  (section 7). A `.env` written before that still shadows the config on its own machine;
  `brain:doctor` reports it and prints the fix.
- **"Engine" has one meaning per field.** `agent` names the framework and role, and `engine` names
  the runtime. The runner can stop branching on runtime names (#1129).
- **Several SDD providers coexist** under one validated table, and the first-party shelf gets a
  provider name without displacing `gentle-ai`.
- **`brain:doctor` has a declared expectation** (`version`) to check against, instead of a binary
  that merely exists.
- **#643 resolves by declaring.** `platform` and `sdd` become schema-declared, and the dead
  `harness` branch of `platformConfig` (`axes/lib/agent-runtime.mjs:231-244`) can be deleted.

### Negative

- **Verbosity on single-provider axes.** `"vcs": { "provider": "github" }` becomes
  `"vcs": { "default": "github", "providers": { "github": {} } }`, which names `github` twice. This
  is the price of a shape that does not change when a second provider arrives, and it is paid on
  every axis.
- **A per-machine value can become the team's.** The migration writes the effective value, and on
  the machine that runs `brain:upgrade` that value may come from its `.env` or from a process env
  set for that run. Behaviour does not change on that machine. A teammate whose `.env` differs keeps
  their override, but the tracked default now reflects the upgrading machine. `brain:upgrade` must
  print each value it wrote and its source, so the commit's reviewer can see it.
- **`platform` and `sdd` stop working silently on a config with nothing in it.** That is the
  purpose, and it is a visible change for anyone who relied on the defaults without running
  `env:init`. The migration covers existing consumers; a hand-made config with no `brain:upgrade`
  run will refuse.
- **One more minor version of aliases** to carry and then remove, with its own refusal text.
- **`version` can drift from reality** like any declaration. Its value is that the drift is
  reported, not that it cannot happen.

## Rejected alternatives

**A per-provider `default: true` flag.** It can be true on zero providers or on two, so a validator
has to define and refuse both cases. A single `default` key cannot express either.

**A `providers` list without per-provider config** (`"providers": ["github"]`). It has no room for
`version` or any later setting, so the first per-provider setting would reshape every axis.

**Keep the flat keys** (`vcs.provider`, `memory.backend`, `platform`, `engine`). Each axis would
keep its own spelling and adding a provider setting would need a new key per axis. `platform` and
`engine` would also stay undeclared, which is the #643/#807 defect.

**Keep the `claude` and `gentle-ai` defaults.** A default in code is a choice the team never made,
and two axes would answer "undeclared" by guessing while two refuse. ADR-0004 Amendment 3 already
ruled this for memory, for the reason that applies here: a second checkout runs something other
than the team's choice and nobody is told.

**VCS with the `.env` level like every other axis.** The VCS provider is dictated by where the
repo lives, and there is no per-developer freedom: a project lives in one repository (ADR-0008,
lines 12 and 18). A per-machine level would only let one checkout disagree with the host.

**Two runtime axes** (a platform axis and a review-engine axis). Both hold agent CLIs that execute
a prompt, `claude` belongs to both, and each stage would have to say which of the two axes its
`engine` comes from. One axis with per-provider capabilities expresses the same thing with one
declaration per runtime.

## What this does NOT close

- **No code changes here.** `resolveAxis`, the migrations, the aliases and the refusals are #1114
  S2 and S3. The `sdd.configs` + `sdd.map` → `sdd.roles` reshape and its projection into each
  platform are #1132.
- **The `brain` SDD provider's roles beyond cold-review.** The provider exists as the roles brain
  already ships: `cold-review` today, run by `brain:review` (ADR-0033). First-party roles for other
  stages, declared through the port, are #1132's work, under ADR-0023.
- **The runtime adapters are not merged.** `axes/platform/adapters/` and
  `axes/review-engine/adapters/` stay two directories until a slice moves them. This ADR rules that
  they are one axis in config, and that a provider lacking a capability is refused wherever that
  capability is required: `platform.default` requires `orchestrate`, and an `engine` requires the
  ability to execute a stage prompt (section 5). A missing capability is never a warning and never a
  fallback to another provider. The declaration lives in each provider's adapter. The rest of the
  vocabulary, and where capabilities beyond these two are checked, belong to #1129 and #1128.
- **How `version` is compared** (exact match or a range) and what `env:init` does on a mismatch
  (warn or refuse) belong to #1130.
- **The call-site leaks** S1's guard allowlists (`day-start.mjs` calling `gentle-ai` and `engram`
  directly, the codex/gemini branch, the VCS spawns) stay owned by #1115, #833, #1107 and #1109.
  One resolver does not remove a call that bypasses it.
- **#807's general scanner** for keys read but never declared. This ADR declares the axis keys; it
  does not build that check.
- **`sdd.engines`** (the `brain:engines --record` store, migration 1.4.0) and
  `reviewer.inferential.challenger` are not reshaped here.

## Amendments this requires (none are made here)

- **ADR-0004.** The selector key `memory.backend` becomes `memory.default` plus `memory.providers`,
  with a one-minor read-only alias. Amendment 3's precedence and no-default rule are unchanged.
- **ADR-0008.** `vcs.provider` becomes `vcs.default` plus `vcs.providers`, with the same alias.
  ADR-0008's no-`.env` rule stands: VCS is the exception to the shared precedence (section 2). The
  runtime-detected CI provider sits outside the precedence and needs only a shipped adapter
  (Ratified point 1).
- **ADR-0023.** The shelf becomes an SDD provider named `brain` (`"version": "self"`). Stage → role
  routing, including the model that decision 4 leaves to routing, lives in `sdd.roles`.
- **ADR-0024.** Four config axes in one shape. `platform.providers` covers every agent runtime, and
  `platform.default` (`AGENT_PLATFORM`) names the one orchestrator per session, which must declare
  `orchestrate`; `plain` stays, as the human orchestrator.
  Amendment 2's `claude` default and the `SDD_HARNESS` legacy fallback are withdrawn. Amendment 1's
  per-stage selection moves to `sdd.roles`, whose `engine` names a platform provider.
- **ADR-0033.** Decision part 1 resolves through `sdd.roles['cold-review']`, with `engine` a key of
  `platform.providers`. The transport and the credential table are unchanged.

## Ratified points (maintainer, 2026-10-02)

These four points were open in the first draft. The maintainer ruled on each one.

1. **The runtime-detected VCS provider.** A CI-detected provider (ADR-0016's `ctx.provider`, for
   example `gitlab` on a GitLab job) is a fact about the host that the caller passes. It sits
   outside the VCS precedence (section 2) and is not another level. It does NOT need to be a key of
   `vcs.providers`; it needs only that brain ships an adapter for it.
   - **Corrected after the cold review of PR #1249.** The first ruling required it to be a key of
     `vcs.providers`. The maintainer revised that on 2026-10-02: the detected provider is a fact
     about the host, not a team choice, and today it lets a GitLab CI job on a mirror of a
     github-configured repo dispatch to `gitlab` (`vcs/cli.mjs:79-82`, finding #14). Requiring the
     key would refuse that job.
2. **`brain:config -- set <axis>.default <name>` also creates `providers.<name>` as `{}`** when that
   entry is absent. The command a refusal names therefore always produces a valid config.
3. **`version` is suggested, never written by a migration.**
   - Each provider may declare a version probe in its adapter, for example `engram --version` or
     `gh --version`. A provider with no easy way to report its version declares none. The probe
     lives in the adapter, so the axis-port guard does not flag it.
   - The migration writes no `version`. It prints the detected version and the exact command to pin
     it, for example
     `npm run brain:config -- set memory.providers.engram.version 1.15.3`.
   - `brain:doctor` reports the provider as unverified, shows the detected version and prints the
     same command.
   - Reason: the detected version belongs to the machine running the upgrade. Writing it would pin
     one person's installation as the team's expectation, the same risk Consequences names for
     `default`.
   - The `brain` provider is the exception. It is written as `"self"`, because it is the package's
     own version and does not depend on the machine.
4. **`plain` stays a provider of both `sdd` and `platform`.** In `sdd` it is a valid SDD framework:
   the manual flow. In `platform` it is the human orchestrator: it declares `orchestrate`, cannot
   execute a stage prompt, and so is never an `engine` (section 5).
   - **Corrected after the cold review of PR #1249.** The first ruling said `plain` leaves
     `platform`. The maintainer reversed it on 2026-10-02, because `AGENT_PLATFORM=plain` is valid
     today (`harness/platform.mjs:65`) and `bootstrap.sh:513-519` writes it into `.env`. Removing it
     would change what those consumers run, which breaks section 7's promise.
