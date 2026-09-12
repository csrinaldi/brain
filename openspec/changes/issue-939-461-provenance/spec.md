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

## #461 — no delta requirement

No code requirement is stated here. The issue and the code's own
`provenance.mjs#renderProvenance` header both establish that the fabrication
cannot be closed without a prior architecture decision (new §4 doctrine
marker, or a validation rule already ruled out on PR #460). That decision is
out of scope for this change — see `proposal.md`.
