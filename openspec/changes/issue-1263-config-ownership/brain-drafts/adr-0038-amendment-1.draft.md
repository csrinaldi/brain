# ADR-0038 Amendment 1: a user layer below `.env`, the providers union, `locked`, and §4 enforced (issue #1263)

> **Tier 3 target. Not promoted, and an agent may not promote it.**
>
> ```
> npm run brain:promote -- openspec/changes/issue-1263-config-ownership/brain-drafts/adr-0038-amendment-1.draft.md
> ```
>
> **Your commit is the signature** (ADR-0028).

```brain-amendment/1
target: brain/project/decisions/adr-0038-one-config-shape-per-axis-default-and-providers.md
amendment: 1
issue: 1263
home-summary: the precedence gains the user layer `<BRAIN_HOME>/config.json` (else `~/.brain/config.json`) between `.env` and the team config — process env > `.env` > user > team > legacy alias > undeclared, VCS excepted; a machine's providers are the union of the team's and the user's, while the config's structure is validated on the team layer alone; a team `<axis>.locked: true` refuses a differing override from the user layer, `.env` and the process env once the team has declared a value; and §4's must-declare-`agent` rule is enforced by `validateAxisConfig` on a shaped `sdd` axis for every stage `sdd.roles` or `sdd.map` routes, with the 1.11.1 migration writing `brain:stage` for each custom routed stage other than `cold-review` (ADR-0040), #1263
body: ## Amendment 1 — a user layer below `.env`, the providers union, `locked`, and §4 enforced (issue #1263)
body-end: ### Notes for the promoter
```

```amend-find
  (for example `memory.lane`).
```

```amend-replace
  (for example `memory.lane`). **[Amended by Amendment 1 (#1263, ADR-0040): `locked` is one of them. It is a boolean, a key of the team layer only, and the user layer may never set it.]**
```

```amend-find
- **`default` must be a key of `providers`.** A config that names a default it does not list is
  invalid and is refused.
```

```amend-replace
- **`default` must be a key of `providers`.** A config that names a default it does not list is
  invalid and is refused. **[Amended by Amendment 1 (#1263, ADR-0040): this, and every other
  structural rule of this ADR (the shape, `sdd.roles`, the capabilities of section 5), is checked
  on the TEAM layer alone. The user layer never repairs the team's structure; the union of section 2
  checks only the value a machine selects.]**
```

```amend-find
3. `brain.config.json` `<axis>.default`, the team's choice;
4. otherwise **undeclared**.
```

```amend-replace
3. `brain.config.json` `<axis>.default`, the team's choice;
4. otherwise **undeclared**.

**[Amended by Amendment 1 (#1263, ADR-0040): the precedence is now process env > `.env` > the
user layer `<BRAIN_HOME>/config.json` (else `~/.brain/config.json`) > `brain.config.json`
`<axis>.default` > the read-only legacy alias > undeclared. When the team config sets
`<axis>.locked: true` and declares a non-empty default, a value from the user layer, `.env` or the
process env that differs from it is refused. VCS is still the exception: it has no `.env` level
and no user layer. See Amendment 1.]**
```

```amend-find
A value from any level that is not a key of `<axis>.providers` is invalid and is refused. It is
never coerced to another provider.
```

```amend-replace
A value from any level that is not a key of `<axis>.providers` is invalid and is refused. It is
never coerced to another provider. **[Amended by Amendment 1 (#1263, ADR-0040): on a machine,
`<axis>.providers` is the UNION of the team's and the user layer's, and the user layer's entry wins
for a provider both list, so its `version` is what that machine runs. VCS has no user layer, so its
providers are the team's.]**
```

```amend-find
`cold-review` and every custom stage are in this case under `gentle-ai`. Such a stage MUST give
`agent` explicitly in `sdd.roles`. A stage that does not is refused, and the message names the
stage.
```

