# Workflow Guide

Two ways to run the brain SDD workflow on a feature, end to end:

- **A. AI-assisted** — drive it through Claude skills (the `gentle-ai` harness).
- **B. Manual** — run the `npm` verbs yourself, in sequence, no AI.

Both modes drive the *same* underlying verbs and produce the *same* artifacts and
governance evidence. The canonical verb contract is
[`harness-contract.md`](../brain/core/methodology/harness-contract.md); the enforcement
that runs over the result is [ADR-0014](../brain/project/decisions/adr-0014-workflow-governance.md)
+ [ADR-0015](../brain/project/decisions/adr-0015-governance-v3-substrate-ladder.md).

## The flow at a glance

```
issue → branch → SDD change (proposal → spec → design → tasks) → apply → verify → archive → PR → merge
```

Artifacts live under `openspec/changes/issue-<id>-<slug>/` during the change; only the
durable residue (ADRs, anti-patterns, glossary) is later promoted into `brain/` by a human.

---

## A. AI-assisted (Claude / gentle-ai)

Run these as slash-commands in a Claude session. Each maps to a canonical verb.

| Step | Command | What it does |
|------|---------|--------------|
| 0 (optional) | `/sdd-explore <idea>` | Investigate before committing to a change — no artifacts created |
| 1 | `/ticket-start <id>` | Take the issue, create branch `{type}/issue-{id}-{slug}` from main |
| 2 | `/sdd-new <id>` | Scaffold the SDD change: `proposal.md`, `spec.md`, `design.md`, `tasks.md` |
| 3 | `/sdd-continue` | Advance the next ready phase (proposal → spec → design → tasks); repeat until tasks are ready |
| 4 | `/sdd-apply` | Implement the tasks (strict-TDD when the project supports it) |
| 5 | `/sdd-verify` | Validate the implementation against spec / design / tasks |
| 6 | `/sdd-archive` | Close the change, consolidate artifacts |
| 7 | `/mr-create` | Open the PR/MR linked to the issue |

- `/retomar` — restore context from the previous session (engram + VCS board) after a break.
- The human still **approves** the issue (`status:approved`) and **signs** any ADR — the
  agent never self-approves or promotes its own artifacts.

---

## B. Manual (no AI — npm verbs in sequence)

Every command has a `brain:` canonical form (the short alias without the prefix is
deprecated but still works).

**One-time setup**

```bash
npm run brain:env:init          # bootstrap tools, auth, memory, skill registry (idempotent)
```

**Start of every session**

```bash
npm run brain:session:start     # restore manifest/engram/active-change context (read-only, local)
```

**Per feature**

```bash
# 1. Take the issue + create the branch
npm run brain:ticket:start -- <id>

# 2. Start the SDD change (scaffolds the artifact folder)
npm run brain:project:feature -- --issue <id>

# 3. Edit the artifacts by hand, in order:
#    openspec/changes/issue-<id>-<slug>/proposal.md   (human-approved PRD)
#    openspec/changes/issue-<id>-<slug>/spec.md        (delta requirements)
#    openspec/changes/issue-<id>-<slug>/design.md      (technical decisions)
#    openspec/changes/issue-<id>-<slug>/tasks.md       (implementation checklist)

# 4. Implement the code (check off tasks as you go)

# 5. Quality gates — run before committing
npm run brain:repo:check        # prohibited-reference check (minimum gate)
npm test                        # full test suite
npm run brain:change:verify     # scope-aware verification of the active change

# 6. Persist team memory before pushing
npm run memory:share            # export local engram → .memory/ (versioned in git)

# 7. Commit and open the PR with a "Closes #<id>" reference
```

**Status / operations (any time)**

```bash
npm run brain:project:status        # active change, artifacts, next action
npm run brain:tracker:board         # ticket board
npm run brain:governance-status     # active substrate rung + remedy to climb higher
npm run brain:audit                 # governance invariants over a commit range
npm run brain:protect               # arm branch-protection contexts (where supported)
```

---

## Governance applies in both modes

The change lands the same way regardless of how you produced it. On the PR, the CI gates
from ADR-0015 run over the observable evidence:

- **Required** — `issue-link`, `diff-size`, `local-checks`, `memory-gate`, `decision-gate`.
- **Detection** (report, do not yet block) — `phase-order`, `actor-check`, `brain-writes-reviewed`.

Two rules bite most often and are worth remembering up front:

- A PR to `main` needs a `Closes/Fixes/Resolves #<issue>` reference, and that issue must
  carry the `status:approved` label — the human approves it.
- Any change to `brain/HOME.md` (or `brain/core/**` / `brain/project/**`) must ship with a
  correlated ADR and be reviewed by a human other than the author (Tier-2:
  "no agent writes to `brain/`").

See [ADR-0015](../brain/project/decisions/adr-0015-governance-v3-substrate-ladder.md) for
the full six-level ladder and the substrate-rung model.
