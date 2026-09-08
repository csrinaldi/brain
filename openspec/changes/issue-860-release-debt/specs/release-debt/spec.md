---
issue: 860
phase: spec
capability: release-debt
---

# Spec — the debt is reported, and its severity is distinguished

## Requirement: a dormant migration is the strongest signal (R860-1)

When a migration's version is ABOVE the package version, `brain:status` MUST
report it as unreachable code, naming the versions.

### Scenario: promoted but unpublished
- GIVEN package `1.1.0` and migrations declaring `1.2.0`, `1.3.0`, `1.4.0`
- THEN the report names all three and says they are declared and unreachable
  until a release cut.

### Scenario: published up to the tail
- GIVEN package `1.4.0` and a tail of `1.4.0`
- THEN no migration debt is reported.

## Requirement: ordinary drift is reported, and not as an alarm (R860-2)

Commits since the last release tag MUST be reported with their conventional-
commit shape, distinguished from the migration case.

### Scenario: feats and fixes, no migration
- GIVEN 7 commits since `v1.4.0` — 3 feat, 4 fix, no migration
- THEN the report says a release is owed but not urgent, with the counts.

### Scenario: nothing since the tag
- GIVEN the tag is HEAD
- THEN the report says the release is up to date.

### Scenario: internal work only
- GIVEN commits that are all `chore`/`test`/`docs`
- THEN no debt or drift line is reported (the report still prints its "up to date" line) — a line that fires for everything is unread.

## Requirement: absent evidence is reported as absent (R860-3)

When a fact cannot be read, the report MUST say so rather than claim health.

### Scenario: no release tag exists
- WHEN `git describe` finds no tag
- THEN the report says the comparison could not be made, and does NOT say
  "up to date".

### Scenario: the migration list is unreadable
- WHEN it cannot be parsed
- THEN the migration half reports its reason in band, and the commit half still
  reports what it could read.
