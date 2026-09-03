# Visual Task Graph & Real-Time Dashboard (Brain UI)

> **status:** draft / RFC | **last-reviewed:** 2026-09-03 | **owner:** @crinaldi | **issue:** #851

---

## 1. Context & Vision

`brain` has achieved extreme maturity as a deterministic, fail-closed development harness: it enforces strict Spec-Driven Development (SDD) layouts, automated two-layer memory synchronization, isolated git worktrees, and external cold reviewer protocols.

However, for a hybrid team of multiple autonomous agents and human leads working concurrently, `brain` currently presents an **observability gap**:
1. Progress is scattered across multiple worktrees (`/home/gandalf/IA/brain-issue-*`), Git branches, and PR threads.
2. In-flight agent state (what an agent is doing *right now*, which test failed, which task checkbox is being tackled) is locked inside local terminal transcripts (`transcript.jsonl`) or ephemeral process stdout.
3. Human stakeholders and collaborating agents have to perform "context archaeology" to understand the real-time health and trajectory of an epic.

### The Objective

Provide an interactive, visual web dashboard (**Brain UI**) where anyone can see the evolution of the project as a live Directed Acyclic Graph (DAG) of epics, features, and tasks. Clicking on any node allows instant inspection of:
- **Agent Presence**: Where the agent is, its active slice, current action, and running test status.
- **Curated Specifications**: Readable, human-oriented delta requirements from `spec.md` (not raw markdown dumps).
- **Live Task Checklist**: Real-time progress on `tasks.md` items.
- **Review Pipeline**: Live status of cold reviews, findings, and `brain-review/2` verdicts.

---

## 2. Core Architecture: Dual-Source State

The platform is designed around two orthogonal sources of truth reconciled in memory by the Brain UI Engine:

```
┌─────────────────────────────────────────┐     ┌─────────────────────────────────────────┐
│     Base 1: Durable Git Substrate       │     │   Base 2: Live Ephemeral Stream         │
│             (Cold Source)               │     │             (Hot Source)                │
├─────────────────────────────────────────┤     ├─────────────────────────────────────────┤
│ • Git repo structure & branches         │     │ • Agent heartbeats (agent ID, worktree) │
│ • Canonical SDD layout (sdd-layout.mjs) │     │ • Active task index & current action    │
│ • proposal.md, spec.md, tasks.md        │     │ • Live test run output / failures       │
│ • .memory/ records & ADRs               │     │ • Blockers & needs-ruling alerts        │
│ • brain-review/2 formal verdicts        │     │ • Semantic intent locks (in-flight)     │
└────────────────────┬────────────────────┘     └────────────────────┬────────────────────┘
                     │                                               │
                     └───────────────────────┬───────────────────────┘
                                             ▼
                             ┌───────────────────────────────┐
                             │        Brain UI Engine        │
                             │   (State Reconciler & Hub)    │
                             └───────────────┬───────────────┘
                                             │
                       ┌─────────────────────┴─────────────────────┐
                       ▼                                           ▼
          [ MCP Server Surface ]                     [ Web Dashboard Surface ]
        (stdio / SSE for AI Agents)               (HTTP + WebSockets for Humans)
```

### Base 1: The Durable Git Substrate (Cold Source)
- **Single Accessor Rule**: The dashboard MUST NOT invent filesystem paths or custom git scrapers. It reads exclusively through brain's existing accessor: `sdd-layout.mjs`, `vcs/cli.mjs`, and `brain:epic:map` data structures.
- **Authority**: If Base 2 is silent or an agent disconnects, Base 1 provides the guaranteed ground truth.

### Base 2: The Ephemeral Telemetry Stream (Hot Source)
- **Zero-Latency State**: Working agents report low-overhead heartbeats during their execution loop.
- **Schema**:
  ```json
  {
    "agentId": "antigravity-worker-1",
    "feature": "issue-810-custom-stage",
    "worktree": "/home/gandalf/IA/brain-issue-810",
    "phase": "sdd-apply",
    "currentTaskIndex": "2.1",
    "status": "running" | "idle" | "blocked" | "needs-ruling",
    "nextAction": "Adding test assertion for resolveWalkSet",
    "lastLogSnippet": "FAIL: assertWalkSet 1 !== 0",
    "updatedAt": "2026-09-03T20:15:00Z"
  }
  ```

---

## 3. The Protocol Choice: Model Context Protocol (MCP) as the Bridge

To avoid creating proprietary hooks or platform-specific extensions for every AI tool, **Brain UI exposes an MCP Server (`brain-mcp`)**:

