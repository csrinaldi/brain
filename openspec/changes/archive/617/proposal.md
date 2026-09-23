---
status: draft
issue: 617
---

# Proposal — supersede-adr-0006 (issue 617)

## What

Two Tier 2 drafts: **ADR-0030** (distribution moves to a scoped registry
package) and **ADR-0006 Amendment 1** (marking it superseded and annotating the
passages that no longer hold).

## Why

ADR-0006 chose git tags over a registry on one property — *"compatible with
private repos"*. Measured on `main` @ `3dfbdd4`: `private: false`. **The premise
was deleted**, not merely aged, which is why this supersedes rather than amends.

And the ordering is the substance. #590 cost a day because a mechanism shipped
and its decision record never did — five live files cited an ADR-0018 that did
not exist. Writing ADR-0030 *after* the install spec moves would reproduce that
exactly, with an ADR that is already wrong left standing while the code walks
away from it.

## Scope

- **In:** the two drafts, verified against the real parsers.
- **Out:** the mechanism. No `installer.mjs`, no `package.json`, no README, no
  `test/fresh-install`. Those are #435's, and keeping them out is the point.

## Superseding is two acts

`brain:promote` knows a new ADR and a `brain-amendment/1` in-place amendment.
Writing only the new ADR would leave ADR-0006 saying `Status: Accepted` and
*"compatible with private repos"* — the exact rot this ticket exists to prevent,
one document over.
