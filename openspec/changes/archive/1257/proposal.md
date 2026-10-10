---
status: approved
approved: 2026-10-02 (maintainer: split ruling)
issue: 1257
---

# Proposal — nonblocking-forge-reads (issue 1257)

## Intent

The UI server stops answering HTTP requests whenever it reads the forge. Every forge verb is a `spawnSync`, and the poller calls those verbs on the server's own thread. On a cold start the first tick makes two list calls and about 133 per-issue `issueView` body reads, so every request, including `GET /`, waits for about two minutes. Later ticks block it again for each list, review read and body read. When the block ends, the graph still shows as a failure ("the first forge poll has not completed") rather than as loading. The evidence, with file and line citations, is in `design.md`, "Cold start today".

This change fixes that across the UI, and it also lays the data path that #1199's epic rollup needs:

- `issueList` carries each issue's `state` and `body`, so no per-issue body read is needed.
- Every forge read runs in a worker thread, one per lane, so the server's event loop never runs a forge spawn.
- A section whose forge read has not landed yet is stated as loading, never as failed and never as 0.
- Closed issues are read on their own background lane: a full list first, then incremental deltas.
- A `forgeLoad` signal, agreed with brain-ad, reports each lane's load state in the snapshot and in `meta.poller`.

This change lands first. #1199 (progress and epic rollup) depends on it and consumes `issueList` `state`/`body`, `forgeLoad` and the closed-issue data. It does not implement them.

## Origin

The maintainer ruled on 2026-10-02 that the approved #1199 change be split in two. This change takes rulings R4, R10 and R11, the cold-start evidence, and decisions D53–D58 and D63–D67 from #1199, with their requirements, scenarios, risks and tests. The original ruling and decision numbers are kept for traceability. The content was approved under #1199 on the same day, so this is a re-scope, not new scope.

## Scope

### In
- An additive widening of the `issueList` return shape with `state` and `body` (R4, R10, R12), and an optional `updatedSince` input for incremental reads. The provider mapping stays inside the adapters.
- Bodies read from the list. The per-issue `issueView` body reads are removed from the snapshot and the poller; they remain only as a fallback for a row whose `body` is `null`.
- Node `state` taken from the port, not hardcoded to `'open'` (D58).
- The forge cache keyed by state: one `issueList` value per state (D57).
- The closed-issue lane: its own worker thread and single flight, a full list first, then `since`/`updated_after` deltas, with a full re-list every 60 runs (D56).
- A `closedIssues` snapshot section that carries the closed graph nodes and the closed rows that could not be resolved. This is the seam #1199 consumes (D68).
- Forge calls moved off the server's event loop, one worker thread per lane (D63).
- Pending sections and one loading band (D65), and an early recompute when the open list first lands (D66).
- The `forgeLoad` signal in the snapshot and in `meta.poller` (D64).
- `brain:snapshot --no-closed` (D67).
- A draft of the `vcs-contract.md` `issueList` row under `brain-drafts/` (Tier 2).

### Out
- Everything #1199 keeps: `countTasks` and the `progress` field, the working-tree and HEAD labels, the hierarchy adapter, the epic rollup and its wording, including "counting closed children…".
- Persisting the forge cache across server restarts. That is follow-up #1256.
- ETag (`If-None-Match`) reads.
- `status/epic-map.mjs`'s own per-issue reads.
- Any edit to `vcs/cli.mjs`, `vcs/lib/exec.mjs` or `brain/core/**`.

## Maintainer rulings (binding)

The numbers are those of #1199, kept for traceability. R1–R3 and R5–R9 stay with #1199.

