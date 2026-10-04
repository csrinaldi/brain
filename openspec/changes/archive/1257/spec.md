---
status: draft
issue: 1257
---

# Spec — nonblocking-forge-reads (issue 1257)

Capabilities: `forge-load` (new) and `issueList-contract` (modified). These are delta requirements: each states what MUST be true after this change. The proposal's rulings R4, R10, R11 and R12 are binding and are cited by number. Those numbers come from #1199 and are kept for traceability. Requirement keywords follow RFC 2119.

Scenario grammar: each scenario has exactly one `WHEN` line and exactly one `THEN` line, plus an optional `GIVEN`. The UI's spec cards (`ui/lib/spec-cards.mjs`) keep only the last `THEN`, so a scenario with several outcomes states them all in its single `THEN`.

This change was split out of #1199 on 2026-10-02. Its requirements were R1199-5 to R1199-13 there; the traceability table at the end maps each one.

## Requirements this change modifies

| Existing requirement | What changes |
|---|---|
| `issueList-contract`, "contract shape assertion across providers" (`openspec/specs/issueList-contract/spec.md:16`) | The exact-key lock becomes `{ number, title, labels, assignees, state, body }` (R1257-2). |
| `issueList-contract`, "Documentation reflects the pagination asymmetry" (`:148-152`) | The scenario is false. Both providers paginate in full since #459. R1257-3 replaces it. |
| R881-4, the poller's rate budget (`archive/881/spec.md:74`) | Still holds, by a different mechanism: the open list carries bodies (R10), so the per-tick `issueView` count is the null-body fallback only, capped at `BODY_CAP` (R1257-11). The new-number, changed-row and least-recently-refreshed body buckets are removed. |
| R881-9, degradation is stated (`archive/881/spec.md:215`) | A section that is still loading is stated as loading, never as a failure (R1257-9). |

Every other requirement of #881, #1032, #1059, #1201 and #1243 is unchanged.

## Fixed values

- Poller constants:
  - `BODY_CAP = 5`: the most `issueView` fallback reads per tick, for open rows whose `body` is `null`.
  - `CLOSED_FULL_EVERY_RUNS = 60`: every 60th closed-lane run re-reads the full closed list instead of a delta.
  - `CLOSED_SINCE_OVERLAP_MS = 600000` (10 minutes): subtracted from the delta anchor to absorb clock skew between this host and the forge.
- `forgeLoad` lane entry shapes:

  | `state` | Shape |
  |---|---|
  | `pending` | `{state:'pending', at:null}`, or `{state:'pending', at:null, reason}` when no read is in flight |
  | `complete` | `{state:'complete', at}`, where `at` is the landing time of the last successful read |
  | `failed` | `{state:'failed', at, reason, lastCompleteAt}`, where `at` is the failed attempt's time and `lastCompleteAt` is the last complete landing or `null` |
  | `disabled` (closed only) | `{state:'disabled', at:null, reason}` |

- Loading wording (R11):

  | Case | Wording |
  |---|---|
  | `graph` while `forgeLoad.open` is `pending` | "loading open issues from the forge…" |
  | `prs` while `forgeLoad.open` is `pending` | "loading open PRs from the forge…" |
  | `reviews` while `forgeLoad.open` is `pending` | "loading PR reviews from the forge…" |
  | `closedIssues` while `forgeLoad.closed` is `pending` | "loading closed issues from the forge…" |
  | The page's loading band | "still loading from the forge: `<section names, comma-separated>`" |

- `closedIssues` section by `forgeLoad.closed`:

  | `forgeLoad.closed` | Section |
  |---|---|
  | `pending` | `pending("loading closed issues from the forge…")` |
  | `complete`, or `failed` with `lastCompleteAt` set | `field({nodes, declarationDivergences, unresolved})` over the held closed list |
  | `failed` with `lastCompleteAt: null` | `uncomputable("the closed-issue list could not be read: <reason>")` |
  | `disabled` | `uncomputable(<reason>)` |

