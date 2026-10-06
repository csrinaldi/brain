# ADR-0008 Amendment 2: the VCS selector takes the ADR-0038 shape, and still has no `.env` level (issue #1263)

> **Tier 3 target. Not promoted, and an agent may not promote it.**
>
> ```
> npm run brain:promote -- openspec/changes/issue-1263-config-ownership/brain-drafts/adr-0008-amendment-2.draft.md
> ```
>
> **Your commit is the signature** (ADR-0028).

```brain-amendment/1
target: brain/project/decisions/adr-0008-adapter-vcs-provider.md
amendment: 2
issue: 1263
home-summary: the selector is `vcs.default` plus `vcs.providers` (ADR-0038), with `vcs.provider` a read-only alias for one minor; VCS keeps no `.env` level and gets no user layer (ADR-0040), and the CI-detected provider sits outside the precedence and needs only a shipped adapter, #1114, #1263
body: ## Amendment 2 — the VCS selector takes the ADR-0038 shape, and still has no `.env` level (issue #1263)
body-end: ### Notes for the promoter
```

```amend-find
- **Explicit repo-level selector**: `vcs.provider` in `brain.config.json` (not in `.env`, not auto-derived from `gitHost`).
```

```amend-replace
- **Explicit repo-level selector**: `vcs.provider` in `brain.config.json` (not in `.env`, not auto-derived from `gitHost`). **[Amended by Amendment 2 (#1114, #1263): the key is now `vcs.default`, a key of `vcs.providers` (ADR-0038); `vcs.provider` is read as a read-only alias for one minor version. The "not in `.env`" rule stands, and VCS has no user layer either (ADR-0040). See Amendment 2.]**
```

```amend-find
  { "vcs": { "provider": "github" } }   // github | gitlab | ...
```

```amend-replace
  { "vcs": { "provider": "github" } }   // github | gitlab | ...  [Amendment 2: { "vcs": { "default": "github", "providers": { "github": {} } } }]
```

```amend-find
- **Dispatcher**: `scripts/vcs/cli.mjs` reads `vcs.provider` and delegates
```

```amend-replace
- **Dispatcher**: `scripts/vcs/cli.mjs` reads `vcs.provider` **[amended by Amendment 2 (#1114, #1263): through `resolveAxis('vcs', …)`, which reads the process env `VCS_PROVIDER`, then `vcs.default`, then the `vcs.provider` alias; a CI-detected provider wins outside that precedence]** and delegates
```

## Amendment 2 — the VCS selector takes the ADR-0038 shape, and still has no `.env` level (issue #1263)

**Signed**: DD/MM/YYYY — <Name>

### What changed

ADR-0038 names this ADR in "Amendments this requires". What is on the
`feature/issue-1114-axis-ports` tracker now:

- **The shape.** The provider is `vcs.default`, a key of `vcs.providers` (ADR-0038 §1). The 1.11.1
  migration (`brain/core/config-migrations.mjs`) moves an existing `vcs.provider` into it, and an
  empty one stays undeclared (`"default": ""`). `brain:config -- set vcs.default <name>` also creates
  `vcs.providers.<name>` as `{}` and, during the alias window, keeps `vcs.provider` in step.
- **One resolver.** `vcs/cli.mjs`'s `resolveProviderName` is a thin caller of `resolveAxis`
  (`brain/scripts/lib/axis-config.mjs`). The precedence is the process env `VCS_PROVIDER`, then
  `vcs.default`, then the `vcs.provider` alias, then undeclared, which is refused with
  `npm run brain:config -- set vcs.default <github|gitlab>`.
- **No `.env` level and no user layer.** `resolveAxis` never reads `.env` or the user layer for
  `vcs`, and `validateUserConfig` ignores a `vcs` key in `<BRAIN_HOME>/config.json`. The rule this
  ADR's Context states, that the provider is dictated by where the repository lives, is kept by
  ADR-0038 §2 and ADR-0040 §3.
- **The CI-detected provider.** When the caller passes a runtime-detected provider (ADR-0016's
  `ctx.provider`), it wins and is outside the precedence. It must be a provider brain ships an adapter
  for (`github` or `gitlab`), and it does not need to be a key of `vcs.providers` (ADR-0038 Ratified
  point 1). A GitLab CI job on a mirror of a GitHub-configured repository therefore dispatches to
  `gitlab`.

### Why

ADR-0038 gives every axis one shape and one resolver. VCS is the one axis whose precedence keeps
fewer levels, for the reason this ADR already gave: there is no per-developer freedom over where the
repository lives.

### What this does NOT change

The verb contract, the adapter directory, credentials in `.env` (`VCS_TOKEN`), and the explicit
selector over a value derived from `gitHost`.

### What the code does not do yet, said plainly

- **The alias window is not closed.** Nothing yet refuses `vcs.provider` after one minor version.
- **The process env still overrides.** `VCS_PROVIDER` in the process env wins over `vcs.default`.
  ADR-0038 §2 keeps that level for a per-run override. `locked` is not written for `vcs` by the
  migration or by a new adoption.

### Notes for the promoter

Three in-place annotations: the Selector bullet, the JSON example inside it, and the Dispatcher
bullet. Amendment 1 is the latest amendment today, so this is number 2. Sources: ADR-0038
("Amendments this requires", ADR-0008, and Ratified point 1), ADR-0040 §3, #1114, #1263.
