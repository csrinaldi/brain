# Proposal: memory scripts move to the `brain:memory:*` namespace (#961)

## Intent

brain writes managed scripts into the CONSUMER's `package.json`, where `brain:` is the namespace that
keeps brain's verbs apart from the project's own scripts. `brain:memory:session-end` already follows
it; `memory:save|index|share|pull|resolve-index|audit|ship` do not. PR #954 (#922) is about to add those
seven bare names to `MANAGED_SCRIPT_KEYS`. No consumer has them yet, and `mergePackageJsonScripts`
(`brain/scripts/lib/installer.mjs:1358-1362`) only adds keys: it never renames or removes one. Renaming
now costs nothing. Renaming after #954 would leave seven stale keys in every upgraded consumer, and
nothing could ever remove them.

## Rulings (the maintainer ratifies each)

- **R1: Order.** (1) the Tier-1 PR merges; (2) the maintainer promotes the doctrine drafts and
  `AGENTS.md` regenerates; (3) only then is #954 rebased and merged. #954 is never merged between (1) and (2).
  *Why:* the tripwire checks doctrine against the catalog. At every step doctrine and catalog agree, and no
  exclusion list is needed.
- **R2: What #954 changes after (2).** Its seven bare keys become `brain:memory:*`. The catalog invariant
  goes back to `^brain:[a-z]`. The tripwire's EXTRACTION still matches `memory:*`, so a bare name that
  slips back into doctrine turns it red.
  *Why:* the looser `^(brain|memory):` regex was only there for the bare names.
- **R3: Scope is all eleven.** The four repo-only scripts (`reindex`, `split-records`, `collect`,
  `migrate-v1`) are renamed too, but stay out of `MANAGED_SCRIPT_KEYS`.
  *Why:* doctrine pairs them with the seven in one clause (`memory-format.md:256,260`). `brain:` in this
  repo means "brain verb", not "managed": there are 37 `brain:` keys and 10 managed ones. No doctrine line
  has `npm run memory:<four>`, so the tripwire asks nothing new.
  *Tradeoff:* about 112 more references, mostly tests, and wider than the issue title. If rejected, the
  fallback is the seven only, with mixed-prefix sentences left in doctrine.
- **R4: Bare aliases stay permanently in the repo, never managed.** Each bare alias keeps a
  byte-identical command string, like the ten existing aliases. A new test pins each `brain:memory:*`
  key and its alias to the same string, the way `session-start-config.test.mjs:34,39` does.
  *Why:* between steps (1) and (2), doctrine still says `npm run memory:save`, and records and history
  cite the bare names. The aliases never reach consumers, so they cost nothing.
- **R5: History is never rewritten.** That covers `.memory/records/**` (the ids are content hashes),
  `openspec/changes/archive/**`, the 20 shipped-but-unarchived `openspec/changes/**` folders, and the
  existing `CHANGELOG.md` lines (523-532). The rename gets a NEW CHANGELOG entry.
  *Why:* each of these was true when written. Only living surfaces change, including `openspec/specs/**`.
- **R6: ADRs get appended amendments.** Each of the five touched ADRs (0002, 0011, 0014, 0017, 0034)
  gets a numbered, signed Amendment with a rename table. The ADR bodies stay untouched and need no
  inline markers.
  *Why:* this follows the convention in `adr-0002` Amendments 1-2 and `adr-0017`. No ADR body contains a
  literal `npm run memory:*`, so appended text alone keeps the tripwire correct.
- **R7: The rename uses an explicit mapping, never a blind regex.** Each name matches only when it is not
  preceded by `brain:` and not followed by `[\w-]`. A static test in this change fails on any `brain:brain:`,
  checks that `governance.yml` still has `memory:index-lag`, and checks that no live Tier-1 surface still
  has `npm run memory:<eleven>`.
  *Why:* a blind replace would corrupt `adr-0002:86` and `adr-0034:136,143` (they already say
  `brain:memory:ship`) and `governance.yml:133` (`memory:index-lag`).
- **R8: The two `.mjs` Tier-2 comments are fixed by hand.** They are `config-migrations.mjs:69` and
  `check-refs-rules.mjs:81`. The drafts README lists them, and the maintainer edits them in the same
  promotion session.
  *Why:* `brain:promote` accepts only `.md` files (`amendment-draft.mjs:116`), and a comment that keeps
  the dead name stops turning up when someone searches for the new one.
- **R9: User-visible strings change in the Tier-1 PR.** The `i18n/en.mjs` and `es.mjs` strings change in
  the same PR as `package.json`.
  *Why:* the CLI must never tell a user to run a name that does not exist.
