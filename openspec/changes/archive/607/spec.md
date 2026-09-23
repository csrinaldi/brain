---
status: draft
issue: 607
---

# Spec — licence-and-files-allowlist (issue 607)

## REQ-607-1 — The package declares MIT and the licence travels with it

`"license": "MIT"` in `package.json`, and `LICENSE` present in the tarball. A
declared licence whose file does not ship is a licence a consumer cannot read.

## REQ-607-2 — Every managed path that needs brain's bytes ships

`managed` in `brain/core/managed-paths.mjs` is authoritative. A path whose
strategy is `copy`, `refuse` or `merge` needs brain's bytes at install time and
must be in the tarball; omitting one breaks `brain:upgrade` on the release that
first needs it — silently (#601's shape).

## REQ-607-3 — A `regenerate` path must NOT ship

`AGENTS.md` is compiled in the consumer from `SOURCE_DOCS`. Shipping brain's own
would be a file describing the wrong repository (#397).

## REQ-607-4 — The named exclusions stay out

`.memory/`, `openspec/`, `test/`, `docs/`, `.brain-source` — each named
individually, so re-admitting one fails by name rather than only moving a byte
count.

## REQ-607-5 — The evidence is the tarball, never the array

The check runs a real `npm pack --dry-run` and asserts over its file listing.
Reading `files` back would only prove the array says what it says; npm applies
its own always-include, always-exclude and dot-directory rules on top.

The reader throws rather than returning an empty list: an empty listing would
satisfy every exclusion assertion and prove nothing.
