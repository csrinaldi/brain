---
status: applying
issue: 975
---

# Config-shape check on `loadBrainConfigOrThrow` (#975)

## Requirements

### Requirement: a non-object brain.config.json fails the strict loader closed

#### Scenario: null
- **WHEN** `brain.config.json` exists and parses to the JSON literal `null`
- **THEN** `loadBrainConfigOrThrow` throws, and the message names the path and `got null`

#### Scenario: array
- **WHEN** `brain.config.json` exists and parses to a JSON array (e.g. `[]`)
- **THEN** `loadBrainConfigOrThrow` throws, and the message names the path and `got array`

#### Scenario: number
- **WHEN** `brain.config.json` exists and parses to a JSON number (e.g. `42`)
- **THEN** `loadBrainConfigOrThrow` throws, and the message names the path and `got number`

#### Scenario: string
- **WHEN** `brain.config.json` exists and parses to a JSON string (e.g. `"x"`)
- **THEN** `loadBrainConfigOrThrow` throws, and the message names the path and `got string`

### Requirement: absence and a valid object are unaffected

#### Scenario: absent config
- **WHEN** `brain.config.json` does not exist at the given root
- **THEN** `loadBrainConfigOrThrow` returns `{}`, exactly as before this change (R11, #942)

#### Scenario: valid object config
- **WHEN** `brain.config.json` exists and parses to a plain JSON object
- **THEN** `loadBrainConfigOrThrow` returns that object unchanged

### Requirement: DENY-direction callers propagate the shape-check throw, driven at the real entry point

#### Scenario: the release gate fails closed
- **WHEN** `brain-audit.mjs` runs against a working tree whose `brain.config.json` parses but is not an object
- **THEN** the audit exits non-zero and the printed failure names `brain.config.json`, `must contain a JSON object`, and the JSON type found — before any merge is evaluated

#### Scenario: brain:approve fails closed
- **WHEN** `approve/cli.mjs`'s real `defaultReadDenyActors` reads a `brain.config.json` that parses but is not an object
- **THEN** the reader throws, naming the path and the type, and `runApprove` (driven with the real reader, not a stub) refuses the approval without posting anything

### Requirement: `loadBrainConfig()` is unchanged

#### Scenario: no caller of the legacy loader needs the shape check
- **WHEN** any of `loadBrainConfig()`'s seventeen call sites reads a non-object config
- **THEN** behaviour is exactly as before this change — no DENY/exclusion-list caller exists for this function, so extending the shape check to it is out of scope (see `proposal.md`'s classification table)