| # | Date | Ruling |
|---|---|---|
| Split | 2026-10-02 | #1199 is split. This change (#1257) takes R4, R10 and R11, the cold-start evidence, the worker-thread lanes, the pending sections and loading band, `forgeLoad`, the closed-issue lane, `--no-closed`, the removal of per-issue `issueView` body reads, the per-state forge cache and node state from the port. It lands first, and #1199 depends on it. |
| R4 | 2026-10-02 | The return shape of `issueList` is widened additively with `state: 'open'\|'closed'`, mirroring #930 for `mrList`. Closed issues are read through the existing `state` option. The extra read is bounded, and design decides how (superseded by R10: the closed read is the full list, carrying bodies). Provider logic stays in the adapters, and `vcs/cli.mjs` is not touched. The `vcs-contract.md` row change is drafted under `brain-drafts/` (Tier 2). |
| R10 | 2026-10-02 | `issueList` also carries `body`, an additive widening beside `state`: `[{ number, title, labels, assignees, state: 'open'\|'closed'\|null, body: string\|null }]`. `null` means the provider did not carry the field and is never coerced to `''`. The provider mapping stays inside the adapters (GitLab `description` → `body`, `opened` → `open`), and `vcs/cli.mjs` is not touched. The per-issue `issueView` body reads are removed wherever the list carries `body`. `CLOSED_READ_BUDGET`, the "25 of 456" partial rollup and the closed-body cache are removed: closed children come from the listed bodies. brain-ad, who owns the shared seam, has been notified and agrees; it asks that both adapters pin `null` versus `''` for `body` and `state`. |
| R11 | 2026-10-02 | UI-wide: no view's first render may wait on a forge read. The first paint comes from the local tree plus the last cached forge data. Every forge read (the open list, the closed list) runs in a background lane and fills in progressively. Until a read lands, the view states what is still loading, for example "counting closed children…", and never shows a 0 or an empty list. The closed list is its own lane and never delays the open lane's cadence. The CLI is not a view and may read synchronously. |
| R12 | 2026-10-02 | A body key that is ABSENT from the provider payload maps to `null`. A body key that is PRESENT with JSON `null` maps to `''`, an empty description. This holds for GitHub `body` and GitLab `description` alike. It prevents an extra `issueView` per empty issue. (This confirms the reading of R10 that #1199's design had asked the maintainer to confirm.) |

## Approach

1. **Probe first.** A test proves that an HTTP request waits on a forge read today. It drives `main()` with an adapter whose `issueList` blocks its thread until a client has received a response. It fails today and passes once forge reads run in worker threads.
2. **Worker threads (D63).** `ui/forge-thread.mjs` runs the four read verbs in a `node:worker_threads` worker. `main()` builds two threads: `open`, for the open list, the MR list, reviews and the `issueView` fallback, and `closed`, for the closed list.
3. **Port widening (R4, R10, R12).** Both adapters normalize `state` to `'open'|'closed'|null` and `body` to `string|null`, and map `updatedSince` to GitHub's `since` and GitLab's `updated_after`. Derived fixtures pin `null` versus `''` for both fields.
4. **Bodies from the list (D58).** The snapshot and the poller take each body and state from the list row. `issueView` is called only for a row whose `body` is `null`, at most `BODY_CAP` per tick in the poller. The body buckets are removed.
5. **The closed lane (D56, D57).** The poller reads closed issues on their own single flight, full then delta, and merges them into a per-state cache entry.
6. **`forgeLoad` and loading states (D64, D65, D66).** The poller tracks each lane as `pending`, `complete`, `failed` or `disabled`. The snapshot uses that value to mark forge sections pending, and the page shows one loading band in place of a failure band.
7. **The `closedIssues` section and the CLI (D67, D68).** The snapshot builds the closed graph from listed bodies and exposes it. The CLI reads everything synchronously unless `--no-closed` is given.

**Rejected:**
- **Making `vcs/lib/exec.mjs` asynchronous.** It is the synchronous seam under every verb and CLI, and it is brain-ad's. Worker threads achieve R11 without touching it.
- **One shared worker for both lanes.** The 13–16 s closed list would then delay the open lane, which R11 forbids.
- **Reading closed bodies through `issueView` under a budget.** That costs about 456 calls where the list costs about 12 pages, and it left the rollup partial.

## Affected areas

| Path | Impact |
|---|---|
| `brain/scripts/axes/vcs/adapters/github.mjs`, `gitlab.mjs` | Modified: `state` and `body` on the `issueList` return; `updatedSince` |
| `brain/scripts/status/snapshot.mjs`, `report.mjs`, `snapshot-cli.mjs` | Modified: bodies and state from the list, the closed read and `closedIssues`, `forgeLoad`, `pending` sections, `--no-closed` |
| `brain/scripts/ui/poller.mjs` | Modified: the closed lane, `forgeLoad`, the early recompute, the null-body fallback; the body buckets are removed |
| `brain/scripts/ui/forge-cache.mjs` | Modified: one `issueList` per state |
| `brain/scripts/ui/forge-thread.mjs`, `forge-thread-worker.mjs` | New: one worker thread per forge lane |
| `brain/scripts/ui/server.mjs` | Modified: thread wiring, the closed port, `forgeLoad` passed to the snapshot |
| `brain/scripts/ui/lib/banners.mjs` | Modified: the loading band; `failedSections` skips pending sections |
| `brain/scripts/vcs/fixtures/{github,gitlab}-issueList-state.json` | New: derived fixtures |
| `openspec/changes/issue-1257-nonblocking-forge-reads/brain-drafts/vcs-contract.issueList-row.md` | New: the row draft, moved from #1199 |
| `*.test.mjs` beside each module | Modified or new |

## Risks

| Risk | L | Mitigation |
|---|---|---|
| The forge verbs are synchronous spawns, so any forge call on the server's thread blocks every request | High | One worker thread per lane (D63). The first RED proves the block today, and the same test proves it is gone. |
| The full closed list is estimated at 13–16 s on this repository, because GitHub's `/issues` also returns PRs | Med | It runs once per process on its own lane and thread, then as one-page deltas (D56). A failed read is reported through `forgeLoad`. The CLI can skip it with `--no-closed`. Apply measures the real cost. |
| A just-closed issue is briefly absent from both lists, between the open list dropping it and the next closed delta | Low | The delta runs every tick, so the window is one interval. The issue is never shown with a wrong state. |
| The delta anchor is local time, so a host clock far ahead of the forge could miss a closure | Low | A 10-minute overlap, plus a full re-list every 60 runs, bounds the miss to about one hour. |
| `Worker.terminate()` cannot interrupt a `spawnSync` in progress, so shutdown may wait for one spawn | Low | `main()`'s signal path exits the process anyway. Tests release held calls before `close()`. |
| The axis-port guard (#1114 tracker) fails any provider branch outside the adapters | Med | The `state` and `body` mapping lives only in `github.mjs` and `gitlab.mjs`. |
| `issueList-contract` says "neither paginates further", but both providers paginate in full since #459 | Low | R1257-3 corrects the stale scenario. |
| #1199 is built against this change's shapes before they merge | Med | The shapes (`forgeLoad`, `closedIssues`, the six-key row) are fixed in this spec. #1199's spec cites them by requirement number. |

## Size forecast

About 420 gated lines added and 100 removed, about 520 changed in all, against the `lite` budget of 1000 (see `design.md`, "Size"). The bulk is the worker threads (about 75 lines), the derived fixtures (about 80), the poller's closed lane and `forgeLoad` (about 80 added and 80 removed), and the snapshot's forge read (about 80). It is one PR.

## Rollback

Revert the PR. There is no data migration and no config key. The `state`, `body`, `forgeLoad`, `closedIssues` and `pending` fields are additive, so consumers that ignore them are unaffected. #1199 must be reverted first if it has merged, because it reads these fields. The `vcs-contract.md` draft is promoted by hand only after merge, and reverting it is a separate human act.

## Success criteria

- [ ] `GET /`, `/api/snapshot` and the stream's `sync` frame are served while a forge call is in flight.
- [ ] Both providers return `state` and `body` from `issueList`, and the contract test pins `null` versus `''` for both, as R12 states.
- [ ] With bodies in the list, the snapshot and the poller make no per-issue `issueView` call.
- [ ] A section whose forge read has not landed reads as loading, with one loading band, and never as failed or 0.
- [ ] `forgeLoad` in the snapshot deep-equals `meta.poller.forgeLoad` from the same recompute.
- [ ] The closed lane never delays the open lane, and it reads in full first and by delta afterwards.
- [ ] `brain:snapshot --no-closed` skips the closed read and reports it as disabled.
- [ ] `vcs/cli.mjs`, `vcs/lib/exec.mjs` and `brain/core/**` are unchanged.

## Follow-up

#1256 persists the forge cache across `brain:ui` restarts, so a cold start paints the last forge data at once. Its brief is in `design.md`, "Follow-up".
