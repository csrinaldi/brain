# Spec — Lane Branch Reconciliation (issue #936, absorbs #930)

## Purpose

The lane sweep (ADR-0034) MUST revisit every `memory/<host>-*` branch this
host owns and resolve it correctly (today's branch through today's ship path,
prior days' branches through the sweep): delivered
branches are cleaned up, pending branches are re-shipped without absorbing
new records, human-closed branches are reported forever (never reopened),
and anything unreadable is kept and reported rather than guessed. Layout
choice: this is a flat `spec.md` under the change directory, matching #920's
precedent — `openspec/specs/**` carries no memory-lane capability entry by
repo convention (#888, #920), and the proposal's own Capabilities section
states "Modified Capabilities: None". The `mrList` shape widening (#930) is
in scope here because both providers are internal VCS-port adapters with no
public capability spec of their own; their contract lives in
`vcs.contract.test.mjs`, not `openspec/specs/**`.

## Requirements

### Requirement: `mrList` reports merge state additively

The VCS port's `mrList` MUST return, for each item, the fields it returns
today (`number`, `title`, `headBranch`) plus an additive `merged` boolean
and the PR's `state` (`open` or `closed`). Both the GitHub and GitLab
providers MUST implement this identically. Existing callers that only read
today's fields MUST keep working unchanged.

#### Scenario: Both providers report merged state

- GIVEN a closed, merged PR and a closed, unmerged PR for two different
  branches
- WHEN `mrList` is called against GitHub or GitLab
- THEN each returned item includes `merged: true|false` and `state: 'closed'`
  matching the provider's own record, alongside the unchanged
  `number`/`title`/`headBranch` fields

#### Scenario: Existing consumers are unaffected

- GIVEN a caller written against the pre-#930 `mrList` shape
- WHEN `mrList` now returns the additive fields
- THEN the caller's existing field reads are unaffected, and the port
  contract test (`vcs.contract.test.mjs`) and both providers' fixtures
  assert the new shape

### Requirement: Content delivery is decided by a shared, fail-closed helper

The system MUST expose one shared helper that classifies a lane ref's
content delivery to `origin/main` as `delivered`, `pending`, or `unknown`,
reused by both the same-day reparent and the cross-day sweep. The helper
MUST check only the paths the lane ref added since it branched from `origin/main`
(not the whole tip tree, so a record later scrubbed from `main` never reads as
pending forever), all-or-nothing (never a partial
match), and MUST return `unknown` — never `delivered` — when the read
cannot be completed.

#### Scenario: Fully delivered tip

- GIVEN every path the lane ref added is already present, byte-identical, in
  `origin/main`'s content
- WHEN the helper classifies the ref
- THEN it returns `delivered`

#### Scenario: Partially delivered tip fails closed

- GIVEN only some of the lane ref's tip-tree paths are present in
  `origin/main`'s content
- WHEN the helper classifies the ref
- THEN it returns `pending`, never `delivered`

#### Scenario: An unreadable state never resolves to delivered

- GIVEN `origin/main` cannot be fetched, or the content diff cannot be
  resolved
- WHEN the helper classifies the ref
- THEN it returns `unknown`

### Requirement: Same-day append reparents onto `origin/main` when the existing tip is fully delivered

`collectLane`'s step 8 MUST call the shared helper on the existing local
ref's tip before deciding the new commit's parent. When the tip is
`delivered`, the system MUST parent the new commit on `origin/main`'s tip
and reset the ref with a compare-and-swap `update-ref` (old value = the
prior tip). When the tip is `pending` or `unknown`, the system MUST append
on the existing tip exactly as before this change.

#### Scenario: #1050 repro — reparent after a same-day squash-merge

- GIVEN record X was shipped and squash-merged into `origin/main` today,
  the local ref still points at the pre-merge commit, and record Y is then
  collected
- WHEN the lane is shipped again today
- THEN the new commit's parent is `origin/main`'s tip, the three-dot diff
  (PR title, body, "Files changed", `lane-paths`/`lane-scrub`) lists only Y,
  and X is not re-listed

#### Scenario: Partial or unknown delivery still appends

- GIVEN the existing local ref's tip is only partially delivered, or its
  delivery state cannot be read
- WHEN a new record is collected on top of it
- THEN the new commit parents on the existing tip, unchanged from today's
  behavior, and no ref reset is attempted

### Requirement: The cross-day sweep reconciles every local and remote `memory/<host>-*` ref for this host

The system MUST enumerate this host's local and remote `memory/<host>-*`
refs other than today's (today's ref is reconciled by today's ship path, under
the same closed-PR rule) and dispatch each one per the table below, using
the shared helper for the delivered/pending/unknown classification and
`mrList`'s `merged`/`state` fields for PR status. When a branch has several PRs, an open PR wins; otherwise the
highest-numbered PR decides. There is no age cutoff;
every unreconciled ref for this host is revisited every run, regardless of
how many days old it is. The sweep MUST NOT enumerate or act on any other
host's refs.

| Branch state | Action |
|---|---|
| Delivered by content to `origin/main` | Delete the local ref only |
| Pending, no PR or an open PR | Re-ship through today's ship path, without collecting new records into it |
| Pending, PR closed unmerged | Never re-ship and never reopen a PR; report branch + PR on every run |
| Unknown (including an `mrList` failure or a missing `merged`/`state` field) | Keep the branch and report it |
| Stale remote branch blocks the push | Fail loud with `diverged`; never force |

#### Scenario: Delivered prior-day ref is deleted

- GIVEN a prior-day local `memory/<host>-*` ref whose tip content is fully
  present in `origin/main`
- WHEN the sweep runs
- THEN the local ref is deleted and no push, PR lookup, or re-ship is
  attempted for it

#### Scenario: Pending prior-day ref is re-shipped without absorbing today's records

- GIVEN a prior-day ref that is `pending` with no PR or an open PR, and
  today's lane has its own newly collected records
- WHEN the sweep runs
- THEN the prior-day ref is re-shipped through the ship path with
  collection disabled for that re-ship, and today's newly collected records
  never appear in the prior-day ref's tree or PR

#### Scenario: Closed-unmerged ref is reported, never reopened, on every run

- GIVEN a `pending` ref with no open PR whose highest-numbered PR is closed and `merged: false`
- WHEN the sweep runs, on this run and every subsequent run
- THEN no push, no `mrCreate`, and no `mrList`-driven reopen occur, and the
  branch name and PR number are reported in both `day:start`'s sweep output
  and `memory:ship --json`'s outcome

#### Scenario: Unknown state is kept and reported, not guessed

- GIVEN a ref whose delivery state is `unknown`, or whose `mrList` call
  throws, or whose returned item is missing `merged` or `state`
- WHEN the sweep runs
- THEN the ref is neither deleted nor re-shipped; it is kept and reported
  as unresolved

#### Scenario: A stale remote branch blocks the push loudly

- GIVEN a `pending` ref's remote counterpart has diverged (moved ahead
  independently) since the local ref was last read
- WHEN the sweep attempts to re-ship it
- THEN the push fails loud as `diverged`, no force-push is attempted, and
  the ref is reported unresolved

### Requirement: #920's ruling R8 is reversed for every branch, including today's

#920's R8 ("PR closed unmerged ⇒ pending ⇒ push if needed, then a fresh
PR") is REVERSED by this change. The system MUST NOT open a fresh PR for a
branch whose only PR was closed unmerged, regardless of whether that branch
belongs to today or a prior day. It MUST instead report the branch and PR
on every run, as specified above. R8's code comment MUST be updated to
state the reversal and reference this change.

(Previously: #920 R8 required a closed-unmerged branch to be pushed, if
needed, and given a fresh PR on the next run.)

#### Scenario: Today's closed-unmerged branch also stops reopening

- GIVEN a lane PR opened earlier today was closed without merging, and the
  branch still has pending content
- WHEN the lane is shipped again later the same day
- THEN no fresh PR is opened; the branch and PR are reported instead

### Requirement: Invariants are preserved

This change MUST NOT force-push in any path, MUST NOT change
`LANE_BRANCH_RE` or any other branch-grammar constant, and MUST NOT change
any governance gate's or `memory-gate`'s semantics.

#### Scenario: No force-push under any sweep outcome

- GIVEN any row of the sweep table, including a stale remote branch
- WHEN the corresponding action is taken
- THEN no `--force` or `--force-with-lease` push occurs anywhere in the
  path

#### Scenario: Branch grammar and gates are untouched

- GIVEN the sweep and reparent logic ship
- WHEN `LANE_BRANCH_RE`, `lane-paths`, `lane-scrub`, or `memory-gate` are
  inspected
- THEN their behavior is byte-for-byte the same as before this change,
  aside from R8's code comment update

### Requirement: Reconciliation tests run against a local bare origin, never a real remote

Every test that exercises delivery classification, reparenting, or the
sweep table MUST run against a local bare `origin` created for the test,
and MUST NOT reach a real GitHub or GitLab remote.

#### Scenario: The #1050 repro is a bare-origin integration test

- GIVEN a local bare origin fixture
- WHEN the test ships X, squash-merges X on the bare origin with plain
  git, keeps the local ref, collects Y, and ships again
- THEN the test fails before this change (X re-listed) and passes after it
  (only Y listed, parent is `origin/main`'s tip), without any network call

#### Scenario: Every sweep table row has a bare-origin assertion

- GIVEN the sweep table's five branch states
- WHEN the test suite runs
- THEN each state is asserted against the local bare origin, including at
  least one prior-day ref, with no real remote involved

## Out of Scope

- `LANE_BRANCH_RE`, branch grammar, and every governance gate or
  `memory-gate` semantic change.
- Force-push in any path.
- The ADR-0034 L2 auto-merge policy — deferred to epic #864 task 6.1.
- Other hosts' lane refs.
- An age cutoff or retention expiry for the cross-day sweep.
