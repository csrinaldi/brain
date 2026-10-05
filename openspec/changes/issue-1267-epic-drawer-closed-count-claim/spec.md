---
status: approved
issue: 1267
---

# Spec — epic-drawer-closed-count-claim (issue 1267)

Capability: `ui-epic-rollup` (modified; #1199). Delta requirements. Requirement keywords follow RFC 2119. Every requirement not named here is unchanged.

## Requirements

### R1267-1: The drawer claims a count only when one was taken

`rollupNote(rollup)` MUST return `'the list shows open children; closed children are counted above'` when `rollup.ok` is true and `rollup.value.closed !== null`, and `null` in every other case. `renderChildren` MUST append the note only when `rollupNote` is non-null.

#### Scenario: A counted epic keeps the note
- **GIVEN** an epic whose closed lane is complete and whose closed list was read
- **WHEN** its drawer is rendered
- **THEN** the drawer shows the rollup sentence and the note "the list shows open children; closed children are counted above"

#### Scenario: A failed refresh over a complete list keeps the note
- **GIVEN** an epic whose closed lane failed with a `lastCompleteAt`
- **WHEN** its drawer is rendered
- **THEN** the drawer shows the stale count and the note

#### Scenario: A pending lane claims no count
- **GIVEN** an epic whose closed lane is pending
- **WHEN** its drawer is rendered
- **THEN** the drawer shows "counting closed children…" and no text saying closed children are counted above

#### Scenario: A disabled lane claims no count
- **GIVEN** an epic whose closed lane is disabled
- **WHEN** its drawer is rendered
- **THEN** the drawer shows "closed children not read (…)" and no text saying closed children are counted above

#### Scenario: A failed lane with no earlier list claims no count
- **GIVEN** an epic whose closed lane failed with `lastCompleteAt` null
- **WHEN** its drawer is rendered
- **THEN** the drawer shows "closed children unknown (…)" and no text saying closed children are counted above

#### Scenario: An unread closed list claims no count
- **GIVEN** an epic whose closed lane is complete but whose hierarchy reports `closedRead.ok` false
- **WHEN** its drawer is rendered
- **THEN** the drawer shows "closed children unknown (…)" and no text saying closed children are counted above

### R1267-2: #1199's design describes `closedRead` as shipped

D59, D60 and the Risks section of `issue-1199-progress-epic-milestone/design.md` MUST describe `closedRead` as shipped and MUST name no follow-up for it. The amendment is annotated in place.
