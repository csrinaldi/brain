# Proposal — Versioned brain installer (Slice 6)

> **Status:** Draft for implementation · **Implements:** [ADR-0006](../../../brain/project/decisions/adr-0006-distribucion-installer-versionado.md)

## Context

`brain` is already extracted as a standalone repo (this repo). What is missing is the mechanism by which a consumer project **installs** and **updates** the generic core without touching its own files. The full architecture is in the ADRs of this repo (`brain/project/decisions/adr-0001..0007`) — **read them first**, especially ADR-0003 (core/project split + self-hosting) and ADR-0006 (distribution).

## What to build

1. **`brain:upgrade`** — command that installs/upgrades a version of the core in a consumer project:
   - Mechanism: `npm i -D github:csrinaldi/brain#<tag>` (or a script that fetches the tag and copies the managed files to the consumer).
   - **Golden rule (ADR-0003/0006): core is read-only in the consumer.** The upgrade OVERWRITES managed paths and NEVER touches local ones.
2. **Managed-paths manifest** — defines what is upstream vs local:
   - Managed (overwritten): `brain/core/**`, `scripts/**` (harness), `.gitattributes`.
   - Local (untouchable): `brain/project/**`, `brain.config.json`, `.env`, `openspec/changes/**`, `.memory/**`.
3. **Versioning via git tags** — `v0.1.0`, `v1.0.0`… Tag the current state as the first release.
4. **`brain.config.json` migration** — when a new version adds keys to the schema, the upgrade adds them WITHOUT overwriting user values (versioned migrations).
5. **Check-and-notify in `day:start`** — detects if a new version is available and NOTIFIES (does not auto-apply — respects `brain/core/anti-patterns/instaladores-autoactualizantes-no-inocuos.md`).

## Out of scope (future slices)

- **VCS adapter (gh vs glab):** the harness scripts currently use `glab` + GitLab API. This repo lives on GitHub, so `ticket:start`/`tracker:board`/MR do not work here yet. The installer itself is VCS-agnostic (npm/git/file-copy), so it can be built regardless. The VCS adapter is a separate story.
- **Consumer adoption (catastro):** this is done on the platform-scit side (another session), once this installer has a release.

## Acceptance criteria

- [ ] `brain:upgrade` installs a version (git tag) and copies only the managed paths.
- [ ] Local paths (`brain/project`, `brain.config.json`, `.env`) remain intact after an upgrade (tested).
- [ ] Config migration: adding a new key in a version does not overwrite existing values (tested).
- [ ] `day:start` detects a new version and notifies without auto-applying.
- [ ] First release tagged (e.g. `v0.1.0`).
- [ ] The brain repo itself is documented: update the README with how to adopt/update.
