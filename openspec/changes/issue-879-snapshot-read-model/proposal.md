---
status: applying
issue: 879
---

# Proposal — the read model and `brain:snapshot --json` (#879)

Parent: #878 (Brain UI), slice 2, Wave A. The first concrete work of the UI,
and valuable without it.

## Intent

Turn what brain already knows into one machine-readable snapshot, computed on
every call from the tree and the forge, so that every later consumer — the web
server (#881), a CI job, an MCP resource (#884) — reads one shape and none
re-derives.

## Measured (main, 2026-09-13)

- The only JSON-emitting verb is `brain:metrics --json`. `brain:status`,
  `brain:epic:map`, `brain:review:board` and `brain:governance-status` render
  prose over data that is already structured in pure functions:
  `status/epic-graph.mjs buildGraph()`, `lib/sdd-layout.mjs`, `status/derive*.mjs`,
  `review/lib/parse-verdict.mjs`, the `vcs/cli.mjs` port verbs, `.memory/records`,
  `status/release-debt.mjs`.
- ADRs (34 files under `brain/project/decisions/`), anti-patterns (8 under
  `brain/core/anti-patterns/`, 0 under `brain/project/anti-patterns/`) and the
  roadmap exist only as prose. `brain/HOME.md` hand-lists the ADRs with
  amendments embedded as prose; `governance/checks/adr-presence.mjs` is a
  presence gate only. Nothing enumerates the anti-patterns.
- Nothing aggregates over `actor`/`actorKind` across records.
- No HTTP server, no `brain:snapshot`, no `brain/scripts/ui/` in the tree.

## Rulings (maintainer, 2026-09-08 — #878, #879)

1. `brain:snapshot --json` is the contract. A consumer may import the module
   in-process, but the verb's JSON and the module's return value are ONE shape,
   proven by a test that runs both and compares.
2. ADRs and anti-patterns are parsed from the existing prose convention. A drift
   check compares the parser's ADR list with `brain/HOME.md`'s hand-written
   list. No declared data block is introduced here; it enters only if the drift
   check shows the convention widely broken, and then as its own ticket.
3. Rule zero of the UI: every fact shown is reconstructible from the repository
   plus the tickets. The snapshot names, for every value, the file or the
   ticket it came from.

## Scope

- `brain/scripts/status/adr-index.mjs` — the ADR parser and the HOME.md drift check.
- `brain/scripts/status/anti-patterns.mjs` — the anti-pattern enumerator.
- `brain/scripts/status/snapshot.mjs` — pure composition: changes, roadmap
  derivation, actor aggregation, and the snapshot object.
- `brain/scripts/status/snapshot-cli.mjs` — the verb `npm run brain:snapshot`,
  `--json` and a text mode over the same object.
- Tests for every reader, including the failure shapes.

## Non-goals

- No cache, no store, no write of any kind: the snapshot is computed on every
  call. A snapshot that persisted would be the second source of truth #878
  forbids.
- No server, no SPA (#881). No `type: review` records (#880). No local overlay
  (#883). No native issue relations read — the graph carries the declared
  `brain-graph/1` edges; the relations read is two forge calls per issue and
  #881's poller decides its own budget.
- No gate. The drift check is a reported section and a warning, never an exit
  code — this slice adds nothing to the governance ladder.
