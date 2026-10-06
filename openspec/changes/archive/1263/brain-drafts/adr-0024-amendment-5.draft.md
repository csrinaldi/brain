# ADR-0024 Amendment 5: four config axes in one shape, `platform.default` is the orchestrator, and the `claude` default is withdrawn (issue #1263)

> **Tier 3 target. Not promoted, and an agent may not promote it.**
>
> ```
> npm run brain:promote -- openspec/changes/issue-1263-config-ownership/brain-drafts/adr-0024-amendment-5.draft.md
> ```
>
> **Your commit is the signature** (ADR-0028).

```brain-amendment/1
target: brain/project/decisions/adr-0024-three-axis-decoupling.md
amendment: 5
issue: 1263
home-summary: four config axes (`vcs`, `memory`, `platform`, `sdd`) in one `{ default, providers }` shape and one resolver (ADR-0038); `platform.providers` covers every agent runtime and `platform.default` (`AGENT_PLATFORM`) is the one orchestrator per session, which must declare `orchestrate`, `plain` included; `resolveAxis` has no `claude` default, and the `SDD_HARNESS` fallback is an alias withdrawn after one minor; per-stage selection moves to `sdd.roles`, whose `engine` names a platform provider, #1114, #1263
body: ## Amendment 5 — four config axes in one shape, `platform.default` is the orchestrator, and the `claude` default is withdrawn (issue #1263)
body-end: ### Notes for the promoter
```

```amend-find
> The harness selection is split into **three orthogonal axes**, each resolved independently from
> `.env` / `brain.config.json`:
```

```amend-replace
> The harness selection is split into **three orthogonal axes**, each resolved independently from
> `.env` / `brain.config.json`:
> **[Amended by Amendment 5 (#1114, #1263): there are now FOUR config axes, `vcs`, `memory`,
> `platform` and `sdd`, each `{ "default", "providers" }` in `brain.config.json` and each resolved by
> one `resolveAxis` (ADR-0038). See Amendment 5.]**
```

```amend-find
> `SDD_HARNESS` is retained only as a **legacy fallback** for `AGENT_PLATFORM`/`SDD_ENGINE` when the
> new variables are absent.
```

```amend-replace
> `SDD_HARNESS` is retained only as a **legacy fallback** for `AGENT_PLATFORM`/`SDD_ENGINE` when the
> new variables are absent.
> **[Amended by Amendment 5 (#1114, #1263): the fallback is a read-only alias for one minor version,
> then withdrawn (ADR-0038 §7). Until then `resolveAxis` reads it last, below `<axis>.default`, and
> reports every use.]**
```

```amend-find
- **[Amended by Amendment 2 (#1125): the default is now `claude`, and `antigravity` is the second supported platform. The sentence below is what this ADR decided on 2026-07-24, kept as the record.]**
```

```amend-replace
- **[Amended by Amendment 2 (#1125): the default is now `claude`, and `antigravity` is the second supported platform. The sentence below is what this ADR decided on 2026-07-24, kept as the record.]** **[Amended by Amendment 5 (#1114, #1263): no resolver has a platform default any more. An undeclared platform is refused, naming `brain:config -- set platform.default <name>` (ADR-0038 §3).]**
```

