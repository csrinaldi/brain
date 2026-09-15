# Delta for managed-paths-namespace (issue #961)

Ratified rulings R1-R10 (maintainer, 2026-09-14, issue #961 comment) are the source of
truth below and are not reopened here. `managed-paths-namespace`'s current spec has no
requirement about the memory scripts, so this delta is entirely ADDED text.

## NOT in this change

- Changing `MANAGED_SCRIPT_KEYS` itself, or editing PR #954 — both follow R1/R2 and are
  applied by the maintainer, not by this change.
- A `bin` entry point as an alternative to npm scripts.
- Archiving the 20 shipped-but-unarchived `openspec/changes/**` folders.
- Any consumer migration — no consumer has any of the seven bare keys installed today.

## ADDED Requirements — Delivery: Tier-1 PR

### Requirement: Managed Scripts Install Only Under the brain: Namespace

The seven managed memory scripts MUST appear in a consumer's `package.json` only as
`brain:memory:save`, `brain:memory:index`, `brain:memory:share`, `brain:memory:pull`,
`brain:memory:resolve-index`, `brain:memory:audit`, `brain:memory:ship`.

#### Scenario: Scripts brain installs carry the brain: namespace

- GIVEN a consumer runs `brain:upgrade` or a fresh install after this change merges
- WHEN the consumer's `package.json` is inspected
- THEN the seven managed keys are present only as `brain:memory:*`
- AND no bare `memory:save|index|share|pull|resolve-index|audit|ship` key is written

### Requirement: Repo-Only Scripts Are Renamed But Never Managed

brain's own `package.json` MUST rename `memory:reindex`, `memory:split-records`,
`memory:collect`, `memory:migrate-v1` to their `brain:memory:*` form (R3). None of the
four MUST be added to `MANAGED_SCRIPT_KEYS`.

#### Scenario: The repo-only scripts are renamed but never installed

- GIVEN brain's own `package.json` after this change
- WHEN `MANAGED_SCRIPT_KEYS` is inspected
- THEN `brain:memory:reindex`, `brain:memory:split-records`, `brain:memory:collect`,
  `brain:memory:migrate-v1` are absent from it
- AND the four keys still exist in brain's own `package.json` under their renamed form

### Requirement: Bare Aliases Stay Runnable Inside brain

Each of the eleven bare `memory:*` names MUST remain in brain's own `package.json` as a
byte-identical duplicate command string beside its `brain:memory:*` key, the same
mechanic as the ten existing `brain:*` aliases. A test MUST pin every pair.

#### Scenario: The bare names keep working inside brain

- GIVEN brain's own `package.json` after this change
- WHEN a pinning test reads each `brain:memory:<name>` key and its bare `memory:<name>`
  counterpart
- THEN both command strings are byte-identical for all eleven names
- AND running the bare name locally still executes the same script

### Requirement: History Is Never Rewritten

The rename MUST NOT modify `.memory/records/**`, `openspec/changes/archive/**`,
shipped-but-unarchived `openspec/changes/**` folders, or existing `CHANGELOG.md` lines.
It MUST add a new `CHANGELOG.md` entry documenting the rename (R5).

#### Scenario: History is never rewritten

- GIVEN the repo state before and after this change merges
- WHEN `.memory/records/**`, `openspec/changes/archive/**`, the unarchived
  `openspec/changes/**` folders, and pre-existing `CHANGELOG.md` lines are diffed
- THEN all of them are byte-identical
- AND `CHANGELOG.md` gains a new entry for the rename

### Requirement: The Rename Cannot Corrupt What It Did Not Mean To Touch

The rename MUST use an explicit mapping where each name matches only when not preceded
by `brain:` and not followed by `[\w-]`, never a blind regex (R7).

#### Scenario: The rename cannot corrupt what it did not mean to touch

- GIVEN the repo state after this change merges
- WHEN the repo is scanned for `brain:brain:`, for `.github/workflows/governance.yml`'s
  `memory:index-lag` step label, and for any remaining bare `npm run memory:<eleven>` in
  a Tier-1 file
- THEN no `brain:brain:` occurrence exists
- AND `memory:index-lag` in `governance.yml` is unchanged
- AND no Tier-1 file still invokes a bare `npm run memory:<eleven>`

### Requirement: The CLI Never Names a Command That Does Not Exist

`brain/scripts/i18n/en.mjs` and `i18n/es.mjs` MUST name the `brain:memory:*` form in the
same change as the `package.json` rename (R9).

#### Scenario: The CLI never names a command that does not exist

- GIVEN the Tier-1 PR that renames `package.json`
- WHEN `i18n/en.mjs` and `i18n/es.mjs` are inspected in that same PR
- THEN every user-visible string that names one of the eleven scripts uses the
  `brain:memory:*` form

### Requirement: No Consumer Needs A Migration

No consumer has any of the seven bare keys installed today, and this change MUST NOT
introduce a migration path for them, because `mergePackageJsonScripts` only ever adds
missing keys.

#### Scenario: No consumer needs a migration

- GIVEN a consumer repo that has never run `brain:upgrade` with the seven bare keys
- WHEN the consumer upgrades to this change
- THEN only the `brain:memory:*` keys are added
- AND no removal, rewrite, or migration step runs against the consumer's `package.json`

## ADDED Requirements — Delivery: Maintainer promotion

### Requirement: An Accepted ADR Is Amended, Never Edited

Each of the five touched ADRs (0002, 0011, 0014, 0017, 0034) MUST gain an appended,
numbered, signed Amendment section with a rename table. Existing ADR body text MUST
stay unchanged (R6).

#### Scenario: An accepted ADR is amended, never edited

- GIVEN one of the five touched ADRs before promotion
- WHEN the maintainer promotes the doctrine drafts
- THEN the ADR gains a new numbered, signed Amendment section listing the renamed names
- AND every pre-existing line of the ADR body is byte-identical to before promotion

### Requirement: Tier-2 Comments Are Hand-Edited During Promotion

`brain/core/config-migrations.mjs:69` and `brain/project/check-refs-rules.mjs:81` MUST
be updated by the maintainer in the same promotion session that regenerates
`AGENTS.md` (R8), since `brain:promote` only accepts `.md` files.

#### Scenario: The maintainer closes the two hand-edited comments during promotion

- GIVEN the drafts checklist flags both `.mjs` comments
- WHEN the maintainer completes the promotion session
- THEN both comments cite the `brain:memory:*` form
- AND `AGENTS.md` has regenerated in that same session

### Requirement: The Tripwire Is Never Red Without A Defect

The order MUST be: (1) the Tier-1 PR merges; (2) the maintainer promotes the doctrine
drafts and `AGENTS.md` regenerates; (3) only then does #954 rebase — renaming its seven
keys to `brain:memory:*` and tightening `MANAGED_SCRIPT_KEYS`'s namespace invariant back
to `^brain:[a-z]` — and merge (R1, R2). At each step, the #922 tripwire's result MUST
reflect a real defect or none.

#### Scenario: The tripwire is never red without a defect

- GIVEN the Tier-1 PR has merged but doctrine promotion has not yet happened
- WHEN the #922 tripwire runs against `main`
- THEN it is green, because doctrine still says `memory:*` and no `brain:` keys are
  expected yet

#### Scenario: The tripwire stays honest after promotion and #954

- GIVEN doctrine has been promoted and #954 has rebased and merged
- WHEN the #922 tripwire runs against `main`
- THEN it is green under the tightened `^brain:[a-z]` invariant
- AND a bare `memory:*` name reintroduced into doctrine after this point turns it red
