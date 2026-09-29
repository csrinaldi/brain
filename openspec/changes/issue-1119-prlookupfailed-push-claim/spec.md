# Spec delta: `memory.ship.prLookupFailed` message honesty

## Requirement: the printed message must never claim an action that did not happen

The `brain:memory:ship` CLI (`brain/scripts/memory/cli.mjs`, `op === "ship"`) prints one
`memory.ship.*` i18n message per outcome. When the underlying `shipLane()` call throws an
error tagged `prLookupFailed`, the printed message MUST accurately reflect whether the
push step already ran by the time the failure occurred.

### Scenario: decidePr's lookup fails (pre-push)

- **GIVEN** `shipLane()` reaches `decidePr()` (called before the push step, per D4)
- **AND** the injected `vcs.mrList` call throws, or returns a match whose
  `state`/`merged` is uncomputable
- **WHEN** the CLI catches the resulting error and selects a message key
- **THEN** the key resolves to `memory.ship.prLookupFailed`
- **AND** the rendered text (both `en.mjs` and `es.mjs`) states that nothing was pushed
- **AND** the rendered text never states or implies a push landed
- **AND** no `memory/*` ref exists on the remote that did not already exist before the run

### Scenario: createPr's one-shot re-scan fails (post-push)

- **GIVEN** `shipLane()` has already run its push step (successfully or as a no-op)
- **AND** `createPr()`'s one-shot `mrList` re-scan (triggered by an unparseable PR URL)
  throws
- **WHEN** the CLI catches the resulting error and selects a message key
- **THEN** the key resolves to `memory.ship.prLookupFailedAfterPush`
- **AND** the rendered text states the push already landed (this is the one case where
  that claim is true)

### Scenario: locale parity

- **GIVEN** either of the two scenarios above
- **THEN** `en.mjs` and `es.mjs` both carry a string for the resolved key
- **AND** neither locale's `prLookupFailed` text claims a push landed
- **AND** neither locale's `prLookupFailedAfterPush` text claims nothing was pushed

## Non-requirement

This spec does not change `decidePr()`'s or `createPr()`'s control flow, D4's
lookup-before-push ordering, or any other `memory.ship.*` message. Sibling messages on the
ship path (`diverged`, `pushFailed`, `prCreateFailed`, `raced`, `badHost`, and the
`memory.ship.sweep.*` family) were audited against the same "claims an action that did not
happen" defect class and found accurate as written — no change required.