```amend-find
**The default `AGENT_PLATFORM` is `claude`.** A repo that states no platform gets `claude`
from every resolver: `harness/platform.mjs#resolvePlatform` and `bootstrap.sh` §6.
```

```amend-replace
**The default `AGENT_PLATFORM` is `claude`.** A repo that states no platform gets `claude`
from every resolver: `harness/platform.mjs#resolvePlatform` and `bootstrap.sh` §6.
**[Withdrawn by Amendment 5 (#1114, #1263): `resolvePlatform` is a thin caller of `resolveAxis`,
which refuses an undeclared platform. `env:init` declares `claude` as the starting value only in
the founding run, and writes no `AGENT_PLATFORM` into `.env`.]**
```

```amend-find
The three axes, their names, their precedence and their reach. `SDD_ENGINE` still selects the
engine; what #323 adds is that the selection may vary **per stage** rather than per repo.
```

```amend-replace
The three axes, their names, their precedence and their reach. `SDD_ENGINE` still selects the
engine; what #323 adds is that the selection may vary **per stage** rather than per repo.
**[Amended by Amendment 5 (#1263): per-stage selection lives in `sdd.roles.<stage>`, whose `engine`
names a platform provider, the runtime, not an `SDD_ENGINE` framework (ADR-0038 §4).]**
```

## Amendment 5 — four config axes in one shape, `platform.default` is the orchestrator, and the `claude` default is withdrawn (issue #1263)

**Signed**: DD/MM/YYYY — <Name>

### What changed

ADR-0038 names this ADR in "Amendments this requires". What is on the
`feature/issue-1114-axis-ports` tracker now:

- **Four config axes, one shape.** `vcs`, `memory`, `platform` and `sdd` are each
  `{ "default", "providers" }` in `brain.config.json`. One resolver, `resolveAxis`
  (`brain/scripts/lib/axis-config.mjs`), replaces `resolvePlatform`'s and `resolveEngine`'s own
  precedence. Both are now thin callers of it. The precedence is the process env, then `.env`, then
  the user layer `<BRAIN_HOME>/config.json` (ADR-0040), then `<axis>.default`, then the legacy alias,
  then undeclared. VCS keeps no `.env` or user level (ADR-0008 Amendment 2).
- **`platform.providers` covers every agent runtime.** `claude`, `antigravity`, `plain`, `codex` and
  `gemini` each have a capability entry in `PLATFORM_CAPABILITIES`: `orchestrate`, and
  `executeStage`, the ability to execute a stage prompt.
- **`platform.default` is the orchestrator.** There is one per session. `validateAxisConfig` refuses
  a `platform.default` that does not declare `orchestrate`. `plain` stays, as the human orchestrator:
  it orchestrates and cannot execute a stage prompt (ADR-0038 Ratified point 4).
- **`AGENT_PLATFORM` selects only the orchestrator.** Its value is checked against the members brain
  ships a workspace adapter for (`claude`, `antigravity`, `plain`) and against the providers this
  machine lists. `AGENT_PLATFORM=codex` is refused.
- **No `claude` default.** Amendment 2's default is withdrawn. An undeclared platform or SDD engine
  is refused with the command that declares it. `env:init` declares `claude` and `gentle-ai` as
  starting values only in the founding run, the one that created `brain.config.json`. In an existing
  repository with no `platform.default` it writes `claude` into the person's user layer, never into the
  team config. It no longer writes `AGENT_PLATFORM` into `.env`.
- **The `SDD_HARNESS` fallback is an alias.** `resolveAxis` still reads `SDD_HARNESS` / `harness`
  last, only for a member of the axis being resolved, and prints a notice on every use. It is
  withdrawn after the one-minor alias window (ADR-0038 §7).
- **Per-stage selection moves to `sdd.roles`.** Amendment 1's "per stage rather than per repo" is
  `sdd.roles.<stage>.engine`, a key of `platform.providers` that can execute a stage prompt. The
  framework that declares the role is the provider part of `agent`.

### Why

ADR-0038 measured four resolvers, three precedences and three answers to "undeclared": refuse,
throw or guess. A default in code is a choice the team never made: a fresh clone runs what the code
guesses, and nobody is told. ADR-0004 Amendment 3 already ruled this for memory.

### What this does NOT change

ADR-0019's neutral artifact lifecycle; the separation of framework (`SDD_ENGINE`) from runtime
(`AGENT_PLATFORM`); the env key names.

### What the code does not do yet, said plainly

- **The capability table is a seam.** `PLATFORM_CAPABILITIES` lives in `axis-config.mjs`, not in each
  adapter. #1128 and #1129 move it.
- **The runtime adapters are still two directories.** `axes/platform/adapters/` and
  `axes/review-engine/adapters/` are not merged.
- **Nothing routes by `sdd.roles` yet.** The cold-review stage still resolves through `sdd.map`
  (`resolveStageEngine`) and branches on `codex`/`gemini` by name
  (`review/lib/run-cold-review-stage.mjs`). The reshape is #1132.
- **The alias window is not closed.** Nothing yet refuses the flat `engine`/`harness` keys or
  `SDD_HARNESS` after one minor version.
- **`day-start.mjs`'s direct `gentle-ai` calls** (Amendment 2's "Known state") stay #1114's and
  #1115's. One resolver does not remove a call that bypasses it.

### Notes for the promoter

Five in-place annotations: the Decision's "three orthogonal axes", its `SDD_HARNESS` fallback, the
Amendment 2 bracket in Consequences, Amendment 2's "default is `claude`" paragraph, and Amendment 1's
"per stage" sentence. Amendment 4 is the latest amendment today, so this is number 5. Sources:
ADR-0038 §§1-5, §7, Ratified point 4, "Amendments this requires" (ADR-0024); ADR-0040 §§1-4; #1114,
#1263.
