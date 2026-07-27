# ship-pr-label-resolution Specification

## Purpose

`brain:ship` derives the PR label and title prefix from the linked issue's
own `type:*` label instead of the hardcoded `'kind:feature'` at
`brain-ship.mjs:94`. Consumes `issueView` (sibling spec
`vcs-issue-view-contract`) for the source label and `vcs-label-preflight`
(sibling spec, same change) to validate it exists on the remote before
`mrCreateFn` runs. Together the three specs close issue #334: read the
issue's label, validate it against the remote, ship with it verbatim.

This spec also resolves `governance` REQ-S5-4's previously undefined
"correct labels" clause (see Cross-Reference below).

## Requirements

### Requirement: Label sourced verbatim from the issue's `type:*` label

The system MUST extract the issue's own `type:*` label from the
`issueView` result and pass it **verbatim** to `mrCreateFn` — never
re-mapped, translated, or substituted with a different taxonomy (e.g.
`bug` MUST NOT become `fix`; no `ci`/`build` labels exist remotely to map
to). No inference from branch name or config default MUST occur when a
`type:*` label is present on the issue.

#### Scenario: Issue's type label passes through unchanged

- GIVEN `issueView` returns `labels: ['type:bug', 'status:approved']`
- WHEN `brain:ship` resolves the PR label
- THEN `mrCreateFn` is called with `labels: ['type:bug']`

### Requirement: Title prefix derived via `deriveBranchType` (title only)

The system MUST derive the PR title's conventional-commit prefix by passing
the issue's labels through the existing `deriveBranchType` mapping. This
mapping MUST be used only for the title prefix, never for the label sent to
`mrCreateFn`.

#### Scenario: Title prefix matches conventional-commit format

- GIVEN `issueView` returns `labels: ['type:bug']` and the branch slug `fix-the-thing`
- WHEN `brain:ship` builds the PR title
- THEN the title matches `type: description` conventional-commit format (e.g. `fix: the thing`)
- AND the label sent to `mrCreateFn` remains `type:bug`, unaffected by the title mapping

### Requirement: Preflight validation gates PR creation

The system MUST call the label preflight (`vcs-label-preflight`) with the
resolved label before invoking `mrCreateFn`. If the preflight resolves
`exists: false`, `brain:ship` MUST refuse and exit non-zero without opening
a PR.

#### Scenario: Preflight rejection blocks shipping

- GIVEN the resolved label `type:bug` does not exist on the remote's label set
- WHEN `brain:ship` runs
- THEN it exits non-zero with an actionable error
- AND `mrCreateFn` is never invoked

#### Scenario: Preflight success allows shipping

- GIVEN the resolved label `type:bug` exists on the remote's label set
- WHEN `brain:ship` runs
- THEN `mrCreateFn` is invoked with `labels: ['type:bug']`

### Requirement: Fail closed when no `type:*` label is present

The system MUST refuse and exit non-zero, with an actionable error, when the
linked issue carries no `type:*` label — `brain:ship` MUST NOT infer a
default or fall back to a hardcoded label.

#### Scenario: Missing type label refuses to ship

- GIVEN `issueView` returns `labels: ['status:approved']` (no `type:*` entry)
- WHEN `brain:ship` runs
- THEN it exits non-zero with an error naming the missing `type:*` label
- AND `mrCreateFn` is never invoked

### Requirement: Cross-Reference — governance REQ-S5-4 "correct labels"

`governance/spec.md` REQ-S5-4 requires `brain:ship` to open a PR with
"correct labels" without defining the term. This spec defines it: a label is
correct when (a) it is the issue's own `type:*` label, sourced verbatim
(never re-mapped), and (b) it is confirmed present in the remote's declared
label set via `vcs-label-preflight` before the write. This requirement does
not modify REQ-S5-4's text; it is the operational definition satisfying it.

#### Scenario: REQ-S5-4 satisfied end-to-end

- GIVEN an approved issue with `type:bug` present in the remote's label set
- WHEN all four `brain:check` invariants pass and `brain:ship` runs
- THEN the opened PR carries `type:bug` and REQ-S5-4's "correct labels" clause is satisfied
