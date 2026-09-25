# ADR-0026 Amendment 8: draft (issue #1124)

> **Tier 3 target. Not promoted, and not promotable by an agent.**
>
> ```
> npm run brain:promote -- openspec/changes/issue-1124-new-consumers-default-lite/brain-drafts/adr-0026-amendment-8.draft.md
> ```
>
> Run it on THIS branch so the amendment lands in the same pull request as the code it
> describes. The verb renders the plan, waits for the typed word, performs §1c's acts,
> writes the `brain/HOME.md` marker and a regenerated `AGENTS.md`, stages them, and stops.
> **Your commit is the signature** (ADR-0028).

```brain-amendment/1
target: brain/project/decisions/adr-0026-governance-doctrine-tiers.md
amendment: 8
issue: 1124
home-summary: a NEW consumer defaults to `lite` and `env:init` states the tier, why, and how to change it; an EXISTING consumer keeps its declared tier, and a missing key still migrates to `standard`, what `resolveTier()` already read for it, #1124
body: ## Amendment 8 — new consumers default to `lite`, and env:init says so (issue #1124)
body-end: ### Notes for the promoter
```

```amend-find
`governance.tier` is consumer config, defaulting to `standard` (behaviourally identical
to brain's pre-tier doctrine, so the migration is a no-op for every existing consumer).
```

```amend-replace
`governance.tier` is consumer config, defaulting to `standard` (behaviourally identical
to brain's pre-tier doctrine, so the migration is a no-op for every existing consumer).
**[Amended by Amendment 8 (#1124): this default now governs EXISTING consumers only. A
config written by `env:init` for a NEW consumer declares `lite`, and `env:init` states the
tier, why, and how to change it. The migration still defaults to `standard`, and no
migration may change a consumer's tier. See Amendment 8.]**
```

```amend-find
a blocking release gate. **The default.** |
```

```amend-replace
a blocking release gate. **The default for an existing consumer that declares no tier (Amendment 8, #1124).** |
```

```amend-find
Explicitly in `brain.config.json`, as a recorded declaration and never by default.
```

```amend-replace
Explicitly in `brain.config.json`, as a recorded declaration and never by default.
**[Amendment 8 (#1124): a new consumer now receives `lite` as its default. brain's own
declaration is unchanged: it predates that default and stays explicit.]**
```

## Amendment 8 — new consumers default to `lite`, and env:init says so (issue #1124)

**Signed**: DD/MM/YYYY — <Name>

### What changed

