---
status: draft
issue: 651
---

# Tasks — own the public session record (issue 651)

- [x] Confirm §1 closed before deciding §2b — prune has no rationale without
      something to rotate
- [x] RED FIRST: the guard against the current README — 4 of 5 claims missing
      (`.memory/` already appears in the layers diagram, so that one passed)
- [x] Write the section: what is in them, why public, the audit, and that they
      do not ship
- [x] 2/2 green; `npm test` **0 fail**; `brain:repo:check`, `brain:nav` clean
- [x] Mutation proof ×4, each diffed, re-read from disk, reverted byte-identical

## Mutation proofs

| # | mutation | expected red | observed |
|---|---|---|---|
| M1 | delete the whole section | the claims | **1 red** |
| M2 | **keep the section, strip "on purpose"** | the deliberateness claim | **1 red** |
| M3 | drop the word "audited"/"pre-flight" | the audit citation | **1 red** |
| M4 | empty the claim list | vacuity guard | **1 red** |

`diff -q` after the last revert: **byte-identical**, both files.

**M2 is the one that justifies the guard.** M1 is a deletion anybody would
notice in review. M2 is a copy-edit: the section stays, reads fine, and the
decision is gone — back to public by omission, with nothing failing. That is the
failure this exists to catch.

## A number that would have aged

The first draft said "2,180 records" flat. Every session adds one, so the
sentence becomes false the day after it is written, in a README that ships. Now
it reads *"as of the 2026-08-13 audit"* — a dated measurement instead of a
floating claim.

## Out of scope

`.memory/` itself, the memory backends, `files` in `package.json`. The tarball is
#607's and settled.
