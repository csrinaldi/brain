---
status: draft
issue: 518
---

# Design

`countUnauditedNonMerges(range, cwd)` — `--first-parent --no-merges`, the exact complement
of `listMerges`'s filter, through `gitTry` so an unreadable range answers `null` instead of
turning a healthy audit red.

## Why a report and not a gate

Three options existed. **(c)** — report squashes as `uncomputable` — is the most correct on
paper and the worst in practice: uncomputable dominates (#474), so the cursor would halt
today over 33 commits of existing history, and the documented remedy becomes routine. A
remedy that has to be run routinely stops being a remedy; #518 says so about a different
remedy in the same file.

**(a)** stops the silence without moving anything the exemption model rests on. **(b)** is
the fix and is a design change.

## A test that could not see what it existed to see

The uncountable-range guard first asserted `/unknown|audit-uncomputable/` on the CLI's
output. The audit dies on a bad range before the count is ever consulted, so the assertion
was satisfied by the *other* branch, and a mutation returning `0` instead of `null` stayed
green. Driven as a unit now.

An `||` in an assertion is a place a weaker answer can hide — the third instance of that
shape this week.
