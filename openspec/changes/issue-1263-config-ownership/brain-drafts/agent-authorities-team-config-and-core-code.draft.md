# agent-authorities.md — the team config has owners, the user layer is the person's, and `brain/core/**` code is not doctrine (issues #1263, #1254)

> **status:** Tier 2 draft. Not yet promoted. `agent-authorities.md` is a signed `brain/core/**`
> artefact, so an agent may not commit it — `brain/core/anti-patterns/ia-escribe-brain-sin-gate.md`.
>
> ```
> npm run brain:promote -- openspec/changes/issue-1263-config-ownership/brain-drafts/agent-authorities-team-config-and-core-code.draft.md
> ```
>
> **Your commit is the signature** (ADR-0028).

```brain-amendment/1
target: brain/core/methodology/agent-authorities.md
issue: 1263
body: ## Team config, user layer and brain/core code (issues #1263, #1254)
body-end: ### Notes for the promoter
```

```amend-find
- **Modify files in `brain/`** — the agent drafts the artifact in
  `openspec/changes/{iid}/brain-drafts/`; the human moves it to `brain/`
```

```amend-replace
- **Modify doctrine in `brain/`** — every `*.md` under `brain/core/**` (`methodology/`,
  `anti-patterns/`, `templates/`) and anything under `brain/project/**`. The agent drafts the
  artifact in `openspec/changes/{iid}/brain-drafts/`; the human promotes it to `brain/`
- **Modify code in `brain/core/**`** — the `*.mjs` files there (for example
  `config-migrations.mjs`, `managed-paths.mjs`) are code, not doctrine. The agent changes them on a
  branch like any other code, under the push and MR rows above and Tier 3's merge rule. They are
  not drafted in `brain-drafts/`, and changing them is not a Tier 3 act
```

```amend-find
- **Modify `.gitlab-ci.yml`, `settings.xml`, `CODEOWNERS`** — infrastructure changes
  that affect the whole team
```

```amend-replace
- **Modify `.gitlab-ci.yml`, `settings.xml`, `CODEOWNERS`, `brain.config.json`** — infrastructure
  changes that affect the whole team. `brain.config.json` is the team config (ADR-0040): a change
  to it needs the approval of a `governance.owners` member who is not its author, which the
  `team-config-reviewed` gate checks (detection at `lite`, required at `standard` and `regulated`,
  ADR-0026 Amendment 10). In an existing repository the agent does not edit it at all (Tier 3)
- **Write the user layer** (`<BRAIN_HOME>/config.json`, else `~/.brain/config.json`) — it belongs
  to the person, not to the repository (ADR-0040 section 1). The agent writes it only when that
  person asks, never commits it, and never copies its values into the team config
```

```amend-find
- Commit directly to `brain/core/**` or `brain/project/**` — the knowledge half,
  whatever its subdirectories are called
```

```amend-replace
- Commit doctrine directly — a `*.md` under `brain/core/**` or anything under
  `brain/project/**`, the knowledge half, whatever its subdirectories are called. Doctrine
  reaches `brain/` only through a draft a human promotes. Code under `brain/core/**` (`*.mjs`)
  is not the knowledge half: it is Tier 2 code like any other
- Edit the team config `brain.config.json` in an existing repository, by hand or through a
  verb (`brain:config -- set`, `env:init`). The agent proposes the exact
  `npm run brain:config -- set …` command; a human runs it on a branch, and an owner approves
  the PR (ADR-0040 sections 4 and 6). The founding run that creates the file is the adopter's
  act, not an agent's
```

## Team config, user layer and brain/core code (issues #1263, #1254)

**Signed**: DD/MM/YYYY — <Name>

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

### Notes for the promoter

Three in-place edits, all in the tier lists: Tier 2's `brain/` row becomes two rows, doctrine and
code; Tier 2's infrastructure row gains `brain.config.json` and is followed by a new user-layer row;
Tier 3's knowledge-half row is narrowed to doctrine and followed by a new team-config row. The
document is not an ADR, so there is no amendment number and no `brain/HOME.md` marker. **One fork to
rule on:** #1254 lists doctrine as `*.md` under `methodology/` and `anti-patterns/`. This draft
writes every `*.md` under `brain/core/**`, which adds `templates/HOME.template.md`. That file is
markdown that ships to consumers. If the ruling was the two directories only, drop `templates/` from
the Tier 2 row before promoting. Sources: ADR-0040 ("Amendments this requires",
`agent-authorities.md`), #1254, #1263.
