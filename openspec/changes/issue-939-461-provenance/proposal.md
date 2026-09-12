# Proposal — issue-939-461-provenance

## What

Two provenance bugs from the memory-audit handoff, bundled because both live
in the capture/round-trip provenance code path:

- **#939** (audit M4, RULED 2026-09-12): widen the default agent-marker list
  `resolveActorKind()` consults, so a session exporting a known AI-platform
  marker other than `AI_AGENT` (e.g. Codex's `CODEX_THREAD_ID`) is recorded
  `actorKind: agent`, not `human`.
- **#461**: a `source` citing an issue the record does not declare fabricates
  `issue` on round-trip.

## Ruling implemented (#939)

Maintainer, 2026-09-12: a session carrying a known AI-platform marker is
recorded as an agent, never a human. The default marker list widens beyond
`AI_AGENT`; `brain.agentEnv` still wins over the defaults. Accepted cost: a
human typing inside an agent terminal is recorded as an agent, because the
session genuinely is one — the two errors (agent-as-human vs human-as-agent)
are not symmetric; the former launders machine content as human-authored
(ADR-0031), the latter merely under-credits a person.

## #461 status: not implemented — this is a finding, not a fix

Both the issue body and the code's own header
(`provenance.mjs#renderProvenance`, "KNOWN-AMBIGUOUS, and NOT resolved here")
say the same thing: a record with no `issue` whose `source` cites `issue #N`
is byte-identical on the wire to a record with `issue: N` — no renderer or
parser change can distinguish them, because the distinguishing information
was never encoded. Closing it needs an architecture decision between two
non-trivial options (a new §4 doctrine marker, or a validation rule
previously ruled OUT on PR #460) — not a bug fix this apply session can make
unilaterally, and the first option touches `brain/core/**` doctrine, which is
out of scope here regardless. See the issue for the full analysis; no code
changed for #461 in this change.

## Non-goals

- Re-opening the #461 architecture decision (new marker vs validation rule).
- Editing `brain/core/**`/`brain/project/**` doctrine directly — a draft
  lives under `brain-drafts/` for the maintainer to promote.
- Touching `actor` resolution (#738, shipped) or "human typing inside an
  agent session" detection — #939's ruling explicitly accepts that
  conflation.
