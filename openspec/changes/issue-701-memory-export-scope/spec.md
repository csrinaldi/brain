# Memory Export Scope Specification

## Purpose

Scope `memory:share`'s export and the staged-record gate to one mechanical
predicate — id presence at the upstream base — so worktrees stop
re-exporting records already on `origin/main`, with no authorship
semantics and no loss of reachability or duplicate reporting.

## Requirements

### Requirement: Export dedup covers the upstream base, not only the worktree's own records

`dualWriteRecords` MUST decline to write a candidate record whose id is
already present in `records/` at `origin/main` (or the merge-base),
IN ADDITION to the existing check against the worktree's own `records/`.
The predicate MUST be content-addressed only (record id presence) — no
worktree, branch, or `issue`-field semantics.

#### Scenario: Record already on origin/main is deduped

- GIVEN a candidate record's id exists in `records/` at `origin/main` but not in the worktree's own `records/`
- WHEN `memory:share` runs `dualWriteRecords`
- THEN the record is deduped (not written) and `accounting.deduped` increments

#### Scenario: Existing own-worktree dedup still applies

- GIVEN a candidate record's id already exists in the worktree's own `records/`
- WHEN `dualWriteRecords` runs
- THEN the record is deduped, unchanged from current behavior

#### Scenario: Genuinely new record is still written

- GIVEN a candidate record's id is absent from both the worktree's own `records/` and `origin/main`'s `records/` (the `issue=545` case)
- WHEN `dualWriteRecords` runs
- THEN the record is written

### Requirement: Sibling-worktree records not yet on origin/main are an acknowledged residual

The upstream-base predicate is NOT required to detect a record authored
in a sibling worktree that is already in the shared host-global engram DB
but not yet pushed to `origin/main`. Such a record MAY still be written,
unchanged from current behavior — deferred, not solved, by this change.

#### Scenario: Sibling-worktree record not yet on origin/main is still written

- GIVEN a record authored in worktree B is in the shared engram DB but not yet on `origin/main`, and worktree A has not pulled it
- WHEN `memory:share` runs in worktree A
- THEN export MAY still write that record as untracked, because it is absent from both worktree A's `records/` and `origin/main`
- AND this is a known, unmeasured residual, not resolved by this change

### Requirement: Merge is never refused because of an export-written record

Once dedup covers the upstream base, `git merge`/`pull` MUST NOT exit
with "local changes would be overwritten" caused by `.memory/records/`
files that export wrote.

#### Scenario: Merge no longer blocked by exported records

- GIVEN a worktree where `memory:share` has just run under the widened dedup
- WHEN the worktree runs `git merge origin/main`
- THEN the merge does not exit 2 with "local changes would be overwritten" due to `.memory/records/` files

### Requirement: Staged-record gate refuses byte-identical re-commits, using the same predicate

A pre-commit/pre-push hook MUST refuse when a staged `.memory/records/`
path's blob is byte-identical to that path's blob at `origin/main`. This
reuses the export's upstream-base predicate as the SAME mechanism at a
second call site — no separate authorship logic.

#### Scenario: Gate blocks an accidental byte-identical restage

- GIVEN `git add .memory/` stages a `records/*.jsonl` file whose blob is byte-identical to `origin/main`'s copy of that path
- WHEN the pre-commit or pre-push hook runs
- THEN the commit/push is refused, naming the byte-identical path

#### Scenario: Gate allows genuinely new or divergent content

- GIVEN a staged `records/*.jsonl` file differs from `origin/main`'s copy
- WHEN the hook runs
- THEN the commit/push proceeds

### Requirement: Duplicate and divergence reporting keeps working

`resolve-index`'s report MUST continue to name any divergent pair (same
id, different content) after this change. The fix MUST reduce writes; it
MUST NOT silence or degrade this report.

#### Scenario: Divergent pair still reported after the fix

- GIVEN a divergent pair (same record id, different content) exists across two branches' records
- WHEN `resolve-index` runs after merge
- THEN the report names the divergent pair, unchanged from current behavior

### Requirement: A declined record remains reachable

A record export declines to write, because it is already present at
`origin/main`, MUST remain readable once the worktree is on a commit
containing `origin/main`'s copy. "We stopped writing it" MUST NOT become
"we lost it." This change MUST NOT delete, migrate, or rewrite any
existing record.

#### Scenario: Declined record is still readable after sync

- GIVEN a record present at `origin/main` was declined by export in worktree W
- WHEN worktree W is on a commit containing `origin/main`'s copy of that record
- THEN the record is present and readable in W's `records/`

## Out of Scope (named, not omitted)

- **`post-merge` unreachability on conflicted merges.** Verified: a
  conflicted merge exits 1 and `post-merge` does NOT run; a clean merge
  exits 0 and it does. `resolve-index`'s call at `post-merge:67` is
  therefore structurally unreachable for the one case that needs it —
  a real gap, not fixed here. Closing it needs a different trigger point,
  not a change to this predicate. Needs its own ticket.
- The `source` provenance round-trip widening (ADR-0017 Amendment 1; filed as issue #461).
- Any `.gitattributes`/merge rule for `index.jsonl` — doctrinally refused (`memory-format.md`, ADR-0017; already tried and reverted, PR #360).
- Authorship semantics of any kind.
- `manifest.json`.
