---
status: draft
issue: 648
---

# Proposal — brain stops shipping somebody else's environment (issue 648)

## What

The one real third-party hostname in the repository leaves the shipped tree, the
fixture notes stop naming an unrelated organisation's phase, and a guard makes
the hostname half unrepeatable.

## Why

Found executing §3 of the #610 pre-flight. Filed as **relevance**, not as a
disclosure: the maintainer confirms SCIT and that git host have nothing to do
with brain's development — brain may later be *used* in projects there, which is
a different statement.

That makes it #397's shape: **a generic harness carrying artifacts that describe
somebody else's environment.**

Measured on `main` @ `0d8d04d`: eight files under `brain/scripts/**`, every one
inside the `files` allowlist, so every one reaching a consumer's disk.

The hostname is the priority for two independent reasons. It is the only line in
the repository naming real third-party infrastructure, and it is the outlier in
its own neighbourhood — every sibling assertion in that test already uses a
reserved name.

## Scope

- **In:** the hostname, the fixture/contract notes, `.gitlab-ci.yml`, the live
  spec under `openspec/specs/`, and a guard.
- **Out — deliberately:** `openspec/changes/**` (51 of the 59 occurrences,
  archived and not). Those are records of what was planned and why, and the
  phase genuinely was called that. **Editing an SDD record to make the past
  tidier is falsifying it**, which is worse than the defect being fixed. Same for
  `CHANGELOG.md`.

The line drawn: **`openspec/specs/**` is the current contract and gets fixed;
`openspec/changes/**` is a record and does not.**

## The guard, and what it deliberately does not cover

`shipped-hostnames.test.mjs` fails on any host under `brain/**` that is neither
RFC 2606/6761 reserved nor on a short allowlist of services brain genuinely
integrates with, each carrying its reason.

There is **no guard for the phase name**, and that is a decision rather than an
omission: a guard has to name the string it forbids, and the guard file ships
too — so it would reintroduce the word into the tarball it exists to keep out.
That is exactly the self-sustaining defect #647 D6 records about the pre-flight
runbook, and the first draft of this guard had it: it quoted the hostname in its
header and excluded itself from its own scan. Hostnames are checkable by
**shape**, which is why that half is enforceable and the other half is not.
