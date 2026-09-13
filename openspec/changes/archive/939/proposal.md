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

## #461 status: partially closed — a write-time guard, not the full fix

A first apply attempt refused #461 outright, reasoning that both options the
issue names (a new §4 doctrine marker, or the `R4` validation rule #460
dropped) needed an architecture decision. A fresh review corrected that: the
issue itself names a THIRD option, already shipped and explicitly out of
that ruling's scope — `validateWritableRecord` ("added in #460... available
and safe, but it does not fix records that already exist"). This change adds
**W4** to it: `validateWritableRecord` now refuses a record whose `source`
cites `issue #N` while the record's own `issue` is absent or a different
number. `brain/scripts/memory/lib/format.mjs`.

This closes the WRITE path: brain itself can no longer create the shape.
`validateRecord`/`parseRecordLine` — the READ path — stay untouched, per
#460's ruling that a read-path rejection would brick a pre-existing consumer
store (`.memory/**` is consumer-owned). What genuinely remains, and is NOT a
code fix: records that ALREADY carry the shape before this change — closing
that still needs the architecture decision between a new §4 marker (doctrine
change, `brain/core/**`, out of scope here) or overturning #460's read-path
ruling. Measured over this repo's `.memory/records/`, 2026-09-12: 0/2374
records carry the shape (2 records cite an issue in `source`; both agree
with their own declared `issue`) — the corruption W4 closes was latent here,
not active. See the issue for the full two-option analysis this change does
NOT resolve.

## Non-goals

- Re-opening the #461 architecture decision (new marker vs validation rule).
- Editing `brain/core/**`/`brain/project/**` doctrine directly — a draft
  lives under `brain-drafts/` for the maintainer to promote.
- Touching `actor` resolution (#738, shipped) or "human typing inside an
  agent session" detection — #939's ruling explicitly accepts that
  conflation.
