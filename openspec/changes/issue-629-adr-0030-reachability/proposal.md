---
status: draft
issue: 629
---

# Proposal — ADR-0030 reachability amendment (issue 629)

## What

A `brain-amendment/1` draft against ADR-0030 recording **reachability**: a
registry name requires a registry, where a git URL reached any host that serves
git — and the git-URL install survives the rename as a measured, equivalent
fallback.

**A draft only.** Nothing under `brain/project/decisions/` is edited here. The
human promotes it with `npm run brain:promote` and the commit is the signature
(ADR-0028).

## Why

ADR-0030's Consequences read *"a consumer installs with no credential and no
repository access"*. True, and incomplete: they install with **registry access**.
Measured on the signed record — **zero** mentions of `mirror`, `firewall`,
`air-gap`, `proxy`, `offline` or `registry access`. The cost is not weighed and
rejected there; it is absent.

Two independent pieces of work landed on the same absence:

- **#627** — `day-start.mjs` reaches `github.com` and reports failure as "no
  network". Translated one-for-one to a registry, a mirrored consumer gets "no
  network" for a host they were never expected to reach.
- **#625** — tracing where a git install actually lands showed the git URL is not
  retired by the rename: it resolves to the same directory the registry install
  would, because npm places a package by the `name` in its `package.json`.

A property two unrelated tickets rediscover is doctrine, not a preference
belonging to whichever noticed it second.

## The measurement behind the "equivalent" claim

Installed HEAD into a clean fixture over `git+file://`, `--ignore-scripts`:
**433 files, 5.5 MB**; `.memory/`, `openspec/`, `test/`, `docs/`,
`.brain-source` and `.git` all **absent**. So a git install **honours `files`** —
the fallback is the same allowlisted tree, not a raw checkout — and it works
under `private: true`, because `private` blocks publishing, not git installs.

## Scope

- **In:** the draft. Four in-place edits (two annotations, two list additions),
  plus the signed section.
- **Out:** the decision itself. The registry stays the mechanism; Decision 1, the
  scope, the visibility/publication split and the whole *"What ADR-0006 decided
  that SURVIVES"* section stand unchanged. Nothing here reopens ADR-0006.
- **Out:** the code. #627 fixes `day-start`; this makes its requirement doctrine.