- **R10: Closing keywords.** A new sub-ticket (child of #961) covers the Tier-1 PR, which says
  `Closes #<sub>` and `Refs #961`. The maintainer's promotion PR says `Closes #961`.
  *Why:* `main` needs a closing keyword on an approved issue, and #961 is done only once its doctrine is
  promoted.

## Scope

### In Scope
- The Tier-1 PR:
  - renames the eleven scripts in `package.json` and adds the bare aliases;
  - updates `brain/scripts/**` production code, hooks, i18n and tests, plus `docs/**`, `openspec/specs/**`,
    `README.md`, `.github/PULL_REQUEST_TEMPLATE.md` and a new CHANGELOG entry;
  - adds the alias-pinning test and the hazard guard.
- Doctrine drafts in `openspec/changes/managed-script-brain-prefix/brain-drafts/`: 8 `brain/core` `.md`
  files, 5 ADR amendments, and a checklist for the two `.mjs` comments.

### Out of Scope
- Rewriting records, archived changes, the 20 unarchived change folders, or old CHANGELOG lines.
- Any consumer migration. None is needed, because no consumer has these keys.
- A `bin` entry point as an alternative to npm scripts.
- Archiving the 20 unarchived change folders.
- Editing #954 itself. R2 states what it must change; the maintainer applies it.

## Capabilities

### New Capabilities
- None.

### Modified Capabilities
- `managed-paths-namespace`: memory verbs use the `brain:` namespace, and bare aliases are repo-only and
  never managed.
- `governance`, `governance-v3`, `feature-working-memory`: the command names cited in their requirements
  change to `brain:memory:*`.

## Approach

Rename-first, split by tier (exploration option 1, widened to eleven scripts by R3). The Tier-1 PR changes
code and every living surface. The bare aliases keep un-promoted doctrine runnable. The maintainer then
promotes, and #954 lands last (R1).

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `package.json:65-75` | Modified | Eleven `brain:memory:*` keys plus byte-identical bare aliases |
| `brain/scripts/**` (hooks, `memory/**`, `i18n/*.mjs`, `brain-save.mjs`, `bootstrap.sh`) | Modified | Command names and user-visible strings |
| `brain/scripts/**/*.test.mjs` | Modified/New | Renamed expectations; pinning test; hazard guard |
| `docs/workflow-guide.md`, `docs/methodology-map/index.html`, `README.md`, PR template | Modified | Command references |
| `openspec/specs/{governance,governance-v3,feature-working-memory}` | Modified | Requirement text |
| `brain/core/**` (8 `.md`), `brain/project/decisions` (5 ADRs), 2 `.mjs` comments | Draft only | Maintainer promotion; `AGENTS.md` regenerates |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| #954 merges before promotion and the tripwire goes red on bare doctrine literals | Med | R1 ordering stated in #954; #954 stays a draft until #961 closes |
| The rename double-prefixes a name or corrupts `memory:index-lag` | Med | R7 anchored mapping plus a static guard test |
| A draft left un-promoted in an unarchived folder would bring back bare names | Low | The spec phase checks those folders' `brain-drafts/` against the current doctrine |
| R3 makes the PR larger than the 400-line review budget | Med | Tests, specs and changes are ignore-listed; `sdd-tasks` forecasts the size; fallback is the seven only |

## Rollback Plan

- Before promotion: revert the Tier-1 PR. The bare names still exist, so nothing breaks.
- After promotion: first append a reverting ADR amendment and re-promote the core drafts with the bare
  names, then revert the Tier-1 PR.
- Consumers need nothing in either case, because #954 has not shipped.

## Dependencies

- Maintainer promotion of the doctrine drafts (Tier 2).
- #954 held as a draft until step (2) (R1).

## Success Criteria

- [ ] `npm run brain:memory:<each of eleven>` and the bare alias run the same command.
- [ ] No live Tier-1 surface cites `npm run memory:<eleven>`, and the repo has no `brain:brain:`.
- [ ] `governance.yml` still says `memory:index-lag`.
- [ ] After promotion, the #954 tripwire is green with catalog regex `^brain:[a-z]` and no exclusions.
- [ ] Records, archive, unarchived change folders and old CHANGELOG lines are byte-unchanged.

## Proposal question round (for maintainer review)

1. R3: rename all eleven now, or only the seven, accepting mixed-prefix sentences in doctrine?
2. R4: are the bare aliases permanent, or should they be deprecated once promotion lands?
3. R10: does a sub-ticket for the Tier-1 PR fit the triage flow, or should #961 be split another way?

Assumptions to confirm: no consumer has installed #954's draft keys; `brain:` in this repo means "brain
verb", not "managed".
