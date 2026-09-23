---
status: draft
issue: 627
---

# Proposal — day:start step 4 asks the registry (issue 627)

## What

Step 4 of `day:start` resolves the latest installable version from the
**registry** instead of `git ls-remote --tags` against a hardcoded github.com
URL, and `readInstalledVersion` stops comparing the package name to a literal
the rename invalidated.

## Why

ADR-0030 supersedes ADR-0006's git-tag mechanism. Under ADR-0006 the tag *was*
the artifact, so asking for tags was authoritative. Under ADR-0030 what a
consumer can install is what the registry publishes, and the sets differ: a tag
can exist unpublished, and a published version can be deprecated while its tag
remains.

**Check-and-notify itself is not superseded** — ADR-0006 Amendment 1 lists it
under "what is NOT superseded" and notes a registry makes auto-update *easier*
to reach for, which makes `instaladores-autoactualizantes-no-inocuos` more
load-bearing here, not less. Nothing in this change auto-applies anything.

## The defect that was already live

`readInstalledVersion` tested `pkg.name === 'brain'`. The scope broke it in both
directions at once — measured on `main` @ `982f544`, BEFORE any change here:

```
consumer with @logikas/brain installed → null
brain's own repo (self-host)           → null
```

Step 4 reads it first, so the whole version check was **already inert on main**,
printing "could not determine installed brain version — skipping check". That is
the failure mode worth naming: a check that skips itself reads like a check that
passed. It is the eleventh site of the #623 class (installed-package identity as
a literal).

## Scope

- **In:** step 4's source, the removal of the hardcoded remote, the failure
  vocabulary, `readInstalledVersion`'s name match.
- **Out:** step 4b (the agent-runtime sub-step) is untouched; auto-apply stays
  forbidden; `highestTag` keeps its git-tag callers and is not repurposed.
