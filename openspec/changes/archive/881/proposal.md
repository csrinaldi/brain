---
status: draft
issue: 881
---

# Proposal — the local UI server and the DAG canvas (#881)

Parent: #878 (Brain UI), slice 3, Wave B. The first consumer of the read model
#879 shipped: one local server that serves the snapshot over HTTP, streams its
diffs over SSE, and one page that draws the graph and opens a change.

## Intent

**The problem.** Everything brain knows about the work in flight is now one
machine-readable object (`buildSnapshot()`, `brain/scripts/status/snapshot.mjs:265-307`)
and nothing reads it. To answer "what is in flight, what is blocked, what is
waiting on review" a maintainer runs `brain:status`, `brain:epic:map` and
`brain:review:board`, then reassembles the graph mentally. To review one change
they open `spec.md`, `tasks.md`, the PR comments and `resume.md` by hand. When a
commit lands in one of several worktrees, or a label moves on the forge, nothing
tells them: they re-run the verbs.

**Who suffers.** The maintainer steering several agents across worktrees, and the
reviewer who needs one change's spec, tasks, review rounds and working memory in
one place with the source of each value visible.

**Why now.** #879 landed the read model with a proven shape and no consumer
(#953). Nothing downstream can start without this slice: #882's management views
and #884's MCP resources both read the same server. The snapshot is a contract
that has never been exercised by a second caller — this slice is the exercise.

**What success looks like.** `npm run brain:ui`, one page, 90 nodes, click one,
read its spec and tasks, and see the canvas change by itself when a commit lands.

## Scope

### In

| Deliverable | Shape |
|---|---|
| `brain/scripts/ui/server.mjs` + `npm run brain:ui` | HTTP server, `--port`, static files, no write verb |
| `GET /api/snapshot` | in-process `buildSnapshot()`, byte-identical in shape to `brain:snapshot --json` |
| `GET /api/stream` | SSE, one event per changed snapshot section, no heartbeats |
| Repo watcher | committed-tier markers only (commits, `openspec/changes/**`, `.memory/records/**`) |
| Forge poller | 60 s default, incremental, with disable and poll-now controls in the UI |
| DAG canvas | hand-rolled SVG layered layout over `snapshot.graph`, coloured by `roadmap.value.state` |
| Inspector drawer | Spec, Tasks, Working memory, Reviews — every value carrying its source |
| Tests | shape parity vs. in-process `buildSnapshot()`, watcher and poller under injected seams, write-throwing port, pure-function tests for layout, diff and parsers |

### Out

| Deferred | Owner |
|---|---|
| Any POST or write verb | never — ticket's own hard line, enforced by test |
| Uncommitted working tree, machine caches, "overlay" marking | slice 5 / #883 |
| Roadmap, decisions, anti-patterns, history, by-actor views | slice 4 / #882 |
| MCP server, telemetry, agent pulse | slice 6 / #884 |
| Remote mode, webhooks, access control | slice 7 |
| `type: review` records as the Reviews source | #880 — not a dependency here (see ruling 4) |
| A cached or persisted snapshot | forbidden by #878: it would be a second source of truth |

## Rulings (maintainer, 2026-09-14)

1. **Node universe — nothing is hidden.** Every open issue is a node (90 today).
   Issues with no `brain-graph/1` declaration sit in the `?` track; issues whose
   body could not be read are rendered as marked `unreadable`
   (`snapshot.mjs:211-213`). The canvas never filters a node away silently.
2. **Forge freshness — 60 s, incremental, and interruptible.** Default poll
   interval 60 s. The UI MUST expose a control to disable polling and a button
   that triggers one poll manually. Repo-local changes arrive through the
   watcher, never through the poll. A full fan-out per poll is **not acceptable**:
   `readForge()` costs one `issueView` per open issue plus one `prReviews` per
   open PR (`snapshot.mjs:184-255`), ~95 calls, which at 60 s exceeds GitHub's
   5,000/h authenticated budget. The poller must be incremental (e.g. re-fetch
   only the issues and PRs whose list-level `updated_at` moved, verified against
   what the provider actually returns) — the exact strategy is design's call, the
   budget constraint is not.
3. **Working memory — committed only.** The tab reads a committed `resume.md` on
   the issue's branch through the object store (`git show <branch>:resume.md`),
   never a worktree's working tree. If absent, the tab says so and points at
   slice 5 / #883. The three rendered fields are `resume-schema.mjs:19`'s
   `next_action`, `current_slice`, `blockers`.
4. **Reviews — all rounds, tier 1, today.** The tab shows every round already
   parsed from the PR's forge comments (`reviewRows()`, `snapshot.mjs:125-138,239-255`
   — `prReviews` returns every posted round, not just the latest), each stating
   its PR comment URL. #880 is open and #881 does not depend on it; when it
   lands the source becomes `type: review` records and the UI says which source
   it used.
