# ADR-0004 Amendment 4: the memory axis takes the ADR-0038 shape, a lock refuses every override, and only a foundation declares it (issue #1263)

> **Tier 3 target. Not promoted, and an agent may not promote it.**
>
> ```
> npm run brain:promote -- openspec/changes/issue-1263-config-ownership/brain-drafts/adr-0004-amendment-4.draft.md
> ```
>
> **Your commit is the signature** (ADR-0028).

```brain-amendment/1
target: brain/project/decisions/adr-0004-adapter-memoria-memory-backend.md
amendment: 4
issue: 1263
home-summary: the selector is `memory.default` plus `memory.providers` (ADR-0038), with `memory.backend` a read-only alias for one minor; a user layer sits between `.env` and the team config; a `locked` memory axis refuses a differing override from the user layer, `.env` and the process env; and env:init declares the backend only in the founding run, a no-TTY foundation leaving it undeclared (ADR-0040), #1114, #1263
body: ## Amendment 4 — the memory axis takes the ADR-0038 shape, a lock refuses every override, and only a foundation declares it (issue #1263)
body-end: ### Notes for the promoter
```

```amend-find
`MEMORY_BACKEND` in the process env or `.env` remains a per-run / per-machine override that wins over the config. The sentence above is what this ADR decided on 2026-06-26, kept as the record.]**
```

```amend-replace
`MEMORY_BACKEND` in the process env or `.env` remains a per-run / per-machine override that wins over the config. The sentence above is what this ADR decided on 2026-06-26, kept as the record.]** **[Amended by Amendment 4 (#1114, #1263): the key is now `memory.default` plus `memory.providers` (ADR-0038), and `memory.backend` is read as a read-only alias for one minor version. A per-run or per-machine override wins only while `memory.locked` is not `true` (ADR-0040). See Amendment 4.]**
```

```amend-find
process env `MEMORY_BACKEND`, then `.env`, then `brain.config.json` `memory.backend`; refuses when none declares one)
```

```amend-replace
process env `MEMORY_BACKEND`, then `.env`, then `brain.config.json` `memory.backend`; refuses when none declares one. **[Amended by Amendment 4 (#1114, #1263): today the one resolver is `resolveAxis` (`brain/scripts/lib/axis-config.mjs`), and the levels are the process env, `.env`, the user layer `<BRAIN_HOME>/config.json`, then `memory.default` (alias `memory.backend`); a locked axis refuses a differing value at every level above the team's.]**)
```

```amend-find
- **Where it lives.** `memory.backend` in the tracked `brain.config.json` is the team's declaration.
```

```amend-replace
- **Where it lives.** `memory.backend` in the tracked `brain.config.json` is the team's declaration. **[Amended by Amendment 4 (#1114, #1263): the declaration is `memory.default`, with the backend listed under `memory.providers`; `memory.backend` stays a read-only alias for one minor version.]**
```

```amend-find
named by the process env or `.env` is an operator's statement and is never overridden.
```

```amend-replace
named by the process env or `.env` is an operator's statement and is never overridden. **[Amended by Amendment 4 (#1263, ADR-0040): this holds only while `memory` is not locked. With `memory.locked: true` and a declared team default, a process-env, `.env` or user-layer value that differs from it is refused, naming the fix.]**
```

```amend-find
- **Adoption.** New consumers declare it at `env:init` (a prompt on a TTY; with no TTY it skips
  memory setup and records the missing declaration).
```

```amend-replace
- **Adoption.** New consumers declare it at `env:init` (a prompt on a TTY; with no TTY it skips
  memory setup and records the missing declaration). **[Amended by Amendment 4 (#1263, ADR-0040):
  the prompt runs only in the FOUNDING run, the one that created `brain.config.json`. A no-TTY
  foundation leaves `memory.default` as `""`, never guessed, and `diagnoseAxes` reports it as an
  ERROR until someone chooses. In an existing repository `env:init` neither prompts nor writes the
  team config: an undeclared backend is refused with the named fix.]**
```

