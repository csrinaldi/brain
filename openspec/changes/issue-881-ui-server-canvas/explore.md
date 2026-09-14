# Exploration — issue-881: local server (HTTP snapshot + SSE) and the DAG canvas with inspector drawer

## Context

Parent epic #878 (Brain UI). Wave A (data) shipped: #879 (snapshot read model,
merged as part of #953) and #880 (review rounds as `type: review` memory
records — status not directly verified in this pass, assume landed per epic
sequencing "needs: [879]" only, not "needs: [880]"). #881 is Wave B, slice 3:
owns `brain/scripts/ui/server.mjs`, the SPA's DAG canvas, and the inspector
drawer (Spec / Tasks / Working memory / Reviews tabs). No POST verbs. No HTTP
server exists in brain today.

## Current state (file:line)

### The snapshot module (#879 / #953)

- `brain/scripts/status/snapshot.mjs:265-307` — `buildSnapshot({root, now, vcs,
  project, _read, _list, _exists, _run})` returns exactly:
  `{generatedAt, tier: "committed", governanceTier, graph, changes, prs,
  reviews, records, adrs, antiPatterns, actors, releaseDebt, drift}`.
  Every section is `{ok:true, value}` or `{ok:false, reason}` (never `[]`/`null`
  on failure) — built with `field`/`uncomputable` from `report.mjs`.
