---
status: draft
issue: 881
---

# Design — the local UI server and the DAG canvas (#881)

The proposal's five rulings are closed. This document closes Q1–Q5 by reading
the code, then states the decisions the implementation is bound to. Every claim
carries a `file:line`.

## Context

`buildSnapshot()` (`snapshot.mjs:265-307`) is a pure-ish composition over the
served root plus an injected VCS port. #881 wraps it in the first long-running
process brain has ever had: an HTTP server, a filesystem watcher, and a forge
poll loop. There is no precedent for any of the three — `grep` for
`createServer` and `fs.watch` across `brain/scripts/**` returns nothing
(`explore.md:122-131`). So every convention here is new and has to justify
itself against the doctrine the proposal quotes.

Two properties drive nearly every decision below:

1. **The snapshot is recomputed, never stored** (`snapshot.mjs:1-8`). A server
   that holds `current` in memory for the lifetime of a request is not a store;
   a server that writes one is the second source of truth #878 forbids.
2. **Every forge read costs a `gh` subprocess** (`github.mjs:442`, `:458`,
   `:560` all spawn `gh api`). The budget in ruling 2 is therefore both a rate
   budget and a latency budget.

### What this phase could not verify

No shell was available in this phase either. The issue #881 and #878 bodies are
read through the verbatim quotations in `explore.md:259-278`, and the epic
sequencing through `explore.md:5-11`. Two consequences are recorded rather than
hidden: the ruling that `#881 needs: [879]` and not `[880]` rests on the
exploration's reading of the epic body, and no `gh` call was made to confirm the
live open-issue count (90) or open-PR count (3) used in the arithmetic of Q1 —
those come from the proposal (`proposal.md:70-77`). The arithmetic below is
therefore given as a formula with the assumed inputs named, so a different live
count can be substituted without redoing the reasoning.

---

## Q1 — the incremental poll

### What the provider actually returns

| Verb | Returns, per item | `updated_at` / ETag? |
|---|---|---|
| `issueList` (`github.mjs:449-454`) | `{number, title, labels, assignees}` | **No** |
| `mrList` (`github.mjs:459`) | `{number, title, headBranch}` | **No** |
| `issueView` (`github.mjs:108-129`) | `{number, title, labels, body, author, assignees, state, stateReason}` | **No** |
| `prReviews` (`github.mjs:564`) | `{state, author, body}` per review | **No** (no `id`, no `html_url`, no `submitted_at`) |

The projections are explicit `.map()`s that drop every field they do not name.
No ETag or conditional-request layer exists anywhere in the port: `ghJson` is a
plain `gh api` spawn.

So **there is no list-level change key today.** The prompt's first branch does
not apply. The choice is between widening the projection and finding a cheaper
signal.

### The projection is not widened in this slice

`providers.test.mjs:191` asserts `deepEqual(result[0], {number, title, labels,
assignees})` for GitHub and `:198` asserts the same row shape for GitLab. The
port is provider-agnostic by contract and has a coverage verb
(`brain:port:coverage`, `package.json:60`) that polices it. Adding
`updatedAt` means: two providers, two contract tests, one port-coverage entry,
and a GitLab semantic (`updated_at` exists on GitLab issues too, but was not
read this pass) — all owned by the VCS port, none owned by a UI slice, and all
of it landing in the same PR as a DAG canvas. **Rejected**: the blast radius is
outside this slice, and the strategy below does not need it.

### The strategy: two lanes, a bounded fan-out per poll

The list projections are themselves a change key. Everything the graph needs
except the issue **body** is visible in `issueList`'s four fields:

| Fact | Visible from the list alone? |
|---|---|
| issue opened / closed | yes (membership of the `state: open` list) |
| label moved (`status:approved` → roadmap colour, `epic-graph.mjs:441`) | yes |
| title, assignees (`epic-graph.mjs:394-398`) | yes |
| PR opened/closed/renamed, `headBranch` → `roadmapState` (`snapshot.mjs:60-70`) | yes, from `mrList` |
| declared graph block in the issue body (`buildGraph` edges, tracks, files) | **no** — needs `issueView` |
| a new review round | **no** — needs `prReviews` |

So the poller runs three lanes per tick:

- **Fast lane (every poll, 2 calls).** `issueList` + `mrList`. Their rows are
  deep-compared against the previous tick's rows. This is the change key.
- **Review lane (every poll, ≤ `R` calls).** `prReviews` for each open PR, capped
  at `R = 10` per tick, round-robin beyond the cap.
- **Body lane (every poll, ≤ `B` calls).** `issueView`, priority order:
  (a) numbers that appeared since the last tick — fetched in the *same* tick so a
  new issue never renders as `unreadable`, capped at 20;
  (b) numbers whose fast-lane row changed;
  (c) least-recently-refreshed, to bound staleness of body-only facts.
  `B = 5` steady state.

Numbers that leave the list are evicted from the cache; numbers that enter it are
fetched. The cache never grows past the open set.

### The budget, in requests per hour at 60 s

With `I` open issues, `P` open PRs, interval `T = 60 s` → 60 ticks/h.

| Case | Calls/tick | Calls/hour | vs. 5,000/h |
|---|---|---|---|
| Cold start (once, at boot) | `2 + min(P,10) + I` = 95 | — | one-off |
| Steady state | `2 + min(P,10) + B` = 2 + 3 + 5 = **10** | **600** | 12 % |
| Worst bounded case | `2 + 10 + 25` = **37** | **2,220** | 44 % |
| Full fan-out per poll (**rejected**, ruling 2) | `2 + I + P` = 95 | **5,700** | **114 % — over** |

