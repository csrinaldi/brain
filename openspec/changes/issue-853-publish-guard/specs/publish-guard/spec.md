---
issue: 853
phase: spec
capability: publish-guard
---

# Spec — the tag must be ON this history, not AT this commit

## Requirement: post-release history is not a failure (R853-1)

The suite-level version/tag check MUST pass when the tag for the declared
version is reachable from HEAD, and MUST fail only when it is not.

### Scenario: main moved on after a release
- GIVEN `package.json` declares 1.4.0 and tag `v1.4.0` exists
- AND HEAD is a descendant of that tag
- THEN the check passes — this is the ordinary state between a release and the
  next version bump.

### Scenario: the tagged commit itself
- GIVEN HEAD is exactly the tagged commit
- THEN the check passes.

### Scenario: a diverged line
- GIVEN the tag exists but is NOT reachable from HEAD
- THEN the check FAILS, naming both commits — the tag points at a line this
  history abandoned, which is the shape worth reporting.

### Scenario: no tag yet
- GIVEN no tag exists for the declared version
- THEN the check passes — publishing before tagging is normal, unchanged.

## Requirement: the rule that guards the publish is untouched (R853-2)

`publish.yml`'s refusal — a version that already names a different tree — stays
exactly as it is, and the sibling test pinning its presence stays passing. This
change narrows a LOCAL early-warning, never the enforcement.

### Scenario: the workflow still refuses
- WHEN the publish workflow is read
- THEN it still compares the version against an existing tag and still tells the
  operator to bump.