- Graph node shape (`epic-graph.mjs:394-407`, extended by
  `snapshot.mjs:211-213,289`): `{number, title, labels, state, track, files,
  declared, sources, assignees, blockedBy, status}` plus, per node,
  `roadmap: {ok, value:{state: planned|in-flight|done, evidence}}`
  (`snapshot.mjs:71-83`, `roadmapState()`). An issue whose body could not be
  read gets `status: "unreadable"`, `declared: null`, `ok:false` — never the
  empty-body-looks-like-no-declaration bug (`snapshot.mjs:211-213`,
  `evidence-reader-empty-on-failure` anti-pattern, cited at `design.md:44-51`
  of #879).
- `changes[]` (`snapshot.mjs:143-174`, `readChanges()`): one row per
  `openspec/changes/issue-<N>-<slug>/` dir — `{id, issue, slug, dir,
  grandfathered, missing, tasks, sliceScopes}`. `tasks` comes from
  `deriveTasks()` (`derive.mjs`) over `tasks.md`'s raw text; `sliceScopes` from
  `parseSliceScopes()` (`sdd-layout.mjs`) reading the `brain-slice-scope/1`
  JSON fence (see `openspec/changes/issue-879-snapshot-read-model/tasks.md:8-10`
  for a live example).
- `records[]` (`snapshot.mjs:114-123,177-182`, `projectRecord()`): index
  metadata only — `{id, ts, actor, actorKind, type, issue?, supersedes?,
  title?, file}` — `content` stays in the file the record points at
  (`file: ".memory/records/<name>.jsonl"`). The inspector's "Working memory"
  and any record-backed view must follow `file` to read prose, never inline it
  in the snapshot (design D3, `design.md:27-36`).
- `reviews` (`snapshot.mjs:125-138,239-255`, `reviewRows()`): one row per open
  PR, `{pr, ok, verdicts[], latest}`, built by parsing every `prReviews`
  comment with `parseVerdict()` (`review/lib/parse-verdict.mjs`) — this
  already returns EVERY posted round per PR, oldest first via the array order,
  not just the latest. The RFC's "latest-only until #880" is a UI/board
  choice, not a port limitation (`design.md:107-109`, "the snapshot carries
  the parsed verdicts prReviews returns, which on GitHub is every posted
  review"). Confirm #880's landing state before assuming `type: review`
  records exist as an alternative Reviews-tab source; issue #881 says "needs
  #880" only for the multi-round tab, and the epic's dependency graph lists
  #881 `needs: [879]`, not `[880]` — so the Reviews tab must work with
  `latest`-only from `reviews.value` even if #880 has not merged.
- `adrs`/`antiPatterns`/`actors`/`releaseDebt`/`drift` — out of scope for
  #881's canvas/inspector (owned by #882's management views), present in the
  snapshot but the drawer per issue #881 only reads Spec/Tasks/Reviews/Working
  memory.

### CLI, VCS port, and tier resolution

- `brain/scripts/status/snapshot-cli.mjs:36-51` (`main()`) — resolves
  `--json`/`--now`/`--root`, calls `buildSnapshot`, prints
  `JSON.stringify(snapshot, null, 2)` or `renderSnapshotText(snapshot)`.
- `brain/scripts/status/snapshot-cli.mjs:54-69` — the CLI-only guard: when run
  as `node snapshot-cli.mjs` (not imported, and no `--root`), it does
  `const { getVcs } = await import('../vcs/cli.mjs'); vcs = await getVcs();
  project = originIdentity()?.project ?? null;` wrapped in try/catch so import
  never crashes on a fixture with no remote. This is the exact pattern
  `server.mjs` should reuse for `GET /api/snapshot`: import `buildSnapshot`
  in-process, resolve `vcs`/`project` once (or per-request — see Open
  Questions), never shell out.
- `getVcs()` (`brain/scripts/vcs/cli.mjs:128-151`) resolves the provider name
  from `brain.config.json`'s `vcs.provider` (here `"github"`,
  `brain.config.json:12-14`), dynamically imports
  `./providers/<name>.mjs`, and binds every exported function to a credential
  identity via `bindIdentity()` (`cli.mjs:166-175`) if one is available
  (`VCS_TOKEN`/explicit `identity`). There is no separate "read-only port"
  constructor in production code — `readOnlyPort()` at
  `snapshot.test.mjs:16-23` is a TEST-ONLY helper that wraps a stub with every
  write verb (`mrCreate`, `issueCreate`, `labelAdd`, `branchProtect`, etc.)
  throwing, used to PROVE the composition never calls a write verb. #881's own
  tests should copy this pattern for the server's forge poller, not invent a
  new "read-only" concept in the port itself.
- Tier: `resolveTier(JSON.parse(read('brain.config.json')))`
  (`snapshot.mjs:276`) → `"lite"` here (`brain.config.json:15-17`). Governance
  diff budget for `lite` is 1000 changed lines
  (`brain/scripts/vcs/governance-tiers.mjs:273-275`, `TIER_PARAMS.lite.diffBudget`).

### Dependency policy — measured, not assumed

- `package.json` (`/home/gandalf/IA/brain-issue-881/package.json`) has no
  `"dependencies"` key at all — only `"devDependencies"`-free `"scripts"`,
  `"bin"`, `"files"`. Confirmed zero runtime deps.
- Explicitly stated in two prior design docs (both quoted verbatim, not
  paraphrased):
  - `openspec/changes/issue-337-efficacy-probes/design.md:32` — "brain has
    **zero runtime dependencies** (package.json)."
  - `openspec/changes/issue-509-promote-amendments/design.md:41` — "...the
    repo has zero runtime dependencies and this is not the change that adds
    one."
  - Also enforced in spirit at `brain/scripts/review/lib/parse-verdict.mjs:3`
    ("zero npm deps") and `brain/scripts/vcs/substrate.mjs:351` ("brain has
    zero runtime dependencies; line-scan the `on:` block" instead of parsing
    YAML with `js-yaml`).
- No ADR or the RFC (`docs/inbox/visual-task-graph-and-realtime-dashboard.md`)
  says anything about a browser-side CDN script or a vendored client-side
  library. The zero-deps statements above are about `package.json`
  `dependencies` (server/build-time, npm-resolved) — a `<script src="https://
  cdn...">` tag in a static HTML page would not touch `package.json` and is
  not literally covered by the same sentence. Nothing in `check-refs-rules.mjs`
  bans CDN URLs either (checked, no match). This is a genuine gap: the
  doctrine that exists forbids an npm dependency, and does not explicitly
  rule on runtime network fetches of third-party JS from a browser. Treat this
  as an **open question for the proposal**, not a decided constraint — my
  reading is that a CDN script contradicts the project's self-hosted,
  offline-capable, deterministic character even where no doctrine sentence
  names it, but that is a judgment call, not a citation.

### No HTTP server precedent

- `brain/scripts/brain-protect-server.mjs` is NOT an HTTP server — it installs
  a `pre-receive` git hook into a bare repo (`installPreReceiveHook()`,
  lines 20-91). Confirmed via read: no `http.createServer`, no listen socket.
- Grep for `createServer`/`http.createServer`/`fs.watch` across
  `brain/scripts/**`: zero matches anywhere in the tree. #881 is the first
  long-running network server and the first filesystem watcher brain will
  have. No precedent to follow for signal handling, port binding, or logging
  conventions — these are new decisions for the proposal/design phase.

### Worktree / commit-change discovery precedent

- `brain/scripts/memory/lane/collect.mjs:105-129` — `parseWorktrees()` parses
  `git worktree list --porcelain` into `{path, bare, prunable}` stanzas; used
  by the memory-lane collector to enumerate worktrees before scanning each
  one's `.memory/records/` candidates (`collect.mjs:219-221`, one
  `worktree list --porcelain` call, "D6 cost control").
