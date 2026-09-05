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

## Round 4: the audit was blind the way #317 was blind

Three review rounds hardened the boundaries of `vcs.<verb>(` — escaping the
verb, then anchoring both sides — while the OBJECT NAME was the wrong premise.
Production reaches the port through several bindings (`providerModule.<verb>(`,
`(await getVcsFn({provider})).<verb>(`), and measured before the fix:
`branchProtect`, `capabilities` and `mrCreate` all read **`consumers: 0` with
live call sites**.

That is #317's failure mode reproduced inside the tool built to end it, and it
survived three rounds of tightening the wrong thing. After the fix they read 1,
1 and 1, and the population of zero-consumer verbs fell from 10 to 7.

(That first number was published as **2** and round 6 measured it wrong: the
audit was counting ITSELF, because this file names `providerModule.branchProtect(...)`
in its own prose. Round 6 fixed three things at once — comments are stripped
before matching, the tool is excluded from its own consumer walk, and a
runtime-resolved dispatch is reported rather than counted.)

The receiver is now any expression; the verb carries the identity. The trade is
one-directional and deliberate: over-counting moves a verb UP a list someone
reads, under-counting hides it at the bottom — which is exactly how `prReviews`
stayed invisible. Between a wrong number and a missing row, this audit chooses
the wrong number.

## Round 6: three ways the count could still lie

- **A mention is not a call.** This file's own comments name the verbs it
  discusses, and `gather()` walked it like any other consumer — so
  `branchProtect` read 2 with one real call site. That is
  `rec-de8fc48c0201e015` ("count callers by IMPORT, never by mention"),
  already on file from #603, reproduced across five rounds that hardened this
  very regex. Comments are stripped now, and the tool is excluded from its own
  walk: an audit is not a consumer of the thing it audits.
- **A dispatcher reaches everything and proves nothing.** `vcs/cli.mjs` calls
  `vcs[verb](args)` with the verb from argv, so seven verbs read `consumers: 0`
  while being reachable. Counting it per verb was this fix's OWN first cut and
  inflated `branchProtect` to 8 — the same sin in the other direction. It is
  reported as its own line now, naming the files, and no count moves.
- **A verb named in a test's prose is not a test.** `coverageOf` strips
  comments too, for the same reason in the other column.
