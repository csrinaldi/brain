---
issue: 853
phase: design
---

# Design — #853

## D1 — reachability, asked of git

`git merge-base --is-ancestor <tag> HEAD` answers "is the tag on this history"
with an exit code, and it is the same question `--is-ancestor` exists for.
No commit-graph walking here: the tool already knows (the lesson #850's rounds
kept teaching — ask the tool, do not reimplement it).

Equality is subsumed: a commit is its own ancestor, so the tagged-commit
scenario needs no special case.

## D2 — the early-return on "no tag" stays

Publishing before tagging is normal and the existing `try/catch` around
`rev-parse` already expresses it. Untouched.

## D3 — the failure message changes with the meaning

The old message told the operator to "bump the version before the first
publish" — advice that was wrong in the case it actually fired on, since the
publish had happened. The new one names what it found: a tag that is not on
this history, with both commits, and says what that means.

## D4 — CI's tag-blindness is NOT fixed here

`local-checks` checks out without tags, so this check remains inert in CI. That
is a separate question (should the gate see tags at all?) and answering it by
adding `fetch-depth: 0` to a job would change what CI fetches for every run —
out of scope for a red-suite fix, and recorded in the issue rather than
silently bundled.
