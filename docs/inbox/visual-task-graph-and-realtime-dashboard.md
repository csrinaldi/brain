# Visual Task Graph & Real-Time Dashboard (Brain UI)

> **status:** draft / RFC | **last-reviewed:** 2026-09-08 | **owner:** @crinaldi | **issue:** #851
>
> **Amendment 1 (2026-09-08)** — the first draft (2026-09-03) put live telemetry
> and an MCP server in slice 2 and inspection in slice 3, and covered only the
> developer's view. This revision (a) adds the management views the maintainer
> asked for — roadmap, ADRs, anti-patterns, project history, per-actor progress,
> per-round cold-review history; (b) replaces the two-source model with a
> three-tier state model where everything shown is reconstructible from the
> repository and the tickets; (c) records two rulings on where review history
> lives; and (d) reorders the roadmap so the cold source ships first and
> telemetry/MCP last. Section 2's inventory was measured against the tree on
> 2026-09-06.

---

## 1. Context & Vision

`brain` is a deterministic, fail-closed development harness: strict
Spec-Driven Development (SDD) layouts, a two-layer memory, isolated git
worktrees per issue, and an external cold-reviewer protocol.

For a hybrid team of autonomous agents and human leads working concurrently, it
has an **observability gap**:

1. Progress is scattered across worktrees (`/home/gandalf/IA/brain-issue-*`),
   branches and PR threads.
2. In-flight agent state (current slice, failing test, task being tackled) is
   locked inside local transcripts or ephemeral stdout.
3. Human stakeholders and collaborating agents perform "context archaeology" to
   learn the health and trajectory of an epic.

### Audiences

- **Developers** — "what is this branch doing now, what did the reviewer say,
  what is the next task". Needs the local, possibly uncommitted, view of their
  own machine.
- **Project leads** — "where is the epic, what is blocked, who did what this
  week, which decisions were taken and why". Needs a shared, reproducible view
  that does not depend on any single machine being online. This is a
  management surface, not a terminal companion.

### The Objective

An interactive web dashboard (**Brain UI**) showing the project as a live
Directed Acyclic Graph (DAG) of epics, features and tasks, plus the management
views around it. Clicking any node opens an inspector with:

- **Curated specification** — human-first rendering of `spec.md` requirements
  and scenarios, not a raw markdown dump.
- **Task checklist** — `tasks.md` items with completion state and the actor
  who did them.
- **Review history** — every cold-review round, not only the latest verdict:
  rev, verdict, findings by severity, causal disposition, what changed between
  rounds.
- **Working memory** — the branch's `resume.md`: next action, current slice,
  blockers.
- **Agent presence** (later slice) — live heartbeat, current action, test tail.

And, outside the graph:

- **Roadmap** — epics, tracks and their ordering.
- **Decisions** — ADR list with status, amendments and the issues that drove
  them.
- **Anti-patterns** — the catalogue, linked to the tickets where each was
  found.
- **Project history** — a timeline of merges, releases, decisions and reviews.
- **Progress by actor** — humans and agents, over the same schema.

**Rule zero: every fact the dashboard shows must be reconstructible from the
repository plus the tickets.** If a fact has no source there, the dashboard
does not show it. This rule is what keeps the UI from becoming a second source
of truth, and it is why several data pieces (section 3) must exist before the
UI does.

---

## 2. Core Architecture: Three-Tier State

The first draft reconciled two sources (durable git substrate, live agent
stream). That is still the end state, but it hid a tier in the middle and put
the riskiest tier first. The model is now three tiers, consumed in order, each
one labeled in the UI so a reader always knows which they are looking at.

```
┌────────────────────────────────────────────────────────────────────────┐
│ Tier 1 — COMMITTED (shared truth)                                      │
│   main + PR branches on the forge, openspec/changes/**, .memory/records│
│   ADRs, anti-patterns, tags/releases, issues, PRs, posted verdicts     │
│   → the only tier a project lead's view is built from                  │
├────────────────────────────────────────────────────────────────────────┤
│ Tier 2 — LOCAL OVERLAY (this machine, uncommitted)                     │
│   working tree of each worktree, branch-local resume.md, the           │
│   gitignored machine cache openspec/reviews/pr-NNN/cold-review.md      │
│   → shown only when the viewer is on the machine that owns it,         │
│     always marked "uncommitted"                                        │
├────────────────────────────────────────────────────────────────────────┤
│ Tier 3 — LIVE (ephemeral telemetry)                                    │
│   agent heartbeats, current action, test output tail                   │
│   → a later slice; never authoritative; silence falls back to tier 1/2 │
└────────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
                    ┌──────────────────────────────┐
                    │      Brain UI read model     │
                    │  composes pure functions →   │
                    │  one snapshot, diffed on     │
                    │  every repo/forge change     │
                    └──────────────┬───────────────┘
                                   │
               ┌───────────────────┴───────────────────┐
               ▼                                       ▼
      [ Web dashboard ]                       [ MCP server — later ]
      HTTP snapshot + SSE diffs               tools/resources for agents
```

