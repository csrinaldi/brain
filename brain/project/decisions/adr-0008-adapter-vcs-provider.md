# ADR-0008 — VCS Adapter: explicit provider + verb contract

**Status**: Accepted
**Date**: 2026-06-26

## Context

The harness scripts (`ticket-start`, `tracker-board`, `project-status`, `day-start`, `bootstrap.sh`) are coupled to GitLab: they invoke `glab` and the REST API `/api/v4/` directly, hardcoding GitLab-only concepts (`iid`, `oauth2:` in the authenticated URL, pipeline status enum, `merge_requests`/`!NNN`). The brain repo itself lives on GitHub, so that flow does not work here.

ADR-0007 already made the **configuration** VCS-agnostic (`gitHost`, `slug`, `owner` in `brain.config.json`), but **execution** is still tied to a specific tool. The adapter that allows the same repo to operate on GitHub (`gh`), GitLab (`glab`), or another host is missing.

Unlike the SDD harness (`SDD_HARNESS`) and memory (`MEMORY_BACKEND`), which are **per-developer** preferences that live in `.env`, the VCS provider is **dictated by where the repo lives**: if the repo is on GitHub, the whole team uses `gh`. There is no per-dev freedom — the host is fixed.

## Decision

VCS follows the adapter pattern, with two differences from harness/memory:

- **Explicit repo-level selector**: `vcs.provider` in `brain.config.json` (not in `.env`, not auto-derived from `gitHost`). Repo-level because it is project identity, alongside `gitHost`/`slug`/`owner` (ADR-0007). Explicit over derived because guessing the provider from `gitHost` is fragile on self-hosted/enterprise/mirror hosts.

  ```json
  { "vcs": { "provider": "github" } }   // github | gitlab | ...
  ```

  This key is added to the schema via **additive migration** (`config-migrations.mjs`, ADR-0006) — the first real use of that machinery.

- **Credentials remain in `.env`** (secrets, per-dev): `GITHUB_TOKEN` / `GITLAB_TOKEN`. Config stays clean: provider selection in `brain.config.json`, secrets in `.env`.

- **Verb contract**: `brain/core/methodology/vcs-contract.md` defines the abstract verbs that any provider must implement (`auth-check`, `auth-login`, `whoami`, `issue-view`, `issue-list`, `mr-list`, `commit-status`, `repo-clone-url`, `pat-setup-url`, and `project-resolve` as a no-op on hosts that use slug directly). The contract normalizes naming differences (GitLab `iid`/`description`/`source_branch` ↔ GitHub `number`/`body`/`headBranch`).

- **Dispatcher**: `scripts/vcs/cli.mjs` reads `vcs.provider` and delegates to `scripts/vcs/providers/<provider>.mjs`. Same pattern as `scripts/memory/cli.mjs` (ADR-0004).

- **Code and contract → core; this ADR → project.** The adapter is a generic product (shipped to consumers). This decision record is evolution of brain-as-project and is not shipped (`brain/project/**` is `local` in the installer manifest).

## Consequences

- **Positive**: the same repo operates on GitHub, GitLab, or another host by changing one key in `brain.config.json`.
- **Positive**: scripts no longer hardcode glab; the flow is testable against the contract without touching a real host.
- **Positive**: adding a new provider = `scripts/vcs/providers/<x>.mjs` + one `case`, without touching callers.
- **Negative**: GitLab-only verbs (`project-resolve`, `commit-status` enum) require explicit normalization; gh↔glab parity is not 1:1 and must be documented in the contract.
- **Negative**: the refactor touches 5 scripts that currently drive the GitLab flow — high blast-radius, delivered in chained PRs.
