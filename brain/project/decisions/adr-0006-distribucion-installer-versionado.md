# ADR-0006 — Distribution: Versioned Installer via Git Tags

**Status**: Accepted (updated 2026-06-29 — S3: brain/scripts/ namespace + 3-pillar model) · **amended 18/08/2026** (Amendments 1-2 — see below)
**Date**: 2026-06-26

## Context

`brain/core/` is a generic product that multiple projects should be able to adopt. The distribution options are:

- **git subtree**: complex to maintain, mixes upstream history with the consumer repo.
- **npm registry**: requires publishing to npmjs.com or a private registry; bureaucratic overhead.
  **[Amended by Amendment 1 (#617) — this rejection is reversed. ADR-0030 chooses the registry. The "overhead" was weighed against a private repo that no longer exists.]**
- **git tags + npm install**: installs directly from GitHub by version tag; compatible with private repos; zero registry.
  **[Amended by Amendment 1 (#617) — SUPERSEDED. "Compatible with private repos" is the property this whole decision rested on, and there is no private repo left: `private: false`. See ADR-0030.]**
- **manual copy**: no way to receive updates in a controlled manner.

## Decision

Distribution uses **git tags + npm install**:

**[Amended by Amendment 1 (#617) — SUPERSEDED. Distribution is a published scoped package. See ADR-0030. The install line below is historical.]**
**[Amended by Amendment 2 (#729) — the scope. Amendment 1 wrote `@csrinaldi/brain`; ADR-0030 Amendment 2 (#653) moved it to `@logikas` and corrected its own copy of this sentence, not this one. Nothing was ever published under `@csrinaldi/brain` (`404`). The package is **`@logikas/brain`**, published since 2026-08-18.]**

```bash
# HISTORICAL — superseded by ADR-0030. The current line is:
#   npm install --save-dev @logikas/brain          # ← Amendment 2 (#729): the scope is @logikas
npm install --save-dev github:csrinaldi/brain#v1.0.0
```

This installs `brain/core/` and the generic scripts as a devDependency of the consumer project. The version is pinned in the consumer's `package.json`.

**Key rule**: `brain/core/` is **read-only in the consumer**. It lives in `node_modules/brain/` — do not edit it there. Improvements go upstream (PR to the brain repo), then the version is updated in the consumer.

**Check-and-notify in day:start**: `scripts/day-start.mjs` checks whether a new version of brain is available and notifies. It does not auto-update — this respects the `instaladores-autoactualizantes-no-inocuos` anti-pattern (see `brain/core/anti-patterns/`).

**brain.config.json migrations**: migrations are **additive and applied automatically** on upgrade (`brain:upgrade`). When a new version adds keys to the schema, it registers them in `brain/core/config-migrations.mjs`; the installer adds them with their defaults **without ever overwriting a value already set by the consumer** (including falsy values such as `""`, `0`, `false`). The `schemaVersion` field in `brain.config.json` tracks how far the migration has run. Renames/restructures (non-additive) use an explicit `migrate()` function and must be documented in the tag's changelog.

## Consequences

- **Positive**: one-liner installation, no registry, compatible with private repos (GitHub).
  **[Amended by Amendment 1 (#617) — no longer a Positive. The repository is public (`private: false`), so "compatible with private repos" describes nothing, and "no registry" is now the cost rather than the benefit.]**
- **Positive**: the version is explicit in the consumer's `package.json` — upgrades are conscious decisions.
- **Positive**: `git tag` is the release mechanism — zero complex CI to publish.
- **Positive (Slice 6)**: additive `brain.config.json` migrations run automatically and are idempotent; the consumer only reads the changelog for renames.
- **Negative**: distributing via npm install from GitHub requires the consumer to have access to the brain repo (authenticated, if private).
  **[Amended by Amendment 1 (#617) — this is the friction ADR-0030 removes. `test/fresh-install/run.sh` still refuses to run without a `VCS_TOKEN` for exactly this reason; when that fixture stops needing one, this Negative is gone.]**
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

## Amendment 1 — SUPERSEDED by ADR-0030: the premise that chose git tags no longer exists (issue #617)

**Signed**: 13/08/2026 — Cristian Rinaldi

### What changed

**This ADR is superseded by ADR-0030 for its distribution mechanism.** Not amended
— superseded. The distinction is the point: its Decision did not become
inconvenient, its **premise was deleted**.

ADR-0006's own comparison chose `git tags + npm install` on one property:

> **git tags + npm install**: installs directly from GitHub by version tag;
> **compatible with private repos**; zero registry.

Measured on `main` @ `3dfbdd4`: **`private: false`**. There is no private repo for
that compatibility to serve. The option it rejected — *"npm registry: requires
publishing […] bureaucratic overhead"* — is what ADR-0030 chooses, and the
overhead was weighed against a constraint that no longer applies.

Its stated Negative, that the consumer needs authenticated access to this
repository, is precisely the friction #435 exists to remove.

### What is NOT superseded

Narrower than a reader might assume, and stated so the supersession is not read
as wider than it is. Everything below stands unchanged and is still current
doctrine:

- **`brain/core/**` is read-only in the consumer**, and improvements go upstream.
- **The three-pillar model** — core / project / scripts — and the `brain/scripts/`
  namespace decided in the S3 update, which removed the root `scripts/` collision.
- **Additive `brain.config.json` migrations**, `schemaVersion`, and the rule that
  a consumer-set value is never overwritten, falsy values included.
- **Check-and-notify in `day:start`, never auto-update.** A registry makes
  auto-update easier to reach for, so `instaladores-autoactualizantes-no-inocuos`
  is *more* load-bearing after this, not less.
- **`specialMerge` and the collision guard** in `copyManaged()`.

What is superseded is one thing: **how the bytes reach the consumer**, and the
private-repo premise that chose it.

### The measurement

| ADR-0006 asserts | measured on `main` @ `3dfbdd4` |
|---|---|
| "compatible with private repos" | `private: false` — public |
| "no registry" as a Positive | `brain` is a deprecated placeholder (`200`); `@csrinaldi/brain` is free (`404`) |
| consumer needs repo access | `test/fresh-install/run.sh` still exits 2 without `VCS_TOKEN` |

### The accepted loss

**ADR-0030 is signed while the mechanism is still ADR-0006's.** `main` carries
`private: true`, `"name": "brain"` and an install spec pointing at the git URL.
For as long as #435's mechanical half is open, ADR-0030 records an intent and
ADR-0006's install line is what actually runs.

**[Amended by Amendment 2 (#729) — PAID. Every clause above expired when #435
closed on 2026-08-18: `private: false`, `"name": "@logikas/brain"`,
`installSpecDetail` resolves `kind: 'registry'` (#644), and `@logikas/brain@1.1.0`
is on the registry. ADR-0030 no longer records an intent, and ADR-0006's install
line is no longer what runs. The paragraph is kept because the loss was real and
deliberately accepted — deleting it would erase the reasoning that justified
signing first — but it must not be read as a description of today.]**

That ordering is deliberate. #590 measured what the reverse costs: a mechanism
shipped, its decision record never written, and five live files citing an ADR
that did not exist — for months. Writing the decision first means a reader can
see the gap. Writing it last means nobody can.

## Amendment 2 — the scope Amendment 1 named was never published, and the loss it accepted is paid (issue #729)

**Signed**: 18/08/2026 — Cristian Rinaldi

Amendment 1 (#617) was written while the chosen scope was `@csrinaldi`. Two things
have happened to it since, and neither reached this file.

### 1 · The scope moved, and only ADR-0030 was told

ADR-0030 Amendment 2 (#653) changed the scope to `@logikas` and annotated its own
copy of the sentence. **ADR-0006's cross-reference was not touched**, so this ADR
went on naming `@csrinaldi/brain` in the present tense — the scope, and the line
its code block tells a reader to type instead.

Measured on `main` @ `76c2cea`:

```
@csrinaldi/brain . . . 404   (never published)
@logikas/brain . . . . 200   (1.1.0, published 2026-08-18)
```

A superseded decision is allowed to be wrong about the future. It is not allowed to
hand a reader an install line that resolves to nothing, in a comment written for the
express purpose of telling them what to type instead.

### 2 · The accepted loss is paid, and saying so is the point

Amendment 1 recorded a deliberate ordering: sign ADR-0030 first, ship the mechanism
after, and accept the interval in which the decision describes something that does
not yet exist. That interval closed with #435.

The paragraph is **kept, not deleted**. Deleting it would erase the reasoning — #590's
measurement of what the reverse ordering costs, which is why the interval was accepted
at all. What it needed was a terminator, so it stops reading as a description of the
present.

### What was deliberately left alone

The row *"`@csrinaldi/brain` is free (`404`)"* in the measurement table above sits under
the heading **"measured on `main` @ `3dfbdd4`"**. It was true when measured and is still
`404`. **A dated measurement is not a stale claim.** The same holds for the row saying
`test/fresh-install/run.sh` still exits 2 without `VCS_TOKEN`, which #728 has since made
false: as a record of what Amendment 1 saw, it stays.

Rewriting either would destroy the evidence Amendment 1 reasoned from, and ADR-0030
handles the identical fact the same way — annotating rather than replacing.

### The rule this leaves behind

**An amendment that renames a thing must chase every ADR that names it, not only its
own.** #653 corrected ADR-0030 and stopped there, because that is where the decision
lived — but the name it changed had already been quoted into a second signed artefact.
A cross-reference is a copy, and a copy does not update itself.
