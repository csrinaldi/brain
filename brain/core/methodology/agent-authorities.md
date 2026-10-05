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
- Capture memory as records: `npm run brain:memory:save` writes a record under `.memory/records/` first (`memory-backend-contract.md` rule 2); the active backend picks it up on the next hydration (`session:start`, `cli.mjs import`) until #874 adds direct hydration. The backend's own MCP write (`mem_save`) is working memory for the change in flight, non-durable by definition: nothing exports it.
- Write to `scratch/{agent-id}.md` within an active change
- Run `npm run brain:repo:check`, `npm run backend:build`, `npm run brain:change:verify`
- Create issues in GitLab (`/gitlab-issue`)
- Propose commits for human review (but not push or merge without confirmation)
- Save observations in Engram (`mem_save`, `mem_session_summary`)
- Refresh the skill registry (`gentle-ai skill-registry refresh`)

### Tier 2 — Confirm before executing

The agent proposes and waits for explicit human approval:

- **Push to any branch** — the human approves each push
- **Create an MR** — the human authorizes it; **merging** follows the declared autonomy
  mode (ADR-0037): in mode A the human reviews the MR and merges it; in modes B and C the
  agent does not merge, the platform does (see Tier 3)
- **Modify doctrine in `brain/`** — every `*.md` under `brain/core/**` (`methodology/`,
  `anti-patterns/`, `templates/`) and anything under `brain/project/**`. The agent drafts the
  artifact in `openspec/changes/{iid}/brain-drafts/`; the human promotes it to `brain/`
- **Modify code in `brain/core/**`** — the `*.mjs` files there (for example
  `config-migrations.mjs`, `managed-paths.mjs`) are code, not doctrine. The agent changes them on a
  branch like any other code, under the push and MR rows above and Tier 3's merge rule. They are
  not drafted in `brain-drafts/`, and changing them is not a Tier 3 act
- **Modify `.gitlab-ci.yml`, `settings.xml`, `CODEOWNERS`, `brain.config.json`** — infrastructure
  changes that affect the whole team. `brain.config.json` is the team config (ADR-0040): a change
  to it needs the approval of a `governance.owners` member who is not its author, which the
  `team-config-reviewed` gate checks (detection at `lite`, required at `standard` and `regulated`,
  ADR-0026 Amendment 10). In an existing repository the agent does not edit it at all (Tier 3)
- **Write the user layer** (`<BRAIN_HOME>/config.json`, else `~/.brain/config.json`) — it belongs
  to the person, not to the repository (ADR-0040 section 1). The agent writes it only when that
  person asks, never commits it, and never copies its values into the team config
- **Delete branches or committed files** — irreversible destructive actions
- **Resolve semantic conflicts of type `architecture`/`decision`** in Engram
  (see `consolidation-protocol.md §4`)
- **Publish to the package registry** — affects artefacts shared by all consumers

### Tier 3 — Prohibited

The agent must never do this, even if explicitly asked:

- Commit doctrine directly — a `*.md` under `brain/core/**` or anything under
  `brain/project/**`, the knowledge half, whatever its subdirectories are called. Doctrine
  reaches `brain/` only through a draft a human promotes. Code under `brain/core/**` (`*.mjs`)
  is not the knowledge half: it is Tier 2 code like any other
- Edit the team config `brain.config.json` in an existing repository, by hand or through a
  verb (`brain:config -- set`, `env:init`). The agent proposes the exact
  `npm run brain:config -- set …` command; a human runs it on a branch, and an owner approves
  the PR (ADR-0040 sections 4 and 6). The founding run that creates the file is the adopter's
  act, not an agent's
- Approve or merge a change it produced, **in any autonomy mode** (ADR-0037). The producing
  identity (a commit author or the PR/MR author) is never the approver or the merger:
  - **mode A** — a human approves the intent and a human merges;
  - **mode B** (the default) — a human approves the intent; the platform merges, under the
    automation identity, only when every required gate passes and the cold review, posted by
    an identity other than the producer, approves; anything else escalates to the human;
  - **mode C** — an agent identity other than the producer may approve the intent, and the
    platform merges as in B; refused at tier `regulated`.

  No agent holds a merge verb in any mode, and the reviewer gains no approve or merge
  authority. The only exception is the solo maintainer at `lite` in mode A, who may merge a
  change produced under their own credential; it is reported as such, never as independent
