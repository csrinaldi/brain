# Knowledge Consolidation Protocol (Moment 3)

> **status:** current | **last-reviewed:** 2026-06-24 | **owner:** @crinaldi

> **Purpose:** Force design micro-decisions, technical tricks, or anti-patterns discovered in a branch chat to scale up into the global brain at zero capture cost for the small team.

## 1. Hot Capture (During the Agent Chat)
- The human programmer or the main orchestrator agent must dump session technical agreements directly into the `## Micro-decisiones en caliente` section of the `tasks.md` for the corresponding change in `./openspec/changes/[change-id]/`. No floating micro-decisions are allowed in the chat history.
- If the direct change does not require SDD/OpenSpec, micro-decisions that must persist are documented in the commit/MR and promoted to `brain/` only if they apply to more than one module, resolve a recurring risk, or change a working rule.

### Concurrent writes — scratch-per-agent pattern

When multiple agents work on subtasks in parallel within the same change, **they must not write directly to `tasks.md`**. Concurrent writes to a shared mutable file produce conflicts and silent context loss.

Mandatory pattern for changes with parallel sub-agents:

- Each agent writes its local context to `openspec/changes/{iid}/scratch/{agent-id}.md` (ignored by git during the change flight).
- The orchestrator consolidates the scratch files into `tasks.md` when closing each batch.
- `openspec/changes/{iid}/scratch/` is in `.gitignore` — it is not committed or persisted.
- **The orchestrator is the only writer of `tasks.md`.** Sub-agents only write their own scratch file.

## 1b. HOME.md maintenance rule

Every time a new ADR is created or a file is added to `brain/methodology/` or
`brain/anti-patterns/`, the corresponding MR **must** update `brain/HOME.md` to
include the new link in the corresponding section. Without this update the MR
is not complete.

## 2. Promotion in the Merge Request (GitLab)

> **Hard Rule — Mandatory human gate:**
> No AI agent may commit directly to `brain/decisions/`,
> `brain/anti-patterns/`, `brain/domain/`, or `brain/methodology/`.
> Promotion works as follows:
> 1. The agent drafts the artifact (ADR, anti-pattern, glossary entry)
>    as a file under `openspec/changes/{iid}/brain-drafts/`.
> 2. The human reviews the draft in the MR, edits it if needed, and moves it to `brain/`
>    in a commit authored by them.
> 3. The MR description documents what was promoted and why.
>
> No agent promotes its own artifacts to `brain/`. That signature is human.
> See anti-pattern: `brain/anti-patterns/ia-escribe-brain-sin-gate.md`.

- Before removing the *Draft* status from the MR in your self-hosted GitLab, the organization's closing skill will analytically process the micro-decisions accumulated in the branch.
- If the learning applies to multiple microservices or resolves a critical compatibility bug (e.g., Jakarta JSON serializations), the agent must draft the artifact in `openspec/changes/{iid}/brain-drafts/` for the human to review and promote.

## 3. Zone map — who can write what

| Zone | Who writes | Allowed operations | Enforcement |
|------|---------------|----------------------|-------------|
| `brain/**` | Human only | create, update, delete | CODEOWNERS + human gate in MR |
| `openspec/changes/**` | Agent or human | create, update | None — flight zone |
| `openspec/changes/*/brain-drafts/**` | Agent (draft) | create, update | None — proposal zone |
| `openspec/changes/archive/**` | Agent or human | create (on archive) | None |
| `openspec/specs/**` | Agent or human | create, update | `npm run repo:check` validates references |
| `.engram/**` | Agent or human | create, update | Merge driver content-addressed |
| `scripts/**`, `package.json` | Agent or human | create, update, delete | `npm run repo:check` |
| `.gitlab-ci.yml`, `settings.xml` | Human recommended | update | Requires issue + MR (not mechanical) |

**Golden rule:** if the destination is `brain/`, the signature is human. Everything else may
originate from an agent, always with issue + MR as the delivery unit.