### Why MCP fits:
1. **Industry Standard**: Native support in Antigravity, Claude Code, Cursor, Windsurf, and custom harnesses.
2. **Standard Primitives**:
   - **MCP Tools**:
     - `brain_heartbeat`: Reports live phase, active task, and status.
     - `brain_claim_task`: Acquires a semantic lease on a subtask in `tasks.md`.
     - `brain_escalate`: Sends an interactive decision fork to the human inbox.
   - **MCP Resources**:
     - `brain://graph/active`: Live DAG topology.
     - `brain://changes/{feature}/spec`: Structured requirements.
     - **Resource Notifications**: Sends `notifications/resources/updated` to notify agents in real time when specs, locks, or peer tasks change.

---

## 4. The Dual-Face Server Topology

The Brain Daemon runs a lightweight Node.js engine (Fastify/Hono) exposing two distinct surfaces:

1. **Agent Surface (MCP via stdio or SSE)**:
   - Lightweight, JSON-RPC 2.0.
   - Low token footprint. Agents treat brain as a tool and context provider.

2. **Human Surface (Web Application via HTTP + WebSockets/SSE)**:
   - Serves an interactive SPA (Vite + React / Cytoscape / React Flow).
   - Pushes live diffs and pulse events over WebSockets.
   - Can run in two deployment modes:
     - **Local Mode (`npm run brain:ui` / `localhost:3000`)**: For solo developers and local multi-worktree coordination.
     - **Remote Mode (Centralized Team Hub)**: Hosted server in CI/cloud connected to GitHub/GitLab webhooks and team agent streams.

---

## 5. UI/UX: Interactive Canvas & Click-to-Inspect

### The DAG Canvas
- Visual hierarchy: **Epics → Features (Changes) → Task Groups**.
- **Live Node Pulsing**:
  - 🟢 **Green pulse**: Agent actively executing / tests running.
  - 🟡 **Yellow pulse**: Awaiting cold review or human approval.
  - 🔴 **Red pulse**: Blocked (`needs-ruling` / human decision needed).
  - ⚪ **Muted gray**: Unstarted / backlog.

### Click-to-Inspect Drawer (Right Panel)
When any feature or ticket node is clicked:
1. **Live Telemetry Card**:
   - Active Agent ID, worktree location, current slice, and current action.
   - Real-time terminal log tail.
2. **Curated Spec View**:
   - Human-first rendered view of `spec.md` showing delta requirements without unparsed raw markdown clutter.
3. **Task Checklist with Claim Avatars**:
   - Tasks rendered from `tasks.md`.
   - Displays which agent/human has claimed each task, completed items, and next items.
4. **Cold Reviewer Verdict Stream**:
   - Parsed `brain-review/2` verdicts: APPROVE / REVISE, causal dispositions, blocker findings, and annotated code diff anchors.

---

## 6. Phased Implementation Roadmap

### Slice 1 — Base 1 Core & Local Server (Read-Only Foundation)
- Scaffold `brain/scripts/ui/` server with Fastify/Hono.
- Wire `sdd-layout.mjs` and `brain:epic:map` to emit graph JSON (`GET /api/graph`).
- Minimal React Flow canvas reading local repository state on `localhost:3000`.

### Slice 2 — Base 2 Telemetry & MCP Server
- Implement `brain-mcp` server (`tools/brain_heartbeat`, `tools/brain_claim_task`).
- In-memory hot state reconciler with WebSocket broadcaster (`/ws/stream`).
- Visual pulse indicators on graph nodes based on live heartbeats.

### Slice 3 — Click-to-Inspect Details & Curated Artifacts
- Inspector drawer: Spec renderer, interactive task list, and `brain-review/2` verdict viewer.
- Real-time task status transitions driven by MCP events.

### Slice 4 — Semantic Intent Locks & Remote Deployment
- Add file-level and symbol-level semantic lease tracking to prevent parallel collision between worktrees.
- Dockerfile and webhook ingress for GitHub/GitLab remote team deployments.

---

## 7. Open Questions for RFC Review

1. **Storage of Hot Telemetry**: Should the daemon keep in-memory ring buffers only, or persist ephemeral runs into SQLite for session replays?
2. **Curated Spec Renderer**: Should `brain` generate the curated view using deterministic AST parsing of `spec.md`, or provide an optional LLM-distilled view for non-technical stakeholders?
3. **Access Control (Remote Mode)**: In remote deployments, what lightweight authentication fits best with `brain`'s token model (bearer token matching VCS reviewer token)?