- RFC §2.3 and issue #881's own scope note (Tier 2 / local overlay) put
  reading a worktree's UNCOMMITTED working tree in slice 5, not slice 3. But
  acceptance criterion 2 of #881 explicitly requires: "A commit in any
  worktree ... updates the canvas within one poll interval, without reload."
  A commit is a COMMITTED-tier event (a new object in the shared git object
  store, visible via `.git/worktrees/<name>/HEAD` or a ref update), distinct
  from uncommitted file edits. The watcher #881 needs therefore watches for
  NEW COMMITS across worktrees (ref/HEAD changes), not file contents — this
  keeps it inside Tier 1 and does not require slice 5's local-overlay reader.
  `.git/worktrees/*/HEAD` files change on every commit in that worktree
  (confirmed structurally: this very worktree's `.git` file at
  `/home/gandalf/IA/brain-issue-881/.git` points at
  `/home/gandalf/IA/brain/.git/worktrees/brain-issue-881`, and each worktree
  has its own `HEAD` under that path) — watching those N small files (or the
  parent `.git/worktrees/` dir non-recursively) is far cheaper than a
  recursive watch of every worktree's full tree, and it never touches
  uncommitted content.
- No `fs.watch` usage anywhere in the current tree (confirmed via grep) — #881
  is greenfield here too.

### Forge polling

- Port verbs available per `readForge()` (`snapshot.mjs:184-255`):
  `vcs.issueList({project, state:'open'})`, then one `vcs.issueView({project,
  number})` PER OPEN ISSUE, `vcs.mrList({project, state:'open'})`, then one
  `vcs.prReviews({project, number})` PER OPEN PR. No batch/GraphQL verb, no
  documented rate limit or caching layer in the port (`vcs/cli.mjs`,
  `vcs/providers/github.mjs` — not fully read this pass, but no cache
  wrapper is imported by `snapshot.mjs`).
- #879's own tasks.md leaves a micro-decision on record: "`issueRelations`
  not read in this slice — two calls per issue; #881's poller owns its
  budget (D4)" (`openspec/changes/issue-879-snapshot-read-model/tasks.md:29-30`).
  This is a direct, named handoff: #881 must decide the poll interval and
  whether every poll re-runs the full O(issues + PRs) fan-out or does
  something cheaper (e.g., only re-fetch `issueView`/`prReviews` for numbers
  whose list-level ETag/updated-at changed — no such field is confirmed
  present in the port's return shape from what was read this pass; verify in
  proposal/design before assuming it exists).

### Spec/tasks/resume parsing conventions

- `spec.md` requirements: `### R<issue>-<n>: <title>` headings, each followed
  by `#### Scenario: <name>` blocks with `- **WHEN** ... **THEN** ...` bullets
  (`openspec/changes/issue-879-snapshot-read-model/spec.md:10-49`, sampled).
  No existing parser turns this into structured cards — #881's "Spec —
  requirements and scenarios as cards, deterministic parser" is NEW work, not
  reuse of an existing reader. `readChanges()` reads `tasks.md`, not
  `spec.md` — confirmed (`snapshot.mjs:143-174` has no `spec.md` read).
