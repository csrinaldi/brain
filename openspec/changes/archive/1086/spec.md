# Spec — Audit PR resolution from the merge commit (issue #1086)

## Purpose

`brain:audit` MUST reach a real verdict for a merge whose subject's trailing `(#N)` is an
issue rather than a pull request, by resolving the pull requests that contain the merge
commit — and MUST keep failing closed on every state where it has no evidence. Layout: a
flat `spec.md` under the change directory (`sdd-layout.md`), matching #920/#936. The VCS
port's contract lives in `vcs.contract.test.mjs` and `vcs-contract.md`, not
`openspec/specs/**`, so the port widening is specified here.

## Requirements

### Requirement: The port answers which pull requests contain a commit

The VCS port MUST expose a read verb that, given a project and a commit sha, returns the
pull request numbers that contain that commit. It MUST return an ascending array of
numbers on a successful read, an empty array when the provider definitively reports none,
and `null` when the read could not be completed. It MUST NOT throw, and MUST NOT fabricate
an empty array on failure. Both the GitHub and GitLab providers MUST implement it.

#### Scenario: A commit with one containing pull request

- GIVEN a merge commit that a single pull request introduced
- WHEN the verb is called with that sha on either provider
- THEN it returns an array holding exactly that pull request's number

#### Scenario: No pull request contains the commit

- GIVEN a commit the provider reports no pull requests for
- WHEN the verb is called
- THEN it returns an empty array, never `null`

#### Scenario: An unreadable lookup is never an empty answer

- GIVEN the provider's transport fails
- WHEN the verb is called
- THEN it returns `null`, does not throw, and the caller can distinguish this from the
  empty-array case

### Requirement: `prView` distinguishes an absent pull request from an unreadable one

`prView` MUST report, additively, whether the failure it is returning is the provider's
definitive statement that the requested number is not a pull request, or a read it could
not complete. A successful fetch MUST report "not absent". A definitive negative MUST
report "absent". Any other failure MUST report the absent state as unknown. The existing
`number`/`labels`/`body`/`author`/`headRefOid`/`baseRefOid` fields and their
uncomputable-versus-empty discipline MUST be unchanged, so a consumer that does not read
the new field behaves exactly as before.

#### Scenario: A number that is an issue, not a pull request

- GIVEN the requested number identifies an issue in the same project
- WHEN `prView` is called for it
- THEN it reports the pull request as absent, still returns `labels: null` and `body: null`,
  and still does not throw

#### Scenario: A transport failure is not an absence

- GIVEN the provider is unreachable, unauthenticated, or rate-limited
- WHEN `prView` is called
- THEN the absent state is reported as unknown, never as absent

#### Scenario: Existing consumers are unaffected

- GIVEN a caller written against the pre-change `prView` shape
- WHEN `prView` succeeds or fails
- THEN every field that caller reads holds the value it held before this change

### Requirement: The audit resolves the pull request by commit sha only on a definitive absence

The shared merge-evidence layer MUST, when the subject's parsed number is reported absent,
resolve the pull requests containing the merge commit and dispatch as the table below
states. It MUST NOT perform that lookup in any other state. A merge resolved by commit sha
MUST then be evaluated from that pull request's own metadata, through the same path a
subject-resolved merge takes.

| State | Outcome |
|---|---|
| Parsed number is a pull request | Audit it, unchanged from today |
| Absent; exactly one pull request contains the merge | Audit that pull request |
| Absent; no pull request contains the merge | Audit from the commit body, the existing no-pull-request path |
| Absent; more than one pull request contains the merge | Uncomputable — never a choice between them |
| Absent; the containing-pull-request lookup fails or is unavailable | Uncomputable |
| The `prView` read could not be completed | Uncomputable, byte-identical to today |

#### Scenario: The real `(#978)` shape is evaluated

- GIVEN a merge whose subject ends in `(#978)`, where `978` is a closed issue and exactly
  one pull request contains the merge commit
