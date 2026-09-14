# Spec — issue-939-461-provenance

## Delta requirement: `resolveActorKind` default marker set (#939)

**REQ-939-1**: `resolveActorKind({ env, agentEnvConfig })`, absent an
`agentEnvConfig` override, MUST check the widened default marker list
`AGENT_ENV_DEFAULTS` (`AI_AGENT`, `CLAUDECODE`, `CODEX_THREAD_ID`), not the
single legacy `AGENT_ENV_DEFAULT` (`AI_AGENT`).

### Scenarios

- **A session exporting only `CODEX_THREAD_ID`** (no `AI_AGENT`, no
  `brain.agentEnv`) → `actorKind: 'agent'`, `marker: 'CODEX_THREAD_ID'`,
  evidence names `CODEX_THREAD_ID`.
- **A session exporting only `CLAUDECODE`** → `actorKind: 'agent'`,
  `marker: 'CLAUDECODE'`.
- **A session exporting none of the default markers, no override** →
  `actorKind: 'human'`, `marker: null`, evidence lists every name checked.
- **A default marker set but EMPTY** (e.g. `CODEX_THREAD_ID=''`) →
  `actorKind: 'human'`, evidence names that marker "set but empty" (#888
  set-but-blank discipline — unchanged from before this change).
- **`git config brain.agentEnv` set** → the configured list is checked
  INSTEAD of the defaults; the defaults never leak in when an override is
  present (unchanged behavior, re-verified against the new default list).

Out of scope for this requirement: `actor` resolution (#738, shipped);
distinguishing a human typing inside an agent session from the agent itself
(the #939 ruling accepts that conflation).

## Delta requirement: `validateWritableRecord` W4 (#461, write-time only)

**REQ-461-1**: `validateWritableRecord(record)` MUST refuse a record whose
`source` cites `issue #N` (matches `/issue #(\d+)/`) unless the record's own
`issue` is present and equal to `N`. `validateRecord` (the READ gate) MUST
NOT gain this rule — a record already carrying the shape must still parse
via `parseRecordLine`, per #460's ruling against a read-path version of this
check.

### Scenarios

- **`source: 'issue #201 / PR #204'`, no `issue`** → `validateWritableRecord`
  invalid (W4); `validateRecord` still valid.
- **`source: 'issue #201 / PR #204'`, `issue: 405`** (disagreeing) →
  `validateWritableRecord` invalid (W4).
- **`source: 'issue #201 / PR #204'`, `issue: 201`** (agreeing) →
  `validateWritableRecord` valid.
- **`source` with no `issue #N` citation at all** → W4 never fires,
  regardless of `issue`.
- **A pre-existing record already carrying the disagreeing shape** →
  `parseRecordLine`/`validateRecord` still parse/admit it unchanged.

## #461 — genuinely remaining, not a code requirement

Existing records that already carry the disagreeing shape are not corrected
by REQ-461-1 (it is write-time only). Correcting those needs the
architecture decision the issue itself defers: a new §4 doctrine marker
(`brain/core/**`, out of scope here) or overturning #460's ruling against a
read-path rule. Measured 0/2374 records in this repo carry the shape,
2026-09-12 — see `proposal.md`.