### 2.1 Tier 1 — what already exists as data

**Single accessor rule.** The read model imports brain's existing pure
functions. It never parses CLI stdout and never invents filesystem paths or git
scrapers. Measured on 2026-09-06, these are the entry points:

| Fact | Entry point | Shape |
| --- | --- | --- |
| Epic graph (the roadmap skeleton) | `brain/scripts/status/epic-graph.mjs` `buildGraph()` | `{nodes, edges, tracks, divergences, ...}`; nodes carry `number, title, labels, state, track, assignees`. Reads `brain-graph/1` blocks off tracker issues. The CLI (`brain:epic:map`) only renders mermaid into the issue body. |
| SDD layout per change | `brain/scripts/lib/sdd-layout.mjs` — `changeDir`, `artifactPaths`, `missingRequiredArtifacts`, `parseSliceScopes` | Paths per lifecycle artifact; `brain-slice-scope/1` JSON inside `tasks.md`. |
| Status sections | `brain/scripts/status/derive.mjs`, `derive-review.mjs` | `deriveTicket/Chain/Tasks/Divergence/Review/WorkingMemory/StandingItems` return structured sections; `report.mjs` renders prose. |
| Latest cold-review verdict per PR | `brain/scripts/review/lib/parse-verdict.mjs` (`parseVerdict`, `verdictsAtHead`), `schema-v2.mjs`, `board.mjs` `reconcileOnePr`, `queue.mjs` `gatherQueue` | `brain-review/2` block parsed from the PR comment; findings carry `evidence_class` and `causal_disposition`. |
| Issues, PRs, labels, commits | `brain/scripts/vcs/cli.mjs` `getVcs()` and its `VERBS` | Structured objects from the provider. No comment-read verb exists. |
| Memory records | `.memory/records/<yyyy-mm>-<id>.jsonl` per `brain/core/methodology/memory-format.md` | `{id, ts, actor, actorKind, type, project, issue?, supersedes?, content, source?}` — the canonical human/agent attribution. |
| Branch working memory | `resume.md` per branch, schema in `brain/scripts/memory/lib/resume-schema.mjs` | `next_action`, `current_slice`, `blockers[]`. |
| Release debt | `brain/scripts/status/release-debt.mjs` `gatherReleaseFacts()`, `releaseDebt()` | `{severity, lines}`; not yet wired to a CLI verb. |
| Governance metrics | `brain:metrics --json` | The only JSON-emitting CLI verb today. |

No HTTP server, MCP server or `brain:ui` script exists in the tree.

### 2.2 Tier 1 — what exists only as prose, or not at all

- **Review-round history.** Only the latest verdict per PR thread is parseable.
  Earlier rounds exist only as the forge comment timeline, which the VCS port
  cannot read. The local artifact `openspec/reviews/pr-NNN/cold-review.md` is
  the engine's raw findings (`brain-findings/1`), deliberately without a
  protocol line; the stage removes it before every run
  (`run-cold-review-stage.mjs`), it is gitignored, and it lands in whichever
  worktree ran `brain:review`. Measured: PR #872's file holds `[]` — the final
  APPROVE — and the round-1 REVISE is gone.
- **Roadmap.** Prose under `docs/inbox/`. The epic graph is the only structured
  roadmap.
- **ADR index.** 33 files under `brain/project/decisions/`, hand-listed in
  `brain/HOME.md` with amendments embedded as prose. No parser reads frontmatter
  or amendments; `governance/checks/adr-presence.mjs` is a presence gate only.
- **Anti-patterns index.** Hand-written READMEs; nothing enumerates them.
- **Progress by actor.** Nothing aggregates over `actor`/`actorKind` or commit
  authorship.
- **Ticket ↔ branch ↔ worktree link.** Not persisted; reconstructable from the
  branch-name convention plus `git worktree list`.
- **A JSON snapshot** of status, graph or board: none.

### 2.3 Tier 2 — the local overlay

A developer looking at their own machine sees, on top of tier 1:

- the working tree of every worktree under the repo's parent directory
  (uncommitted edits to `tasks.md`, `spec.md`, `resume.md`);
