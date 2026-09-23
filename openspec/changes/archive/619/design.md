---
status: draft
issue: 619
---

# Design — publish-allowlist-reads-the-tarball (issue 619)

## D1 — Extract and walk, rather than parse `tar -tzvf`

Listing the tarball would mean parsing tar's human-readable columns, which vary
by implementation — trading one unstable output format for another. Extracting
into a temp dir and walking with `fs` gives exact paths **and** exact sizes from
the artifact itself, at the cost of a few hundred files and milliseconds.

## D2 — Strip npm's `package/` prefix

npm wraps everything under `package/`. Stripping it makes the packed paths read
like the repo-relative ones `managed` uses, so the comparison stays direct.

## D3 — The lesson, recorded in the file

A check whose verdict depends on the shape of a tool's JSON is testing the tool.
The header now says so, and says the report shape is not stable across versions.

## Hot micro-decisions

- Verified equivalent before switching: both paths yield **423 entries** on npm
  10.9.7, so the rewrite is a change of evidence source and not of scope.
- The failure was invisible to CI by construction — the runner is *behind* the
  developer machine. Noted in #619; whether `local-checks` should run a Node/npm
  matrix is a separate decision and not taken here.
