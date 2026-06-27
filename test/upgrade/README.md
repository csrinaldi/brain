# Upgrade-safety integration test

Verifies that upgrading brain in a consumer repo **updates the managed core** but
**never touches the consumer's project-specific files** — the read-only-core
contract ([ADR-0003](../../brain/project/decisions/adr-0003-split-core-project-self-hosting.md) /
[ADR-0006](../../brain/project/decisions/adr-0006-distribucion-installer-versionado.md)).

Maintainer/CI test; not part of `brain/core` and not part of `npm test`.

## Run

```bash
npm run test:upgrade -- v0.4.0 v0.4.1   # explicit FROM → TO
npm run test:upgrade                     # second-latest → latest tag
```

## Requirements

- **Docker**, and a **github token** (`VCS_TOKEN` or `gh auth token`) with read
  access to the private brain repo (never logged).

## What it does

1. Installs brain @ **FROM** in a clean container, seeds the managed paths + runs `env:init`.
2. Adds consumer customizations: a `brain/project/` ADR, a `.env` variable, a custom
   `brain.config.json` value (`project.owner`), and an `openspec/changes/` dir.
3. Upgrades to **TO** (re-install `git+https` + `brain:upgrade`).
4. Asserts (exits non-zero on any breach):
   - brain is now at **TO** and the managed scripts/core were updated;
   - the `brain/project` ADR, the `.env` var, the custom `brain.config.json` value,
     and the `openspec/changes/` dir **all survive**.

## Note

The FROM managed state is seeded via a managed-paths copy: a pre-v0.4.1
`brain-upgrade` uses the SSH `github:` shorthand and can't run over HTTPS. The
**TO** upgrade uses the real `brain:upgrade` (git+https, #44). Existing
pre-v0.4.1 consumers need a one-time `npm i -D "git+https://…#v0.4.1"` to cross
that boundary; after v0.4.1, HTTPS upgrades work directly.
