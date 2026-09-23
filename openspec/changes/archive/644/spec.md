---
status: draft
issue: 644
---

# Spec — the install spec becomes a package name (issue 644)

## REQ-644-1 — The `v` boundary exists in exactly one place

`specVersion` maps `v1.2.0` and `1.2.0` to `1.2.0`, keeps everything after a
prerelease or build separator, and returns **null** for anything that is not a
version (`latest`, `main`, `''`, non-strings). A caller handed `'latest'` as if
it were a version installs something nobody pinned.

## REQ-644-2 — A scoped name resolves to a registry spec

`resolveInstallSpec({ name: '@scope/brain', … })` returns
`kind: 'registry'`, `spec: '@scope/brain@1.2.0'` — the `v` stripped, because a
published version has none.

## REQ-644-3 — An unscoped name keeps the git URL, ref VERBATIM

`kind: 'git'`, `spec: 'git+https://…#v1.2.0'`. The ref is **not** normalised: a
git ref is a name, not a number, and `#1.2.0` is a different ref. This is the
one-for-one translation ADR-0030 forbids, and it is guarded in both directions.

The git form is not a leftover. ADR-0030 Amendment 1 (#629) records it as a
supported fallback, measured equivalent.

## REQ-644-4 — A guess never looks like an answer

`source` is `'manifest'` when the installed manifest supplied the inputs and
`'fallback'` when the constant did, and `why` is written for a human.
`brain-upgrade` prints the fallback reason rather than printing the resulting
spec as though the manifest had declared it.

## REQ-644-5 — A scoped name with an unreadable version refuses

`kind: 'unresolved'`, `spec: null`, and a `why` that names what could not be
read. `@scope/brain@null` must never be constructed, and `installSpec` throws
rather than returning it.

## REQ-644-6 — Registry ranking is re-derived, not ported

`highestVersion` ranks a version **list** and returns the highest **release**.
Prereleases are excluded by rule: `compareSemver` reads only major.minor.patch,
so a prerelease and its release compare equal and a plain sort would answer by
input order (measured). Null means "no published release" — the caller holds the
list and can distinguish that from "could not read", per ADR-0030 Amendment 1.

## REQ-644-7 — `highestTag` is proven NOT interchangeable

Fed registry output, `highestTag` returns null: it looks for `refs/tags/…`.
Reused blindly it would report "no versions" on a healthy registry. The proof is
a test, not a comment.

## REQ-644-8 — Nothing changes before the rename

`PACKAGE_NAME` is unchanged, `installSpec`'s signature and today's output are
unchanged, and `npm test` is green.
