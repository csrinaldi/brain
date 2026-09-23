---
status: draft
issue: 676
---

# Spec — every signed ADR on disk carries exactly one Status line (issue 676)

## Purpose

`test/adr-status-line-single.e2e.test.mjs` sweeps every signed ADR already on
disk and asserts §1c act 1's invariant — exactly one `**Status**:` line — by
calling `checkSingleStatusLine`. Point 1 (PR #692) repaired the one violation
that existed, so this suite is **born GREEN** on 30/30 ADRs. A green test
that was never watched to fail proves nothing; the mutation obligation in
REQ-676-6 is part of the acceptance criteria, not follow-up work.

## REQ-676-1 — The subject is every ADR on disk, enumerated from the filesystem

The suite MUST enumerate `brain/project/decisions/adr-*.md` at run time from
the filesystem. It MUST NOT use a hardcoded list of ADR paths or numbers.

#### Scenario: a new ADR is covered without editing the test

- GIVEN a new file `brain/project/decisions/adr-0031-example.md` is added
- WHEN the suite runs
- THEN it is included in the swept set with no change to the test file

## REQ-676-2 — The check calls `checkSingleStatusLine`, never re-derives it

The suite MUST import `checkSingleStatusLine` from
`brain/scripts/lib/amendment-draft.mjs` and assert on its `{ok, count,
indices}` return shape. It MUST NOT contain an independent regex or
line-count implementation of the same rule.

#### Scenario: the assertion delegates

- GIVEN a signed ADR's text
- WHEN the suite checks it
- THEN it calls `checkSingleStatusLine(text)` and reads `ok`/`count`/`indices`
  from the result — no second `**Status**:` counter exists in the test file

## REQ-676-3 — An empty enumeration FAILS, never passes vacuously

The suite MUST fail if enumeration returns zero ADR files. A reader that
returns `[]` and lets the suite go green is the
`evidence-reader-empty-on-failure` anti-pattern this suite is most likely to
rot into.

#### Scenario: zero files found

- GIVEN a decisions-directory read that yields zero `adr-*.md` files
- WHEN the suite runs
- THEN it FAILS with a message stating zero files were found

#### Scenario: baseline sanity floor

- GIVEN the repository's real decisions directory (30 ADRs at time of writing)
- WHEN the suite runs
- THEN it asserts the enumerated count exceeds a low sanity floor, catching a
  reader that silently under-reads the directory

## REQ-676-4 — The failure names the file, the count, and the remedy

On a violation the suite MUST report the offending file's path and the
Status-line count returned by `checkSingleStatusLine`, and MUST state that
`brain:promote`'s amendment path (`applyStatusAct`) REFUSES a file in this
state, and that `brain/project/decisions/**` is Tier 3 for an agent.

#### Scenario: two Status lines

- GIVEN an ADR with two `**Status**:` lines
- WHEN the suite runs
- THEN it fails naming the path, count `2`, and states the amendment path
  refuses the file and repair is by hand under Tier 3

#### Scenario: zero Status lines

- GIVEN an ADR with zero `**Status**:` lines
- WHEN the suite runs
- THEN it fails naming the path and count `0`, with the same remedy text

## REQ-676-5 — No exemption list, no allowlist, no skip label

The suite MUST NOT contain any registry, exemption list, allowlist, or skip
mechanism for any ADR file or number. There is no legitimate second Status
line in a signed ADR.

#### Scenario: source contains no registry

- GIVEN the suite's source
- WHEN it is read
- THEN no list of excluded file paths, ADR numbers, or skip labels exists

## REQ-676-6 — The green is proven by mutation before it is trusted

Before this suite's pass is trusted, its red path MUST be exercised, against
a real signed ADR, on each of these axes — then reverted with `git checkout
--`:

1. a file carrying two `**Status**:` lines,
2. a file carrying zero `**Status**:` lines,
3. an enumeration that returns no files.

A green recorded without exercising all three axes is not evidence the suite
detects the defect it exists to catch
(`red-proof-blind-along-an-unvaried-axis`).

#### Scenario: two-line mutation goes red, then reverts

- GIVEN a real signed ADR mutated to carry two `**Status**:` lines
- WHEN the suite runs against the mutated tree
- THEN it fails, naming the mutated file
- AND after `git checkout -- <path>` the suite is green again

#### Scenario: zero-line mutation goes red, then reverts

- GIVEN a real signed ADR mutated to remove its `**Status**:` line
- WHEN the suite runs against the mutated tree
- THEN it fails, naming the mutated file
- AND after `git checkout -- <path>` the suite is green again

#### Scenario: empty enumeration goes red

- GIVEN the decisions-directory reader returns no files
- WHEN the suite runs
- THEN it fails per REQ-676-3, not a vacuous pass
</content>
