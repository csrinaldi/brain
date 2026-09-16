---
status: draft
issue: 881
---

# Spec — the local UI server and the DAG canvas (#881)

## Requirements

### R881-1: `brain:ui` serves the snapshot in-process

The script `brain/scripts/ui/server.mjs`, run via `npm run brain:ui` (also
directly, accepting `--port <n>`), MUST start an HTTP server on
`localhost:3000` by default, MUST accept a `--port` override (port `0`
allowed, e.g. for tests), MUST serve the static SPA at `/`, and MUST answer
`GET /api/snapshot` with the JSON of an in-process `buildSnapshot()` call over
the served root — never shelling out to the CLI.

#### Scenario: default port and static root
- **WHEN** `npm run brain:ui` starts with no `--port`
- **THEN** the server listens on `localhost:3000` and `GET /` returns the SPA's `index.html`

#### Scenario: ephemeral port for tests
- **WHEN** the server starts with `--port 0`
- **THEN** it listens on an OS-assigned port and reports that port to the caller

#### Scenario: snapshot shape parity
- **WHEN** `GET /api/snapshot` is requested against a fixture root with a pinned clock
- **THEN** the parsed JSON deep-equals `buildSnapshot({root, now})` called in-process on the same root and clock (A4)

### R881-2: `/api/stream` pushes diffs, not the whole snapshot

`GET /api/stream` MUST be a Server-Sent-Events stream. Each event MUST name at
least: which top-level snapshot section(s) changed, the new value(s) of those
sections, and the snapshot's `generatedAt`. A client MUST receive the current
snapshot (or an equivalent full-state event) as its first event, before any
diff event. A change in the served root's committed tier (a commit in the
primary checkout or a linked worktree, a change under `openspec/changes/**`
or `.memory/records/**`) or a forge change that survives a poll MUST reach
every connected client within one poll interval, with no page reload (A2).

#### Scenario: initial connect gets current state
- **WHEN** a client opens `GET /api/stream`
- **THEN** the first event carries the current snapshot (or every section), not a diff against nothing

#### Scenario: a committed-tier change reaches the client
- **WHEN** a commit lands in a watched worktree after a client is connected
- **THEN** within one poll interval the client receives an event naming the affected section and its new value, with no reconnect required

#### Scenario: a forge change reaches the client
- **WHEN** a label changes on an open issue between two polls
- **THEN** the next poll's event names the affected section(s) and their new values

### R881-3: the watcher only ever sees the committed tier

The watcher MUST read only: the git common dir's own metadata (`logs/`,
`worktrees/`, `worktrees/*/logs/`, `worktrees/*/gitdir` to resolve each
linked worktree's admin id, and `worktrees/*/HEAD` — read by `git --git-dir`
for the branch name, never through the worktree — the watcher's own `fs.watch`
set has no `HEAD` file, the reflogs carry every ref move for watching),
enumerated the way `collect.mjs`'s `parseWorktrees()` does, plus
`openspec/changes/**` and `.memory/records/**` under the served root. It MUST
NOT read or watch any working-tree content — not even a linked worktree's own
`.git` file.

#### Scenario: an uncommitted edit produces no event
- **WHEN** a file in a worktree's working tree is edited but not committed
- **THEN** no watcher event fires and no SSE event is sent for it

#### Scenario: a commit in a linked worktree is seen
- **WHEN** a commit lands in a linked worktree and its `.git/worktrees/<name>/HEAD` changes
- **THEN** the watcher fires and the next snapshot recompute reflects it

### R881-4: the forge poller stays inside the rate budget

The poller MUST default to a 60-second interval, MUST be disableable through
a UI control, and MUST expose a manual-refresh control that triggers exactly
one poll on demand. The UI MUST show when the forge was last polled and
whether polling is currently paused. A poll MUST NOT unconditionally re-fetch
`issueView`/`prReviews` for every open issue/PR on every cycle (ruling 2); it
MUST re-read the issues/PRs the list-level data indicates moved, and beyond
those MAY spend only a bounded least-recently-refreshed slice per cycle, so
that the per-cycle cost never scales with the number of open issues.