- Modify git history (`--force`, `--amend` of published commits,
  `rebase` of branches others use)
- Add AI attribution to commits — an agent co-author trailer, a session URL or a
  "generated with" footer, whatever the tool is called. Provenance is not
  authorship: it is evidence when a runner attests to it, and a claim when the
  producer asserts it about itself (ADR-0031). Enforced by `hooks/commit-msg`
  and `hooks/pre-receive`; the agent vocabulary is `git config brain.aiAgents`,
  so a consumer governs their own tooling without waiting for a brain release
- Publish release artefacts to the package registry without explicit human
  instruction — whatever the ecosystem's artefact is
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

## Autonomy modes (issue #1123)

**Signed**: 25/09/2026 — Cristian Rinaldi

### What changed

Tier 3's "approve or merge its own MR" becomes a rule per autonomy mode, and Tier 2's "the human
reviews the MR before merging" holds in mode A only. The invariant under both is unchanged in
substance and now stated for every mode: the identity that produced a change never approves or
merges it.

### Why

The flat rule asked an agent to remember it, and at `lite` the forge requires no approving
review, so nothing stopped an agent that held a merge path. It also named no way to run
automatically without the agent merging its own work. ADR-0037 separates who approves the
intent from who executes the merge, and makes the merger the platform, not the producer.

### What this does NOT close, said plainly

The rule is still doctrine until the identity gate (#1134) and the port's merge verb (#1133)
land. Until then mode B cannot be claimed and the effective mode is A: a human approves the
intent and a human merges. Brain reports the declared and the effective mode separately rather
than letting the default read as enforced.

## Team config, user layer and brain/core code (issues #1263, #1254)

**Signed**: 05/10/2026 — Cristian Rinaldi

### What changed

- **`brain.config.json` joins Tier 2's team-wide infrastructure.** ADR-0040 names this document in
  "Amendments this requires". The row says who approves a change: a `governance.owners` member who
  is not the author, checked by the `team-config-reviewed` gate (`GOVERNANCE_JOBS`,
  `brain/scripts/vcs/governance-checks.mjs`) at the tier's own policy.
- **An agent never edits the team config in an existing repository (Tier 3).** ADR-0040 section 4
  rules that, after the foundation, nobody's daily run writes it. An agent proposes the
  `brain:config` command and a human runs it.
- **The user layer is the person's (Tier 2).** `<BRAIN_HOME>/config.json` holds one person's
  orchestrator, runtimes and versions, across every repository. The agent writes it only on that
  person's request.
- **`brain/core/**` is split into doctrine and code (#1254).** Tier 2 and Tier 3 named
  `brain/core/**` by path alone and called it "the knowledge half". The path also holds code:
  `config-migrations.mjs` and `managed-paths.mjs`. Doctrine is now every `*.md` under
  `brain/core/**`, plus `brain/project/**`. It still goes through a draft and a human promotion.
  The `*.mjs` under `brain/core/**` is code, under the ordinary PR review and merge rules.

### Why

Before ADR-0040, any PR could change the tier, the ignore list, the reviewer or an axis of the
team config, with the review a typo fix gets. #1114 S3.3 also made daily `env:init` write it from
any machine. Tier 2 already listed the files that affect the whole team, and this one was missing.

#1254: the cold review of PR #1252 read Tier 2 and Tier 3 literally and flagged a config migration.
Every migration since 1.2.0 has landed through a PR the maintainer merged, so the rule's intent
always held. Its wording forced a human ruling on every migration PR anyway.

### What the code does not do yet, said plainly

- **The cold reviewer still flags `brain/core/**` code.** `TIER2_PREFIXES` in
  `brain/scripts/review/evaluators/tranche.mjs` is `['brain/core/', 'brain/project/']`, so a
  migration PR still draws the `tier2-frontier` finding. Aligning it with this split is #1254's code
  half, and its acceptance ("a PR that adds a config migration draws no Tier-2 finding") is not met
  by this draft.
- **Nothing refuses an agent's edit of `brain.config.json`.** The `team-config-reviewed` gate judges
  the PR, not who made the edit, and at `lite` it only reports. `brain:config -- set` cannot tell
  whether an agent invoked it.
- **Nothing stops an agent from writing the user layer.** That row is doctrine only.
