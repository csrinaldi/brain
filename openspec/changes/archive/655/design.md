---
status: draft
issue: 655
---

# Design — the publish slice (issue 655)

## D1 — `access: public` in two places, deliberately

Not redundancy. The workflow flag covers the workflow; `publishConfig` covers
every other path, including a maintainer typing `npm publish` on a laptop at
some future date. The failure it prevents is the one that **succeeds**: a scoped
package published `restricted` uploads fine, burns the version number, and
cannot be installed by anyone. There is no fixing that version afterwards.

## D2 — Dispatch-only, and separate from `release.yml`

`release.yml` is the rung-2 release **gate**: it runs `brain-audit` and blocks.
This one performs an irreversible outward act. Giving them one trigger would let
the audit's schedule decide when bytes reach strangers.

No push or tag trigger for the same reason ADR-0030 gives: publishing cannot be
cleanly undone, so a human types the version.

## D3 — The version guard compares against tags, not against the registry

Asking npm "does this version exist" only catches a **second** publish. The
mistake available here is the first one: `v1.0.0` was cut hundreds of commits
ago against the git-tag mechanism, and publishing `1.0.0` from today's tree would
put these bytes behind that number permanently.

So the comparison is local and precise — *if a tag for this version exists and is
not this commit, refuse* — and "no tag at all" passes, because publishing before
tagging is normal.

## D4 — The alias migration is a list of literals, never a pattern

`writeBootstrapAlias`'s rule is "keep the consumer's value". A pre-rename alias
is not the consumer's value; it is brain's own previous output, now pointing at a
directory npm stopped creating. So the migration is exactly as wide as the set of
strings brain has itself written, and no wider.

A regex would be shorter and would eventually overwrite something a consumer
wrote on purpose. The list can only ever be wrong by being incomplete, which
fails visibly (a stale alias survives) rather than destructively.

## D5 — One `'brain'` literal is not the package name

`brain-upgrade.mjs`'s clobber-awareness check tests `ownPkg.name === 'brain'`.
Every other occurrence of that string in executable code was the package name and
became `PACKAGE_NAME`; this one is the **fingerprint of a historical bug**. Those
clobbers already happened, and their victims still carry `"name": "brain"`.

Renaming it would look like consistency and would silently drop the warning for
the only repositories it exists to serve. A comment now says so at the site,
because the next person doing a sweep will reach for it.

## D6 — The publish workflow runs the full suite

The tarball's contents are decided by `publish-allowlist.e2e.test.mjs`, which
packs for real and walks what comes out. Sixty seconds before an irreversible act
is cheap; there is no equivalent check afterwards.

## Hot micro-decisions

- **`publish.yml` stays out of `files`.** A consumer needs the governance
  workflows vendored, not brain's release machinery (#607).
- **Version bumped to 1.1.0 here** rather than left to the release. The version
  guard turns red otherwise, and the number is one line if the maintainer wants a
  different one.
- **The README keeps the git URL**, framed as a supported fallback for mirrored
  and air-gapped consumers, per ADR-0030 Amendment 1 — not as a legacy note.
- **`permissions: { contents: read }`.** Publishing needs nothing else, and an
  omitted scope in a `permissions:` block becomes `none`, which is the property
  #475 already paid for once.