## Amendment 4 — the memory axis takes the ADR-0038 shape, a lock refuses every override, and only a foundation declares it (issue #1263)

**Signed**: DD/MM/YYYY — <Name>

### What changed

ADR-0038 and ADR-0040 each name this ADR in "Amendments this requires". What is on the
`feature/issue-1114-axis-ports` tracker now:

- **The shape.** The team declares the backend as `memory.default`, a key of `memory.providers`
  (ADR-0038 §1). The 1.11.1 migration (`brain/core/config-migrations.mjs`, `migrateToAxisShape`)
  moves an existing `memory.backend` into it. An empty `memory.backend` stays undeclared
  (`"default": ""`). `brain:config -- set memory.default <name>` also creates
  `memory.providers.<name>` as `{}`.
- **The alias.** `memory.backend` is still read when the shape has no default
  (`readAxis`, `brain/scripts/lib/axis-config.mjs`). During the alias window
  `brain:config -- set memory.default` writes it as well, for the readers not yet moved.
- **One resolver.** `memory/lib/backend-resolve.mjs` is now a thin caller of `resolveAxis`. The
  precedence is the process env `MEMORY_BACKEND`, then `.env`, then the user layer
  (`<BRAIN_HOME>/config.json`, else `~/.brain/config.json`, read by `lib/user-config.mjs`), then
  `memory.default`, then undeclared. A value that is not a key of the union of the team's and the
  user's `memory.providers` is refused, never coerced.
- **`locked`.** When the team config declares `memory.locked: true` and a non-empty default, a
  value from the user layer, `.env` or the process env that differs from that default is refused
  (`AxisRefusal` code `locked`), and the fix names `governance.owners` and
  `brain:config -- set memory.default <name>` in a PR. A new adoption is written with
  `memory.locked: true` (`NEW_CONSUMER_DEFAULTS`). The 1.11.1 migration writes `memory.locked: false`
  on an existing consumer, so nothing it runs changes.
- **Adoption.** `bootstrap.sh` decides once whether the run is a foundation (`ensure --founding-file`).
  Only a founding run prompts for the backend, on a TTY, and writes `memory.default`. With no TTY the
  foundation leaves it `""`, and `diagnoseAxes` reports `axis-undeclared` with ERROR severity. An
  existing repository with no declared backend is refused with the named fix, with no prompt and no
  write.

### Why

ADR-0038 gives every axis one shape and one resolver. ADR-0040 ruled that a different memory backend,
even for one run, splits the team's shared index, so a lock must refuse the process env too
(Ratified point 5). It also ruled that daily `env:init` writes no team config (section 4). Amendment 3's
rule that an env value "is an operator's statement" was written before either existed.

### What this does NOT change

The dispatcher, the backend directory, the verbs, the canonical `.memory/` directory, and Amendment 3's
"no default" rule.

### What the code does not do yet, said plainly

- **The alias window is not closed.** Nothing yet refuses `memory.backend` after one minor version.
  The refusals in `backend-resolve.mjs` (`DECLARE_FIX`) and in `bootstrap.sh` still name
  `brain:config -- set memory.backend …`, the alias, not `memory.default`.
- **A lock on an undeclared axis refuses nothing.** `resolveAxis` applies `locked` only when the team
  default is non-empty. A no-TTY foundation is therefore locked and undeclared: a per-machine value
  still runs there, and the gap is reported only by the `axis-undeclared` finding.
- **An override equal to the team's value is not refused.** It is not an override, and `bootstrap.sh`
  exports the resolved value into the process env.

### Notes for the promoter

Five in-place annotations: the Selector line, the Dispatcher precedence, and Amendment 3's
"Where it lives", "operator's statement" and "Adoption" bullets. Amendment 3 is the latest amendment
today, so this is number 4. Sources: ADR-0038 ("Amendments this requires", ADR-0004), ADR-0040
(same section, ADR-0004), #1114, #1263.
