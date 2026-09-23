# Promote Migration Specification

## Purpose

`brain:promote` gains a third draft shape: a config-migration entry, promoted
into `brain/core/config-migrations.mjs` through the same ceremony ADRs get.
Built strictly from the proposal's D1–D4.

## Requirements

### Requirement: The contract is a fenced JSON block, and nothing is eval'd

A draft named `config-migrations-<semver>.md` carrying exactly ONE fenced
`brain-migration/1` block promotes. The block is JSON:
`{version, description, defaults}` — `defaults` a plain object tree.

#### Scenario: JS is refused
- **WHEN** the block contains a function, a comment, or any non-JSON syntax
- **THEN** the promotion refuses naming the parse failure; nothing is written

#### Scenario: Zero or two blocks refuse
- **WHEN** the draft has no `brain-migration/1` block, or more than one
- **THEN** refusal names the count — the amendment contract's own rule

#### Scenario: An imperative migration is out of reach
- **WHEN** the block carries a `migrate` key
- **THEN** refusal states the declarative-only rule and that `migrate()`
  entries remain hand edits

### Requirement: The number is computed, shown, and signed (#806)

> Amended 02/09/2026 during apply (proposal addendum, D2): there is NO `--as`
> override — `parseArgs`'s own written doctrine ("brain:promote takes no
> options — deliberately") was found and honored. The computed number is the
> only path; a human needing a different one edits by hand, exactly as today.

The verb proposes next-minor above max(package.json version, migration tail).
The plan prints the draft's number AND the promoted number. Monotonic-forever
holds by construction and is pinned by test.

#### Scenario: Stale draft number is renumbered in the open
- **WHEN** the draft says `1.4.0` and the computed number differs
- **THEN** the plan prints "draft says 1.4.0 → promoting as <computed>" and the
  typed confirmation covers it

#### Scenario: The computed number is always above the tail
- **WHEN** the number is proposed for any package/tail pair
- **THEN** it strictly exceeds the tail — pinned by test, not by a refusal
  branch no input can reach

### Requirement: The splice proves itself before anything is staged

The entry is appended before the migrations array's closing bracket. The
candidate text is written to a temp file, imported, and `migrateConfig` must
run clean over the result — parse proof precedes staging.

#### Scenario: A splice that breaks the file never lands
- **WHEN** the candidate import throws or `migrateConfig` fails
- **THEN** refusal shows the failure; `config-migrations.mjs` is untouched

### Requirement: Same ceremony, same stops

Render the draft, show the plan, require the TYPED confirmation, write, stage,
STOP, print the commit command. The human's commit is the signature — Tier 3
is mechanically assisted, never bypassed.

#### Scenario: Declining writes nothing
- **WHEN** the operator types anything but the confirmation word
- **THEN** the tree is byte-untouched

### Requirement: The backlog rides the contract

The three pending drafts (1.2.0 #456, 1.3.0 #312, 1.4.0 #814) are converted
to `brain-migration/1` blocks in this change.

#### Scenario: A converted draft parses
- **WHEN** the parser runs over each converted draft
- **THEN** all three yield valid entries
