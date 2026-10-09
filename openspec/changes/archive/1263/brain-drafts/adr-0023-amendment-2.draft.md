# ADR-0023 Amendment 2: the shelf is the SDD provider `brain`, and stage routing lives in `sdd.roles` (issue #1263)

> **Tier 3 target. Not promoted, and an agent may not promote it.**
>
> ```
> npm run brain:promote -- openspec/changes/issue-1263-config-ownership/brain-drafts/adr-0023-amendment-2.draft.md
> ```
>
> **Your commit is the signature** (ADR-0028).

```brain-amendment/1
target: brain/project/decisions/adr-0023-sdd-role-port.md
amendment: 2
issue: 1263
home-summary: the first-party shelf is declared as the SDD provider `brain` (`"version": "self"`), and stage → role routing, model included, lives in `sdd.roles`, where cold-review's agent is `brain:cold-review` (ADR-0038); the declaration and its validation shipped, the routing reader is #1132's, #1114, #1263
body: ## Amendment 2 — the shelf is the SDD provider `brain`, and stage routing lives in `sdd.roles` (issue #1263)
body-end: ### Notes for the promoter
```

```amend-find
- `roles/first-party/` — brain's own role content: the four archetypes and
  their instances; `brain:engines` surveys; `brain:config` writes.
```

```amend-replace
- `roles/first-party/` — brain's own role content: the four archetypes and
  their instances; `brain:engines` surveys; `brain:config` writes.
  **[Amended by Amendment 2 (#1114, #1263): this shelf is declared in config as the SDD provider
  `brain`, `sdd.providers.brain = { "version": "self" }` (ADR-0038). Its content still lives here.]**
```

```amend-find
   `plain`, a future `brain-sdd-engine`).
```

```amend-replace
   `plain`, a future `brain-sdd-engine`). **[Amended by Amendment 2 (#1263): that framework is the
   SDD provider `brain` (ADR-0038). It is a key of `sdd.providers` today, not yet an adapter or a
   selectable `sdd.default`.]**
```

```amend-find
   space; `model` is OMITTED — tier and selection belong to routing, and a
```

```amend-replace
   space; `model` is OMITTED — tier and selection belong to routing **[Amendment 2 (#1263): routing
   is `sdd.roles.<stage>` = `{ agent, engine, model }`, ADR-0038 §4]**, and a
```

## Amendment 2 — the shelf is the SDD provider `brain`, and stage routing lives in `sdd.roles` (issue #1263)

**Signed**: DD/MM/YYYY — <Name>

### What changed

ADR-0038 names this ADR in "Amendments this requires".

- **The shelf has a provider name.** Brain's first-party roles are the SDD provider `brain`. The
  1.11.1 migration (`brain/core/config-migrations.mjs`) writes `sdd.providers.brain` as
  `{ "version": "self" }` on every consumer. `"self"` is the installed brain package's version, the
  one version a migration may write (ADR-0038 Ratified point 3).
- **Routing is `sdd.roles`.** Stage → role routing, including the `model` that decision 4 leaves to
  routing, is `sdd.roles.<stage>` = `{ agent: "<sdd provider>:<role>", engine: "<platform provider>",
  model }`. The provider part of `agent` names the framework that declares the role. `engine` names
  the runtime that executes it.
- **cold-review.** The migration writes `sdd.roles['cold-review'].agent` as `"brain:cold-review"`,
  with the `engine` and `model` it finds in `sdd.map['cold-review']`.
- **Validation.** `validateAxisConfig` (`brain/scripts/lib/axis-config.mjs`) refuses an `agent` whose
  provider is not a key of `sdd.providers`, and an `engine` that is not a key of `platform.providers`
  or cannot execute a stage prompt.

### Why

ADR-0038 ends the two meanings of "engine" in one field: the framework that declares a role is the
`agent`'s provider, and the runtime is the `engine`. Several SDD providers then coexist, with one of
them as `sdd.default`, and the shelf gets a name without displacing `gentle-ai`.

### What this does NOT change

The `declareRoles` contract, the archetype layer, the four archetypes, projection, and decision 1's
rule that frameworks declare and platforms receive.

### What the code does not do yet, said plainly

- **No `brain` adapter exists.** `axes/sdd-engine/adapters/` holds `gentle-ai` and `plain`. `brain` is
  not a member of `SDD_ENGINES`, so `sdd.default: "brain"` or `SDD_ENGINE=brain` is refused.
- **Nothing routes by `sdd.roles` yet.** The cold-review stage still resolves through
  `sdd.map['cold-review']` (`resolveStageEngine`, `review/lib/run-cold-review-stage.mjs`). Nothing
  resolves `brain:cold-review` to the `adversary-cold-review` instance. The reshape and its reader
  are #1132.
- **The `agent` cascade is not checked.** ADR-0038 §4 refuses a stage with no default role that gives
  no `agent`. `validateAxisConfig` does not implement that rule yet.

### Notes for the promoter

Three in-place annotations: the `roles/first-party/` Context bullet, decision 1's "future
`brain-sdd-engine`", and decision 4's "belong to routing". Amendment 1 is the latest amendment today,
so this is number 2. Sources: ADR-0038 §4, §7, Ratified point 3, "Amendments this requires"
(ADR-0023); #1114, #1263.
