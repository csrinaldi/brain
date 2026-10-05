# ADR-0008 — VCS Adapter: explicit provider + verb contract

**Status**: Accepted · **amended 04/10/2026** (Amendments 1-2 — see below)
**Date**: 2026-06-26

## Context

The harness scripts (`ticket-start`, `tracker-board`, `project-status`, `day-start`, `bootstrap.sh`) are coupled to GitLab: they invoke `glab` and the REST API `/api/v4/` directly, hardcoding GitLab-only concepts (`iid`, `oauth2:` in the authenticated URL, pipeline status enum, `merge_requests`/`!NNN`). The brain repo itself lives on GitHub, so that flow does not work here.

ADR-0007 already made the **configuration** VCS-agnostic (`gitHost`, `slug`, `owner` in `brain.config.json`), but **execution** is still tied to a specific tool. The adapter that allows the same repo to operate on GitHub (`gh`), GitLab (`glab`), or another host is missing.

Unlike the SDD harness (`SDD_HARNESS`) and memory (`MEMORY_BACKEND`), which are **per-developer** preferences that live in `.env`, the VCS provider is **dictated by where the repo lives**: if the repo is on GitHub, the whole team uses `gh`. There is no per-dev freedom — the host is fixed.

## Decision

VCS follows the adapter pattern, with two differences from harness/memory:

- **Explicit repo-level selector**: `vcs.provider` in `brain.config.json` (not in `.env`, not auto-derived from `gitHost`). **[Amended by Amendment 2 (#1114, #1263): the key is now `vcs.default`, a key of `vcs.providers` (ADR-0038); `vcs.provider` is read as a read-only alias for one minor version. The "not in `.env`" rule stands, and VCS has no user layer either (ADR-0040). See Amendment 2.]** Repo-level because it is project identity, alongside `gitHost`/`slug`/`owner` (ADR-0007). Explicit over derived because guessing the provider from `gitHost` is fragile on self-hosted/enterprise/mirror hosts.

  ```json
  { "vcs": { "provider": "github" } }   // github | gitlab | ...  [Amendment 2: { "vcs": { "default": "github", "providers": { "github": {} } } }]
  ```

  This key is added to the schema via **additive migration** (`config-migrations.mjs`, ADR-0006) — the first real use of that machinery.

- **Credentials remain in `.env`** (secrets, per-dev): `GITHUB_TOKEN` / `GITLAB_TOKEN`. Config stays clean: provider selection in `brain.config.json`, secrets in `.env`.

- **Verb contract**: `brain/core/methodology/vcs-contract.md` defines the abstract verbs that any provider must implement (`auth-check`, `auth-login`, `whoami`, `issue-view`, `issue-list`, `mr-list`, `commit-status`, `repo-clone-url`, `pat-setup-url`, and `project-resolve` as a no-op on hosts that use slug directly). The contract normalizes naming differences (GitLab `iid`/`description`/`source_branch` ↔ GitHub `number`/`body`/`headBranch`).

- **Dispatcher**: `scripts/vcs/cli.mjs` reads `vcs.provider` **[amended by Amendment 2 (#1114, #1263): through `resolveAxis('vcs', …)`, which reads the process env `VCS_PROVIDER`, then `vcs.default`, then the `vcs.provider` alias; a CI-detected provider wins outside that precedence]** and delegates to `brain/scripts/axes/vcs/adapters/<provider>.mjs` (under `scripts/vcs/providers/<provider>.mjs` until #1141; see Amendment 1). Same pattern as `scripts/memory/cli.mjs` (ADR-0004).

- **Code and contract → core; this ADR → project.** The adapter is a generic product (shipped to consumers). This decision record is evolution of brain-as-project and is not shipped (`brain/project/**` is `local` in the installer manifest).

## Consequences

- **Positive**: the same repo operates on GitHub, GitLab, or another host by changing one key in `brain.config.json`.
- **Positive**: scripts no longer hardcode glab; the flow is testable against the contract without touching a real host.
- **Positive**: adding a new provider = `brain/scripts/axes/vcs/adapters/<x>.mjs` (under `scripts/vcs/providers/<x>.mjs` until #1141; see Amendment 1) + one `case`, without touching callers.
- **Negative**: GitLab-only verbs (`project-resolve`, `commit-status` enum) require explicit normalization; gh↔glab parity is not 1:1 and must be documented in the contract.
- **Negative**: the refactor touches 5 scripts that currently drive the GitLab flow — high blast-radius, delivered in chained PRs.

## Amendment 1 — the VCS providers moved to `axes/vcs/adapters/` (issue #1141)

**Signed**: 28/09/2026 — Cristian Rinaldi

#1141 moved every provider adapter into one directory per axis, with `git mv`, so `git log
--follow` still reaches its history:

| as written above | the path today |
|---|---|
| `scripts/vcs/providers/<provider>.mjs` | `brain/scripts/axes/vcs/adapters/<provider>.mjs` |
| `scripts/vcs/providers/<x>.mjs` (how-to) | `brain/scripts/axes/vcs/adapters/<x>.mjs` |

Both citations above are annotated in place under ruling R6 on #961 as amended (option A) — the
maintainer applied the same ruling to #1141's path moves on 2026-09-28. The explicit-provider +
verb-contract decision is unchanged.

## Amendment 2 — the VCS selector takes the ADR-0038 shape, and still has no `.env` level (issue #1263)

**Signed**: 04/10/2026 — Cristian Rinaldi

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
