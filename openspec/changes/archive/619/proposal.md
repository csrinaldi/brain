---
status: draft
issue: 619
---

# Proposal — publish-allowlist-reads-the-tarball (issue 619)

## What

`publish-allowlist.e2e.test.mjs` stops parsing `npm pack --dry-run --json` and
reads the real tarball instead.

## Why

The `files[]` field it depends on exists on npm 10.9.7 and **not** on the
maintainer's Node 24 / newer npm. Same tree, same command, different shape — the
suite threw "npm pack reported no files" on a healthy repository, while CI stayed
green because the runner's npm still has the field.

Environment-conditional in the one direction CI cannot see: green on the runner,
red on a machine ahead of it.

## Scope

- **In:** the reader, and the header comment that explains why.
- **Out:** the allowlist itself, the rule, and every assertion — unchanged. Both
  original mutations must stay red through the new reader, or the fix traded a
  portability bug for a weaker check.