`I = 90`, `P = 3` from `proposal.md:70-77`. The rejected row is the arithmetic
ruling 2 already did; the design reproduces it because the bound is the whole
point. `issueList` is `--paginate`d (`github.mjs:442`) so `I ≤ 100` costs one
request; beyond 100 open issues the fast lane costs `ceil(I/100)` and the table
shifts by ≤ 1 call/tick.

**Correction (2026-09-14, judgment:cold-4, third cold review of PR #971):**
the worst-bounded-case row originally read `2 + 10 + 5 = 17` — `B = 5` was the
only figure used for the body lane's ceiling. That was wrong: the
implementation never capped the "changed" bucket (issues whose fast-lane row
moved), only the "new" bucket (`NEW_BODY_CAP = 20`), so a tick where every
open issue changed at once (a bulk label rename) had no upper bound at all —
`issueView` was called once per open issue, not `min(I, B)`. The fix bounds
the body lane's TOTAL per tick at `BODY_CAP + NEW_BODY_CAP = 5 + 20 = 25`
(new issues and already-known changed issues share one ceiling); the
corrected worst bounded case is `2 + min(P,10) + 25 = 37` calls/tick, 2,220/h,
44 % of the 5,000/h ceiling — still well under budget. Issues that changed
but did not fit a tick's slice are never dropped: they queue in a FIFO
pending set (`poller.mjs`'s `pendingBodyRefresh`) and drain oldest-first on
later ticks, so a mass change of all 90 open issues fully drains within
`ceil(90/25) = 4` ticks, not the 18-tick `ceil(I/B)` figure below (that
figure describes the *unforced*, least-recently-refreshed fallback only,
which still uses `B = 5` as its per-tick share once the pending queue is
empty).

**Correction (2026-09-16, judgment:cold-1, cold review of tracker PR #970):**
the implementation returned early — before bucket (c) ran at all — whenever
nothing was new and nothing was pending, and it DROPPED the brand-new numbers
beyond `NEW_BODY_CAP` instead of queueing them. Together those two made a
bulk import permanently unreadable: an overflow number has no previous row, so
the "changed" test can never see it, it stops being new at the end of its own
tick, and with (c) foreclosed nothing else would ever reach it — measured, 20
ticks after a 30-issue import, ten issues still had zero `issueView` calls and
rendered `status: UNREADABLE` forever. The fix queues the overflow into the
same FIFO pending set (ascending number, drained ahead of any churn that
arrives later) and removes the early return, so (c) runs whenever the first
two buckets leave it room.

**The budget table is unchanged by this correction**, because it already
priced bucket (c): the steady-state row is `2 + min(P,10) + B` = 10
calls/tick, 600/h. What changed is that the implementation now actually spends
that `B` every tick instead of spending 0 on a tick where no row moved — the
reality moved up to the figure the design had always stated, not past it. The
worst bounded case is still `2 + min(P,10) + 25 = 37` calls/tick: the overflow
is queued, not spent in the same tick, so the new-issue bucket's ceiling
remains `NEW_BODY_CAP = 20`. Spec R881-4's first scenario, which had read
"unchanged issues cost nothing on the next poll", was amended to the bounded
claim ruling 2 actually bought — at most `B` calls, never one per open issue.

**Full-refresh latency of body-only facts**: `ceil(I / B)` ticks = `ceil(90/5)` =
18 ticks = 18 minutes worst case *with no other signal*. A body edit that also
moves a label, a title, or the PR list is picked up on the next tick through
priority (b). This is stated in the UI: `/api/meta` carries `forgeAsOf` per lane,
and the page shows "bodies refreshed through <n> of <I>".

Cold start is 95 `gh` spawns, ≈ 10–20 s wall clock. The server therefore does not
block on it (D1).

---

## Q2 — per-task actor and timestamp

`deriveTasks()` (`derive.mjs:73-93`) returns exactly three aggregate fields:
`checked` (a count), `open` (a count), `next` (the first open line's text). There
is no per-task array, no actor, no timestamp. `snapshot.mjs:169` exposes it as
`tasks: Object.fromEntries(tasks.fields)` — the aggregate, unchanged.

**Widening `derive.mjs` cannot produce the missing facts.** It is a pure function
over `tasks.md`'s text (`derive.mjs:81-84`), and the text has no actor and no
timestamp in it: the line grammar is a checkbox plus prose
(`AGENTS.md:377-379`). A widened `deriveTasks` could emit a per-line array, but
it would have to invent the two fields the tab needs.

So: **the drawer parses `tasks.md` itself** (`ui/lib/tasks-list.mjs`, pure, one
line-shape regex mirroring `AGENTS.md:377-379` including the case-insensitive
`- [X]`), and the actor/timestamp comes from the only place that holds it — git.
`git blame --porcelain -- <dir>/tasks.md` is **one** subprocess per drawer open
and returns author, author-time and commit sha for every line at once
(`ui/lib/blame.mjs` parses the porcelain text, pure and tested).

The field is labelled for exactly what it is: **"last commit that touched this
line"**, not "who checked it" — a reflow or a renumbering rewrites the line and
takes the attribution with it. When the change dir is uncommitted the blame
fails and the field is `{ok: false, reason}` per item, never a blank.

Rejected: leaving the column out entirely (RFC §6 asks for it, and the honest
approximation with its caveat printed beats an absence); rejected: widening
`derive.mjs` (above); rejected: deriving it from `.memory/records[].ts/actor`
filtered by issue — records are change-level, not task-level, so the mapping
would be a guess.

---

## Q3 — the watched set

### First, what a watcher can actually change

`buildSnapshot` reads the **served root's working tree** through
`readFileSync`/`readdirSync` (`snapshot.mjs:266-268`): `openspec/changes/**`
(`:143-174`), `.memory/records/**` (`:177-182`), `brain/HOME.md` (`:281`),
`brain.config.json` (`:276`), the ADR and anti-pattern dirs (`:278`, `:302`), and
`git` through `_run` for release facts (`:272`, `:304`). So "committed tier"
here means *no new reader of uncommitted state beyond what `buildSnapshot`
already reads* — the watcher watches the same paths the read model already
reads, and adds nothing.

That has a consequence worth stating plainly: **a commit inside another worktree
changes nothing in the served root's tree sections.** Worktree
`/home/gandalf/IA/brain-issue-881` has its own `openspec/changes/**`; the primary
checkout does not see it until a merge. What a commit in any worktree *does*
change is the **shared object store**, which is exactly what the Working-memory
tab reads (`git show <branch>:resume.md`, ruling 3) and what `releaseDebt` reads.
So watching every worktree's ref movement is not decoration: it is what makes
A2's commit case observable from the served root at all.

### Watch directories, not files

Git replaces `HEAD`, `refs/heads/<branch>` and `packed-refs` by writing a
`.lock` file and renaming over the target. A `fs.watch` bound to the *file* is
bound to an inode that the rename orphans, and stops delivering events. A watch
bound to the *containing directory* sees the rename and every subsequent write to
the new inode. Every watcher in this design is therefore a directory watcher,
non-recursive, and `recursive: true` is **not used** — its availability on Linux
is Node-version dependent and the test job pins no Node version (Q4), so the
watcher must not depend on it.

### The set

| Watched directory | Catches |
|---|---|
| `<root>/` | `brain.config.json` |
| `<root>/brain/` | `brain/HOME.md` |
| `<root>/brain/project/decisions/` | ADR add/remove/edit (`adr-index.mjs` reads it) |
| each dir in `ANTI_PATTERN_DIRS` (`anti-patterns.mjs:20`) | anti-pattern edits |
| `<root>/.memory/records/` | one watch, whatever the file count |
| `<root>/openspec/changes/` | a change dir appearing or disappearing → re-sync children |
| each `<root>/openspec/changes/issue-*/` | `tasks.md` edits (**> 100 dirs today**) |
| `<git-common>/` | `HEAD` (branch switch), `packed-refs` (`pack-refs`, gc), `ORIG_HEAD`, `MERGE_HEAD` |
| `<git-common>/logs/` | the primary checkout's `HEAD` reflog |
| `<git-common>/worktrees/` | worktree add/remove → re-scan |
| `<git-common>/worktrees/<n>/logs/` per worktree | that worktree's `HEAD` reflog |

The reflog is the load-bearing choice. `logs/HEAD` is **appended** on every HEAD
movement in its worktree — commit, `commit --amend`, fast-forward merge, reset,
rebase step, checkout — and it is a flat path per worktree, unlike
`logs/refs/heads/feat/issue-881-…`, which nests one directory per branch-name
segment and would need either recursion or a watcher per branch. Proof by shape:

| Commit shape | Caught by |
|---|---|
| commit in the primary checkout | `<git-common>/logs/` (`HEAD` reflog appended) |
| commit in a linked worktree | `<git-common>/worktrees/<n>/logs/` |
| `commit --amend` (either) | same — amend moves HEAD, so the reflog appends |
| fast-forward merge in the primary checkout | same — HEAD moves |
| branch switch | `<git-common>/logs/` **and** `<git-common>/` (`HEAD` symref rewritten) |
| `git worktree add` / `remove` | `<git-common>/worktrees/` → re-scan |
| `pack-refs` / gc | `<git-common>/` (`packed-refs`) |

Worktree re-scan uses the parser that already exists — `git worktree list
--porcelain` parsed by the same stanza grammar as `collect.mjs:115-129`
(re-exported, not re-written: the single-accessor rule). On a re-scan the watcher
closes watchers for vanished worktrees and opens them for new ones.

**Not caught**, and stated rather than implied: a ref moved by `git update-ref`
or a `git fetch` that no worktree's HEAD follows. Neither changes any fact the
served root's snapshot asserts, so neither is a gap in A2.

Watch count ≈ `6 + |change dirs| + |anti-pattern dirs| + |worktrees|` ≈ 110–120
today. libuv registers these as watch descriptors on one shared inotify
instance, so the binding kernel limit is `fs.inotify.max_user_watches` (commonly
8,192 or more), not the 128-instance limit.

### Debounce and recompute

Every watcher event is funnelled through one 250 ms trailing debounce. The
debounce fires **one full `buildSnapshot()`**, with the forge served from cache
(D1) so no `gh` process is spawned, followed by a section diff (Q5). Recomputes
are serialised: an event arriving during a recompute schedules exactly one
follow-up, so a `git rebase` that moves HEAD forty times produces at most two
recomputes, never forty concurrent ones.

In addition to the snapshot diff, a ref event emits a `refs` SSE event carrying
`{worktree, head}` even when no snapshot section changed — that is what tells an
open drawer to re-read `git show <branch>:resume.md`, which is the honest way
A2's commit case reaches the page.

### When the watcher fails

`fs.watch` throwing (`ENOSPC` when `max_user_watches` is exhausted, `EPERM`,
`ENOENT` for a path that does not exist in this root) is caught per directory.
The server keeps running, `/api/meta` reports `watcher: {ok: false, reason,
watched: <n>, failed: [<paths>]}`, an SSE `status` event pushes it, and the page
shows a persistent band: *"the watcher failed: <reason> — the canvas updates on
the forge poll only; press Refresh for repo changes."* Polling continues. A
watcher that dies silently would make the page assert freshness it does not have,
which is the `evidence-reader-empty-on-failure` shape this repo has already paid
for (`snapshot.mjs:198-207`).

---

## Q4 — testing SSE without a browser

**Node version.** `package.json` has no `engines` key (read in full; the file
declares `bin`, `publishConfig`, `files`, `scripts` only). CI pins Node `22` in
`publish.yml:72` and `release.yml:52`. The job that runs `npm test`
(`governance.yml:123-138`) is `runs-on: ubuntu-latest` with **no `setup-node`
step** — it uses whatever Node the runner image ships. So the repo already
assumes 22 for publishing and pins nothing for testing.

`"engines": {"node": ">=22"}` is added. It declares what two workflows already
assume, `npm install` treats it as a warning rather than an error absent
`engine-strict`, and nothing pins package.json's key set: the publish contract
test asserts `name` (`publish-contract.e2e.test.mjs:54-57`), `private`
(`:72`), and `Object.keys(deps).length === 0` (`:253-254`) — `engines` is not a
dependency and is untouched by all three. `MANAGED_SCRIPT_KEYS` is **not**
touched either: `managed-paths.test.mjs:139-147` pins it at exactly 10 entries,
and `brain:ui` is a repo-local verb like `brain:snapshot` and `brain:status`,
which are also absent from that list.

Native `fetch`, `ReadableStream` and `AbortController` are globals from Node 18
onward, so the SSE test runs on any runner the unpinned job could pick.

**The SSE test.**

```js
const server = createUiServer({ root, vcs: stub, project: 'o/r', _now, _watch, interval: 0 });
await server.listen(0);                       // ephemeral port, no fixed-port flake
const ac = new AbortController();
const res = await fetch(`http://127.0.0.1:${server.port}/api/stream`, { signal: ac.signal });
assert.equal(res.headers.get('content-type'), 'text/event-stream');
const reader = res.body.getReader();
const dec = new TextDecoder();
let buf = '';
while (!buf.includes('\n\n')) buf += dec.decode((await reader.read()).value, { stream: true });
assert.match(buf, /^event: sync\ndata: \{/);  // first frame is the full snapshot (D6)
ac.abort();
await server.close();
```

`server.close()` ends every open SSE response before closing the listener,
otherwise `node --test` hangs on an open socket — the failure mode that makes
long-running-server tests flaky, and the reason D15 exists.

---

## Q5 — diff granularity

**Section-level.** The unit is a top-level key of the snapshot's return object
(`snapshot.mjs:292-306`): `governanceTier`, `graph`, `changes`, `prs`,
`reviews`, `records`, `adrs`, `antiPatterns`, `actors`, `releaseDebt`, `drift`.
`generatedAt` and `tier` are **excluded from the comparison** — `generatedAt` is
a fresh ISO string on every recompute (`snapshot.mjs:273`), so including it would
make every event a change and the diff a no-op.

Comparison is `isDeepStrictEqual` from `node:util` — the diff module runs
server-side only, so it costs zero code and cannot disagree with `assert.deepEqual`
in the tests. A changed section is sent **in full**. Sub-section diffing (per
node, per record) is rejected: it needs a stable identity and a patch vocabulary
on the client, which is a second contract to keep in sync with #879's shape for
no measured gain.

Whole-snapshot push is rejected on payload. `records.value.records` is one row
per record and the store holds ~2,300 of them (`issue-879…/design.md:31-33`);
`graph.value.nodes` is 90 nodes with labels, files and edges. Pushing all of it
on every commit event, every 250 ms debounce and every 60 s poll turns a label
change into hundreds of kilobytes. Section diff turns the same label change into
`graph` alone, and a `tasks.md` edit into `changes` alone.

---

## Decisions

### D1 — the poller owns every forge call; `buildSnapshot` reads a cache-only port

The server composes `buildSnapshot({root, now, vcs: forgeCache, project, _run})`
exactly as `snapshot-cli.mjs:54-69` resolves `getVcs()` and `originIdentity()`,
but the `vcs` it passes is a **memoising wrapper exposing only the four read
verbs** `readForge` calls (`snapshot.mjs:190-246`): `issueList`, `issueView`,
`mrList`, `prReviews`. Each answers from a `Map` filled by the poller. A cache
miss **throws** `the first forge poll has not completed` rather than fetching, so
`buildSnapshot` provably makes zero network calls, on any path, ever.

That single invariant buys four things:

- A tree event recomputes the whole snapshot with the last poll's forge answers
  and spawns no `gh` process — the prompt's requirement, with no change to
  `snapshot.mjs`'s contract and no second code path.
- The rate budget of Q1 is enforced in exactly one file (`poller.mjs`), so it
  can be asserted by counting calls on a stub port.
- Boot is non-blocking: before the first poll lands, the cache is empty, every
  read verb throws, and `graph`/`prs`/`reviews` degrade to
  `{ok: false, reason}` through the path `snapshot.mjs:227-228,235-236,240-241`
  already has. The page paints the tree sections in milliseconds and fills in the
  forge when the first poll finishes 10–20 s later, each band saying why.
- A5 gets stronger than asked: not only do write verbs throw, they are not on the
  object the snapshot path can reach.

**Rejected — split composition**: keep `lastForge` sections on the server and
merge them into a tree-only snapshot by hand. It breaks `roadmapState`:
`snapshot.mjs:288-290` derives every node's roadmap *inside* the composition from
`forge.prs` and `forge.reviews`. A hand-merge would either duplicate that
derivation (two implementations of `planned|in-flight|done`, guaranteed to drift)
or ship a `graph` whose per-node roadmap disagrees with the `prs` section beside
it.

**Rejected — recompute per HTTP request**: makes `/api/snapshot` and the SSE
stream disagree by construction, and makes a page reload cost a full tree read.
The server holds exactly one `current` snapshot in memory, rebuilt only on a
debounced watcher event or a completed poll; `/api/snapshot` serves it.

### D2 — the poller: two fast lanes and one bounded slow lane

As derived in Q1: `issueList` + `mrList` every tick; `prReviews` for open PRs
capped at 10; `issueView` capped at 5 per tick plus up to 20 brand-new numbers in
the tick they appear. The poller is constructed with every edge injected —
`{vcs, project, interval, _setTimeout, _clearTimeout, _now}` — so a test drives
30 simulated ticks without a timer and asserts the exact call counts against the
table in Q1. A poll failure keeps the previous cache: sections keep their last
values, `/api/meta` carries `poller: {lastError, lastOkAt}`, and the page shows
"forge as of <time> — last poll failed: <reason>". It never empties a section it
once filled.

### D3 — the provider's list projection is not widened

Stated and justified under Q1. If a later slice wants a real change key, the
place is a port-owned change with both providers and both contract tests
(`providers.test.mjs:191`, `:198`), not here.

### D4 — directory watchers over an enumerated set, reflogs for commits

Stated and justified under Q3. `watcher.mjs` takes `{root, gitCommonDir, _watch,
_run, _now, debounceMs = 250}`; `_watch` defaults to `fs.watch` and is injected
in tests, so the watcher's debounce, its re-scan on a `worktrees/` event and its
per-directory failure handling are all testable without touching a real inotify.

### D5 — one debounce, one recompute, one diff

250 ms trailing debounce; recomputes serialised with at most one queued
follow-up. 250 ms is below the threshold where a human reads the page as stale
and above the burst width of a multi-step git operation.

### D6 — SSE: a `sync` frame first, then one event per changed section

The stream's **first frame carries the whole current snapshot** (`event: sync`).
This removes the race that a `GET /api/snapshot` followed by a separate
`EventSource` would have — a change landing between the two would be lost
forever, because SSE has no replay. `/api/snapshot` remains for parity (A4) and
for scripting. After `sync`, one frame per changed section, plus `refs` and
`status`. No heartbeats (RFC §5, `proposal.md:145`). Disconnection is the
browser's own `EventSource` reconnect, which re-issues `sync` — recovery costs
one full payload and no server state.

### D7 — the poll controls are POST routes over process-local state; nothing writes to brain

`POST /api/poll/pause`, `/resume`, `/once` return the poller's state as JSON.
They mutate a timer that lives in this process and dies with it: no repo write,
no forge write, no persisted state. `/once` is rate-limited — while a poll is in
flight it returns the in-flight result, and two calls inside 5 s collapse into
one, so the button cannot be clicked into the rate budget.

The ticket's "slice 3 has no POST" (`explore.md:268-271`) is read, by
maintainer ruling of 2026-09-14, as "no write surface over brain's state" —
the examples the ticket gives are claiming a task, escalating, posting a
comment, all forge writes. A timer toggle is none of those, and carrying it on
`GET` would put a side effect behind a safe, cacheable, prefetchable method.
So: the three control routes accept `POST` only (`Allow: POST`); every other
route accepts `GET`/`HEAD` only (`Allow: GET, HEAD`); the method check happens
before routing. The test asserts `POST`, `PUT`, `PATCH`, `DELETE` against every
non-control path and `GET`, `PUT`, `PATCH`, `DELETE` against the three control
paths, and asserts after a `POST /api/poll/pause` that no file under the
served root, no git ref and no forge stub call changed.

**Rejected — `GET` with a side effect on the control routes**: satisfies the
letter of "no POST" at the cost of HTTP semantics; a browser prefetch or a
crawler could pause the poller. Reversed on 2026-09-14.

**Rejected — a client-side-only polling toggle**: the cost being controlled is
server-side `gh` spawns; a per-tab switch would change nothing about it.

### D8 — module layout

```
brain/scripts/ui/
  server.mjs          routes, SSE hub, static serving, argv, signals
  watcher.mjs         directory watchers, debounce, worktree re-scan   (injected _watch)
  poller.mjs          the three lanes, pause/resume/once               (injected timer + port)
  forge-cache.mjs     the four-read-verb memoising port                (D1)
  diff.mjs            section diff over the snapshot's top-level keys  (pure)
  change-route.mjs    GET /api/change/{issue}: the drawer's IO         (injected _read/_run)
  lib/                pure, imported by the browser AND by node:test
    layout.mjs        {nodes, edges} -> coordinates                    (D10)
    spec-cards.mjs    spec.md -> requirement/scenario cards
    tasks-list.mjs    tasks.md -> checklist items with line numbers
    blame.mjs         git blame --porcelain -> per-line attribution
    resume-view.mjs   parsed frontmatter -> the three ruling-3 fields
    colour.mjs        (roadmap state, node status) -> colour class      (D-note below)
  static/
    index.html  app.js  app.css
  *.test.mjs          colocated, picked up by `node --test "brain/scripts/**/*.test.mjs"`
```

`package.json` gains `"brain:ui": "node ./brain/scripts/ui/server.mjs"`
(`brain:<noun>`, `package.json:98-99`) and `"engines": {"node": ">=22"}`.

### D9 — the browser imports the same modules `node:test` imports

`static/app.js` is `<script type="module">` and imports `/lib/<name>.mjs`, which
the server serves verbatim from `brain/scripts/ui/lib/`. There is no browser test
runner in this repo and no build step, so this is the only way the canvas logic
is tested at all. The rule that keeps it honest: **`ui/lib/**` imports nothing
outside `ui/lib/**`** — no `node:` builtin, no `../status/*`. A source guard test
asserts it by scanning the import lines, because one `node:fs` import there
breaks the page silently in a way no node test would catch.

The consequence for provenance and for `colour.mjs` is D11 and the note below.

**`colour.mjs` and the constants.** It maps `roadmap.value.state`
(`planned|in-flight|done`, `snapshot.mjs:45-47`) and `node.status`
(`ready|blocked|awaiting-human|unclassified`, `epic-graph.mjs:109-112`, plus
`unreadable`, `snapshot.mjs:49`) to a CSS class. It cannot import those constants
(D9), so its **test** imports all eight and asserts the map is exhaustive over
them. A renamed constant then fails a test instead of quietly painting a node
grey.

### D10 — layout: deterministic, cycle-tolerant, pure

`layout({nodes, edges, options})` → coordinates. Four passes:

1. **Cycle breaking.** DFS from the numerically smallest node; any edge reaching a
   node already on the DFS stack is a back edge and is **reversed** for layering,
   with `reversed: true` kept on the output so the renderer can draw it
   differently. The graph reports divergences rather than guaranteeing acyclicity
   (ruling 5), so a cycle must produce a drawing, never a hang.
2. **Layering, longest path.** `layer(to) = max(layer(from)) + 1` over the
   acyclic edge set. **Orientation is load-bearing**: `epic-graph.mjs:432-438`
   computes `openBlockers.set(to, [...prev, from])` and assigns
   `node.blockedBy = blockers`, so **`from` is the blocker and `to` is the
   blocked**. Blockers sit above. (The prose at `epic-graph.mjs:346-347` reads
   the other way round; the code at `:432-438` is the authority, and a test pins
   the orientation by asserting that every `n.blockedBy` member lands in a
   strictly smaller layer than `n`.)
3. **Ordering, barycentre, fixed sweeps.** Exactly 4 down-up sweeps — a constant,
   not a convergence loop, so the function is deterministic and terminating.
   Ties break on issue number. Same input → byte-identical output, which is what
   makes it testable at all.
4. **Coordinates.** `x = order * (nodeWidth + gapX)`, `y = layer * (nodeHeight +
   gapY)`, plus the bounding box. Edges get two endpoints and, for a layer
   skip > 1, straight-line points; no spline routing in v1.

Nodes with no edges (the `?` track, ruling 1) are laid out in a trailing band
below the layered graph, never dropped — ruling 1 says the canvas never filters a
node away silently, and a node absent from every edge has no layer to belong to.

**Rejected — a convergence loop** (sweep until crossings stop improving):
non-deterministic run-to-run under floating-point ties, which would make the
layout test assert "looks about right" instead of an exact shape.

### D11 — provenance: the server does the IO, the lib attaches the source

`GET /api/change/{issue}` returns raw text plus the path it came from; the pure
parsers attach `{path, line}` to every card and row they emit. So every drawer
field is one of:

```js
{ ok: true,  value: <rendered value>, source: { path: 'openspec/changes/issue-881-…/spec.md', line: 12 } }
{ ok: true,  value: <rendered value>, source: { url:  'https://github.com/o/r/pull/957' } }
{ ok: false, reason: '<why>',         source: { path: '…' } }
```

The `{ok, value} | {ok, reason}` vocabulary is #879's (`design.md:8-15`), with
`source` added. A3 is then a **property test, not a screenshot**: for the fixture
change, every object the four tab shapers emit has a non-empty `source` with a
`path` or a `url`. No DOM, no browser.

The `spec.md` grammar the parser reads — `### R<issue>-<n>: <title>` then
`#### Scenario: <name>` then `- **WHEN** … **THEN** …` — is new work; no reader
for it exists (`explore.md:181-187`, `readChanges` reads `tasks.md` only,
`snapshot.mjs:143-174`).

`resume.md` frontmatter is the one parse the **server** does, because
`parseFrontmatter` already exists (`resume-frontmatter.mjs:27-104`, pure, never
throws) and duplicating its grammar in `ui/lib` would be a second reader of one
format. `resume-view.mjs` receives the already-parsed object and shapes the three
fields.

### D12 — Working memory: the object store, ruling 3

The tab reads `git show <branch>:resume.md` through an injected `_run` with the
same signature `snapshot.mjs:272` uses (`(file, args) => execFileSync(file, args,
{cwd: root, encoding: 'utf8', stdio: ['ignore','pipe','ignore']})`). It never
reads a worktree's working tree.

Branch resolution, in order, each step's outcome shown in the tab:

1. `current.prs.value` row whose `issue === N` → its `headBranch`
   (`snapshot.mjs:234`, `issueOfBranch`). Source: the PR.
2. No such PR → `git branch --list 'feat/issue-<N>-*'`. Exactly one match → use
   it. Zero → *"no open PR and no `feat/issue-<N>-*` branch in this clone."*
   More than one → list them and render none, rather than picking.
3. Branch found, no `resume.md` in it → *"no committed `resume.md` on
   `<branch>`. The uncommitted working tree is slice 5 / #883."*

Rendered fields are `resume-schema.mjs:19`'s `next_action`, `current_slice`,
`blockers`. `validateResume` is **not** used as a gate: `resume.md` is an
operational artifact where staleness is expected and it is never a gate
condition (`AGENTS.md:388-395`). A missing field renders as
`{ok: false, reason: "resume.md on <branch> has no next_action"}` beside the
fields that are present. The source is `{path: "<branch>:resume.md"}` — the
object-store path, which is literally where the bytes came from.

### D13 — per-task attribution from blame, labelled for what it is

Stated and justified under Q2. One `git blame --porcelain` per drawer open,
parsed by `ui/lib/blame.mjs`, displayed as "last touched by <author> on <date>
(<sha[0..7]>)".

### D14 — Reviews: the snapshot's verdicts, sourced to the PR

Rows come from `current.reviews.value[pr].verdicts`, **oldest first** — which is
the array order `reviewRows` builds (`snapshot.mjs:126-137`, pushed in
`prReviews` order) — each carrying `{rev, verdict, author, head_sha, findings,
malformed}`. The source is the PR URL, `https://<host>/<project>/pull/<pr>`,
built from `project` served by `/api/meta` (the snapshot carries no `project`
key, and adding one would change #879's contract).

A per-round anchor is **not** available: `prReviews` returns
`{state, author, body}` and drops `id`, `html_url` and `submitted_at`
(`github.mjs:564`). Surfacing one would mean widening the provider verb *and*
`reviewRows`'s projection — a change to a module that shipped days ago, for an
anchor. Rejected here. The round is identified in the UI by `rev` and the short
`head_sha`, which is how the reviewer protocol already names rounds.

The tab carries the caveat ruling 4 requires, verbatim in the UI:
*"source: forge comments, until #880 lands `type: review` records."* When #880
lands the source line changes and `records[].file` gives per-round pointers for
free (`issue-879…/design.md:29-36`).

### D15 — lifecycle

`parseArgs` copies `snapshot-cli.mjs:18-34` exactly: a manual loop, explicit
flags (`--port`, `--root`, `--interval`, `--no-poll`), `{ok: false, error}` on
anything unknown, **exit 2**. `EADDRINUSE` prints
`✗ port <n> is already in use` and **exits 2** as well — same class of "the
operator gave me something I cannot use", same code.

`SIGINT`/`SIGTERM`: stop the poll timer, `close()` every watcher, `end()` every
open SSE response, close the listener, exit 0. Without the SSE `end()` the
process hangs on open sockets — in production on Ctrl-C, and in `node --test`
as a test that never finishes.

The server binds **`127.0.0.1` by default**, not `0.0.0.0`. Remote mode and
access control are slice 7 (`proposal.md:58`); a local UI that listens on every
interface is a remote UI with no access control.

### D16 — `engines: {"node": ">=22"}`

Stated and justified under Q4.

---

## Data shapes

**SSE frames.**

```
event: sync
data: {"generatedAt":"2026-09-14T…","snapshot":{…the whole current snapshot…},
       "meta":{"project":"o/r","forgeAsOf":…,"watcher":{…},"poller":{…}}}

event: section
data: {"name":"graph","section":{"ok":true,"value":{…}},
       "generatedAt":"…","cause":"poll"}

event: refs
data: {"worktree":"/home/gandalf/IA/brain-issue-881","head":"feat/issue-881-…",
       "at":"2026-09-14T…"}

event: status
data: {"watcher":{"ok":false,"reason":"ENOSPC…","watched":0,"failed":["…"]},
       "poller":{"enabled":true,"lastOkAt":"…","lastError":null,
                 "callsThisHour":600,"forgeAsOf":{"issues":"…","bodies":"…","reviews":"…"}}}
```

`cause` is `"poll"` or `"watch:<relative path>"` — provenance for the *event*,
not just for the values, so a reviewer watching the stream can tell which
mechanism fired.

**Drawer field.** `{ok, value|reason, source: {path, line?} | {url}}` (D11).

**Layout output.**

```js
{
  layers: [[881, 879], [882, 884]],                       // node numbers, top layer first
  nodes:  { 881: { x, y, w, h, layer: 0, order: 0 } },
  edges:  [{ from: 879, to: 881, reversed: false, points: [{x,y},{x,y}] }],
  width, height,
  unlinked: [ …node numbers with no edge, laid out in the trailing band… ]
}
```

---

## Test plan, mapped to acceptance

| # | Statement | Test |
|---|---|---|
| A1 | one node per open issue; activating it opens spec + tasks | `layout.test.mjs`: every `graph.value.nodes` number appears exactly once across `layers` ∪ `unlinked`, for a fixture including an `unreadable` node and a `?`-track node (ruling 1). `spec-cards.test.mjs` / `tasks-list.test.mjs`: the fixture `spec.md`'s requirements and scenarios, and `tasks.md`'s `- [x]`/`- [ ]`/`- [X]` lines, parse to the expected cards. `change-route.test.mjs`: `GET /api/change/881` returns both texts with their paths. |
| A2 | a commit or a label change moves the canvas within one interval, no reload | `watcher.test.mjs`: injected `_watch` fires a `<git-common>/worktrees/x/logs/` event → exactly one debounced recompute, one `refs` frame, zero `gh` calls. `poller.test.mjs`: a label moving in the stub's `issueList` → the fast lane sees it on the next tick → `graph` section differs → one `section` frame. `server.test.mjs`: the SSE reader (Q4) observes `sync` then `section` after a simulated event. |
| A3 | every drawer value carries its path or URL | Property test over the four shapers: for the fixture change, every emitted object has `source.path` or `source.url`, non-empty. No DOM. |
| A4 | `GET /api/snapshot` deep-equals in-process `buildSnapshot()` | `server.test.mjs`: same fixture root, same injected `_now`, same cache-only port → `assert.deepEqual`, the pattern of `snapshot-cli.test.mjs:16-28` over HTTP instead of stdout. |
| A5 | no write verb is reachable | `readOnlyPort()` (`snapshot.test.mjs:16-23`) wrapping the stub reads: every route and a full poll cycle run without throwing. Plus: the `forge-cache` object exposes exactly four keys (D1), asserted; and every mutation method returns 405 on every non-control route, the three `/api/poll/*` control routes accept `POST` only, and a `POST /api/poll/pause` leaves the served root, the refs and the forge stub untouched (D7). |

Cross-cutting: a source-guard test asserting no file under `ui/lib/**` imports
outside `ui/lib/**` (D9), and a layout determinism test asserting two runs over a
shuffled input array produce identical output.

Fixtures extend `brain/scripts/__fixtures__/snapshot-tree.mjs` rather than
defining a second tree; a richer multi-worktree tree goes in a sibling
non-`.test.mjs` module for the reason documented at the top of that file
(`explore.md:230-237`).

---

## Delivery seam

`lite`, 1,000 changed lines per PR (`governance-tiers.mjs:273-275`,
`brain.config.json:15-17`). The proposal's two-PR seam does not fit; the
arithmetic:

| PR | Contents | Source | Tests | Total |
|---|---|---|---|---|
| **A1 — the server serves the read model** | `server.mjs` (routes, static, argv, signals, 405), `forge-cache.mjs`, `diff.mjs`, `package.json` (`brain:ui`, `engines`) | ~300 | ~260 | **~560** |
| **A2 — the server notices** | `watcher.mjs`, `poller.mjs`, SSE hub + `/api/poll/*`, `refs`/`status` frames | ~280 | ~300 | **~580** |
| **B1 — the pure page logic** | `lib/layout.mjs`, `spec-cards.mjs`, `tasks-list.mjs`, `blame.mjs`, `resume-view.mjs`, `colour.mjs`, `change-route.mjs` | ~420 | ~380 | **~800** |
| **B2 — the page** | `static/index.html`, `app.js`, `app.css` — SVG rendering, drawer, four tabs, poll controls, degradation bands | ~400 | ~40 | **~440** |

Total ≈ 2,380, consistent with the exploration's 900–1900 forecast at the upper
end (`explore.md:365-395`) once the four-lane poller, the blame reader and the
405 surface are counted.

**Review Workload Forecast — chained PRs recommended: yes.** Four PRs, each
under the 1,000-line budget, each independently reviewable: A1 is reviewable
against A4/A5 alone; A2 against A2's mechanism with no canvas; B1 is pure
functions with no IO; B2 is DOM glue that a reviewer reads rather than tests. The
order is a strict chain — B1 needs A1's route contract, B2 needs both.

**Rollback.** Additive: one new directory and two `package.json` keys. No
existing verb, module or return shape changes.

---

## Risks left open

1. **Recompute cost per event.** Each debounced event re-reads > 100 change dirs'
   `tasks.md` plus ~2,300 record files (`snapshot.mjs:143-182`). Unmeasured. If a
   recompute exceeds the 250 ms debounce the page stays correct but lags;
   recomputes are serialised so it can never pile up. Mitigation if measured
   slow: section-scoped recompute keyed on which directory fired — deferred
   because it needs a path→section map that would duplicate `buildSnapshot`'s own
   read set.
2. **`mrList` is not paginated** (`github.mjs:458` — no `--paginate`, unlike
   `issueList` at `:442` and `prReviews` at `:560`). Beyond 100 open PRs it
   returns a silent prefix, the exact defect #459 fixed on the other two verbs.
   Not this slice's to fix; the poller inherits it, and `P = 3` today.
3. **Body-fact staleness is up to 18 minutes** with no corroborating signal
   (Q1). If an issue's `brain-graph/1` block is edited and nothing else about the
   issue moves, the canvas's edges are that stale. The UI states
   `forgeAsOf.bodies`; it does not hide it.
4. **The hand-rolled layout is the largest unfamiliar piece** (ruling 5, risk
   accepted in `proposal.md:167-170`). Mitigated by purity and determinism; a
   crude but stable layering is accepted for v1.
5. **`recursive: true` is avoided on evidence of version-dependence, not on a
   measurement.** Not verified in this phase (no shell). If per-directory
   watchers prove unwieldy at > 100 dirs, revisit with `process.version` in hand.
6. **The issue bodies of #881 and #878 are still second-hand** — read through
   `explore.md`'s quotations in all three phases so far. The tasks phase should
   run `gh issue view 881 878` before cutting tasks, per the proposal's own note
   (`proposal.md:172-174`).
7. **`POST` on the poller controls** (`/api/poll/pause|resume|once`, D7) is the
   first mutation method this repo's servers accept. It writes nothing to brain,
   but a reviewer reading the ticket's "no POST" literally will stop on it, so
   the PR description names the ruling of 2026-09-14 and the test that proves
   nothing under the served root, the refs or the forge changed.
