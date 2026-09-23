---
status: draft
issue: 653
---

# Proposal — ADR-0030 Amendment 2, the organisation scope (issue 653)

## What

A `brain-amendment/1` draft recording that the package is **`@logikas/brain`**,
that a scoped package publishes `restricted` unless told otherwise, and that the
publishing token must be scoped to `@logikas/*`. **A draft only** — the human
promotes it, and the rename lands after.

## Why

ADR-0030 did not reject an organisation scope. It **deferred** one and named the
condition:

> **An organisation scope.** Deferred, not rejected. Easy later, awkward to unmake
> now.

The organisation now exists and owns the publishing credential. The condition
holds, so the deferral ends. **The ADR is being followed, not overruled** — which
is the first thing the amendment says, because an amendment that changes a
package name otherwise reads as a reversal.

## The cost, measured

| name | result |
|---|---|
| `@logikas/brain` | **404 — free** |
| `@csrinaldi/brain` | `404` — still free, never published |
| `brain` | `200` — the deprecated placeholder |

Because nothing was ever published under `@csrinaldi/brain`, this costs
**nothing**: no unpublish, no deprecation, no redirect, no consumer migrated
twice. One constant in `installer.mjs` — #623 made it exactly one — and five
passages in the record.

"Easy later" was the correct prediction, and this is the last moment it holds.
After a first publish it would be an unpublishable rename.

## Why a record before a rename

#590 measured the reverse: a mechanism shipped, its decision record never
written, five live files citing an ADR that did not exist, for months.

## Scope

- **In:** the draft. Five in-place edits and the signed section.
- **Out:** `PACKAGE_NAME`, `package.json`, the publish workflow — the #435
  publish slice, which lands after this is promoted.

## Follow-up this creates

`installed-package-root.resolve.test.mjs` (#625, merged) and
`install-spec-registry.test.mjs` (#644, in PR #646) inject `@csrinaldi/brain` as
their scoped fixture. Both still pass — the name is injected precisely so it is
not load-bearing — but they should read `@logikas/brain` once #646 merges, so a
reader is not shown a scope the project does not use. Noted rather than reached
into from this branch.
