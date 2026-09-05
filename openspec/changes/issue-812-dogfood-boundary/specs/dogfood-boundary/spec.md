---
issue: 812
phase: spec
capability: dogfood-boundary
---

# Spec — doctrine is inherited, environment is pinned

## Requirement: the suite is independent of the transport axis (R812-1)

`review/cli.test.mjs` MUST pass with and without `sdd.map` configured in the
repository's own `brain.config.json`.

### Scenario: the key is present
- WHEN `brain.config.json` declares `sdd.map.cold-review`
- THEN the suite passes, and no test spawns a review engine.

### Scenario: the key is absent
- WHEN it is not declared
- THEN the suite passes exactly as before.

## Requirement: the dogfooding that was chosen survives (R812-2)

The assertions that read the REAL config on purpose (#442) MUST remain, and
remain passing.

### Scenario: the protocol version is still dogfooded
- WHEN the CLI resolves its protocol
- THEN the tests still assert it comes from `brain.config.json`, not a default.

## Requirement: the key is committed (R812-3)

`brain.config.json` MUST carry `sdd.map.cold-review`, so the transport is not an
uncommitted local edit that a `git pull` can silently destroy.

### Scenario: a fresh clone reviews with both controls
- WHEN an operator clones and runs `brain:review`
- THEN the judgment half is configured, and a verdict does not silently arrive
  with `controls_not_applied: ["inferential"]` because a file was overwritten.