- Disabled reasons: "--no-closed was given" (the CLI), "no closed-issue lane is configured" (a poller without a closed port).
- Unresolved closed row reason: "the forge list carried no body".

## The `issueList` port

### R1257-1: `issueList` entries carry `state` and `body`, normalized inside each adapter (R4, R10, R12)

Every `issueList` entry MUST carry `state: 'open' | 'closed' | null` and `body: string | null`. The widening is additive and mirrors #930 for `mrList`.

- `state`: GitHub emits `r.state` when it is `'open'` or `'closed'`. GitLab maps `'opened'` to `'open'` and `'closed'` to `'closed'`. Any other value, absent and `''` included, is `null`.
- `body` (R12): GitHub reads `body`, GitLab reads `description`. When the key is absent from the payload, `body` is `null`: the provider did not carry the field. When the key is present, `body` is its string value, and a JSON `null` value is `''`, an empty description. An absent key MUST NOT become `''`, and a present JSON `null` MUST NOT become `null`.
- The mapping MUST live in the adapter files. It MUST NOT live in `vcs/lib/normalize.mjs` or in any caller.
- `state:'closed'` MUST be accepted as a filter on both providers, through the existing `providerState`.
- `vcs/cli.mjs` MUST NOT change.

#### Scenario: GitLab `opened` is `open`
- **GIVEN** a derived GitLab fixture entry with `state:'opened'`
- **WHEN** `gitlab.issueList` normalizes it
- **THEN** the entry's `state` is `'open'`

#### Scenario: GitLab `description` is `body`
- **GIVEN** a derived GitLab fixture entry with `description:'Part of #878'`
- **WHEN** `gitlab.issueList` normalizes it
- **THEN** the entry's `body` is `'Part of #878'` and the entry has no `description` key

#### Scenario: No readable state is `null`, never guessed
- **GIVEN** fixture entries with no `state` key, with `state:''` and with `state:'locked'`
- **WHEN** either provider normalizes them
- **THEN** all three entries carry `state: null`

#### Scenario: An absent body is `null`, never `''` (R12)
- **GIVEN** a fixture entry whose payload has no `body` key on GitHub, or no `description` key on GitLab
- **WHEN** either provider normalizes it
- **THEN** the entry carries `body: null`

#### Scenario: A JSON null body is `''`, never `null` (R12)
- **GIVEN** fixture entries whose body key holds JSON `null` and `""`
- **WHEN** either provider normalizes them
- **THEN** both entries carry `body: ''`, and `''` is distinct from the absent entry's `null`

#### Scenario: The closed filter reaches the wire
- **GIVEN** a spawn spy
- **WHEN** `issueList({project, state:'closed'})` runs on each provider
- **THEN** the GitHub endpoint carries `state=closed`, the GitLab endpoint carries `state=closed`, and both paginate as they do for `open`

### R1257-2: The contract test's exact-key lock widens to six keys (MODIFIES `issueList-contract`)

The parameterized contract test (`axes/vcs/contract.test.mjs:539`) MUST lock each entry to exactly `['assignees', 'body', 'labels', 'number', 'state', 'title']`, in the existing contract-test style.

The recorded happy fixtures carry no `state` and no `body`, because they were trimmed when recorded (`vcs/fixtures/github-issueList-happy.json` `_provenance.note`). Their expected arrays therefore gain `state: null` and `body: null`, the truthful "cannot see". They MUST NOT be edited to add either field.

New derived fixtures `vcs/fixtures/{github,gitlab}-issueList-state.json`, each carrying `_provenance.derived`, MUST pin on both providers: `state` open, closed, absent, `''` and unrepresentable; `body` present, absent, JSON `null` and `""`. The GitLab fixture MUST pin `opened` → `open` and `description` → `body` on named entries.

#### Scenario: The lock rejects the old shape
- **GIVEN** a normalizer that omits `body`
- **WHEN** the contract test runs
- **THEN** it fails on the key list