5. **Layout — hand-rolled, no library.** The DAG layout is written in this repo
   in plain SVG: longest-path layering plus barycentre ordering, cycle-tolerant
   because the graph reports divergences rather than guaranteeing acyclicity. No
   npm dependency, no CDN script, no vendored library.

## Approach

**One process, four moving parts, one page.**

- **Server.** `server.mjs` resolves `vcs` and `project` the way the snapshot CLI
  already does (`snapshot-cli.mjs:54-69`) and calls `buildSnapshot()` in
  process — it never shells out to the verb. It serves three things: the static
  SPA files, `GET /api/snapshot`, and `GET /api/stream`. `npm run brain:ui`
  follows the existing `brain:<noun>` script convention (`package.json:98-99`)
  and `--port` follows the CLI's argv convention (`snapshot-cli.mjs:18-34`).
- **Watcher.** Committed tier only: `.git/HEAD` of the primary checkout plus
  `.git/worktrees/*/HEAD` for commit detection (worktrees enumerated the way
  `collect.mjs:105-129` already does it), and `openspec/changes/**` plus
  `.memory/records/**` of the served root. It never reads working-tree content.
- **Poller.** One timer, incremental per ruling 2, with the interval, the
  disable switch and the manual trigger exposed to the page.
- **Diff and stream.** Each watcher or poll event recomputes the snapshot and
  diffs it against the previous one; changed sections become SSE events. One
  direction only — SSE, not WebSockets.
- **SPA.** Static `index.html` / `app.js` / `app.css` served by the same server,
  with every piece of pure logic (layout math, snapshot diff, drawer data
  shaping, the `spec.md` requirement/scenario parser, the `tasks.md` reader)
  living in plain `.mjs` modules importable both by `<script type="module">` and
  by `node:test`. There is no browser test runner in this repo; this is the only
  way the canvas logic is testable at all.
