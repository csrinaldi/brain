---
status: draft
issue: 644
---

# Design — the install spec becomes a package name (issue 644)

## D1 — Two shapes, neither derived from the other

`resolveInstallSpec` branches on whether the installed **name** is scoped, and
each branch builds its own spec from scratch. The tempting design — build the
version once and format it twice — is precisely what ADR-0030 forbids, because
the two consume different objects: a registry wants `1.2.0`, a git ref wants the
tag as written.

## D2 — The `v` is stripped in one function, and never at a call site

`specVersion`. A call site that strips is a call site that can forget, or can do
it on the git path. M1 and M2 exist because those are opposite mistakes and both
are plausible.

## D3 — `source` and `why`, not just a string

`installSpec` returns a string and cannot explain itself; its `catch {}` turned
"the manifest is unreadable" into an answer indistinguishable from a real one.
`installSpecDetail` carries the reasoning, and `brain-upgrade` prints it when the
spec came from the constant. That is the `evidence-reader-empty-on-failure`
shape closed at its source rather than at the consumer.

`installSpec` is kept, delegating, so no caller had to change to get the fix —
and it **throws** on `unresolved` rather than degrading to a git URL, because
falling back to git when the manifest says registry installs a different artifact
than the one asked for.

## D4 — Prereleases excluded by rule, not by comparator

Two independent reasons, and either alone would be enough:

1. **Measured:** `compareSemver` reads only major.minor.patch, so `1.0.0-rc.1`
   and `1.0.0` compare equal and the sort answers by input order.
2. **Policy:** this feeds check-and-notify. Telling an operator to install an rc
   is worse than telling them nothing.

Full prerelease ordering (`rc.1` vs `rc.2`) is deliberately **not** implemented.
A comparator I would be guessing at is worse than a stated limit, and nothing in
scope needs it.

## D5 — `highestTag` is left exactly as it is

It parses `git ls-remote` output correctly and that remains a real input for as
long as the git path is supported — which, per ADR-0030 Amendment 1, is
indefinitely. The new function sits beside it, and a test proves feeding one the
other's input yields silence rather than an answer.

## Hot micro-decisions

- **`installSpecDetail` reads the manifest itself** rather than taking injected
  contents: `resolveInstallSpec` is the pure half and is where the tests live.
  Two injection seams for one question is the #340 defect.
- **`SCOPED_NAME_RE` is module-private.** Callers should ask
  `resolveInstallSpec`, not re-implement "is this scoped".
- **The unused `installSpec` import was removed from `brain-upgrade.mjs`** rather
  than left as documentation. A dead import is a claim about what the file uses.
