---
status: draft
issue: 625
---

# Design — legacy-install fallback and a legible failure (issue 625)

## D1 — The fallback is inert today, and that is why it is injectable

`PACKAGE_NAME === LEGACY_PACKAGE_DIR`, so the two candidates coincide and the
resolver returns on the first line without probing. A fallback in that state
cannot be exercised by calling it normally. `packageName` and `exists` are
therefore parameters: the scoped behaviour runs **now**, in eleven tests, rather
than for the first time on the release where a consumer's recovery depends on it.

## D2 — Canonical first, always

A tree holding both directories is a tree mid-migration. Preferring the legacy
one there would pin a consumer to the old install forever, and silently.

## D3 — With neither present, return canonical, not legacy

The value is about to be `existsSync`ed and reported. Naming the path a reader
should **create** is more useful than naming the one that happens to be older.

## D4 — The message is built from the resolver's own constants

`installedPackageSearchPaths` reads `PACKAGE_NAME` and `LEGACY_PACKAGE_DIR` — the
same two the resolver probes — and returns them in probe order. This is the whole
reason it exists as a function rather than as a string at each call site: a
message that is assembled independently can drift into naming a path the code
never searched, which is exactly the defect being fixed.

Before the rename it returns **one** entry. A message inventing a second location
sends the reader to look twice at one directory.

## D5 — The guard strips comments rather than allowlisting lines

Both entry points carry several deliberate prose mentions of the legacy path
(`brain-upgrade.mjs:7`, `:9`, `:171`, `:364`, `:380`). A guard that flagged those
would be turned off within a week. Stripping comment lines keeps it about
executable text, and it throws if a file reads as all comments — "no offending
lines" and "nothing scanned" must not share a verdict.

## Hot micro-decisions

- **Not a `try`/`catch` around the caller's `existsSync`.** The resolver already
  knows both candidates; discovering the fallback at the call site would put the
  knowledge back in the six places #623 just removed it from.
- **`describeInstalledPackageSearch` takes `rest`, not a pre-joined suffix.**
  `cli-entry.mjs` needs `…/package.json` on both paths. A caller appending the
  suffix itself would append it to the rendered string — i.e. to the first path
  only, or after the closing parenthesis.
- **`BOOTSTRAP_SCRIPT_VALUE` left alone deliberately.** It is the same defect,
  but it writes into the consumer's `package.json`. Fixing it here would mean
  this PR changes a file in someone else's repository on the next upgrade, on a
  branch whose stated scope is "behaviour is unchanged until the rename".