- the machine cache `openspec/reviews/pr-NNN/cold-review.md` — the latest
  raw findings, useful between "stage ran" and "verdict posted".

Overlay facts are rendered with an explicit "uncommitted on this machine"
marker and never reach a shared deployment (section 5).

### 2.4 Tier 3 — live telemetry

Unchanged from the first draft in shape (heartbeat with `agentId`, `feature`,
`worktree`, `phase`, `currentTaskIndex`, `status`, `nextAction`,
`lastLogSnippet`, `updatedAt`), but moved to the last slice. Silence or
disconnection falls back to tiers 1 and 2. Telemetry never overrides a
committed fact.

---

## 3. Data That Must Exist Before the UI

Rule zero turns four of section 2.2's gaps into prerequisites. They are worth
doing even if the UI never ships, because each one turns prose into data brain
can reason about.

### 3.1 Cold-review verdicts become memory records — RULED

**Ruling (maintainer, 2026-09-08):** review-round history is committed and
shared, and each posted round is persisted as a `.memory/records` entry with a
new `type: review`.

Fields: `actor`/`actorKind` (the reviewer identity), `issue`, `pr`, `rev`,
`head_sha`, `verdict`, a findings summary (counts by severity and causal
disposition, blocker titles), and `supersedes` pointing at the previous
round's record id. Emitted by `brain/scripts/review/poster.mjs` at post time —
the one moment the machine holds the full verdict.

**Why a memory record and not a file on the PR branch.** A verdict pins
`head_sha`. Committing `rev-N` on the PR branch after the APPROVE moves the
approved head, and under ADR-0026 Amendment 5 the poster's commit is foreign to
the approval. The record therefore cannot ride the PR head. That is exactly the
problem #862 (memory lane) and #863 (backend contract: idempotent hydration by
id, records first, no backend artifact in the tree) are solving for every other
record. One mechanism, not two: review history rides the memory lane.

**Costs.** `memory-format.md`'s `type` enum grows `review` — that is
`brain/core` doctrine, a Tier 2 human promotion. The UI's review views depend
on #862 and #863 closing. The #863 backend contract gains a producer it did not
list: the review poster.

**What it buys.** Progress by actor becomes one aggregation over records —
decisions, session summaries and reviews share one `actor`/`actorKind`
schema, so no cross-referencing of commit authorship is needed.

### 3.2 ADR index as data

A parser over `brain/project/decisions/adr-NNNN-*.md` yielding `{number, title,
status, date, amendments[{n, date, issue, summary}], supersedes?, issues[]}`.
Amendments are currently prose inside HOME.md's bullets and inside each ADR's
"Amendment N" heading; the parser reads the ADR files, and a drift check keeps
HOME.md's hand-written list consistent with what it finds.

### 3.3 Anti-patterns index as data

Enumerate `brain/core/anti-patterns/*.md` and `brain/project/anti-patterns/*.md`
into `{id, title, scope: core|project, path, issues[]}`. Cross-link to tickets
by scanning issue references in each file.

### 3.4 Roadmap as data

No new artifact. The roadmap IS the epic graph: `buildGraph()` over the tracker
issues' `brain-graph/1` blocks already carries tracks, ordering and blocking
relations. What is missing is a JSON emitter and a "planned / in-flight /
done" derivation per node from PR and label state, which `derive.mjs` already
computes per ticket.

### 3.5 The snapshot

One read-model module composing 2.1's functions plus 3.1–3.4 into a single
`snapshot` object: `{generatedAt, tier, graph, changes[], prs[], reviews[],
records[], adrs[], antiPatterns[], actors[], releaseDebt}`. Exposed as
`npm run brain:snapshot -- --json`. Every other consumer (the web server, a
CI job, a future MCP resource) reads this shape; none re-derives.

Whether the server imports the read model in-process or shells out to the verb
is open (section 8).

---

## 4. The Protocol Choice: MCP for Agents — Later

Unchanged in intent from the first draft: brain exposes an MCP server
(`brain-mcp`) with tools (`brain_heartbeat`, `brain_claim_task`,
`brain_escalate`) and resources (`brain://graph/active`,
`brain://changes/{feature}/spec`) so no per-platform plugin is needed.

Changed in position: MCP is the agent-facing surface for tier 3 and it ships
last. Resources can be served straight from the snapshot (section 3.5) when the
time comes, which is another reason the snapshot comes first.

---

## 5. Server Topology

A lightweight Node.js server, kept inside `brain/scripts/ui/`, with two modes:

