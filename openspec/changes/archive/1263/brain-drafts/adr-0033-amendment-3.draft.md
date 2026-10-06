# ADR-0033 Amendment 3: part 1 resolves through `sdd.roles['cold-review']`, with `engine` a platform provider (issue #1263)

> **Tier 3 target. Not promoted, and an agent may not promote it.**
>
> ```
> npm run brain:promote -- openspec/changes/issue-1263-config-ownership/brain-drafts/adr-0033-amendment-3.draft.md
> ```
>
> **Your commit is the signature** (ADR-0028).

```brain-amendment/1
target: brain/project/decisions/adr-0033-cold-review-transport.md
amendment: 3
issue: 1263
home-summary: decision part 1 becomes `sdd.roles['cold-review'] → { agent: "brain:cold-review", engine, model }`, with `engine` a key of `platform.providers` that can execute a stage prompt (ADR-0038); the declaration, its migration and its validation shipped, the runner still reads `sdd.map` until #1132; parts 2-4, the transport and the credential table are unchanged, #1114, #1263
body: ## Amendment 3 — part 1 resolves through `sdd.roles['cold-review']`, with `engine` a platform provider (issue #1263)
body-end: ### Notes for the promoter
```

```amend-find
1. **Resolution.** `sdd.map['cold-review'] → { engine, model }`. `model` is a
   pass-through:
```

```amend-replace
1. **Resolution.** `sdd.map['cold-review'] → { engine, model }`. **[Amended by Amendment 3
   (#1114, #1263): the declared target is `sdd.roles['cold-review'] → { agent, engine, model }`,
   with `agent` = `"brain:cold-review"` and `engine` a key of `platform.providers` that can execute
   a stage prompt (ADR-0038). The runner still reads `sdd.map` until #1132; see Amendment 3.]**
   `model` is a pass-through:
```

## Amendment 3 — part 1 resolves through `sdd.roles['cold-review']`, with `engine` a platform provider (issue #1263)

**Signed**: DD/MM/YYYY — <Name>

### What changed

ADR-0038 names this ADR in "Amendments this requires". Decision part 1, `sdd.map['cold-review'] →
{ engine, model }`, becomes `sdd.roles['cold-review'] → { agent, engine, model }`:

- `agent` is `"brain:cold-review"`: the role, declared by brain's own SDD provider `brain`
  (ADR-0023 Amendment 2).
- `engine` is a key of `platform.providers`: the runtime that executes the stage, for example `codex`.
  It must declare the ability to execute a stage prompt. `plain` and `antigravity` cannot.
- `model` stays an opaque pass-through, as decided.

What is on the `feature/issue-1114-axis-ports` tracker:

- The 1.11.1 migration (`brain/core/config-migrations.mjs`) writes `sdd.roles['cold-review']` from
  `sdd.map['cold-review']`, and adds the routed runtime to `platform.providers` as `{}`. This
  repository's own `codex` route is migrated that way.
- `validateAxisConfig` (`brain/scripts/lib/axis-config.mjs`) refuses a `cold-review` entry whose
  `agent` provider is not a key of `sdd.providers`, or whose `engine` is not a key of
  `platform.providers` or cannot execute a stage prompt (`PLATFORM_CAPABILITIES`).

### Why

`engine` meant two things in one field: an SDD framework for a lifecycle stage, and a runtime for
`cold-review`. ADR-0038 separates them. #833's option C, where the SDD framework holds the transport,
is not taken. The field split replaces it.

### What this does NOT change

Parts 2-4: spawning through the harness, a file as the output, and only `brain:review` touching the
forge. The warrant table, the credential channels, and Amendments 1 and 2 are unchanged.

### What the code does not do yet, said plainly

- **The runner still reads `sdd.map`.** `review/lib/run-cold-review-stage.mjs` resolves the stage with
  `resolveStageEngine(config, 'cold-review')` over `sdd.map`, and still branches on `codex`/`gemini`
  by name to choose the final-message output. `brain:review --engine/--model` override
  `sdd.map['cold-review']`, not `sdd.roles`. `sdd.roles['cold-review']` is declared, migrated and
  validated, and read by nothing that routes. Moving the reader is #1132, and dropping the name branch
  is #1129.
- **Nothing resolves `brain:cold-review` to a role instance.** The Adversary instance for the stage
  still comes from `roles/first-party/`, as before.

### Notes for the promoter

One in-place annotation of decision part 1. Amendment 2 is the latest amendment today, so this is
number 3. Sources: ADR-0038 §4, §5, §7, "Amendments this requires" (ADR-0033); #1114, #1263.
