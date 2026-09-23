# Proposal — ADR-0006 Amendment 2 (issue #729)

## Problem

ADR-0006's Amendment 1 (#617) was written while the chosen registry scope was
`@csrinaldi`. Two things have happened to it since, and neither reached the file.

1. **#653 moved the scope to `@logikas`** and corrected ADR-0030's own copy of the
   sentence. ADR-0006's cross-reference was left naming `@csrinaldi/brain` — in the
   present tense, and in the code comment that exists to tell a reader what to type
   instead. `@csrinaldi/brain` returns `404` and nothing was ever published under it.
2. **#435 closed**, publishing `@logikas/brain@1.1.0`. Amendment 1's
   `### The accepted loss` paragraph asserts `private: true`, `"name": "brain"`, a
   git-URL install spec and "#435's mechanical half is open". All four expired.

The second is the one that costs a reader something: they reach that paragraph and
conclude ADR-0006's install line is what runs today.

## Why now

The publish landed this morning. A superseded ADR is allowed to be wrong about the
future; it is not allowed to describe the present incorrectly while a reader is
looking for what replaced it.

## Approach

One in-place amendment through `brain:promote` Route B — §1c's acts: numbered Status
stamp, `amend-find`/`amend-replace` pairs for the three sites, an appended signed
section, and the `brain/HOME.md` marker.

The expired paragraph is **terminated, not deleted**. It records a deliberately
accepted ordering and #590's measurement of what the reverse costs; removing it would
erase the reasoning that justified signing ADR-0030 first.

Dated measurements are **preserved as measured**, including one PR #728 falsified
hours earlier. ADR-0030 treats the identical fact the same way.

## Non-goals

- Any change to ADR-0030, already correct since #653.
- Any change to `test/fresh-install/**` — that is #435, delivered in PR #728.
- Re-numbering, re-wording or re-statusing any other ADR.

## Authority

`brain/project/decisions/**` is Tier 3. The agent produces and verifies the draft;
the maintainer runs the verb and commits, and that commit is the signature (ADR-0028).