```amend-replace
`cold-review` and every custom stage are in this case under `gentle-ai`. Such a stage MUST give
`agent` explicitly in `sdd.roles`. A stage that does not is refused, and the message names the
stage. **[Amended by Amendment 1 (#1263): enforced by `validateAxisConfig`
(`brain/scripts/lib/axis-config.mjs`), as an `invalid-config` refusal (`role-agent-required`) that
names the stage and the `brain:config -- set sdd.roles.<stage>.agent` fix. The rule applies to a
ROUTED stage: any key of `sdd.roles` or of `sdd.map`, `cold-review` included. A stage nothing
routes is not refused. It applies only when the `sdd` axis has this ADR's shape (`sdd.default` or
`sdd.providers` present); a legacy config is migrated first. The default role is read from the role
port (`declaredDefaultRole`, `axes/sdd-engine/role-port.mjs`), which counts no derived role. The
`brain` provider has no adapter yet, so its roles come from an explicit table, the seam #1132
replaces: `cold-review` for that stage, and `stage`, the generic custom-stage runner, for every
other custom stage. The 1.11.1 migration writes `sdd.roles.<stage>` as
`{ "agent": "brain:stage", engine, model }` for every custom stage `sdd.map` routes other than
`cold-review`, so its output passes this rule.]**
```

```amend-find
A stage absent from `roles` resolves all three fields by the cascade only when its provider declares a default role for it; `cold-review` or a custom stage absent from `roles` is refused (section 4).
```

```amend-replace
A stage absent from `roles` resolves all three fields by the cascade only when its provider declares a default role for it; `cold-review` or a custom stage absent from `roles` is refused (section 4). **[Amended by Amendment 1 (#1263): refused when the stage is routed, that is, named by `sdd.roles` or `sdd.map`. A custom stage declared in `sdd.stages` that neither names is not refused.]**
```

```amend-find
- **A new consumer:** `env:init` declares each axis's default or asks for it, as it does for
  `memory` today.
```

```amend-replace
- **A new consumer:** `env:init` declares each axis's default or asks for it, as it does for
  `memory` today. **[Amended by Amendment 1 (#1263, ADR-0040 section 4): `env:init` declares the
  team config only in the FOUNDING run, the one that creates `brain.config.json`. It then declares a
  `default` for every axis, except that a no-TTY foundation leaves `memory` undeclared. In an existing
  repository `env:init` writes the user layer only, and an undeclared team axis is refused with the
  named fix.]**
```

## Amendment 1 — a user layer below `.env`, the providers union, `locked`, and §4 enforced (issue #1263)

**Signed**: DD/MM/YYYY — <Name>

### What changed

ADR-0040 names this ADR in "Amendments this requires". What is on the
`feature/issue-1114-axis-ports` tracker now:

- **The user layer.** `lib/user-config.mjs` reads `<BRAIN_HOME>/config.json`, or
  `<os.homedir()>/.brain/config.json` when `BRAIN_HOME` is unset. Under a test it refuses to read the
  real home directory. `resolveAxis` (`brain/scripts/lib/axis-config.mjs`) takes it as an injected
  input. The precedence for `memory`, `platform` and `sdd` is the process env, `.env`, the user
  layer's `<axis>.default`, the team's `<axis>.default`, the read-only legacy alias, then undeclared.
  VCS keeps its own: the process env, `vcs.default`, the legacy `vcs.provider`, then undeclared, with
  no `.env` level and no user layer. A CI-detected provider still sits outside the precedence
  (Ratified point 1).
- **The providers union.** The value a machine selects is checked against the team's
  `<axis>.providers` plus the user layer's. For a provider both list, the user's entry wins, so its
  `version` is what that machine runs. `diagnoseAxes` reports a difference from the team's `version`
  as a mismatch.
- **Team-only structural validation.** `validateUserConfig` checks only what no union could repair:
  a `locked` key, a `providers` that is not a map, a `default` that is not a string. Everything else is
  `validateAxisConfig`'s, run on the team config alone. A user layer never makes an invalid team
  config valid.