- WHEN the audit walks that merge
- THEN it evaluates that pull request's labels, body, author and reviews, and reports a
  real verdict instead of `[UNCOMPUTABLE]`

#### Scenario: A transport failure never reaches the commit-sha lookup

- GIVEN `prView` fails to read the subject's number for a reason other than a definitive
  absence
- WHEN the audit walks that merge
- THEN the merge is uncomputable, and the containing-pull-request lookup is not called at all

#### Scenario: Two containing pull requests are uncomputable

- GIVEN the subject's number is absent and two pull requests contain the merge commit
- WHEN the audit walks that merge
- THEN the merge is uncomputable and neither pull request is evaluated

#### Scenario: No containing pull request falls back to the commit body

- GIVEN the subject's number is absent and no pull request contains the merge commit
- WHEN the audit walks that merge
- THEN the merge is evaluated from the commit body, exactly as a subject that references no
  pull request is today, and the human-gate check abstains rather than failing

### Requirement: The audit output names how the pull request was resolved

`brain:audit` MUST let an operator distinguish, from the output alone: a merge resolved from
its subject, a merge resolved from its commit sha, a merge whose subject's number is not a
pull request and that no pull request contains, and each uncomputable cause. The existing
`[PASS]`/`[FAIL]`/`[FAIL-SHA]`/`[SKIP]`/`[LANE]`/`[UNCOMPUTABLE]` line grammar MUST NOT gain
a new tag, and the existing unreadable-metadata line MUST stay byte-identical.

#### Scenario: A commit-sha resolution is visible on the verdict line

- GIVEN a merge audited through a pull request resolved by commit sha
- WHEN the verdict line is printed
- THEN it carries the resolved pull request's number and states that the subject's number is
  not a pull request

#### Scenario: Each uncomputable cause is distinguishable

- GIVEN one merge whose `prView` read failed and one whose subject's number is absent with
  two containing pull requests
- WHEN both are printed
- THEN each `[UNCOMPUTABLE]` line names its own cause, and the first is byte-identical to the
  line printed before this change

### Requirement: Exit semantics and the audit baseline are unchanged

This change MUST NOT alter the exit-code ladder (0 clean, 1 failing invariant, 2
uncomputable dominates), MUST NOT alter `governance.auditBaseline`, and MUST NOT change any
governance check's verdict for a merge whose pull request was already resolvable from its
subject.

#### Scenario: A previously passing window still passes identically

- GIVEN a window in which every merge's subject references a real pull request
- WHEN the audit runs before and after this change
- THEN the output and exit code are identical

#### Scenario: An uncomputable merge still drives the window to exit 2

- GIVEN any merge that resolves to uncomputable under the table above
- WHEN the audit finishes
- THEN it exits 2 regardless of the other merges' verdicts

### Requirement: Tests never touch the real repository or spawn an entrypoint

Every test for this change MUST run against injected fakes or recorded fixtures, MUST NOT
read or write the real repository's `.git`, and MUST NOT spawn a live CLI entrypoint or
reach a real forge.

#### Scenario: The port verb is exercised from fixtures

- GIVEN the contract suite runs for both providers
- WHEN the new verb's happy, empty and failure cases are asserted
- THEN every transport is the injected fixture reader, each fixture declares exactly one of
  recorded or derived, and no network call occurs

#### Scenario: The fallback matrix is exercised from a fake port

- GIVEN a fake VCS port whose `prView` and containing-pull-request verb are programmable
- WHEN every row of the dispatch table is exercised
- THEN no git process is spawned against the real repository and no entrypoint is executed

## Out of Scope

- `parsePrNumber`'s grammar, `governance.auditBaseline`, and the exit-code ladder.
- Any change to `issueLink`, `diffSize`, `adrPresence`, `writesGoverned` or `memory-gate`
  semantics.
- Rewriting the four merges on `main`, or tagging `v1.6.0` by hand.
