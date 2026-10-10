---
status: approved
issue: 1262
---

# Spec — paused-poller-and-closed-delta (issue 1262)

Capability: `ui-forge-poller` (modified; #881, #1257). Requirement keywords follow RFC 2119. Each scenario has one `WHEN` and one `THEN`.

## R1262-1: A pending section carries the lane's own reason

When `forgeLoad.<lane>.reason` is a non-empty string on a `pending` entry, the sections fed by that lane (`graph`, `prs`, `reviews` for the open lane; `closedIssues` for the closed lane) MUST be `{ok: false, pending: true, idle: true, reason: <that reason>}`. A pending entry with no reason keeps today's loading wording and carries no `idle`. Sections that are pending because `graph` is (`hierarchy`, `localWorktrees`) MUST keep the reason and the `idle` flag.

#### Scenario: A paused open lane
- **GIVEN** `forgeLoad.open` is `{state: 'pending', at: null, reason: 'polling is paused'}`
- **WHEN** `buildSnapshot` composes the forge sections
- **THEN** `graph`, `prs` and `reviews` are pending and idle with the reason `polling is paused`, and the port is not read

#### Scenario: A lane whose read is in flight
- **GIVEN** `forgeLoad.open` is `{state: 'pending', at: null}`
- **WHEN** `buildSnapshot` composes the forge sections
- **THEN** the sections keep the loading wording and no `idle` flag

## R1262-2: The loading band never claims a read that will not start

`degradationBands` MUST list a pending section in the `loading` band only when it is not idle. An idle section MUST be listed in an `idle` band reading `not read yet, <reason>: <names>`, one band per distinct reason, after the `loading` band. An idle section MUST NOT be reported as failed.

#### Scenario: Only idle sections
- **GIVEN** `graph`, `prs` and `reviews` are pending and idle with the reason `polling is paused`
- **WHEN** `degradationBands` runs
- **THEN** the bands are exactly one `idle` band reading `not read yet, polling is paused: graph, prs, reviews`

#### Scenario: A paused server with no injected port
- **GIVEN** `createUiServer({poll: false})` with no `vcs`, so the snapshot composes the poller's `forgeLoad`
- **WHEN** `/api/snapshot` is read
- **THEN** every forge section reads `polling is paused` and `degradationBands` has no `loading` band

## R1262-3: A closed delta never drops a just-closed issue

`publishClosed` MUST publish the held closed rows minus the numbers of the latest open list, and MUST NOT remove anything from the held set. A later open landing MUST republish from the intact held set.

#### Scenario: The closed delta lands first
- **GIVEN** #5 was open at tick 1 and is closed at tick 2, and tick 2's closed delta lands while its open list is still held
- **WHEN** the open list, which no longer lists #5, lands
- **THEN** the cache's closed list contains #5

## R1262-4: Per-number "queued" reasons key off the open lane

The cache MUST answer a per-number miss with its "queued" reason only once the open lane has written a list (`issueList('open')` or `mrList`). A closed landing alone MUST leave the first-poll wording.

#### Scenario: Only the closed list has landed
- **GIVEN** a cache holding only `issueList('closed')`
- **WHEN** `issueView` or `prReviews` misses
- **THEN** the error reads `the first forge poll has not completed`
