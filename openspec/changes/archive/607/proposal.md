---
status: draft
issue: 607
---

# Proposal — licence-and-files-allowlist (issue 607)

## What

An MIT `LICENSE`, and a `files` allowlist derived from `managed`, with a test
that measures the real `npm pack` output rather than the array.

## Why

The repo is **already public** (`private: false`, measured) and carries **no
licence** — all rights reserved by default, so nobody may legally adopt it,
which is the opposite of #435's stated goal.

And `files` was absent: a publish would have shipped **1053 files / 16.8 MB**,
including `.memory/` (2177 session records) and `openspec/`. `private: true` was
the only thing preventing it, and #435 names the ordering — the allowlist lands
**before** `private` comes off.

## Scope

- **In:** `LICENSE` (MIT), `"license": "MIT"`, the `files` allowlist, and the
  coverage test.
- **Out:** removing `private: true`; the scoped package name; the install-spec
  move off the git URL; the pre-flight history audit; superseding ADR-0006. All
  of those stay in **#435**.

## The licence choice, and why it is not neutral

`managedStrategy` copies `brain/core/**` and `brain/scripts/**` **into the
consumer's repository**. Brain's source files end up inside other people's
repos, so a copyleft licence would reach through that vendoring into every
adopter's codebase. MIT does not. Decided by the maintainer, 2026-08-13.