- **Local mode** (`npm run brain:ui`, `localhost:3000`) — serves the snapshot
  over HTTP and pushes diffs over Server-Sent Events. "Real time" here is a
  watcher over the repo (worktrees, `.memory/`, `openspec/`) plus a polling
  loop over the forge, diffed against the previous snapshot. No heartbeats
  needed. Tier 2 overlay is available.
- **Remote mode** (team hub) — same server, fed by forge webhooks and a checkout
  of `main`. Tier 1 only; the overlay is meaningless off the developer's
  machine.

WebSockets are not needed until tier 3; SSE covers one-directional diffs.

---

## 6. UI/UX

### The DAG canvas

Hierarchy: **Epics → Features (changes) → Task groups**. Node state derives
from tier 1 (label + PR + verdict state) and, when present, tier 3 pulse:

- 🟢 in progress (tier 1: open PR with commits since last verdict; tier 3: agent
  active)
- 🟡 awaiting cold review or human approval
- 🔴 blocked / `needs-ruling`
- ⚪ backlog

### Inspector drawer

1. **Spec** — requirements and scenarios rendered as cards, delta vs. baseline
   highlighted.
2. **Tasks** — checklist with actor and timestamp per completed item.
3. **Reviews** — one row per round from the `review` records: rev, verdict,
   findings by severity, what closed between rounds. Latest verdict expanded.
4. **Working memory** — `resume.md` fields; overlay-marked when uncommitted.
5. **Telemetry** (tier 3) — agent, action, log tail.

### Management views

- **Roadmap** — the epic graph as tracks over time, with planned / in-flight /
  done per node.
- **Decisions** — ADR table: number, title, status, amendments, driving
  issues. Click opens the rendered ADR.
- **Anti-patterns** — catalogue with the tickets where each was found.
- **History** — timeline of merges, releases, ADRs and review verdicts, from
  git tags, PR merge events and records.
- **By actor** — humans and agents side by side: records authored, reviews
  posted, PRs merged, per period. Same schema for both kinds.

---

## 7. Phased Roadmap

Reordered: cold source first, telemetry last. Slices 1 and 2 are pure data
work with no UI and are valuable on their own.

### Slice 1 — Review history as records (depends on #862, #863)
- `type: review` added to `memory-format.md` (Tier 2 promotion).
- `poster.mjs` emits one record per posted round with `supersedes`.

### Slice 2 — Read model and snapshot
- ADR parser (3.2), anti-pattern enumerator (3.3), roadmap derivation (3.4).
- `brain:snapshot --json` composing 2.1's functions and the new readers.
- Drift checks: HOME.md's ADR list vs. the parser.

### Slice 3 — Local server and canvas
- `brain/scripts/ui/` server: HTTP snapshot + SSE diffs, repo watcher, forge
  poller.
- DAG canvas over the snapshot; inspector with spec, tasks, reviews, working
  memory.

### Slice 4 — Management views
- Roadmap, decisions, anti-patterns, history, by-actor.

### Slice 5 — Local overlay
- Working-tree and machine-cache readers, "uncommitted" marking, worktree
  discovery.

### Slice 6 — Telemetry and MCP
- `brain-mcp` server, heartbeat reconciler, pulse on nodes.

### Slice 7 — Remote deployment
- Webhook ingress, `main` checkout feed, access control.

---

## 8. Open Questions for RFC Review

1. **Read-model transport.** Does the server import the read model in-process,
   or shell out to `brain:snapshot --json`? In-process is faster and shares one
   codebase; the verb keeps the server replaceable and testable from CI.
2. **Curated spec renderer.** Deterministic parsing of `spec.md` into cards, or
   an optional LLM-distilled view for non-technical readers? Rule zero says the
   deterministic view is the default and any distilled view is labeled as such.
3. **ADR/anti-pattern data source.** Parse the existing prose (3.2, 3.3), or
   introduce authored data blocks like `brain-graph/1` inside each file? Parsing
   needs no doctrine change; blocks are unambiguous but every ADR would need
   one.
4. **Hot telemetry storage** (slice 6). In-memory ring buffers only, or SQLite
   for session replay?
5. **Access control in remote mode** (slice 7). Bearer token matching the VCS
   reviewer token model, or the forge's own OAuth?

---

## Amendment log

- **2026-09-03** — first draft.
- **2026-09-08 — Amendment 1.** Audiences and management views added (§1);
  three-tier state model with a measured inventory of what is and is not data
  (§2); prerequisite data work named (§3), including the ruling that
  cold-review verdicts become `type: review` memory records riding the #862
  lane (§3.1); MCP moved to the last slices (§4, §7); server simplified to HTTP
  + SSE with polling-and-diff (§5); roadmap reordered cold-first (§7); open
  questions refreshed (§8).
