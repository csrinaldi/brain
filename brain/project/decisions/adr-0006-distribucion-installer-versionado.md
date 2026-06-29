# ADR-0006 — Distribution: Versioned Installer via Git Tags

**Status**: Accepted (updated 2026-06-29 — S3: brain/scripts/ namespace + 3-pillar model)
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
- **Implemented (Slice 6)**: `brain:upgrade` (`brain/scripts/brain-upgrade.mjs`), the path manifest (`brain/core/managed-paths.mjs`), the migrations (`brain/core/config-migrations.mjs`), and the check-and-notify in `day:start`. See `openspec/changes/installer-versionado/`.

## S3 Update — 3-Pillar Model and brain/scripts/ Namespace (2026-06-29)

### The Three Pillars

Brain's managed content is structured around three namespaces:

| Pillar | Path | Ownership | Purpose |
|--------|------|-----------|---------|
| **core** | `brain/core/**` | Brain-owned (read-only in consumer) | Methodology, patterns, ADRs, config schema |
| **project** | `brain/project/**` | Consumer-owned (never touched by upgrade) | Consumer decisions, overrides, audits |
| **scripts** | `brain/scripts/**` | Brain-owned (managed harness) | Executable verbs: day:start, upgrade, hooks, governance |

### Decision: brain/scripts/ Namespace (S3)

**Problem**: brain previously distributed its harness scripts at the consumer repo
root (`scripts/`). This caused a namespace collision — `brain:upgrade` would
overwrite any consumer-owned files at root `scripts/`. The `managed` array
contained `'scripts/**'`, giving brain implicit ownership of the consumer's own
script directory.

**Decision**: Rename `scripts/` → `brain/scripts/` in both the brain repo and the
managed-paths manifest. The managed array now contains `'brain/scripts/**'`.

**Rationale**: Completing the `brain/` namespace prefix for all brain-owned content
is the structurally correct fix. It eliminates the collision without adding policy
complexity, and it mirrors the existing `brain/core/` pattern. Consumers who
previously had `scripts/` at root no longer risk their files being overwritten.

**Migration**: Existing consumers must delete the orphaned root `scripts/` after
upgrading and update their `package.json` aliases (see CHANGELOG for the exact
steps). The installer never deletes files — deletion is manual and intentional.

### Decision: Merge-Don't-Overwrite for Managed Config (S1/S2)

**Problem**: Some managed files (specifically `.claude/settings.json`) contain a
mix of brain-owned configuration and consumer-owned configuration. Plain
`copyFileSync` overwrites the consumer's content on every upgrade.

**Decision**: The `copyManaged()` function supports a `specialMerge` map:
`{ relPath → mergeFn }`. Files in this map are merged (not overwritten) via the
supplied function. The merge function receives `(destPath, srcPath)` and is
responsible for writing the merged result. This keeps the file in the `managed`
array (drift-checked, distributed) while preventing data loss.

**Current special-merge targets**: `.claude/settings.json` (merged via
`mergeClaudeSettings()` — preserves `permissions.allow` and consumer hooks,
additively appends brain's `hooks.PreToolUse` entries deduplicated by serialization).

**Collision guard**: A pre-flight check in `copyManaged()` detects non-identical
dest vs src for all non-`specialMerge` managed paths. The result reports
`collisions[]`. The `--abort-on-collision` flag makes the guard hard (all-or-nothing
before any write). Default: warn and proceed (current behavior preserved).
