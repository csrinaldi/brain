---
status: draft
issue: 648
---

# Tasks — brain stops shipping somebody else's environment (issue 648)

- [x] Measure the real surface: 8 files under `brain/scripts/**`, all in `files`
- [x] Derive `ALLOWED_REAL` from what is actually there, rather than guessing
- [x] RED FIRST: the guard, red against the current tree — exactly **1** offender,
      named with its file
- [x] Replace the hostname; keep four path segments so the test still tests
      nested groups
- [x] Rewrite the phase references on live and shipped surfaces only
- [x] Fixtures re-parsed as JSON; payloads untouched, `note` fields only
- [x] 4/4 green; `npm test` **3556 pass / 0 fail**; `brain:repo:check`, `brain:nav` clean
- [x] Mutation proof ×4, each diffed, re-read from disk, reverted byte-identical

## Mutation proofs

| # | mutation | expected red | observed |
|---|---|---|---|
| M1 | restore the real hostname in the fixture | the rule | **1 red** (2), naming the file |
| M2 | `isNotAHostname` always true (everything skipped) | the classifier probe | **1 red** (4) |
| M3 | empty `ALLOWED_REAL` | vacuity guard + rule | **2 red** (1, 2) |
| M4 | walker stops recursing | vacuity guard | **1 red** (1) |

`diff -q` after the last revert: **byte-identical**, both files.

## Two defects in my own guard, caught before commit

**It shipped what it forbade.** The first draft quoted the offending hostname in
its header to explain itself, and excluded itself from its own scan so it would
pass. That is #647 D6 exactly — a document that records a finding by quoting it
becomes the finding — committed while I was writing the ticket about it. Fixed by
describing the host, removing the self-exclusion, and assembling the negative-case
probe at runtime.

**Its hostname rule was a blocklist.** `!h.includes('.')` let `…#v1.0.0` through
as a foreign host: an ellipsis-truncated URL in a doc comment, where the version
number supplied the dot. Replaced with a positive `[a-z0-9.-]` match. A rule
written as "not the shapes I happened to see" reports the next shape as a finding.

## Out of scope

`openspec/changes/**` (51 of 59 occurrences) and `CHANGELOG.md`. Records of what
was planned and what it was called; editing them to tidy the past is falsifying
them. The #610 runbook's §3 also still names it — that section is being rewritten
by #647, which is where the correction belongs.
