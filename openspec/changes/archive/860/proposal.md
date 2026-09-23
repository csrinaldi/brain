---
issue: 860
phase: proposal
---

# Proposal — release debt is a signal, not a convention

## Intent

Make "what is published and what is not" a line `brain:status` prints, so the
question the maintainer asked — *when do I cut a release?* — is answered by
measurement instead of by a policy document nobody re-reads.

## Measured (main, 2026-09-05)

- **Zero** GitHub milestones; **zero** cadence doctrine anywhere in `brain/core`
  or `docs/`.
- `main` is **7 commits** past the published `1.4.0`: 3 feat, 4 fix, no new
  migration — but real consumer-visible changes to `run-check` (#603) and
  `actor-check` (#124).
- The precedent already cost something: migrations `1.2.0`–`1.4.0` sat
  **promoted, signed and dead** for weeks, because `migrateConfig` applies
  entries only up to the installed package version. Nothing said so.

## Why a mechanism and not a document

A cadence policy in a `.md` is a hand-maintained fact — the shape this
repository has spent several changes removing. Its failure mode is silence,
which is the failure mode that produced the dormant migrations.

Brain already holds all three inputs: the package version, the migration tail,
and what changed since the last release tag.

## The severity ladder, and it is not one level

1. **A promoted migration above the published version.** That code is DEAD for
   every consumer until a release ships. Strongest signal.
2. **Consumer-visible behaviour changed** — a gate's exit code, a verb's
   contract. Owed, not urgent.
3. **Internal-only work** — hygiene, audits, doctrine. Accumulates, reports
   nothing, because a line that fires for everything is a line nobody reads.

## Scope

`brain/scripts/status/release-debt.mjs`: a pure `releaseDebt()` over injected
facts, plus a thin gatherer, printed by `brain:status` in the shape #713's
stranded-tracker section established — **report, never refuse**.

## Non-goals

No auto-publish: the cut stays a human act, for the same reason promotion does.
No GitHub milestones — the epics carry `brain-graph/1` and live closer to the
code. No commit classification beyond conventional-commit prefixes.
