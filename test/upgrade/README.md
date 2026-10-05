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

- **Docker**, and a **github token** (`VCS_TOKEN` or `gh auth token`) that can clone
  the sample consumer repo (never logged). brain itself is installed from the npm
  registry as `@logikas/brain` (ADR-0030).

## What it does

1. Installs `@logikas/brain@FROM` in a clean container, runs `npx brain init` and
   `brain:env:init` (the consumer flow in `docs/adoption.md`).
2. Adds consumer customizations: a `brain/project/` ADR, a `.env` variable, a custom
   `brain.config.json` value (`project.owner`), an `openspec/changes/` dir and a
   consumer-owned `brain:day:start`.
3. Upgrades to **TO** (`npm i -D @logikas/brain@TO` + `brain:upgrade`, default path).
4. Asserts (exits non-zero on any breach): brain is at **TO**, the `brain:*` verbs
   were injected, and every customization above survives.

CI runs it informationally via `.github/workflows/upgrade-smoke.yml` (not a required check).
