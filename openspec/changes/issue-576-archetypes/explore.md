# Exploration: #576 — the four archetypes on the port (M5 step B)

Worktree `/home/gandalf/IA/brain-issue-576`, off `origin/main @ 4cde50e`
(#831 merged). The issue body's "Measured state" is dated 12/08 and stale in
brain's favor — re-measured today:

| the body says | today |
|---|---|
| `brain/scripts/roles/` does not exist | exists — port, contract suite, `first-party/` with the Adversary instance |
| the port has n=0 inhabitants | **n=2 measured** (plain, gentle-ai), `instructions` in the contract |
| output contract gated on #552 | **#552 CLOSED** — the gate is open; mechanical validation is possible |
| ADR-0023 draft, unratified | **ADR-0023 does not exist, not even as a draft** — #312 closed without its doctrine; the port and now the archetypes have no signed ADR behind them |

## What stays true from the body

- Three genuinely new fields: **archetype**, **escalation rule**, **output
  contract**. Two already spoken for: write surface = `writes`, blindness =
  `reads` inverted (a closed read set). Duplicating those is the failure the
  2026-08-12 rescope exists to prevent.
- The taxonomy (from #284): Coordinator / Constructor / Adversary / Verifier,
  each characterized by what it may WRITE and what it must not SEE.
- Every contract labelled **mechanical or doctrinal** (#499's lesson): the
  write surface is mechanical (COMMENT-only port verbs, both providers);
  blindness is doctrinal unless something controls the material handed in.
- The reviewer is the first full instance — the only role with signed doctrine
  (`reviewer-protocol.md`, §2's three structural locks, drift-guarded by
  `reviewer-protocol.citations.test.mjs`).

## Standing debts this ticket can retire

1. `resolve-challenger.mjs:24` — "WHEN #312 LANDS: delete the binding half and
   call the port instead. Keep the AXIS resolution." The last debt of its
   class (the contract suite's header says so since #814).
2. #754 — "there is no cold-reviewer role definition" — closes here per the
   roadmap's own S5 line.
3. The Adversary instance (`first-party/adversary-cold-review.mjs`) is the
   seed: the archetype set grows AROUND it, as its header promised.

## Projection targets and the precedent

`compileAgentsMd` (antigravity): 5 canonical docs → AGENTS.md,
byte-deterministic, drift-guarded by `antigravity.drift.test.mjs`. The role
projection applies that shape to roles. Candidate native formats:
- `claude` — `.claude/agents/<name>.md` (frontmatter: name/description/model/tools)
- `antigravity` — a roles section of AGENTS.md (the compile pipeline exists)
- `gentle-ai`/`plain` — SDD_ENGINE frameworks; they DECLARE roles to the port
  (D6 vocabulary), they are not projection TARGETS. Projection is for AGENT
  platforms — the port's content rendered into each runtime's native format.

## jd-* (judgment-day) local agents

`~/.claude/agents/jd-{judge-a,judge-b,fix-agent}.md` — literal archetype
instances (two Adversaries, one Constructor) living OUTSIDE the repo, on one
machine. Exit criteria: migrated or explicitly left, with the reason.

## Open questions (the maintainer's, not design's)

1. Which platforms does the reviewer project to (the ≥2 with drift guard)?
2. ADR-0023 is missing entirely — does this ticket draft it (Ruta A, your
   promotion) or does doctrine get its own ticket?
3. jd-*: migrate into the first-party set, or leave with reason?
4. The resolve-challenger binding half: retire here, or separate ticket?
