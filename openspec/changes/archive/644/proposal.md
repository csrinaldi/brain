---
status: draft
issue: 644
---

# Proposal — the install spec becomes a package name (issue 644)

## What

`installSpec` learns the registry shape, **re-derived** rather than translated,
and every caller can now tell a manifest-derived spec from a guessed one. **The
rename is not here** — `"name"` stays `brain`, so today's output is byte-identical.

## Why

ADR-0030 Decision 3 moves the install spec from `git+https://…#<tag>` to a
package name plus a version, and is explicit about the trap:

> A git tag and a registry version are not the same object: tags can be moved and
> deleted, published versions cannot; `dist-tags` exist and refs do not; and a
> range resolves differently from a pinned ref.

The concrete instance is one character. The tag is `v1.2.0`; the published
version is `1.2.0`. Neither form throws when used in the other's place — one
produces `@csrinaldi/brain@v1.2.0`, which npm reports as *not found*; the other
produces `#1.2.0`, a ref that usually does not exist. Both read as "the release
is missing" rather than as "the spec is the wrong shape".

Built **before** the rename, and tested with the name injected, for the reason
#625 established: a resolver that only runs correctly after the rename is a
resolver that has never run.

## Scope

- **In:** `specVersion` (the `v` boundary, decided once), `resolveInstallSpec`
  (the two shapes), `highestVersion` (registry ranking), `installSpecDetail`
  (the spec plus why), and `brain-upgrade` reporting a fallback instead of
  printing it as though the manifest had said it.
- **Out:** the rename, `private: false`, the publish workflow and `NPM_TOKEN`;
  `day-start` (#627) and `BOOTSTRAP_SCRIPT_VALUE` (#628), both sequenced after
  the publish; `test/fresh-install` dropping `VCS_TOKEN`, which cannot pass until
  something is actually published.

## What the measurement changed about the plan

`compareSemver` reads **only** major.minor.patch, so `1.0.0-rc.1` and `1.0.0`
compare **equal**. A `.sort(compareSemver).at(-1)` over a registry version list
therefore returns whichever the registry happened to list last — an answer that
depends on input order and looks right in whichever direction you test it first.

That is exactly the "translate and move on" failure ADR-0030 names, and it is
why `highestVersion` excludes prereleases by rule rather than trusting the sort.
Second reason, independent of the first: this feeds check-and-notify, which must
never tell an operator to install an rc.

`compareSemver` itself is left alone. Changing a comparator eleven call sites
depend on is not this ticket, and the new function does not need it changed.
