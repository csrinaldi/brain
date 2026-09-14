# Delta for governance (issue #961)

Ratified rulings R1-R10 (maintainer, 2026-09-14, issue #961 comment) are the source of
truth and are not reopened here. Delivery: Tier-1 PR — the command literal renames in
this delta land in the same PR as the `package.json` rename (R9's Tier-1-PR principle
applied to this domain's own requirement text).

## MODIFIED Requirements

### Requirement REQ-S5-3: brain:save Gates Session Summary + Memory

`brain:save` MUST: (a) call `brain:memory:share` to materialize memory, (b) verify that
`.memory/` now has uncommitted changes (i.e., new observations exist), (c) commit the
`.memory/` changes. It MUST exit non-zero if no new memory was materialized.

(Previously: cited the bare `memory:share` name; the Gaps and Assumptions entry (G3)
describing this invariant is renamed in the same edit.)

[**unit-testable**: stub brain:memory:share and git commands; assert exit non-zero when no .memory/ changes appear]

#### Scenario: No new memory causes refusal

- GIVEN `brain:memory:share` runs but produces no new .memory/ changes
- WHEN `brain:save` runs
- THEN it exits non-zero with a message asking the user to capture a session summary

#### Scenario: New memory present — commits and exits zero

- GIVEN `brain:memory:share` produces new .memory/ changes
- WHEN `brain:save` runs
- THEN the .memory/ changes are committed and the command exits zero
