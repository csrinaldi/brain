---
status: draft
issue: 1141
parent: 1121
---

# Proposal — one directory per axis (issue #1141)

## Problem

Adapters have no common layout. `brain/scripts/harness/backends/` holds three axes in one
folder: platforms (claude, antigravity), SDD engines (gentle-ai, plain) and review engines
(codex, gemini, and claude again). Memory adapters live in `memory/backends/`, VCS adapters in
`vcs/providers/`, and the SDD role port in `roles/`. Nothing about a directory says which axis
it serves, so adding a supplier means learning where that axis happens to keep its files.

## Outcome

Every adapter lives under `brain/scripts/axes/<axis>/adapters/`, one directory per axis:
`memory`, `vcs`, `platform`, `sdd-engine`, `review-engine`. The existing parity suites move
into their axis. `harness/backends/`, `memory/backends/` and `vcs/providers/` no longer exist.

A consumer that upgrades is left with the new layout only. Consumers receive
`brain/scripts/**` by copy, and `brain:upgrade` had no way to remove a file a release stopped
shipping, so without a fix every upgraded consumer would keep two copies of every adapter.

## Scope

- A pure move with `git mv`: history follows every file, and there are no behaviour changes.
- Every reference moves with its file: imports, repo-relative path strings, the check-refs
  exemptions, the drift guards, and the living specs under `openspec/specs/`.
- `brain:upgrade` removes the files the incoming package declares retired, and keeps a
  consumer file in the same directory.
- Promote drafts for the doctrine that cites the old paths. Doctrine is not edited here.

## Non-goals

- No `contract.mjs` and no `resolve-axis.mjs`. The resolvers stay as they are and are
  collapsed in #1114.
- No new parity suites for platform or review-engine: #1128 and #1129.
- No change to what any loader resolves a name to.

## Constraint that shaped the upgrade fix

Under `--no-install` (the only way to upgrade to an unpublished tarball until #1140) the
outgoing package is already replaced, so "brain shipped this last time" cannot be read off the
tree. The incoming package therefore names the files it retired, as an exact list.
