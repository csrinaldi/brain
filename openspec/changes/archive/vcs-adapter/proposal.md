# Proposal — VCS Adapter (gh / glab / other)

> **Status:** Draft for implementation · **Implements:** [ADR-0008](../../../brain/project/decisions/adr-0008-adapter-vcs-provider.md) · **Depends on:** [ADR-0007](../../../brain/project/decisions/adr-0007-config-vcs-agnostica-y-checkrefs.md) (config), [ADR-0006](../../../brain/project/decisions/adr-0006-distribucion-installer-versionado.md) (migrations)

## Context

The harness scripts are coupled to GitLab (`glab` + API `/api/v4/`). The brain repo itself lives on GitHub, so `ticket:start`/`tracker:board`/`project:status`/`day:start` do not work here. ADR-0007 made the config VCS-agnostic but **execution** is still tied to a specific tool. This slice builds the missing adapter (explicitly deferred by the installer proposal).

## What to build

1. **`vcs.provider` selector** in `brain.config.json`, added via **additive migration v0.2.0** (`config-migrations.mjs`). Default suggested by host, but the value is explicit.
2. **Verb contract** `brain/core/methodology/vcs-contract.md`: the 10 abstract verbs a provider must implement, with field normalization (GitLab `iid`/`description`/`source_branch` ↔ GitHub `number`/`body`/`headBranch`).
3. **Dispatcher** `scripts/vcs/cli.mjs` (mirror of `scripts/memory/cli.mjs`): reads `vcs.provider`, delegates to `scripts/vcs/providers/<provider>.mjs`.
4. **Two providers**: `github.mjs` (`gh`) and `gitlab.mjs` (`glab`, preserves the current exact behavior).
5. **Refactor of callers** to go through the dispatcher instead of invoking `glab`/curl directly: `tracker-board.mjs`, `project-status.mjs`, `day-start.mjs`, `ticket-start.mjs`, `bootstrap.sh`. Plus `install-tools.sh` (installs `gh` or `glab` based on provider).

## Verbs (inventory)

`auth-check`, `auth-login`, `whoami`, `issue-view`, `issue-list`, `mr-list`, `commit-status`, `repo-clone-url`, `pat-setup-url`, `project-resolve` (no-op on GitHub). gh↔glab mapping and edge cases in [design.md](design.md).

## Out of scope

- **New write verbs** (`issue:create`, `mr:create`) beyond porting what the scripts already do — these are future slices once the contract is proven.
- **Adoption in consumers**: done on the platform side with a new release.

## Acceptance criteria

- [ ] `vcs.provider` is added to the schema via additive migration v0.2.0 without overwriting existing values (tested).
- [ ] Dispatcher `scripts/vcs/cli.mjs` resolves the provider from `brain.config.json` and delegates correctly (tested).
- [ ] Provider `gitlab.mjs` reproduces the current behavior of the 5 scripts (no regression in the GitLab flow).
- [ ] Provider `github.mjs` implements the 10 verbs; `tracker:board`/`project:status` work against this repo (GitHub) end-to-end.
- [ ] No script invokes `glab` or `/api/v4/` directly — everything goes through the dispatcher.
- [ ] Normalization verified: the caller does not see `iid`, `source_branch`, or the GitLab status enum.
- [ ] README + `harness-contract.md` updated; `vcs-contract.md` created in core.

## Rollback plan

The refactor is per-script and additive: the adapter is introduced without deleting the old logic until the equivalent provider is proven. Each chained PR is independently revertible. The `gitlab.mjs` provider guarantees parity, so a revert leaves the GitLab flow intact.
