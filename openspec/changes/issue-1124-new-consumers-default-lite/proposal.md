---
status: draft
issue: 1124
---

# Proposal: new consumers default to tier `lite`, and env:init says so

## Problem

`brain/core/config-migrations.mjs`'s 0.9.0 entry defaults `governance.tier` to `standard`,
on purpose: its note says a default of `lite` *"would silently weaken governance on
upgrade"*. That protects existing consumers. But `buildDefaultConfig()`
(`brain/scripts/lib/brain-config.mjs`) builds a NEW consumer's config from the same
migrations, so the same `standard` also becomes the tier of every new repository.

At `standard` a merge needs a second, non-author approval (ADR-0026 Amendment 6). A new
consumer is usually one person, and GitHub forbids approving your own pull request. In #1081
`env:init` wrote `standard` for a new one-person repository without saying so, and that
repository's lane PR could not have merged.

## Intent

The maintainer's ruling (24/09/2026, #1121 ruling 2):

- **New** consumers default to `governance.tier: "lite"`, and `env:init` states the tier it
  sets, why, and the alternatives.
- **Existing** consumers keep their declared tier. No migration may change it silently.

## Scope

In scope:

- A new-consumer default (`lite`) kept separate from the migrations, read only by
  `buildDefaultConfig()`.
- A tier notice printed by `env:init`'s config step on every run: the tier, why, and how to
  change it. On an existing consumer it states the declared tier as unchanged.
- The new strings in the `en` and `es` catalogs.
- A `brain-amendment/1` draft of ADR-0026 Amendment 8, for the maintainer to promote.
- Tests, and a check on a consumer built from the packed tarball (ADR-0036).

Out of scope:

- Changing any existing consumer's tier, or `resolveTier()`'s reading of an absent key.
- Enforcing that a one-maintainer repository cannot select `standard` (Amendment 6 records
  that coupling as a known limitation).
- An interactive tier prompt in `env:init`. The ruling asks to state the tier, not to ask.
- `brain init` re-pointing the dependency from the installed tarball to a git tag (found
  while checking this change; reported separately).

## Acceptance

- A config built with no prior file declares `lite`.
- A config declaring `standard` or `regulated` keeps it through every migration and through
  `env:init`.
- An existing config with no tier key migrates to `standard`, the tier `resolveTier()`
  already reads for it.
- `env:init`'s output contains the tier line, on a fresh consumer built from the packed
  tarball.
- The amendment plans cleanly under `brain:promote`'s `planAmendment`.
