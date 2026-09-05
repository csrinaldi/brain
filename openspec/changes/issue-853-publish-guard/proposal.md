---
issue: 853
phase: proposal
---

# Proposal — the local publish guard stops calling "moved on" a failure

## Intent

`npm test` is red on every maintainer checkout since the 1.4.0 release, for a
state that is correct. Restore the signal without discarding the local early
warning the check was written to give.

## Measured (main @ e49faf60)

- `npm test` → `# fail 1`: *"package.json says 1.4.0, and tag v1.4.0 points at
  c9676387 while HEAD is e49faf60 … Bump the version before the first publish."*
- 1.4.0 **is** published (npm `latest`). The tag is right, the publish was
  right, and `main` moved on when #852 merged.
- `git merge-base --is-ancestor v1.4.0 HEAD` → **true**: HEAD descends from the
  tag. Ordinary post-release history.
- `local-checks` checks out with no `fetch-depth`, so **CI has no tags** and the
  check returns early there. #852's `local-checks` was green against this same
  red local suite.

So the guard is inert where it would be a gate and firing where it is noise.

## Why this is worth fixing rather than tolerating

`npm test` returning `# fail 0` is this repository's pre-commit discipline. A
permanently red `main` retires that signal: the next real regression arrives as
`# fail 2` and reads like the same noise. A guard that trains its readers to
ignore the suite has a negative value, not a small one.

## The change

Fail only when the tag for the declared version is **not on this history** —
neither HEAD itself nor an ancestor of it. "main moved on" passes; a diverged
or rewritten line still fails, which is the shape actually worth reporting.

## Why not the two alternatives

- **Delete the local copy** (leaving `publish.yml`'s guard alone) is defensible
  and simpler, but it discards the intent the test states in its own comment —
  *"so it is caught locally rather than in the workflow"*. The narrowed check
  keeps that intent and costs one `git merge-base` call.
- **Bump `main` to a dev version after each release** changes the release
  ritual to satisfy a test, which is the wrong direction of accommodation.

## What the check no longer claims

It stops answering *"would publishing this tree as this version be wrong?"* —
after a release the honest answer is "yes, and that is fine". That question
belongs to `publish.yml`, which asks it at the only moment it can be violated,
and whose presence is already pinned by the sibling test in this same file.
