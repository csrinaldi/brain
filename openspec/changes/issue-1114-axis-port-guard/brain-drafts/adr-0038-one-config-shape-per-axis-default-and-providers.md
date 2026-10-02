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
`platform.providers`, makes the config invalid. It is **refused, never warned about**. This is how
several SDD providers coexist, for example `gentle-ai` and brain's own first-party roles (ADR-0023's
shelf, as the provider `brain`), with one of them as `sdd.default`.

In `sdd.roles`, `engine` means one thing: a platform provider, the runtime that executes. The
framework that declares the role is the provider part of `agent`. This ends the two meanings of
"engine" described in Context.

### 5. `platform.providers` is the set of agent runtimes

`platform.providers` holds every runtime that executes a prompt: `claude`, `codex`, `gemini`,
`antigravity`. It unifies today's agent platform with the cold-review engines (#1129, #833).

**Why one axis.** Each member is an agent CLI that receives a prompt and a model and executes it.
What differs between "the platform a developer works in" and "the engine a stage spawns" is the
caller, not the thing called. Two axes would give `claude` two declarations, two versions to verify
and two adapter directories, which is the state Context measures. What a member can do (emit
session hooks, return a final message, write an artifact) is a per-provider capability declared by
the provider. It is not a reason to put the member on a second axis.

Consequences for the ADRs this touches:

- **ADR-0024.** Its three axes become four config axes in one shape, with VCS on the same footing.
  `AGENT_PLATFORM` widens from the platforms that emit workspace files to every agent runtime.
  Per-stage selection (Amendment 1's "per stage rather than per repo") lives in `sdd.roles`, and its
  `engine` field names a platform provider, not an `SDD_ENGINE` framework. The `claude` default
  (Amendment 2) and the `SDD_HARNESS` legacy fallback are retired.
- **ADR-0033.** Decision part 1, `sdd.map['cold-review'] → { engine, model }`, becomes
  `sdd.roles['cold-review'] → { agent, engine, model }`, with `engine` a key of
  `platform.providers`. Parts 2-4 (spawn through the harness, a file as output, only `brain:review`
  touches the forge) and the credential table are unchanged. #833's option C (the SDD framework
  holds the transport) is not taken; the field split replaces it.

### 6. `version` is verified

`providers.<name>.version` is what the team expects to run. `brain:env:init` and `brain:doctor`
(#1130) compare it with the installed provider and report the mismatch. For the `brain` provider,
`"self"` means the version of the installed brain package.

### 7. Migration: additive, through `brain:upgrade`, and no consumer changes behaviour

Migrations follow ADR-0026 Amendment 8: existing consumers keep what they run today, and a new
consumer is asked.

| Today | After the migration |
|---|---|
| `memory.backend` | `memory.default` plus `memory.providers.<name>` |
| `vcs.provider` | `vcs.default` plus `vcs.providers.<name>` |
| flat `platform`, `engine`, `harness`; legacy `SDD_HARNESS` (#643) | `platform.default` / `sdd.default` plus the matching `providers.<name>` |
| `sdd.configs` + `sdd.map` | `sdd.roles`; #1132 owns this reshape and implements it, and this ADR fixes only its target |

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
      "cold-review": { "agent": "brain:adversary-cold-review", "engine": "codex", "model": "gpt-5.5" },
      "design": { "model": "claude-opus-5-5" }
    }
  }
}
```

`design` resolves to agent `gentle-ai:<the role gentle-ai declares for design>`, engine `claude`,
model `claude-opus-5-5`. A stage absent from `roles` resolves all three fields by the cascade. The
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
    "roles": { "cold-review": { "agent": "brain:adversary-cold-review", "engine": "gemini" } }
  }
}
```

The first names a default it does not list. The second routes to an SDD provider (`brain`) and a
platform provider (`gemini`) that the config does not declare.

## Consequences

### Positive

- **One reader for every axis.** One precedence, one refusal and one validation rule replace the
  four resolvers in Context and the shell resolver in `bootstrap.sh`.
- **Defaults are declared, not inherited.** A fresh clone, a teammate or CI runs what the tracked
  config names, never what the code happens to default to (the #1165 defect, closed for the two
  axes it did not reach).
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

**Two runtime axes** (a platform axis and a review-engine axis). Both hold agent CLIs that execute
a prompt, `claude` belongs to both, and each stage would have to say which of the two axes its
`engine` comes from. One axis with per-provider capabilities expresses the same thing with one
declaration per runtime.

## What this does NOT close

- **No code changes here.** `resolveAxis`, the migrations, the aliases and the refusals are #1114
  S2 and S3. The `sdd.configs` + `sdd.map` → `sdd.roles` reshape and its projection into each
  platform are #1132.
- **The `brain` SDD provider does not exist yet.** `axes/sdd-engine/adapters/` holds `gentle-ai`
  and `plain`. Making the first-party shelf a provider that declares roles through the port is
  #1132's work, under ADR-0023.
- **The runtime adapters are not merged.** `axes/platform/adapters/` and
  `axes/review-engine/adapters/` stay two directories until a slice moves them. This ADR rules that
  they are one axis in config, and the cold-review engine contract (#1129) is where the per-provider
  capabilities get written.
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
  VCS gains the `.env` level of the shared precedence, which reverses ADR-0008's "not in `.env`".
  The runtime-detected CI provider sits outside the precedence (Ratified point 1).
- **ADR-0023.** The shelf becomes an SDD provider named `brain` (`"version": "self"`). Stage → role
  routing, including the model that decision 4 leaves to routing, lives in `sdd.roles`.
- **ADR-0024.** Four config axes in one shape. `AGENT_PLATFORM` covers every agent runtime.
  Amendment 2's `claude` default and the `SDD_HARNESS` legacy fallback are withdrawn. Amendment 1's
  per-stage selection moves to `sdd.roles`, whose `engine` names a platform provider.
- **ADR-0033.** Decision part 1 resolves through `sdd.roles['cold-review']`, with `engine` a key of
  `platform.providers`. The transport and the credential table are unchanged.

## Ratified points (maintainer, 2026-10-02)

These four points were open in the first draft. The maintainer ruled on each one.

1. **The runtime-detected VCS provider.** A CI-detected provider (ADR-0016's `ctx.provider`, for
   example `gitlab` on a GitLab job) is a fact about the host that the caller passes. It sits
   outside the env > `.env` > config precedence and is not a fifth level. It must still be a key of
   `vcs.providers`; if it is not, it is refused.
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
4. **`plain` stays a provider of `sdd`** (a valid SDD framework: the manual flow) **and leaves
   `platform`** (it is not an agent runtime that executes prompts).
