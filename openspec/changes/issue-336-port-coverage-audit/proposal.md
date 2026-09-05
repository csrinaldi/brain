---
issue: 336
phase: proposal
---

# Proposal — M10 Phase 1: the port's coverage, measured by a script

## Intent

Produce the one table #336 asks for — port verb × contract test × fixture
provenance × consumers — as a **reproducible script**, so the gap list Phase 2
slices from is data rather than a hand-grep that rots.

## Measured before designing (main @ 1a0e3d9)

- `github.mjs` exports **28** verbs as functions.
- `brain/scripts/vcs/fixtures/` holds **60** JSON fixtures, **all 60** carrying
  `_provenance`. Its keys across the set: `endpoint`, `date`, `derived`,
  `recorded`, `measured`, `live_verified`, `note`, `shape_note`, `content_note`.
- Fixtures are named `<provider>-<verb>-<case>.json`, so verb→fixture is a
  mechanical join, not a guess.
- The contract test titles each case `<provider>.<verb> (contract)`.
- Consumers call the port as `vcs.<verb>(`. The most-called verbs today:
  `prReviews` (7), `issueView` (7), `prView` (6), `whoami` (5).

## Scope — detection only

A new `brain/scripts/vcs/port-coverage.mjs` and its `brain:port:coverage`
verb. Markdown by default, `--json` for machines. **No new contract test, no
new fixture, no adapter change** — #336 is explicit that this milestone
measures the surface and does not move it.

## The four columns, and where each is read from

| column | source | never |
|---|---|---|
| Port verb | `export function` / `export async function` in each provider adapter | a hand-kept list |
| Contract test | the verb's presence in `vcs.contract.test.mjs`, then in any other `*.test.mjs` | assumed from the name |
| Fixture provenance | `_provenance` in each `<provider>-<verb>-*.json` | inferred from the file's shape |
| Consumers | `vcs.<verb>(` across `brain/scripts/**`, excluding tests and the adapters themselves | alphabetical order |

## Why ranking by consumers is the point

`prReviews` is the worked example the ticket names: it stayed unpinned until it
broke the reviewer subsystem (#317). A gap list sorted alphabetically would
have placed it between `prCommits` and `prStatusRollup` and said nothing. Sorted
by blast radius it is at the top, and the report says so in its own words.

## Non-goals

Fixing any gap it finds. Phase 2 owns that, and it will be sliceable precisely
because this ran first.

## What the first real run found — and where it contradicts the ticket

Run on `main`, 55 rows (28 github + 27 gitlab verbs):

- **Coverage: 45 contract, 10 elsewhere, ZERO uncovered.** #336's acceptance
  expects `prReviews` to appear as uncovered; it reads `contract`. The gap the
  ticket was written around closed after it was filed. The report states that
  difference in its own output rather than restating the ticket's prediction.
- **Provenance: 0 recorded, 15 derived, 8 mixed, 32 none.** Not one verb has
  fixtures that are all recorded, and **51 of 60 fixture files carry
  `derived: true`**. The exposure moved: contract coverage is complete, and
  what those covered tests are checked AGAINST is largely assumption.
- **Five fixtures matched no exported verb** — four for `github.postmergeRuns`,
  which no adapter exports, and one outside the naming convention. Found by
  cross-checking the report's own fixture total against a direct count of the
  directory; the audit now reports them instead of dropping them.

That last one is the reason this had to be a script and not a hand-written
table: the discrepancy was five files, and no one would have noticed it by
reading.