#### Scenario: Open, closed and unknown are distinguishable
- **GIVEN** the `-state.json` fixtures
- **WHEN** both providers normalize them
- **THEN** the open entry, the closed entry and the stateless entry carry `'open'`, `'closed'` and `null`, and `null` is distinct from both

### R1257-3: The documented pagination is the code's (MODIFIES `issueList-contract`)

The scenario "Documentation reflects the pagination asymmetry" is replaced. The truth, measured at `github.mjs:458-465` (`gh api --paginate`, `per_page=100`) and `gitlab.mjs:618-626` (pages of 100 until a short page), is that **both providers paginate in full** (#459). `vcs-contract.md:28` already says so, and its row changes only for the widened shape and `updatedSince` (R1257-4).

#### Scenario: Both paginate
- **GIVEN** the `#459` provider tests (`vcs/providers.test.mjs:207-241`)
- **WHEN** they run
- **THEN** GitHub passes `--paginate`, and GitLab requests page 2 after a full page of 100

### R1257-4: The `vcs-contract.md` row is drafted, not edited (Tier 2)

The `issueList` row change MUST be drafted at `openspec/changes/issue-1257-nonblocking-forge-reads/brain-drafts/vcs-contract.issueList-row.md`. `brain/core/methodology/vcs-contract.md` MUST NOT be edited by this change. The verb set is unchanged, so `vcs/verb-contract-drift-guard.test.mjs` MUST pass without modification.

#### Scenario: Core untouched
- **WHEN** the change's diff is listed
- **THEN** it contains no path under `brain/core/`, and it contains neither `brain/scripts/vcs/cli.mjs` nor `brain/scripts/vcs/lib/exec.mjs`

### R1257-5: `issueList` accepts an optional `updatedSince` for incremental reads

`issueList({project, state, assignee, updatedSince})` MUST accept an optional ISO-8601 `updatedSince`. When it is absent, the endpoint is unchanged. When it is present:

- GitHub appends `&since=<encoded iso>&sort=updated&direction=asc`.
- GitLab appends `&updated_after=<encoded iso>&order_by=updated_at&sort=asc`.
- Both keep paginating in full, and the returned shape is the one in R1257-1.

The mapping MUST live in the adapters. `vcs/cli.mjs` passes its JSON arguments through unchanged (`cli.mjs:210-218`), so it MUST NOT change.

#### Scenario: GitHub delta endpoint
- **GIVEN** a spawn spy
- **WHEN** `github.issueList({project, state:'closed', updatedSince:'2026-10-02T10:00:00.000Z'})` runs
- **THEN** the endpoint carries `state=closed`, `since=2026-10-02T10%3A00%3A00.000Z`, `sort=updated` and `direction=asc`, and `--paginate` is still passed

#### Scenario: GitLab delta endpoint
- **GIVEN** a spawn spy
- **WHEN** `gitlab.issueList({project, state:'closed', updatedSince:'2026-10-02T10:00:00.000Z'})` runs
- **THEN** every page's endpoint carries `state=closed`, `updated_after=2026-10-02T10%3A00%3A00.000Z`, `order_by=updated_at` and `sort=asc`

#### Scenario: Absent means unchanged
- **GIVEN** a spawn spy
- **WHEN** `issueList({project, state:'open'})` runs on each provider
- **THEN** neither endpoint carries `since`, `updated_after`, `sort` or `order_by`

## Reading the forge in the snapshot

### R1257-6: The snapshot's open read takes bodies and state from the list, and `issueView` is only a fallback

`readForge` (`status/snapshot.mjs:313`) MUST build the graph from `issueList({state:'open'})` rows, taking each node's `body` from the row and its `state` from the row (`i.state ?? null`). The hardcoded `state: 'open'` at `:337` MUST go.

`issueView` MUST be called only for an open row whose `body` is `null`. When that call throws, the node is unreadable exactly as today (`:326-335`, `:348-350`).

#### Scenario: No body read when the list carries bodies
- **GIVEN** a fake port whose open rows all carry a string `body`, and an `issueView` spy
- **WHEN** the snapshot is built
- **THEN** the spy was never called, and every node's `declared` is parsed from its row's body

#### Scenario: A null body falls back to `issueView`
- **GIVEN** open rows #5 with `body:'x'` and #6 with `body:null`, and an `issueView` spy
- **WHEN** the snapshot is built
- **THEN** the spy was called exactly once, for #6

#### Scenario: An empty body is read, not re-fetched (R12)
- **GIVEN** an open row #7 with `body:''`, and an `issueView` spy
- **WHEN** the snapshot is built
- **THEN** the spy was never called, and #7's node is readable with `declared` false

#### Scenario: Node state comes from the port
- **GIVEN** an open-list row carrying `state:'open'` and one carrying `state:null`
- **WHEN** the snapshot is built
- **THEN** their nodes' `state` values are `'open'` and `null`

### R1257-7: The snapshot reads closed issues in full and exposes them as `closedIssues`

`buildSnapshot` MUST add a top-level `closedIssues` section, shaped by `forgeLoad.closed` as in Fixed values. When it is a value, it is built as follows:

1. Call `issueList({state:'closed'})` once, through whatever port the snapshot was given.
2. Run `buildGraph` over the closed rows whose `body` is a string, and carry its `nodes` and `declarationDivergences`.
3. List every closed row whose `body` is `null` in `unresolved` as `{number, reason}`, with the reason in Fixed values. No `issueView` is called for a closed row.

The closed nodes MUST NOT enter the `graph` section.

Failure and disabling:

- A failed closed list MUST NOT change the `graph`, `prs` or `reviews` sections. It makes `forgeLoad.closed` `failed` (R1257-8).
- `buildSnapshot({closed:false})` MUST skip the closed read and report `forgeLoad.closed` as `disabled`. `brain:snapshot --no-closed` passes it. Without the flag, the CLI reads closed issues in full and synchronously.
- In the server, the closed list MUST be read from the cache only when `forgeLoad.closed` is `complete`, or `failed` with a `lastCompleteAt`.

#### Scenario: The graph survives a closed failure
- **GIVEN** a fake port whose `issueList` throws "rate limited" only for `state:'closed'`
- **WHEN** the snapshot is built
- **THEN** `graph.ok` is true, `closedIssues.ok` is false with reason "the closed-issue list could not be read: rate limited", and `forgeLoad.value.closed` is `{state:'failed', at, reason:'rate limited', lastCompleteAt:null}`

#### Scenario: A closed row without a body is unresolved, not dropped silently
- **GIVEN** closed rows #880 with a line-initial `body:'Parent: #878 (the epic)'` and #881 with `body:null`
- **WHEN** the snapshot is built
- **THEN** `closedIssues.value.nodes` holds #880 with `parent: 878`, `closedIssues.value.unresolved` is `[{number:881, reason:'the forge list carried no body'}]`, and neither number is a `graph` node

#### Scenario: `--no-closed` disables the closed read
- **GIVEN** a fake port and an `issueList` spy
- **WHEN** `brain:snapshot --json --no-closed` runs
- **THEN** the spy never saw `state:'closed'`, `forgeLoad.value.closed` is `{state:'disabled', at:null, reason:'--no-closed was given'}`, and `closedIssues.reason` is "--no-closed was given"

### R1257-8: `forgeLoad` reports each lane's load state, in the snapshot and in `meta.poller`

The poller's `state()` MUST carry `forgeLoad: {open, closed}`, with each entry shaped as in Fixed values. The snapshot MUST carry a top-level `forgeLoad` section, `field({open, closed})`:

- In the server, it is the poller's `forgeLoad` at the time of the recompute, passed to `buildSnapshot({forgeLoad})`, so it deep-equals `meta.poller.forgeLoad` from the same recompute.
- In the CLI, `buildSnapshot` derives it from its own synchronous reads, with `at` equal to `generatedAt`. The CLI never reports `pending`.

The rules are:

- `open` is `complete` once an open list has landed in this process.
- `closed` is `complete` once a **full** closed list has landed in this process. A delta read never makes it `complete` on its own, and a successful delta keeps it `complete` with a new `at`.
- A failed read after a complete one keeps the last complete data in the cache and reports `failed` with its reason and `lastCompleteAt`. Readers compute the age from `lastCompleteAt`.
- A forge-halted poller (`initialError`) reports both lanes `failed`, with the halt reason and `lastCompleteAt: null`.
- A poller paused before any landing reports `pending` with the reason "polling is paused".
- A poller with no closed port reports `closed` as `disabled`, with the reason "no closed-issue lane is configured".

#### Scenario: Open pending
- **GIVEN** a poller whose first tick has not settled
- **WHEN** `state()` is read
- **THEN** `forgeLoad.open` is `{state:'pending', at:null}`

#### Scenario: Open complete
- **GIVEN** a poller whose open list lands at T1
- **WHEN** the tick settles
- **THEN** `forgeLoad.open` is `{state:'complete', at:T1}`

#### Scenario: Open failed after complete
- **GIVEN** an open list that landed at T1 and throws "boom" at T2
- **WHEN** the second tick settles
- **THEN** `forgeLoad.open` is `{state:'failed', at:T2, reason:'boom', lastCompleteAt:T1}`, and the cache still serves the T1 list

#### Scenario: Closed pending
- **GIVEN** a poller with a closed port whose first full list is still in flight
- **WHEN** `state()` is read
- **THEN** `forgeLoad.closed` is `{state:'pending', at:null}`

#### Scenario: Closed complete after a full list
- **GIVEN** a closed port whose full list lands at T1
- **WHEN** the closed lane settles
- **THEN** `forgeLoad.closed` is `{state:'complete', at:T1}`

#### Scenario: A delta keeps closed complete
- **GIVEN** a closed lane that is complete at T1
- **WHEN** a delta read lands at T2
- **THEN** `forgeLoad.closed` is `{state:'complete', at:T2}`

#### Scenario: Closed failed after complete keeps the data
- **GIVEN** a closed lane that is complete at T1, and a delta that throws "rate limited" at T2
- **WHEN** the closed lane settles
- **THEN** `forgeLoad.closed` is `{state:'failed', at:T2, reason:'rate limited', lastCompleteAt:T1}`, and the cache still serves the T1 closed list

#### Scenario: Closed failed with no data
- **GIVEN** a closed port whose first full list throws "boom"
- **WHEN** the closed lane settles
- **THEN** `forgeLoad.closed` is `{state:'failed', at, reason:'boom', lastCompleteAt:null}`

#### Scenario: Closed disabled without a closed port
- **GIVEN** a poller created without `closedVcs`
- **WHEN** `state()` is read
- **THEN** `forgeLoad.closed` is `{state:'disabled', at:null, reason:'no closed-issue lane is configured'}`

#### Scenario: CLI complete
- **GIVEN** a fake port whose open and closed lists succeed, and `--now 2026-10-02T12:00:00.000Z`
- **WHEN** `brain:snapshot --json` runs
- **THEN** `forgeLoad.value` is `{open:{state:'complete', at:'2026-10-02T12:00:00.000Z'}, closed:{state:'complete', at:'2026-10-02T12:00:00.000Z'}}`

#### Scenario: CLI failed
- **GIVEN** a fake port whose open list throws "offline"
- **WHEN** `brain:snapshot --json` runs
- **THEN** `forgeLoad.value.open` is `{state:'failed', at:<generatedAt>, reason:'offline', lastCompleteAt:null}` and `graph.ok` is false

#### Scenario: Forge halted
- **GIVEN** a poller created with `initialError: 'no git origin remote'`
- **WHEN** `state()` is read
- **THEN** both `forgeLoad.open` and `forgeLoad.closed` are `failed` with reason "no git origin remote" and `lastCompleteAt: null`

#### Scenario: Paused before any load
- **GIVEN** a poller created with `enabled: false`
- **WHEN** `state()` is read
- **THEN** `forgeLoad.open` is `{state:'pending', at:null, reason:'polling is paused'}`

#### Scenario: The snapshot mirrors the poller
- **GIVEN** a server whose closed lane is in flight
- **WHEN** a recompute runs
- **THEN** `current.forgeLoad.value` deep-equals `meta.poller.forgeLoad` in the `status` frame that recompute broadcasts

### R1257-9: No view's first render waits on a forge read (R11)

The server MUST compute its first snapshot from the local tree and the forge cache only, before any forge call, and every forge call MUST run off the server's event loop:

- `listen` (`ui/server.mjs:379-405`) MUST resolve without waiting for any forge call to settle.
- The live forge port given to the poller MUST run each verb in a worker thread (`ui/forge-thread.mjs`). The open lane and the closed lane MUST each have their own thread, so one lane's call never queues behind the other's.
- While `forgeLoad.open` is `pending`, the `graph`, `prs` and `reviews` sections MUST be `{ok:false, pending:true, reason}` with the loading wording in Fixed values. While `forgeLoad.closed` is `pending`, so MUST `closedIssues`.
- `failedSections` (`ui/lib/banners.mjs:64`) MUST NOT list a pending section. The page MUST show one loading band naming the pending sections.
- The first landing of the open list MUST trigger a recompute before the review lane runs, so the graph fills in before the reviews.
- No view MAY render a count of 0, or an empty list, for a quantity whose lane is `pending`.

#### Scenario: An HTTP request waits on a forge read today (the probe)
- **GIVEN** `main()` started with an adapter whose first `issueList` blocks its thread until a client has received a response to `GET /`, with a deadlock guard of a few seconds
- **WHEN** a client requests `GET /` while that `issueList` blocks
- **THEN** the client receives 200 and the adapter's wait ends released, not timed out

#### Scenario: The first snapshot is served while a forge call is held
- **GIVEN** a server whose open forge thread holds its first `issueList` call unresolved
- **WHEN** `GET /api/snapshot` is requested
- **THEN** it answers 200 before the call is released, with `graph.pending` true, `graph.reason` "loading open issues from the forge…" and `forgeLoad.value.open.state` `'pending'`

#### Scenario: The stream syncs while a forge call is held
- **GIVEN** a server whose open forge thread holds its first `issueList` call unresolved
- **WHEN** a client connects to `/api/stream`
- **THEN** it receives the `sync` frame before the call is released

#### Scenario: A blocking adapter does not block the server
- **GIVEN** a forge thread over a test adapter whose `issueList` blocks its thread synchronously until released through a shared `Int32Array`
- **WHEN** `GET /` is requested while the adapter blocks
- **THEN** the page is served before the release

#### Scenario: The closed thread does not delay the open thread
- **GIVEN** a closed forge thread whose adapter blocks its first `issueList`, and an open forge thread over a non-blocking adapter
- **WHEN** the open thread's `issueList` is called
- **THEN** it resolves while the closed thread is still blocked

#### Scenario: Loading is not failure
- **GIVEN** a snapshot whose `graph`, `prs` and `reviews` are pending
- **WHEN** `degradationBands` runs
- **THEN** no `sections` band is produced for them, and one `loading` band reads "still loading from the forge: graph, prs, reviews"

#### Scenario: Closed issues loading
- **GIVEN** a server whose open list has landed and whose closed thread holds its first `issueList` call unresolved
- **WHEN** `GET /api/snapshot` is requested
- **THEN** `graph.ok` is true, `closedIssues.pending` is true with reason "loading closed issues from the forge…", and `forgeLoad.value.closed.state` is `'pending'`

#### Scenario: The graph lands before the reviews
- **GIVEN** a poller whose open list resolves and whose `prReviews` is held unresolved
- **WHEN** the open list lands
- **THEN** `onTick` has been called once with `forgeLoad.open.state` `'complete'` before any `prReviews` call settles

#### Scenario: A pending graph shows no empty board
- **GIVEN** a snapshot whose `graph` is pending
- **WHEN** the lanes view renders through `installDom`
- **THEN** it shows "loading open issues from the forge…" and renders no count of 0 and no empty-lane message

## The forge poll lanes

### R1257-10: The closed issues are their own background lane, full then incremental

`createPoller` MUST accept `closedVcs` (default `null`). When it is set, the closed lane runs as follows:

- **Independent.** It runs under its own single flight, the way the remotes lane does (#1201 D40, `poller.mjs:128-145`, `:268-275`). `tick()` starts it when it is not already in flight and never awaits it. A tick never waits for it, and it never waits for a tick. When it settles outside a tick, it calls `onTick` itself.
- **First run, full.** It calls `closedVcs.issueList({project, state:'closed'})` with no `updatedSince`.
- **Later runs, incremental.** It calls `closedVcs.issueList({project, state:'closed', updatedSince})`, where `updatedSince` is the start time of the last successful closed run minus `CLOSED_SINCE_OVERLAP_MS`. Every `CLOSED_FULL_EVERY_RUNS`-th run is full instead.
- **Merge.** A full list replaces the held set. A delta upserts its rows by number. After either, any number present in the latest open list is removed from the closed set, which is how a reopened issue leaves it. The merged set, in descending number, is written with `cache.setIssueList(rows, 'closed')`.
- **Contained.** A closed-lane failure MUST NOT touch the open lane's `lastError` or any open section. The held closed set stays cached (R881-9), and the next run retries from the same anchor.

The forge cache (`ui/forge-cache.mjs`) MUST hold one `issueList` value per `state`: `port.issueList({state = 'open'})` returns the list stored for that state, and `setIssueList(value, state = 'open')` stores it. The port stays exactly four verbs.

#### Scenario: The closed lane does not delay the open lane
- **GIVEN** `closedVcs` whose first full list is held unresolved, and a `fakeScheduler`
- **WHEN** ticks 1, 2 and 3 fire
- **THEN** the open `issueList` was called on each of the three ticks, and `closedVcs.issueList` was called once

#### Scenario: First run full, second run incremental
- **GIVEN** `closedVcs`, `_now` returning T1 for the first closed run and T2 for the second
- **WHEN** two closed runs settle
- **THEN** the first call carried no `updatedSince`, and the second carried `updatedSince` equal to T1 minus 10 minutes

#### Scenario: A reopened issue leaves the closed set
- **GIVEN** a closed set holding #7, and an open list that contains #7 on the next tick
- **WHEN** the next closed run settles
- **THEN** the cached closed list no longer holds #7

#### Scenario: Periodic full re-list
- **GIVEN** `closedVcs` and a closed lane that has completed 59 runs
- **WHEN** run 60 starts
- **THEN** it calls `issueList` with no `updatedSince`, and its result replaces the held set

#### Scenario: A closed-lane failure is contained
- **GIVEN** a closed lane that is complete, and a delta that throws
- **WHEN** the tick that started it and the delta both settle
- **THEN** `lastError` is null, the open list was cached on that tick, and the cache still serves the previous closed list

#### Scenario: The cache keeps one list per state
- **GIVEN** `setIssueList(openRows)` and `setIssueList(closedRows, 'closed')`
- **WHEN** `port.issueList({state:'closed'})` and `port.issueList({})` are read
- **THEN** they return `closedRows` and `openRows`

#### Scenario: A closed miss is not the open list
- **GIVEN** a cache holding only an open list
- **WHEN** `port.issueList({state:'closed'})` is read
- **THEN** it throws "the closed-issue list has not been fetched yet (queued)"

### R1257-11: The open lane reads bodies from the list, with a capped null-body fallback

The open lane MUST read bodies from the list. Its `issueView` reads are the null-body fallback only: open rows whose `body` is `null` and that are not yet cached, ascending, at most `BODY_CAP` per tick. A number already cached is not re-read until its row's `body` becomes a string. `pickBodyTargets`, `pendingBodyRefresh`, `lastBodyRefreshTick`, `NEW_BODY_CAP` and the cold-start uncapped read MUST be removed.

#### Scenario: The open lane reads no body it already has
- **GIVEN** 133 open rows, all carrying a string `body`
- **WHEN** a tick runs
- **THEN** no `issueView` call is made

#### Scenario: The fallback is capped
- **GIVEN** 8 open rows whose `body` is `null`, none cached
- **WHEN** one tick runs
- **THEN** `issueView` was called for the 5 lowest numbers only

#### Scenario: The cold start is capped too
- **GIVEN** a poller on its first tick with 133 open rows whose `body` is `null`
- **WHEN** the tick runs
- **THEN** `issueView` was called exactly `BODY_CAP` times

## Out of scope

- `countTasks`, the `progress` field, the hierarchy adapter and the epic rollup, with its "counting closed children…" wording. They stay in #1199, which consumes this change's `state`, `body`, `forgeLoad` and `closedIssues`.
- Persisting the forge cache across server restarts (#1256).
- ETag (`If-None-Match`) reads.
- `status/epic-map.mjs:82,95,114`. That verb keeps its own open read, its per-issue `issueView` and its hardcoded state; it can drop them in its own change.
- Editing `vcs/cli.mjs`, `vcs/lib/exec.mjs` or `brain/core/**`.

## Traceability

| Ruling | Requirements |
|---|---|
| R4 | R1257-1, R1257-2, R1257-3, R1257-4, R1257-7 |
| R10 | R1257-1, R1257-2, R1257-5, R1257-6, R1257-7, R1257-10, R1257-11 |
| R11 | R1257-8, R1257-9, R1257-10 |
| R12 | R1257-1, R1257-6 |

| This change | Was in #1199 | Note |
|---|---|---|
| R1257-1 | R1199-5 | R12 replaces the "interpretation" wording; one scenario retitled |
| R1257-2 | R1199-6 | Unchanged |
| R1257-3 | R1199-7 | Unchanged |
| R1257-4 | R1199-8 | Draft path moves to this change; `exec.mjs` added to the scenario |
| R1257-5 | R1199-9 | Unchanged |
| R1257-6 | R1199-10 (open read, node state) | New scenario for an empty body (R12) |
| R1257-7 | R1199-10 (closed read, `--no-closed`) | `closedUnresolved` and the closed graph move into the new `closedIssues` section (design D68); #1199's `hierarchy` reads them from there |
| R1257-8 | R1199-11 | Unchanged |
| R1257-9 | R1199-12 | `hierarchy` pending moves to #1199; `closedIssues` pending, the probe and two scenarios added |
| R1257-10 | R1199-13 (closed lane, cache) | One scenario added for the closed miss |
| R1257-11 | R1199-13 (open-lane bodies) | Split out; two scenarios added |

| Success criterion | Requirements |
|---|---|
| Requests are served during a forge call | R1257-9 |
| Both providers return `state` and `body`, `null` versus `''` pinned | R1257-1, R1257-2 |
| No per-issue `issueView` when bodies are carried | R1257-6, R1257-11 |
| Loading is stated, never failed or 0 | R1257-9 |
| `forgeLoad` mirrors the poller | R1257-8 |
| The closed lane is independent, full then delta | R1257-10 |
| `--no-closed` | R1257-7 |
| `cli.mjs`, `exec.mjs` and `brain/core/**` unchanged | R1257-4 |
