---
status: draft
issue: 625
---

# Tasks — legacy-install fallback and a legible failure (issue 625)

- [x] Trace the break end to end: old vendored code + git-URL install spec + new
      package.json → tree lands under the scope → `die()`
- [x] Separate what code can fix (new code / old install) from what it cannot
      (old code / new install) and say so in the artifacts, not just the ticket
- [x] RED FIRST: `installed-package-root.resolve.test.mjs` against the current
      tree — missing-export import error, 6 tests blocked
- [x] `LEGACY_PACKAGE_DIR` + `resolveInstalledPackageRoot({ packageName, exists })`
- [x] RED FIRST again for the messages: 5 more tests, missing-export import error
- [x] `installedPackageSearchPaths` + `describeInstalledPackageSearch`
- [x] Wire both entry points (`brain-upgrade.mjs:419`, `cli-entry.mjs:59`)
- [x] 11/11 green; `npm test` 3496/3497 (1 pre-existing skip), 0 fail
- [x] Mutation proof ×4, each diffed, each re-read from disk, each reverted

## Mutation proofs

| # | mutation | expected red | observed |
|---|---|---|---|
| M1 | drop the `exists(legacy)` branch | legacy install found; trailing segments | **2 red** (tests 2, 5) |
| M2 | re-hardcode `node_modules/brain` in `brain-upgrade.mjs` | the entry-point guard | **1 red** (test 11) |
| M3 | `describeInstalledPackageSearch` returns only the canonical path | names BOTH; segments on every path | **2 red** (tests 8, 10) |
| M4 | `installedPackageSearchPaths` always returns two entries | one path before the rename | **1 red** (test 9) |

Each was diffed against the pre-mutation file and **re-read from disk** before
the red was believed — four silent substitutions in this repo have produced
meaningless greens.

## Out of scope

- The rename, `private: false`, the install spec, the publish workflow — #435.
- `lib/init.mjs`'s `BOOTSTRAP_SCRIPT_VALUE` — the third site of the same defect,
  writing into the consumer's `package.json`. Named in the guard's failure text
  and in the proposal; it travels with the rename.