**Amended 2026-09-16 (tracker PR #970 cold review).** This scenario read
"unchanged issues cost nothing on the next poll — the second poll issues no
per-issue `issueView` call for any of those N issues". That absolute reading
foreclosed design.md Q1/D2's bucket (c), the least-recently-refreshed
catch-up, and a body-only edit moves no list-level field, so a body the poller
had never fetched could never be fetched again. The claim ruling 2 actually
bought is *bounded*, not *zero*: N unchanged issues must not cost N calls.

#### Scenario: unchanged issues cost a bounded poll, never one call each
- **WHEN** N open issues are unchanged between two consecutive polls
- **THEN** the second poll issues at most `B` per-issue `issueView` calls in
  total, regardless of how large N is, and spends them on the
  least-recently-refreshed bodies

#### Scenario: a bulk import is never left unreadable
- **WHEN** more issues appear between two polls than a single cycle's new-issue
  cap allows
- **THEN** the cycle stays inside its per-cycle bound, and every one of the new
  issues has its body read within a bounded number of later cycles, even while
  other issues keep changing

#### Scenario: disable and manual poll
- **WHEN** the operator disables polling
- **THEN** the timer stops firing, and pressing "poll now" still triggers exactly one poll

#### Scenario: last-polled state is visible
- **WHEN** a poll completes, successfully or not
- **THEN** the UI reflects the new last-polled time and the paused/active state

### R881-5: no route writes to the repository or the forge

No route MUST write to the repository or to the forge. The only routes that
accept `POST` are the poller controls `/api/poll/pause`, `/api/poll/resume`
and `/api/poll/once`, which mutate a timer that lives in this process and dies
with it (ruling of 2026-09-14: "slice 3 has no POST" means no write surface
over brain's state, not an HTTP method ban). Every other route MUST answer
`405` to `POST`, `PUT`, `PATCH` or `DELETE`, and the control routes MUST
answer `405` to `GET`, `PUT`, `PATCH` or `DELETE`. Composed with a VCS port
whose every write verb throws, every route the server serves and every
scheduled poll MUST complete without invoking any write verb (A5).

#### Scenario: mutation methods are rejected outside the poller controls
- **WHEN** a `POST`, `PUT`, `PATCH`, or `DELETE` request is sent to any route other than `/api/poll/pause`, `/api/poll/resume` or `/api/poll/once`
- **THEN** the response status is `405`

#### Scenario: poller controls accept POST only
- **WHEN** `POST /api/poll/pause` is sent
- **THEN** the response is the poller's state as JSON with `paused: true`, and no repository file, no git ref and no forge object changed
- **WHEN** `GET /api/poll/pause` is sent
- **THEN** the response status is `405`

#### Scenario: read-only port proves no write call
- **WHEN** the server is composed with a port whose write verbs (`mrCreate`, `issueCreate`, `labelAdd`, etc.) all throw
- **THEN** every route responds successfully and a full poll cycle completes, with no write verb ever invoked

### R881-6: every open issue is a node, coloured by its computed state

Every open issue present in `snapshot.graph` MUST render as exactly one
canvas node (ruling 1). An issue with no `brain-graph/1` declaration MUST
render in the `?` track. An issue marked `status: "unreadable"` MUST render
marked as unreadable. A node's colour MUST derive from `roadmap.value.state`
(`planned` / `in-flight` / `done`), overridden to a blocked mark when it has
an open `blockedBy`, and to an awaiting-review/approval mark per the RFC's
colour rule where applicable. A node whose `roadmap` is `{ok: false}` MUST
render with a distinct "not computed" mark and MUST NOT be drawn as
`planned` (A1).

#### Scenario: no node is filtered away
- **WHEN** the graph has 90 open issues, some undeclared, some unreadable
- **THEN** the canvas renders 90 nodes, one per issue, none omitted

#### Scenario: roadmap not computed is never mistaken for planned
- **WHEN** a node's `roadmap` is `{ok: false, reason}`
- **THEN** the node renders with a "not computed" mark, distinct from the `planned` colour

#### Scenario: blocked overrides state colour
- **WHEN** a node's `roadmap.value.state` is `planned` and it has an open `blockedBy`
- **THEN** the node renders with the blocked mark, not the plain `planned` colour

### R881-7: the layout is deterministic and cycle-tolerant

The DAG layout MUST be a pure function from `{nodes, edges}` to per-node
coordinates, implemented as hand-rolled SVG layering with no external script
or npm/CDN dependency. The same `{nodes, edges}` input MUST always produce
the same coordinates. A cycle in the edges MUST NOT crash the layout or drop
any node from the output.

#### Scenario: same input, same output
- **WHEN** the layout function is called twice with the same `{nodes, edges}`
- **THEN** both calls return identical coordinates for every node

#### Scenario: a cycle does not crash or hide nodes
- **WHEN** the edge set contains a cycle, as the graph's `divergences` may report
- **THEN** the layout returns a coordinate for every node with no thrown error

### R881-8: the inspector drawer, four tabs, every value sourced

Activating a node MUST open a drawer with four tabs — Spec, Tasks, Working
memory, Reviews — and every value shown in any tab MUST be accompanied by the
repo-root-relative file path or the ticket/PR URL it came from (A3).

- **Spec**: requirements and scenarios parsed deterministically from
  `openspec/changes/issue-<N>-*/spec.md`, shown as cards, with the file path.
  No change dir → the tab states "no change dir" and names the expected path.
- **Tasks**: the checklist from `tasks.md`, each item's done/pending state,
  and actor/timestamp when the source carries them, with the file path. No
  change dir → same "no change dir" behavior as Spec.
- **Working memory**: only a committed `resume.md` read on the issue's branch
  through the object store, showing `next_action`, `current_slice`,
  `blockers`. Absent → the tab says so and points at slice 5 (ruling 3).
- **Reviews**: every round parsed from the PR's forge comments, oldest first,
  each with its PR comment URL; the tab states its source is the forge,
  pending #880 (ruling 4).

#### Scenario: full drawer for a change with a spec and tasks
- **WHEN** a node's issue has an `openspec/changes/issue-<N>-*/` dir with `spec.md` and `tasks.md`
- **THEN** the Spec tab shows its requirement/scenario cards with the `spec.md` path, and the Tasks tab shows its checklist with the `tasks.md` path

#### Scenario: no change dir
- **WHEN** a node's issue has no matching `openspec/changes/issue-<N>-*/` dir
- **THEN** the Spec and Tasks tabs each show "no change dir" and the expected path, not an empty card

#### Scenario: no committed resume.md
- **WHEN** the issue's branch has no `resume.md` in the object store
- **THEN** the Working memory tab states it is absent and points at slice 5 / #883

#### Scenario: reviews carry their source and URL
- **WHEN** a PR has two posted review rounds
- **THEN** the Reviews tab lists both, oldest first, each with its PR comment URL, and states the source is the forge

### R881-9: degradation is stated, never silent

When a snapshot section is `{ok: false}`, the canvas MUST still render from
every section that is `{ok: true}`, and the failed section's reason MUST be
shown in the UI, not hidden. The stream MUST keep serving diffs for sections
that remain computable even while another section is failing. A poll that
fails MUST leave the previous forge-derived values in place and MUST show
the failure reason and the time of the failed attempt.

#### Scenario: graph unreadable, tree sections still render
- **WHEN** no VCS port is available and `graph` is `{ok: false, reason}`
- **THEN** the canvas still renders sections that are `ok: true` (e.g. `changes`), and the UI shows `graph`'s failure reason in band

#### Scenario: a failed poll keeps stale data visible with a stated reason
- **WHEN** a scheduled poll throws
- **THEN** the previously known forge values remain displayed, and the UI shows the failure reason and the time of the failed poll

### R881-10: out of scope, asserted as absence

Slice 3 MUST NOT read any worktree's uncommitted working tree, MUST NOT
render roadmap/decisions/anti-patterns/actor-history management views
(#882), and MUST NOT expose any MCP resource or agent-pulse/heartbeat
endpoint (#884).

#### Scenario: no uncommitted content is ever read
- **WHEN** a worktree has uncommitted changes
- **THEN** no server route, watcher event, or drawer tab reflects that uncommitted content

#### Scenario: no management views are served
- **WHEN** the SPA's routes/views are inspected
- **THEN** there is no roadmap, decisions, anti-patterns, or by-actor view — only the canvas and the four-tab drawer

#### Scenario: no MCP or heartbeat surface
- **WHEN** the server's route table is inspected
- **THEN** there is no MCP resource route and no heartbeat/agent-pulse endpoint
