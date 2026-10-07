---
status: approved
issue: 1282
---

# Spec — unreadable-sdd-doc-not-present (issue 1282)

Capability: `sdd-artifact-reader` (modified; amends #1276 R1276-8). Keywords follow RFC 2119. Every requirement not named here is unchanged.

### R1282-1: An unreadable document is never present, and says why

From a worktree or origin source, a stage whose document is in state `unreadable` MUST carry `present: false` and the detail `could not be read: <reason>`, where `<reason>` is the document's own reason. When the document has no reason the detail MUST say `no reason was given`. R1276-8's "present exactly when the source holds that document" is read as: held and readable (`present` or `truncated`).

#### Scenario: A symlinked worktree document
- **GIVEN** a worktree source whose `design.md` is a symbolic link
- **WHEN** the SDD tab is built
- **THEN** the `design` row is not present and its detail starts with `could not be read:` and names the symbolic link, while a readable `spec.md` stays present

### R1282-2: A single unreadable origin entry is not present

#### Scenario: A symlink committed on the origin branch
- **GIVEN** an origin source whose tree holds `design.md` as a symlink
- **WHEN** the SDD tab is built
- **THEN** the `design` row is not present and says `could not be read:` with the symlink reason, and the other stages keep their own state

### R1282-3: An unlistable origin tree makes no stage present

#### Scenario: A branch sha that no longer resolves
- **GIVEN** an origin source whose commit cannot be resolved or listed
- **WHEN** the SDD tab is built
- **THEN** no document stage is present and each says `could not be read:` with the git reason

## Traceability

| Requirement | Test |
|---|---|
| R1282-1 | tab-source.test.mjs "R1282-1" |
| R1282-2 | tab-source.test.mjs "R1282-2" |
| R1282-3 | tab-source.test.mjs "R1282-3" |