- **`locked`.** `<axis>.locked` is a boolean on the team layer, refused when it is not one.
  `resolveAxis` applies it only when the team has declared a non-empty default. It then refuses, as
  `AxisRefusal` code `locked`, a user-layer, `.env` or process-env value that differs from the team's.
  The fix names `governance.owners` and a PR. A new adoption is written with `memory` and `sdd`
  locked. The 1.11.1 migration writes `locked: false` on an existing consumer's `memory`, `platform`
  and `sdd`.
- **§4 is enforced.** `validateAxisConfig` refuses a routed stage that gives no `agent` when
  `sdd.default` declares no default role for it. A routed stage is any key of `sdd.roles` or of
  `sdd.map`, `cold-review` included. The rule runs only on a shaped `sdd` axis (`sdd.default` or
  `sdd.providers` present): a legacy config is not checked, it is migrated first. The refusal is
  `role-agent-required`, catalogued in `en` and `es`, and it names the stage and the `brain:config`
  fix. The default role comes from the role port's `declaredDefaultRole`
  (`axes/sdd-engine/role-port.mjs`), which is injected so the validator stays pure. It counts no
  `derived: true` role.
- **The `brain` provider's roles, and the migration (maintainer ruling, 2026-10-04).** `brain`
  declares `cold-review` for that stage and `stage`, its generic custom-stage runner (run stage X
  with engine Y), for every other custom stage; it declares no lifecycle role. The 1.11.1 migration
  writes `sdd.roles.<stage>` as `{ "agent": "brain:stage", engine, model }` for every custom stage
  `sdd.map` routes other than `cold-review`, which keeps `brain:cold-review`. It keeps an existing
  role, stays idempotent and prints each role it writes. Without this, an existing consumer with a
  custom routed stage would have been refused on upgrade, against §7. This repository's config, and
  the migration's output for a fresh consumer, a GitLab consumer, a `plain` platform, an
  `antigravity` platform and a custom `lint` stage, all pass.

### Why

ADR-0040 ruled that a person's tools belong in a layer of their own, not in the team's file or a
per-worktree `.env`. It also ruled that a team can lock an axis against every override, the process
env included (its Ratified point 5). Both change this ADR's precedence. Section 4 decided the
must-declare-`agent` rule, but nothing enforced it. A `cold-review` entry without `agent` validated
cleanly and then had no defined agent.

### What this does NOT change

The shape of section 1, the four axes, the refusal when an axis is undeclared, the capabilities of
section 5, the version states of section 6, and VCS's exception at the `.env` level.

### What the code does not do yet, said plainly

- **A lock on an undeclared axis binds nothing.** A no-TTY foundation locks `memory` and leaves it
  undeclared. A per-machine value still runs there, and the gap is reported only by the
  `axis-undeclared` finding.
- **§4 is checked against the team's `sdd.default` only.** On a free `sdd` axis, a machine that
  overrides `sdd.default` to another provider is not re-checked against that provider's roles.
- **An explicit `agent` is checked by its provider part only.** The role part, the `cold-review` in
  `brain:cold-review`, is not looked up.
- **The `brain` provider's roles are a hand-kept table.** `BRAIN_PROVIDER_ROLES` in `role-port.mjs`
  names `cold-review` and the generic `stage`. #1132 replaces it with an inhabitant that declares
  through the port.
- **A legacy config is not checked by §4.** Until the migration runs, a config with no `sdd` shape
  can route a stage with no defined agent, and nothing says so.
- **The runner still reads `sdd.map`.** The rule validates the declaration. Routing through
  `sdd.roles` is #1132's.
- **The user file has no schema version and no migration.** ADR-0040 leaves that open.
- **The alias windows are not closed,** and `version` is compared as an exact string. Range
  semantics and probes are #1130's.

### Notes for the promoter

Seven in-place annotations: the axis-level settings bullet and the `default`-in-`providers` bullet of
§1, the precedence list and the providers sentence of §2, §4's must-declare-`agent` paragraph, the
cascade sentence after the Example, and §7's "A new consumer" bullet. ADR-0038 has no amendment
today, so this is number 1. Sources: ADR-0040 ("Amendments this requires", ADR-0038), #1263, and the
commit that enforces §4 on this branch (`fix(config): a stage with no default role must declare its
agent`).
