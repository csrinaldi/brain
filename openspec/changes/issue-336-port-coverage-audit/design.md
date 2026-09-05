---
issue: 336
phase: design
---

# Design — #336

## D1 — pure core, IO at the edge

`buildReport({adapters, fixtures, contractText, otherTestText, consumerText})`
is pure: it takes already-read strings and returns rows. The reading lives in a
thin `gather()` the CLI calls. That is what makes the four scenarios testable
without a repository — and what keeps this audit honest about a tree it does
not have to be run inside.

## D2 — verbs come from the adapter, coverage from the tests

Verb extraction is one regex over `export (async )?function <name>` — the
adapters' own declaration. Coverage is a two-step lookup: the verb in
`vcs.contract.test.mjs` first (`contract`), then in any other test file
(`elsewhere`), else `uncovered`. Two steps because "covered elsewhere" is a
real, weaker state the ticket asks to distinguish, not a synonym for covered.

## D3 — provenance is a fold, and disagreement survives it

Per verb: collect `<provider>-<verb>-*.json`, read each `_provenance`, and fold
to `recorded` | `derived` | `mixed` | `none` | `unreadable`. `mixed` exists
because a verb whose fixtures disagree is the #334 shape — a derived fixture
encoding an assumption next to a recorded one — and collapsing it would hide
exactly what the ticket says is load-bearing. `unreadable` exists for the same
reason `uncomputable` does elsewhere in this repo: a file we could not read is
not a file that said `none`.

## D4 — consumers, and why the count is the sort key

`vcs.<verb>(` across `brain/scripts/**`, excluding `*.test.mjs` and
`providers/**` — a provider calling itself is not a consumer. The uncovered
rows sort by that count descending, because the ticket's whole argument is that
alphabetical order is what let `prReviews` hide.

## D5 — the report explains its own worst row

When `prReviews` is uncovered, the markdown says what that cost (#317). Not a
generic legend: the one worked example the ticket names, printed where the
reader is already looking.