- **Provenance.** Every value in the drawer carries either a repo-root-relative
  file path or a ticket/PR URL. Record-backed views follow the record's `file`
  pointer rather than inlining prose (design D3 of #879, `design.md:27-36`).

### Acceptance, restated as verifiable statements

- **A1.** For every open issue in `snapshot.graph`, the canvas renders exactly
  one node, and activating that node opens the drawer showing that change's
  `spec.md` requirements/scenarios and its `tasks.md` checklist.
- **A2.** A commit in any worktree, or a label change on the forge, changes the
  rendered canvas within one poll interval with no page reload — the commit case
  through the watcher, the label case through the poller.
- **A3.** Every value displayed in any drawer tab is accompanied by the file path
  (relative to the repo root) or the ticket/PR URL it came from.
- **A4.** `GET /api/snapshot` deep-equals an in-process `buildSnapshot()` over
  the same fixture root and pinned clock (the parity pattern already used at
  `snapshot-cli.test.mjs:16-28`).
- **A5.** The server composed with a port whose every write verb throws (the
  `readOnlyPort()` pattern, test-only, `snapshot.test.mjs:16-23`) serves every
  route without throwing — no write verb is reachable.

## Constraints (doctrine, quoted)

| Constraint | Source |
|---|---|
| "Every fact the dashboard shows must be reconstructible from the repository plus the tickets. If a fact has no source there, the dashboard does not show it." | #878, rule zero (`explore.md:260-261`) |
| "'Real time' here is a watcher over the repo (worktrees, `.memory/`, `openspec/`) plus a polling loop over the forge, diffed against the previous snapshot. No heartbeats needed. ... WebSockets are not needed until tier 3; SSE covers one-directional diffs." | RFC §5, `docs/inbox/visual-task-graph-and-realtime-dashboard.md:265-278` |
| "What this ticket must NOT become: A write surface. Slice 3 has no POST." | issue #881 body (`explore.md:269-271`) |
| "brain has **zero runtime dependencies** (package.json)." | `openspec/changes/issue-337-efficacy-probes/design.md:32`; restated at `issue-509-promote-amendments/design.md:41` |
| Pure core, injected edges — `_read`/`_list`/`_exists`/`_run` seams for testability | design D2 of #879, `openspec/changes/issue-879-snapshot-read-model/design.md:17-25` |
| Never commit to `brain/core/**` or `brain/project/**`; `brain/scripts/ui/**` is Tier 1 territory | `AGENTS.md:154-172`, `AGENTS.md:129-138` |
| `resume.md` is an operational artifact, outside `REQUIRED_ARTIFACTS` — read by path, staleness expected | `AGENTS.md:388-396` |
| Governance tier `lite`, 1000 changed lines per PR | `brain/scripts/vcs/governance-tiers.mjs:273-275`, `brain.config.json:15-17` |

The server, watcher, poller and diff all take injected seams (`_watch`, the
timer, the VCS port, `_read`) so they run under `node:test` with no browser, and
so the write-throwing port proves A5 rather than asserting it.

## Risks and open questions handed to design

| # | Question | Why it matters |
|---|---|---|
| Q1 | What incremental poll strategy fits GitHub's rate budget, and does the provider actually return a list-level `updated_at`/ETag to key it on? | Ruling 2 forbids a full fan-out; if the field is absent the strategy must change (read `brain/scripts/vcs/providers/github.mjs` before committing). #879 handed this budget over explicitly (`issue-879-snapshot-read-model/tasks.md:29-30`) |
| Q2 | Does `deriveTasks()` already carry per-task actor and timestamp, or must `derive.mjs` widen? | The Tasks tab's "actor and timestamp per completed item" (RFC §6) depends on it; live `tasks.md` lines carry neither inline |
| Q3 | Does watching `.git/HEAD` plus `.git/worktrees/*/HEAD` catch `commit --amend` and a fast-forward merge, and how are worktrees added or removed while the server runs? | A2 fails silently if a commit shape is missed |
| Q4 | Which Node version does CI run, and does it support native `fetch` and streaming-body reads for SSE assertions? | No `engines` field pins one and there is no HTTP client dependency to fall back on |
| Q5 | Full-snapshot recompute-and-diff per event, or section-level? | Correctness is equal; payload size, latency and code volume are not |

Risk accepted: the hand-rolled layout (ruling 5) is the largest and least
familiar piece of code in the slice. Mitigation: the layout is a pure function
from `{nodes, edges}` to positions, tested without a DOM, and a crude but stable
layering is acceptable for v1 — legibility beats aesthetics.

Not verified in this phase: the issue bodies for #881 and #878 were read through
the exploration's verbatim quotations rather than `gh issue view` (no shell in
this phase). Design should re-read both before cutting tasks.

## Delivery

The full scope is forecast at 900–1900 changed lines (`explore.md:365-395`),
at or over the `lite` budget of 1000. Intended seam, two PRs:

- **PR A — the server.** `server.mjs`, `GET /api/snapshot`, `GET /api/stream`,
  the watcher, the incremental poller, the diff module, and their tests
  (including A4 and A5). No SPA; `/` serves a placeholder.
- **PR B — the page.** The DAG canvas, the inspector drawer and its four tabs,
  the pure parsers, and their tests (A1, A2, A3).

PR A is reviewable on its own and A2's mechanism is testable before any canvas
consumes it. Commit and PR mechanics are the tasks phase's business, not this
proposal's.

**Rollback.** Purely additive: a new `brain/scripts/ui/` directory and one
`package.json` script entry. Reverting the PR removes the feature; no existing
verb, module or data shape changes, so nothing else regresses.

## Success criteria

- [ ] `npm run brain:ui` serves a page on localhost with no build step and no
      runtime dependency added to `package.json`.
- [ ] A1–A5 hold, each covered by a test under `node:test`.
- [ ] A full poll cycle stays inside the forge rate budget at the 60 s default,
      and the UI can turn polling off and trigger one poll by hand.
- [ ] No write verb of the VCS port is reachable from the server, proven by the
      write-throwing port.
- [ ] Nothing in the server or the watcher reads uncommitted working-tree
      content.