The ruling (maintainer, 24/09/2026, epic #1121 ruling 2):

> **New** consumers default to `governance.tier: "lite"`, and `env:init` states the tier it
> sets, why, and the alternatives. **Existing** consumers keep their declared tier: no
> migration may change it silently.

This splits one default into two, by when the config is written:

| Config | Tier written | Written by |
|---|---|---|
| **New**: no `brain.config.json` yet | `lite` | `env:init` (`ensureBrainConfig` → `buildDefaultConfig`) |
| **Existing**, declares a tier | the declared one, unchanged | nothing: every migration is additive |
| **Existing**, declares no tier | `standard` | the 0.9.0 migration, unchanged |

And `env:init` prints the tier on every run. On a new consumer it prints the tier it set,
one sentence on why (`lite`: one maintainer, no second approval required to merge), and how
to change it (`standard` or `regulated`, with `brain:config -- set governance.tier …` and
then `brain:protect`). On an existing consumer it prints the declared tier as left unchanged.

### Why

**The default was chosen for the wrong reader.** The Decision above made `standard` the
default so that the 0.9.0 migration would be a no-op for every consumer that already
existed. That was, and remains, correct for them. But `buildDefaultConfig()` builds a NEW
consumer's config from the same migrations, so the protection meant for existing consumers
also chose the tier for repositories that did not exist yet.

**For a new repository, `standard` is usually unsatisfiable.** A new consumer is typically
one person. At `standard` a merge needs a second, non-author approval (Amendment 6 sets
`required_approving_review_count` to 1), and GitHub forbids an author approving their own
pull request. Measured in #1081: `env:init` wrote `standard` for a new one-person repository
and said nothing, and that repository's lane PR could not have merged. This ADR's own
Decision already describes `lite` as the tier for a solo maintainer and says two-human
constraints are *"unsatisfiable by construction"* there. The new default follows that.

**Stating the tier is half of the ruling, not decoration.** A default nobody sees is a
default nobody chose. Amendment 6 records the same failure one layer down: the review count
armed on the platform came from a function signature, and nobody could see where it came
from. `env:init` now names the tier whether it just set it or found it already declared.

### Why the missing-key migration stays `standard`

The one case the ruling left open is an existing config with **no** tier key. It stays
`standard`, for a measured reason: `resolveTier()` (`governance-tiers.mjs`) returns
`standard` for an absent key, so every gate at that consumer has always run at `standard`.
A migration writing `lite` there would change the effective tier of a repository whose
maintainer never chose it, which is exactly the silent weakening this ADR's 0.9.0 note
forbids. Writing `standard` changes nothing any gate can observe.
`config-migrations.test.mjs` pins the equality: the effective tier before and after the
migration is the same.

### How new and existing are kept apart

The `lite` default is **not** a migration entry. It is `NEW_CONSUMER_DEFAULTS` in
`brain/core/config-migrations.mjs`, outside the `migrations` list. `buildDefaultConfig()`
merges it first, then the migrations on top, and `mergeDefaults` never overwrites a present
value. `migrateConfig`, which `brain:upgrade` and `brain:config` run, never reads it. Two
tests make the boundary structural rather than a convention: no migration entry may default
the tier to `lite`, and an empty config walked through every migration comes out `standard`.

### Shown on a fresh consumer (ADR-0036)

Built from the packed tarball (`npm pack`), not the source tree: a fresh consumer's
`env:init` wrote `lite` and printed the tier line. Consumers already declaring `standard` or
`regulated` kept them through `brain:upgrade` and `env:init`, and a pre-0.9.0 config with no
tier key came out `standard`. The exact commands are in
`openspec/changes/issue-1124-new-consumers-default-lite/tasks.md`.

### What this does NOT change

- **Any existing consumer's tier.** Declared or absent, it is what it was.
- **`resolveTier()`'s absent-key reading.** It is still `standard`. The new default is
  written into the file at creation; it is not a new reading of a missing key.
- **The tiers themselves**, their gates, evidence, parameters, and the seven invariants.
- **Amendment 6's recorded n=1 coupling.** A repository with one maintainer can still
  select `standard` and get an unmergeable `main`. This amendment changes the default and
  makes it visible; it does not stop an explicit choice.

### Accepted loss, recorded rather than implied

A new consumer that is really a team starts at `lite` until someone changes it: no required
second approval, and `memory-gate` and `phase-order` at detection. The notice tells them how
to change it on the first `env:init`. The alternative, `standard` for everyone, is the
failure #1081 measured: a one-person repository that cannot merge.

### References

- #1124 (this amendment) · #1121 (epic, ruling 2) · #1081 (the measurement)
- ADR-0036 (done means it works on a fresh consumer install)
- `brain/core/config-migrations.mjs` `NEW_CONSUMER_DEFAULTS` and the 0.9.0 entry
- `brain/scripts/lib/brain-config.mjs` `buildDefaultConfig`, `ensureBrainConfig`
- `brain/scripts/lib/tier-notice.mjs`, `brain/scripts/vcs/governance-tiers.mjs` `resolveTier`

### Notes for the promoter

- Three `amend-find`/`amend-replace` pairs, each anchor verified to occur **exactly once**
  in the target before this draft was written (`planAmendment` plans cleanly).
- The first and third replacements keep the original sentence and annotate it rather than
  deleting it: both were true when written, and they are still true for existing consumers.
- The Divergence section's *"Since `standard` is the default tier"* is left unannotated on
  purpose: it argues about the doctrine an existing consumer with no tier key still gets,
  and that is still `standard`.
- The `brain/HOME.md` marker is §1c's fourth act and the one with no gate behind it
  (#516): confirm it landed before committing.
