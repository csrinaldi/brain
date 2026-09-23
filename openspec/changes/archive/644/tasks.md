---
status: draft
issue: 644
---

# Tasks — the install spec becomes a package name (issue 644)

- [x] Read `installSpec`, `resolveInstallUrl`, `highestTag`, `compareSemver` and
      every caller before writing anything
- [x] RED FIRST: `install-spec-registry.test.mjs` — missing-export import error
- [x] `specVersion` — the `v` boundary, one place
- [x] `resolveInstallSpec` — registry / git / unresolved, with `source` and `why`
- [x] `highestVersion` — registry ranking, prereleases excluded by rule
- [x] `installSpecDetail`; `installSpec` delegates and throws on unresolved
- [x] `brain-upgrade` reports a fallback instead of printing it as an answer;
      dropped the now-unused `installSpec` import
- [x] 14/14 green; `npm test` **3566 pass / 0 fail** (1 pre-existing skip)
- [x] Mutation proof ×4, each diffed, re-read from disk, reverted byte-identical

## Mutation proofs

| # | mutation | expected red | observed |
|---|---|---|---|
| M1 | registry spec keeps the `v` | scoped → registry spec | **1 red** (3) |
| M2 | git ref gets the `v` stripped | ref verbatim, and today's output | **4 red** (4, 5, 6, 14) |
| M3 | `highestVersion` stops excluding prereleases | prerelease never outranks; all-prerelease | **2 red** (10, 11) |
| M4 | `source` always `'manifest'` | a fallback says it fell back | **1 red** (6) |

`diff -q` against the pre-mutation file after the last revert: **byte-identical**.

M1 and M2 are the same defect pointing in opposite directions, and both had to be
proved. A guard that only catches the missing strip lets the spurious one through,
and the spurious one is the more plausible mistake once "strip the v" is in
someone's head.

## What I got wrong on the way

The first version of the prerelease test was `highestVersion(['1.0.0-rc.1', '1.0.0'])`
→ `'1.0.0'`, which passed **before** the exclusion rule existed — `compareSemver`
returns 0 for that pair and `Array.sort` is stable, so the answer came from input
order. Testing the reverse order is what exposed it. A test that passes for a
reason you did not intend is not a test.

## Out of scope

- The rename, `private: false`, the publish workflow, `NPM_TOKEN` (#435).
- `day-start.mjs` (#627) and `BOOTSTRAP_SCRIPT_VALUE` (#628) — after the publish.
- `test/fresh-install` dropping `VCS_TOKEN` — cannot pass until something is
  published; it is ADR-0030's acceptance criterion, not a step available now.
- `compareSemver`. Its prerelease blindness is recorded here and worked around
  by rule; changing a comparator its other callers depend on is its own ticket.
