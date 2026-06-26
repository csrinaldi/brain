# AI Agent Authorities

> **status:** current | **last-reviewed:** 2026-06-24 | **owner:** @crinaldi

> **Purpose:** defines what an agent can do autonomously, what requires
> human confirmation, and what is prohibited. Companion to `consolidation-protocol.md`
> and `anti-patterns/ia-escribe-brain-sin-gate.md`.
>
> **This document is human-authored.** Changes to tiers require an MR
> with human review — they are covered by CODEOWNERS.

---

## Authority tiers

### Tier 1 — Autonomous

The agent may execute without asking for permission:

- Read any file in the repo (`brain/`, `openspec/`, code, scripts)
- Create/modify files in `openspec/changes/**` (in-flight SDD artifacts)
- Create/modify files in `.engram/**` (live memory)
- Write to `scratch/{agent-id}.md` within an active change
- Run `npm run repo:check`, `npm run backend:build`, `npm run change:verify`
- Create issues in GitLab (`/gitlab-issue`)
- Propose commits for human review (but not push or merge without confirmation)
- Save observations in Engram (`mem_save`, `mem_session_summary`)
- Refresh the skill registry (`gentle-ai skill-registry refresh`)

### Tier 2 — Confirm before executing

The agent proposes and waits for explicit human approval:

- **Push to any branch** — the human approves each push
- **Create or merge an MR** — the human reviews the MR before merging
- **Modify files in `brain/`** — the agent drafts the artifact in
  `openspec/changes/{iid}/brain-drafts/`; the human moves it to `brain/`
- **Modify `.gitlab-ci.yml`, `settings.xml`, `CODEOWNERS`** — infrastructure changes
  that affect the whole team
- **Delete branches or committed files** — irreversible destructive actions
- **Resolve semantic conflicts of type `architecture`/`decision`** in Engram
  (see `consolidation-protocol.md §4`)
- **Deploy to the Package Registry** (`npm run backend:deploy`) — affects artifacts
  shared by all consumers

### Tier 3 — Prohibited

The agent must never do this, even if explicitly asked:

- Commit directly to `brain/decisions/`, `brain/anti-patterns/`,
  `brain/domain/`, or `brain/methodology/`
- Approve or merge its own MR
- Modify git history (`--force`, `--amend` of published commits,
  `rebase` of branches others use)
- Add AI attribution in commits (`Co-Authored-By: Claude...`)
- Publish JARs to the Package Registry without explicit human instruction
- Escalate decisions to other agents without the human's knowledge

---

## Escalation rule

If the agent is unclear which tier an action belongs to: **pause and ask**.
Doubt about the tier is already sufficient reason to escalate to the human.

---

## Review

This document must be reviewed when:
- A new tool type or capability is added to the harness
- A Tier 2 action proves to be routine and low-risk (candidate for Tier 1)
- A Tier 1 action produces an incident (candidate for Tier 2 or 3)

Changes to this document require an MR reviewed by `@crinaldi`.