## 4. Semantic conflict protocol in Engram

Engram may accumulate contradictory observations across sessions — for example,
a "Spring prohibited" decision coexisting with "Spring Boot as target" before
ADR-0007 was formalized.

This protocol does not depend on proprietary harness APIs (confidence scores,
`judgment_id`, `mem_judge`). Authority is determined by **observation type**,
**declared authorship**, and **explicit supersession in the content** — all of it
readable without the harness active.

### Provenance convention in observations

Every observation saved in Engram must declare in its content:

| Field | Format | Example |
|-------|---------|---------|
| **Actor** | First line of body | `**Actor:** @crinaldi (humano)` / `**Actor:** claude-sonnet-4-6 (agente)` |
| **Source** | Reference to issue/MR if applicable | `**Fuente:** issue #78 / MR !72` |
| **Supersede** | Only if it replaces something previous | `**Supersede:** observación anterior "Spring prohibido"` |

This convention lives in the content — it is portable to any harness.

### How to detect conflicts

```bash
# Listar observaciones candidatas a revisión
mem_review --action list --project <your-project>
```

Observations with `needs_review` status are candidates. If `mem_review` is not
available, look for observations with type `architecture` or `decision` whose content
contradicts active ADRs in `brain/decisions/`.

### Resolution criteria

| Condition | Action |
|-----------|--------|
| Type `architecture`, `decision`, or `policy` in conflict | **The human decides** — the agent presents both versions and waits for explicit confirmation |
| One observation declares `**Supersede:**` pointing to the other | The previous one is marked `needs_review`; the agent continues without escalating |
| Type `pattern`, `bugfix`, `config`, or `discovery` in conflict | The agent resolves by recency (newest wins) unless there is an obvious contradiction |
| One observation is human-authored and the conflicting one is agent-authored, same type | The human one takes precedence |

### Resolution authority

The human is the final authority over conflicts of type `architecture`, `decision`, and
`policy`. The resolution is documented with:

1. An explicit `**Supersede:**` declaration in the winning observation
2. If the conflict changes a durable rule: new ADR or correction commit in `brain/`
3. If it is stale context: `mem_review --action mark_reviewed` after
   explicit human confirmation — never automatically

## 5. Memory Synchronization (Engram git-based)

`npm run day:start` closes the full cycle at the start of the workday:
1. **import** (`engram sync --import`) — pulls `.engram/` from the repo → local `~/.engram`
2. **index** (`brain-to-engram.mjs`) — reprojects `brain/` → `~/.engram`
3. **export** (`engram sync --export`) — publishes `~/.engram` → `.engram/` in the repo

The export in step 3 captures the memory accumulated from the previous session and the reprojection of `brain/`. Memory generated during the active workday (in-session `mem_save` calls) is exported with the next `day:start` or manually:

```bash
npm run memory:share   # export explícito en cualquier momento
```

Before pushing the branch, confirm that `.engram/` reflects the current state:

```bash
npm run memory:share && git add .engram/ && git status
```

From #81 onwards, a **pre-push hook** (`scripts/hooks/pre-push`) automates that
check: it runs `engram sync --export` before every push and aborts if `.engram/`
was left uncommitted, indicating how to materialize it. It auto-installs via `core.hooksPath`
(the `prepare` script in `npm install` + self-heal in `day:start`), so it does not depend on
re-running `env:init`. The export is client-side by design — it only happens on the
dev's machine; the hook maximizes its reach but does not make it unbypassable (`git push --no-verify` remains
the emergency escape).

Once the MR is merged, the team absorbs the memory with `npm run memory:pull` or on the next `day:start`.

The **durable** layer (decisions, anti-patterns) is promoted to `brain/` in Markdown, which is the source of truth; engram is the shared **live** layer. See `../decisions/adr-0003-memoria-equipo-git-based.md`.
