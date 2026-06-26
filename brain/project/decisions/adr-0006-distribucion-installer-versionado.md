# ADR-0006 — Distribution: Versioned Installer via Git Tags

**Status**: Accepted  
**Date**: 2026-06-26

## Context

`brain/core/` is a generic product that multiple projects should be able to adopt. The distribution options are:

- **git subtree**: complex to maintain, mixes upstream history with the consumer repo.
- **npm registry**: requires publishing to npmjs.com or a private registry; bureaucratic overhead.
- **git tags + npm install**: installs directly from GitHub by version tag; compatible with private repos; zero registry.
- **manual copy**: no way to receive updates in a controlled manner.

## Decision

Distribution uses **git tags + npm install**:

```bash
npm install --save-dev github:csrinaldi/brain#v1.0.0
```

This installs `brain/core/` and the generic scripts as a devDependency of the consumer project. The version is pinned in the consumer's `package.json`.

**Key rule**: `brain/core/` is **read-only in the consumer**. It lives in `node_modules/brain/` — do not edit it there. Improvements go upstream (PR to the brain repo), then the version is updated in the consumer.

**Check-and-notify in day:start**: `scripts/day-start.mjs` checks whether a new version of brain is available and notifies. It does not auto-update — this respects the `instaladores-autoactualizantes-no-inocuos` anti-pattern (see `brain/core/anti-patterns/`).

**brain.config.json migrations**: migrations are **additive and applied automatically** on upgrade (`brain:upgrade`). When a new version adds keys to the schema, it registers them in `brain/core/config-migrations.mjs`; the installer adds them with their defaults **without ever overwriting a value already set by the consumer** (including falsy values such as `""`, `0`, `false`). The `schemaVersion` field in `brain.config.json` tracks how far the migration has run. Renames/restructures (non-additive) use an explicit `migrate()` function and must be documented in the tag's changelog.

## Consequences

- **Positive**: one-liner installation, no registry, compatible with private repos (GitHub).
- **Positive**: the version is explicit in the consumer's `package.json` — upgrades are conscious decisions.
- **Positive**: `git tag` is the release mechanism — zero complex CI to publish.
- **Positive (Slice 6)**: additive `brain.config.json` migrations run automatically and are idempotent; the consumer only reads the changelog for renames.
- **Negative**: distributing via npm install from GitHub requires the consumer to have access to the brain repo (authenticated, if private).
- **Implemented (Slice 6)**: `brain:upgrade` (`scripts/brain-upgrade.mjs`), the path manifest (`brain/core/managed-paths.mjs`), the migrations (`brain/core/config-migrations.mjs`), and the check-and-notify in `day:start`. See `openspec/changes/installer-versionado/`.