- `tasks.md` checked-task pattern: `- [x] T1. ...` / `- [ ] T5. ...`
  (`AGENTS.md` "Checked-task pattern" section, `sdd-layout.md` excerpt at
  `AGENTS.md:375-379`: "`- [ ]` (pending) and `- [x]` (done), matched
  case-insensitively"). The live example
  (`openspec/changes/issue-879-snapshot-read-model/tasks.md:12-24`) shows
  tasks WITHOUT an inline actor/timestamp per line — `deriveTasks()`
  (`derive.mjs`, not fully read) evidently derives whatever structure
  `snapshot.mjs:169` exposes as `tasks: Object.fromEntries(tasks.fields)`.
  Issue #881's acceptance criterion asks for "actor and timestamp per
  completed item" in the inspector — verify in design phase whether
  `deriveTasks()`'s current output already carries per-task actor/timestamp,
  or whether that requires widening `derive.mjs` (not confirmed either way
  this pass — needs a dedicated read of `derive.mjs` before the design phase
  commits to a shape).
- `resume.md` schema: `brain/scripts/memory/lib/resume-schema.mjs:19` —
  `REQUIRED_FIELDS = ['next_action', 'current_slice', 'blockers']`,
  `blockers` validated as an array. This is the exact three-field shape the
  "Working memory" tab should render. `resume.md` is explicitly NOT part of
  the snapshot (`sdd-layout.md`'s `OPERATIONAL_ARTIFACTS`, `AGENTS.md:388-396`)
  — the drawer must read it directly by path, and per #881's acceptance
  criterion 3 ("every drawer value is traceable to a file path"), the tab
  should show the literal `resume.md` path it read.

### `brain:` script naming and JSON parsing convention

- `package.json:98-99` — `"brain:status": "...status/cli.mjs"`,
  `"brain:snapshot": "...status/snapshot-cli.mjs"`. `brain:ui` does not exist
  yet; `npm run brain:ui` would be a new script entry
  `"brain:ui": "node ./brain/scripts/ui/server.mjs"`, matching the
  `brain:<noun>` convention already used for every other long-running/verb
  script.
- `snapshot-cli.mjs:18-34` (`parseArgs`) shows the argv-parsing convention:
  manual `for` loop over `argv`, explicit flags, `{ok:false, error}` on an
  unknown flag, exit code 2. `server.mjs` should follow the same shape for
  its own flags (e.g. `--port`).

### Test conventions

- `node:test` throughout, files named `*.test.mjs`, colocated with source.
- Tmp-dir hygiene: `brain/scripts/lib/test-tmp.mjs` — `testTmp(prefix)`
  (`test-tmp.mjs:35-38`) creates one per-run root
  `brain-test-<pid>-*` under `os.tmpdir()`, registered for removal on
  `process.on('exit', ...)`; `test-hygiene.mjs` (the `pretest` npm script)
  sweeps roots left by dead PIDs (SIGKILL survivors) — this is issue #842's
  mechanism. `snapshot-tree.mjs` (`brain/scripts/__fixtures__/snapshot-tree.mjs`)
  is the shared fixture for snapshot tests — a plain module (not a `.test.mjs`)
  because importing a test file for its helper re-runs every test it declares
  (documented at the top of that file, measured "23 results for 13 tests").
  A `server.test.mjs` fixture for #881 should follow the same non-test-module
  convention if it needs a richer tree (e.g. multiple worktrees).
- No `GIT_CONFIG_GLOBAL=/dev/null` reference found in the snapshot test files
  read this pass — may exist elsewhere in the suite but was not the pattern
  used by `snapshot.test.mjs`/`snapshot-cli.test.mjs`, so do not assume it is
  required for #881's own tests without checking scripts that actually spawn
  `git` commands under test.
- Spawn-and-compare parity pattern already exists and is exactly reusable for
  the server: `snapshot-cli.test.mjs:16-28` spawns the CLI with `spawnSync`,
  parses stdout JSON, and asserts deep-equal against an in-process
  `buildSnapshot()` call on the same fixture root and pinned `--now`. #881's
  task says "the test from #879 guarding shape parity" — this is that test;
  `GET /api/snapshot`'s handler should be testable the same way: start the
  server on port 0 (ephemeral), `fetch()` `/api/snapshot`, deep-equal against
  `buildSnapshot()` on the same fixture root/clock.
- No `undici` in devDependencies checked this pass (zero deps implies none) —
  global `fetch` (Node 18+, native) is the only available HTTP client for
  tests; no `engines` field pins a Node version in `package.json`, so confirm
  the CI Node version supports native `fetch`/`ReadableStream` body reading
  for SSE assertions before design commits to that approach.

## Constraints found (quoted doctrine)

- Rule zero (#878, quoted in issue #878's body): "Every fact the dashboard
  shows must be reconstructible from the repository plus the tickets. If a
  fact has no source there, the dashboard does not show it."
- RFC §5 (`docs/inbox/visual-task-graph-and-realtime-dashboard.md:265-278`):
  "'Real time' here is a watcher over the repo (worktrees, `.memory/`,
  `openspec/`) plus a polling loop over the forge, diffed against the
  previous snapshot. No heartbeats needed. ... WebSockets are not needed
  until tier 3; SSE covers one-directional diffs." Issue #881 restates this
  almost verbatim as its own scope line 1.
- Issue #881 body: "What this ticket must NOT become: A write surface. Slice 3
  has no POST." — hard constraint, no `mrCreate`/`issueCreate`/etc. should be
  reachable from `server.mjs` at all, provably (test with a write-throwing
  port, per `readOnlyPort()`'s pattern).
- AGENTS.md Tier 3 (`AGENTS.md:154-172`): agent must never "Commit directly to
  `brain/core/**` or `brain/project/**`". `brain/scripts/ui/**` is neither —
  it is implementation code under `brain/scripts/`, Tier 1 autonomous
  territory for an agent working an SDD change (`AGENTS.md:129-138`, "Create/
  modify files in `openspec/changes/**`" plus normal code editing is implied
  by the harness's SDD flow; `brain/scripts/**` is not named in Tier 2/3
  restrictions).
- Design D2 pattern from #879 (`design.md:17-25`, "pure core, injected
  edges"): `buildSnapshot` takes `_read`/`_list`/`_exists`/`_run` seams for
  testability; #881's server and watcher should follow the same seam
  discipline (inject `fs.watch`, the poll timer, and the VCS port) rather
  than hardcoding them, both for testability and to avoid a second untested
  side-effect surface.
- Governance: `lite` tier, 1000-line diff budget
  (`governance-tiers.mjs:273-275`; `brain.config.json:17`).

## Options with tradeoffs

### DAG canvas rendering

| Option | Pros | Cons | Effort |
|---|---|---|---|
| Hand-rolled SVG, longest-path layering + barycentre ordering | Zero deps — matches the measured zero-runtime-dependency convention exactly, no doctrine question to raise, fully offline, smallest attack surface, trivially testable (pure layout function over `{nodes, edges}` → `{x,y}` per node, no DOM needed for the layout math itself) | More code to write and own; a hand-rolled Sugiyama-style layered layout with barycentre ordering is a known but nontrivial algorithm (cycle-breaking, layer assignment, crossing minimization) — brain's own graph can have edge cycles reported as `divergences`/`UNCLASSIFIED` nodes that a naive DAG layout must tolerate without crashing | Medium-High |
| Vendored layout library (e.g. a single-file dagre/elk build checked into `brain/scripts/ui/vendor/`) | Proven, tested layout algorithm; less code to write and maintain | Directly tests the "zero runtime dependencies" doctrine even though it is vendored, not npm-resolved — publish allowlist (`_files_note` in `package.json`) and the drift-guarded `MANAGED_SCRIPT_KEYS`/publish tests were built around the current shape and would need review; adds a large third-party file with its own license to track; still needs an ADR-level ruling per the ADR-0032-style "declared vs. parsed" precedent this project uses whenever it adds a new convention | Low-Medium (implementation), High (doctrine/process cost) |
| CDN-hosted library loaded at runtime in the browser | Least code | Directly contradicts the project's committed-tier, reconstructible-from-the-repo, offline-capable character even though no doctrine sentence names browser CDNs specifically (see Dependency policy above) — a network failure or CDN outage would break the UI's rendering even when the repo/forge data is fine, which is the opposite of "silence falls back to tier 1/2" (RFC §2.4) | Low (implementation), High (doctrine risk — likely to be rejected) |

### Real-time mechanism

| Option | Pros | Cons | Effort |
|---|---|---|---|
| Single `fs.watch` recursive on the repo root + one forge poll timer, debounce, full-snapshot diff | Simplest to reason about — one watcher, one poll, one diff function; matches "diffed against the previous snapshot" (RFC §5) literally | `fs.watch({recursive:true})` is not reliable cross-platform (Linux support is version/backend-dependent — `inotify` limits on watch count for a large monorepo with many worktrees/`.memory/records/` files could be hit); watching the FULL repo root risks picking up Tier-2 uncommitted edits inside worktrees, which #881 must not surface (that is slice 5's job) — needs explicit exclusion of working-tree content, watching only `.git/worktrees/*/HEAD`-style commit markers, `openspec/changes/**`, and `.memory/records/**` on the MAIN checkout, not arbitrary worktree file content | Medium |
| Targeted watchers on `.git/worktrees/*/HEAD` (commit detection), `openspec/changes/**`, `.memory/records/**`, plus the existing forge poll; debounce; section-level diff | Cheaper (fewer watched paths, no risk of crossing into Tier-2 content), directly matches the "committed-tier only" boundary this slice must respect, section-level diff sends smaller SSE payloads | More watcher wiring code (N worktree HEAD files instead of one recursive watch — must also handle a worktree being added/removed while the server runs, i.e. re-scan `git worktree list --porcelain` periodically or on `.git/worktrees/` dir change) | Medium |

Recommendation direction (not a decision — proposal's call): targeted
watchers + section-level diff is the better fit for the stated Tier-1/Tier-2
boundary; full-snapshot diff is fine as a v1 simplification if the proposal
accepts recomputing the whole snapshot per event and just diffing the JSON
top-level keys (cheap, since `buildSnapshot()` already degrades per-section).

### SPA delivery

| Option | Pros | Cons | Effort |
|---|---|---|---|
| Static `index.html` + `app.js` (+ maybe `app.css`) served by `server.mjs` itself via `fs.readFileSync`/simple content-type map | No build step, no bundler dependency (matches zero-deps posture), trivial to test (serve and fetch), easy to keep dependency-free | Manual DOM/SVG code without a framework — more verbose UI code, no component model, no hot reload | Low-Medium |
| Inline HTML+JS (single file with embedded `<script>`) | Fewer files, simpler server routing (one route serves everything) | Harder to maintain as the SPA grows (canvas + drawer + 4 tabs), harder to test JS logic in isolation (would need to extract functions into a separate importable module anyway for `node:test` to exercise them without a DOM) | Low (short term), High (maintenance) |

Recommendation direction: separate `index.html`/`app.js`/`app.css` static
files, with the pure logic (layout math, snapshot diffing, drawer data
shaping) factored into plain `.mjs` modules importable both by the browser
(via `<script type="module">`) and by `node:test` — this is the only way to
unit-test the canvas/drawer logic without a browser, consistent with "Test
conventions" above (no browser test runner exists in this repo).

## Open questions for the proposal

1. **CDN/vendored library for DAG layout** — is a vendored (checked-in) layout
   library acceptable, or must the layout be hand-rolled to keep with the
   measured "zero runtime dependencies" posture? No ADR rules on this
   directly; the proposal should either get an explicit ruling or default to
   hand-rolled given the doctrine's clear direction on npm-resolved deps.
2. **#880 dependency for the Reviews tab** — confirm whether #880 (review
   rounds as `type: review` records) has landed before design commits to a
   dual-source Reviews tab (records-backed multi-round + `reviews.value`
   latest-only fallback). The epic's dependency graph only lists #881
   `needs: [879]`; the ticket body says the multi-round view itself needs
   #880 and must show latest-only with a stated caveat otherwise — verify
   #880's actual merge status before writing tasks.
3. **Forge poll budget** — #879's tasks.md explicitly hands #881 the decision
   on `issueView`/`prReviews` fan-out cost ("two calls per issue; #881's
   poller owns its budget"). What is the target poll interval, and does
   every poll re-run the full `buildSnapshot()` forge fan-out, or is there a
   cheaper incremental check (e.g., `issueList`'s `updated_at` per issue) to
   avoid one `issueView` per open issue every interval? This needs a read of
   the actual GitHub provider's rate-limit/caching behavior
   (`brain/scripts/vcs/providers/github.mjs`) before committing to a number —
   not done in this exploration pass.
4. **`deriveTasks()` per-task actor/timestamp** — does `derive.mjs`'s current
   `deriveTasks()` output already carry per-completed-task actor/timestamp
   (needed for the Tasks tab's acceptance criterion), or does this slice need
   to widen that function? Not confirmed this pass; read `derive.mjs`/
   `derive.test.mjs` before design.
5. **Watcher scope precision** — does watching `.git/worktrees/*/HEAD` alone
   catch every "a commit landed" case (e.g., a `git commit --amend`, a
   fast-forward merge in the main checkout `.git/HEAD` rather than a linked
   worktree), or does the watcher also need `.git/HEAD` on the primary
   checkout plus the linked worktrees' `HEAD` files? The primary checkout
   (`/home/gandalf/IA/brain`) is not itself inside `.git/worktrees/` — its
   `HEAD` lives directly under `.git/HEAD`. Both must be covered.
6. **Diff-budget seam** — one PR (server + SPA + canvas + drawer + tests) vs.
   two (server+stream+tests, then canvas+drawer). See below.

## Suggested first-slice boundary (review-workload forecast)

Governance budget here is `lite` / 1000 changed lines
(`governance-tiers.mjs:273-275`). Rough size estimate for #881's full scope:

- `server.mjs` (HTTP routes, SSE, watcher wiring, poll loop, port/signal
  handling): new file, likely 150-300 lines.
- A snapshot-diff module (section-level or whole-object diff for SSE
  payloads): 50-150 lines.
- Static `index.html`/`app.js`/`app.css` (DAG canvas layout math + SVG
  rendering + drawer with 4 tabs + spec/task/resume parsing for the drawer):
  likely the largest single piece, 400-800+ lines given a hand-rolled layout
  algorithm plus four inspector tabs.
- Tests: server route tests (snapshot parity, SSE smoke test), watcher tests
  (commit-detection with injected `_watch`), layout/diff pure-function tests,
  drawer data-shaping tests — likely 300-600 lines given the project's test
  density elsewhere (e.g. `snapshot.test.mjs` alone is hundreds of lines for
  a comparable-complexity module).

Combined estimate: plausibly 900-1900+ lines, which is at or over the
1000-line `lite` budget on its own, before counting `package.json`'s new
`brain:ui` script entry and any `brain/HOME.md`/doctrine touches. A natural
seam exists exactly where the ticket's own four numbered scope items split:
**PR A** — `server.mjs` (`GET /api/snapshot`, `GET /api/stream`, the watcher,
the forge poller, the read-only-port test) with no SPA at all (serves a
placeholder or 404 on `/`); **PR B** — the SPA: DAG canvas + inspector drawer
(Spec/Tasks/Working memory/Reviews tabs) consuming PR A's endpoints, plus the
shape-parity test explicitly called out in the ticket ("test from #879
guarding shape parity"). This split lets PR A land and be reviewed
independently of the (harder to review, more subjective) canvas/drawer UI
code, and matches the acceptance criteria: criterion 2 (poll-interval canvas
update) is testable once PR A's stream exists even before PR B's canvas
consumes it end-to-end in a browser.

## Ready for Proposal

Yes, with the five open questions above flagged for the proposal author to
either answer directly or explicitly defer to design. The snapshot contract,
dependency policy, and real-time mechanism are well-evidenced from the
codebase; the layout-library and #880-dependency questions are the two most
likely to change scope materially and should be resolved before tasks are
cut.
