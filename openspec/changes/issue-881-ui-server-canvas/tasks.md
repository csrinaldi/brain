---
status: draft
issue: 881
---

# Tasks — the local UI server and the DAG canvas (#881)

Strict TDD is active for this project (`npm test` = `node --test
"brain/scripts/**/*.test.mjs" "test/**/*.e2e.test.mjs"`). Every task that adds
behaviour is preceded by the task that writes its failing test. Chain
strategy (maintainer ruling, 2026-09-14, supersedes the stacked-to-main text
below): **feature-branch-chain** on the tracker `feature/brain-ui`. PR 1
(#964) is squash-merged into the tracker as `8d074e44`. PR *n* targets the
tracker branch once PR *n-1* is merged into it, or targets PR *n-1*'s branch
directly while that PR is still open. The tracker PR (#970, draft) is the
only PR in this chain that targets `main`, and it closes #881 once every
child PR has landed on the tracker.

## Ticket reconciliation

Read verbatim from `gh issue view 881` and `gh issue view 878` (risk 6 of
design.md, discharged here).

1. **"Slice 3 has no POST" (#881 body, "What it must NOT become").** Spec
   R881-5 and design D7 already read this, by the maintainer's ruling of
   2026-09-14, as "no write surface over brain's state" — the three poller
   timer controls (`/api/poll/pause|resume|once`) accept `POST` because they
   mutate an in-process timer, not the repo or the forge. This is not a fresh
   contradiction; it is already correctly captured in spec.md/design.md.
   Tasks below follow R881-5/D7 as written: every other route answers `405`
   to any mutation method, the three control routes answer `405` to
   everything except `POST`.
2. **Reviews tab source (#881 body, item 3).** The ticket body says: "one row
   per round from `type: review` records — needs #880; until it lands the
   tab shows the latest verdict only and says so." Spec R881-8 and design
   D14 — reading proposal.md ruling 4 (maintainer, 2026-09-14) — say the
   opposite: **all** posted review rounds, oldest first, parsed from the
   PR's forge comments, **today**, with **no dependency on #880**; the tab
   states its source is the forge until #880 lands `type: review` records.
   The epic (#878) sequencing table lists "#881 needs: #879" only, and
   marks #880 as informing the Reviews tab, not blocking it — consistent
   with ruling 4, not with the ticket body's older conditional. Spec/design
   are authoritative (they postdate and explicitly supersede the ticket
   text); tasks below implement "every round, today."
3. **Canvas grouping (#881 body, item 2: "DAG canvas (epics → features →
   task groups)").** Spec R881-6 / proposal ruling 1 define the node
   universe flatly: every open issue is one node, undeclared issues in the
   `?` track. Neither `epic-graph.mjs` nor `snapshot.mjs` carries an
   epic/feature/task-group tier concept; design D10's layering derives
   structure only from `{nodes, edges}` (`blockedBy`). Read as descriptive
   shorthand, not a distinct requirement — no task below builds a separate
   tiering concept beyond the layered DAG the spec already asks for.

No other divergence found between the ticket bodies and spec.md/design.md.

---

## PR 1 / A1 — the server serves the read model

```brain-slice-scope/1
{"slice": 1, "claims": ["R881-1", "R881-5"], "files": ["brain/scripts/ui/server.mjs", "brain/scripts/ui/forge-cache.mjs", "brain/scripts/ui/diff.mjs", "brain/scripts/ui/static/index.html", "package.json"], "terminal_pr": "this PR -> main"}
```

Estimated: ~300 source, ~260 test, **~560 total**. Closes R881-1 (all
scenarios), R881-5 (mutation-method 405 on the routes that exist in this
PR — the three control routes do not exist yet).

- [x] T1a. `brain/scripts/ui/forge-cache.test.mjs`: failing test for the
      cache-only port — exposes exactly the four read verbs `readForge`
      calls (`issueList`, `issueView`, `mrList`, `prReviews`), a cache miss
      throws `the first forge poll has not completed`, a filled entry is
      served from the `Map` with no re-fetch (D1).
- [x] T1b. `brain/scripts/ui/forge-cache.mjs`: implement the memoising
      cache-only port so T1a passes.
- [x] T2a. `brain/scripts/ui/diff.test.mjs`: failing test for the
      section-level diff — `isDeepStrictEqual` over the snapshot's
      top-level keys, `generatedAt` and `tier` excluded from comparison, a
      changed section returned in full (Q5).
- [x] T2b. `brain/scripts/ui/diff.mjs`: implement the pure diff so T2a
      passes.
- [x] T3a. `brain/scripts/ui/server.test.mjs`: failing tests for —
      default port + static root (R881-1 S1: `GET /` on `localhost:3000`
      returns the static placeholder), ephemeral port (R881-1 S2:
      `--port 0` listens on an OS-assigned port and reports it), snapshot
      shape parity (R881-1 S3 / A4: `GET /api/snapshot` deep-equals
      in-process `buildSnapshot({root, now})` on a fixture root + pinned
      clock, extending `brain/scripts/__fixtures__/snapshot-tree.mjs`),
      and the read-only-port test (A5: `readOnlyPort()` from
      `snapshot.test.mjs:16-23`, composed through `forge-cache.mjs`, every
      route in this PR responds without throwing).
- [x] T3b. `brain/scripts/ui/server.mjs`: implement `createUiServer({root,
      vcs, project, _now})`, `listen(port)`, `close()`, `GET /` (static
      placeholder), `GET /api/snapshot` (in-process `buildSnapshot`
      composed with `forge-cache.mjs`, never shelling out) so T3a passes.
- [x] T4a. `brain/scripts/ui/server.test.mjs` (extend): failing test for
      R881-5 S1 on this PR's route set — `POST`/`PUT`/`PATCH`/`DELETE`
      against `/` and `/api/snapshot` all return `405`.
- [x] T4b. `brain/scripts/ui/server.mjs`: implement the method check before
      routing so T4a passes. (The guard was already present from T3b's
      implementation of D7's "method check before routing" invariant; RED
      was reproduced honestly by temporarily reverting the guard in the
      working tree, confirming the two new T4a assertions fail without it,
      then restoring it — see apply-progress for the transcript. The
      committed diff for this task is test-only.)
- [x] T5a. `brain/scripts/ui/server.test.mjs` (extend): failing test for
      `parseArgs` (`--port`, `--root`; unknown flag → `{ok: false, error}`
      / exit 2; `EADDRINUSE` → `✗ port <n> is already in use` / exit 2,
      D15) and a test reading `package.json` asserting `scripts["brain:ui"]
      === "node ./brain/scripts/ui/server.mjs"` and `engines.node ===
      ">=22"`. (`parseArgs`/`main`/`EADDRINUSE` production code already
      existed from T3b — see apply-progress; only the `package.json`
      assertion was genuinely red here.)
- [x] T5b. `brain/scripts/ui/server.mjs` + `package.json`: implement
      `parseArgs`, the `EADDRINUSE` handler, add `"brain:ui"` and
      `"engines": {"node": ">=22"}` to `package.json`, add
      `brain/scripts/ui/static/index.html` (placeholder — the real SPA
      ships in PR 4) so T5a passes.
- [x] T6. Verify: `GIT_CONFIG_GLOBAL=/dev/null npm test` and `npm run
      brain:repo:check` both green (confirms `managed-paths.test.mjs`'s
      10-entry `MANAGED_SCRIPT_KEYS` pin is untouched — `brain:ui` is a
      repo-local verb like `brain:snapshot`, not a managed key, same as
      #879's micro-decision).
- [x] T7. `npm run memory:save -- "brain:ui server serves the read model
      in-process" "<summary of forge-cache.mjs, diff.mjs, the 405 surface
      and the A4/A5 parity tests landed in this PR>" --issue 881 --type
      architecture`, staged with only the new `.memory/records/*.jsonl`
      file and `.memory/index.jsonl`. (`rec-b9a5a16c68582663`.)

**Done when**: `npm run brain:ui` (or `--port 0`) serves `/` and
`/api/snapshot`, every other verb returns `405`, A4 and A5 hold under test,
and no `gh` process, git write, or repo write happens on any request.

---

## PR 2 / A2 — the server notices

```brain-slice-scope/1
{"slice": 2, "claims": ["R881-2", "R881-3", "R881-4", "R881-5", "R881-9", "R881-10"], "files": ["brain/scripts/ui/watcher.mjs", "brain/scripts/ui/poller.mjs", "brain/scripts/ui/server.mjs"], "terminal_pr": "this PR -> main"}
```

Estimated: ~280 source, ~300 test, **~580 total**. Depends on PR 1 merged.
Closes R881-2, R881-3, R881-4, completes R881-5 (adds the three POST
control routes and their 405 boundary), R881-9 (watcher/poller failure
surfaced in `/api/meta` and the `status` SSE frame), and the R881-10 "no MCP
or heartbeat route" scenario over the now-complete route table.

- [x] T1a. `brain/scripts/ui/watcher.test.mjs`: failing tests for —
      an uncommitted working-tree edit produces no event (R881-3 S1: the
      watcher registers watches **only** for the Q3 table's enumerated
      directories — root, `brain/`, `brain/project/decisions/`, each
      `ANTI_PATTERN_DIRS` entry, `.memory/records/`, `openspec/changes/`,
      each `openspec/changes/issue-*/`, `<git-common>/`,
      `<git-common>/logs/`, `<git-common>/worktrees/`, each
      `<git-common>/worktrees/<n>/logs/` — and nothing else, which doubles
      as the R881-10 "no uncommitted content is ever read" scenario); a
      commit in a linked worktree is seen (R881-3 S2: an injected `_watch`
      firing on `<git-common>/worktrees/x/logs/` yields exactly one
      debounced recompute); a worktree `add`/`remove` event triggers a
      re-scan reusing `collect.mjs`'s `parseWorktrees()` stanza grammar; a
      simulated rebase (40 rapid HEAD moves) collapses to at most two
      recomputes, never forty (D5); a caught `fs.watch` failure
      (`ENOSPC`/`EPERM`/`ENOENT`) leaves the server running and shapes
      `{ok: false, reason, watched: <n>, failed: [<paths>]}` (Q3 "when the
      watcher fails").
- [x] T1b. `brain/scripts/ui/watcher.mjs`: implement directory watchers
      (non-recursive, no `recursive: true`) over the Q3 set, the 250 ms
      trailing debounce with serialised recompute (at most one queued
      follow-up), worktree re-scan, and per-directory failure handling so
      T1a passes.
- [x] T2a. `brain/scripts/ui/poller.test.mjs`: failing tests for — unchanged
      issues cost nothing on the next poll (R881-4 S1: N unchanged
      `issueList` rows issue zero `issueView` calls on tick 2); disable and
      manual poll (R881-4 S2: the timer stops firing when disabled, "poll
      now" still triggers exactly one poll, and two `/once` calls inside
      5 s collapse into one in-flight result, D7); last-polled state is
      visible after success or failure (R881-4 S3); the Q1/D2 call-count
      table over 30 simulated ticks with injected `{_setTimeout,
      _clearTimeout, _now}` — steady state `2 + min(P,10) + B` = 10
      calls/tick, cold start `1 + I + 1 + P`; a poll failure keeps the
      previous cache and sets `poller.lastError`/`lastOkAt` without
      emptying any section (R881-9 S2, D2).
- [x] T2b. `brain/scripts/ui/poller.mjs`: implement the fast lane
      (`issueList` + `mrList`), the review lane (`prReviews`, cap 10,
      round-robin), the body lane (`issueView`, cap 5 steady state plus up
      to 20 brand-new numbers in the tick they appear), pause/resume/once,
      and failure handling so T2a passes.
- [x] T3a. `brain/scripts/ui/server.test.mjs` (extend): failing SSE tests
      using the Q4 reader pattern (`AbortController`, `res.body.getReader()`,
      `TextDecoder`, ephemeral port) — initial connect gets the current
      state first (R881-2 S1: the first frame is `event: sync` carrying the
      whole snapshot, not a diff); a committed-tier change reaches the
      client (R881-2 S2: a watcher-triggered recompute+diff yields a
      `section` frame naming the changed section and its new value, plus a
      `refs` frame carrying `{worktree, head}`, within the debounce, no
      reconnect); a forge change reaches the client (R881-2 S3: a label
      moving in the poller stub's `issueList` produces a `section` frame
      naming `graph` on the next tick); `server.close()` ends every open
      SSE response before closing the listener (no hang under
      `node --test`, D15/Q4).
- [x] T3b. `brain/scripts/ui/server.mjs`: implement `GET /api/stream` (the
      SSE hub: `sync` first, then `section`/`refs`/`status` frames, no
      heartbeats, D6) wired to `watcher.mjs` and `poller.mjs`, and full
      `close()` teardown so T3a passes.
- [x] T4a. `brain/scripts/ui/server.test.mjs` (extend): failing tests for —
      mutation methods rejected outside the poller controls (R881-5 S1,
      re-run over the now-complete route table including `/api/stream`);
      poller controls accept POST only (R881-5 S2: `POST /api/poll/pause`
      returns `{paused: true}` JSON with no repository file, git ref or
      forge object changed; `GET /api/poll/pause` returns `405`; same for
      `/resume` and `/once`); the read-only-port test re-run with the
      poller wired in — a full poll cycle plus every route completes with
      no write verb ever invoked (R881-5 S3 / A5, now covering the poller).
- [x] T4b. `brain/scripts/ui/server.mjs`: implement `POST
      /api/poll/pause|resume|once`, extend the method check so exactly
      these three routes accept `POST` only (`Allow: POST`) and every other
      route accepts `GET`/`HEAD` only (`Allow: GET, HEAD`) so T4a passes.
- [x] T5a. `brain/scripts/ui/server.test.mjs` (extend): failing tests for
      full D15 lifecycle — a simulated `SIGINT`/`SIGTERM` stops the poll
      timer, closes every watcher, ends every open SSE response, closes the
      listener, and exits 0 with no hang; `--no-poll` disables the timer
      entirely (composes with R881-4 S2); `--interval <n>` overrides the
      60 s default.
- [x] T5b. `brain/scripts/ui/server.mjs`: implement the signal handlers and
      the `--interval`/`--no-poll` argv extensions so T5a passes.
- [x] T6. `brain/scripts/ui/server.test.mjs` (extend): guard test for
      R881-10 S3 — inspect the now-complete route table (`/`,
      `/api/snapshot`, `/api/stream`, `/api/poll/pause|resume|once`) and
      assert there is no MCP resource route and no heartbeat/agent-pulse
      endpoint. Test-only; no production change expected.
- [ ] T7. Verify: `GIT_CONFIG_GLOBAL=/dev/null npm test` and `npm run
      brain:repo:check` both green.
- [ ] T8. `npm run memory:save -- "watcher, poller and SSE hub wire A2 into
      brain:ui" "<summary of the committed-tier watcher, the 3-lane poller,
      the sync/section/refs/status SSE frames and the POST-only control
      routes landed in this PR>" --issue 881 --type pattern`, staged with
      only the new `.memory/records/*.jsonl` file and `.memory/index.jsonl`.

**Done when**: a commit in any watched worktree or a forge label move
reaches a connected SSE client within one poll interval with no reload
(A2), disabling/triggering polling works from the three control routes,
and R881-5's 405 boundary holds over the full route table.

---

## PR 3 / B1 — the pure page logic

```brain-slice-scope/1
{"slice": 3, "claims": ["R881-6", "R881-7", "R881-8"], "files": ["brain/scripts/ui/lib/layout.mjs", "brain/scripts/ui/lib/colour.mjs", "brain/scripts/ui/lib/spec-cards.mjs", "brain/scripts/ui/lib/tasks-list.mjs", "brain/scripts/ui/lib/blame.mjs", "brain/scripts/ui/lib/resume-view.mjs", "brain/scripts/ui/change-route.mjs"], "terminal_pr": "this PR -> main"}
```

Estimated: ~420 source, ~380 test, **~800 total**. Depends on PR 2 merged
(reads the route contract PR 1/2 established; ships no DOM). Closes R881-6,
R881-7, and R881-8's data shaping (the SPA wiring that renders these tabs
ships in PR 4).

- [ ] T1a. `brain/scripts/ui/lib/layout.test.mjs`: failing tests for — same
      input, same output (R881-7 S1: two calls with the same `{nodes,
      edges}`, including a run over a shuffled input array, return
      byte-identical coordinates, D10 "rejected: a convergence loop"); a
      cycle does not crash or hide nodes (R881-7 S2: an edge set with a
      cycle from `divergences` still returns a coordinate for every node,
      no thrown error); the `blockedBy` orientation pin (every
      `n.blockedBy` member lands in a strictly smaller layer than `n`,
      D10 point 2); nodes with no edges land in the trailing `unlinked`
      band, never dropped (ruling 1 / R881-6 S1's node-universe guarantee,
      the layout half of it).
- [ ] T1b. `brain/scripts/ui/lib/layout.mjs`: implement the four passes —
      DFS cycle-breaking with `reversed: true` markers, longest-path
      layering, exactly 4 fixed barycentre sweeps (ties break on issue
      number), coordinates plus bounding box — so T1a passes.
- [ ] T2a. `brain/scripts/ui/lib/colour.test.mjs`: failing tests for — no
      node is filtered away (R881-6 S1: a 90-node fixture including
      undeclared `?`-track and `unreadable` nodes all receive a colour
      class); roadmap not computed is never mistaken for planned (R881-6
      S2: `roadmap: {ok: false, reason}` gets a distinct "not computed"
      mark); blocked overrides state colour (R881-6 S3: `planned` +
      open `blockedBy` renders the blocked mark, not plain `planned`); the
      exhaustive map test importing all eight `roadmap.value.state` /
      `node.status` constants from `snapshot.mjs`/`epic-graph.mjs` and
      asserting every one maps to a class (D9 note — a renamed constant
      fails this test instead of painting a node grey).
- [ ] T2b. `brain/scripts/ui/lib/colour.mjs`: implement the state/status →
      CSS-class map so T2a passes.
- [ ] T3a. `brain/scripts/ui/lib/spec-cards.test.mjs`: failing test parsing
      a fixture `spec.md`'s `### R<issue>-<n>: <title>` /
      `#### Scenario: <name>` / `- **WHEN** … **THEN** …` grammar into
      requirement/scenario cards, each carrying `{path, line}` (R881-8's
      Spec-tab shape, D11).
- [ ] T3b. `brain/scripts/ui/lib/spec-cards.mjs`: implement the
      deterministic parser so T3a passes.
- [ ] T4a. `brain/scripts/ui/lib/tasks-list.test.mjs`: failing test parsing
      a fixture `tasks.md`'s `- [ ]`/`- [x]`/`- [X]` lines (case-
      insensitive, mirroring `AGENTS.md:377-379`) into checklist items with
      line numbers (R881-8's Tasks-tab shape).
- [ ] T4b. `brain/scripts/ui/lib/tasks-list.mjs`: implement the pure line
      parser so T4a passes.
- [ ] T5a. `brain/scripts/ui/lib/blame.test.mjs`: failing test parsing a
      fixture `git blame --porcelain` text (injected, no shell inside
      `lib/`) into per-line `{author, authorTime, sha}` (Q2/D13); a
      malformed/absent blame input yields `{ok: false, reason}` per item,
      never a blank.
- [ ] T5b. `brain/scripts/ui/lib/blame.mjs`: implement the pure porcelain
      parser so T5a passes.
- [ ] T6a. `brain/scripts/ui/lib/resume-view.test.mjs`: failing test
      shaping an already-parsed frontmatter object into the three
      ruling-3 fields (`next_action`, `current_slice`, `blockers`, D12); a
      missing field renders `{ok: false, reason: "resume.md on <branch>
      has no next_action"}` beside the fields that are present; confirms
      `validateResume` is not used as a gate.
- [ ] T6b. `brain/scripts/ui/lib/resume-view.mjs`: implement the shaper so
      T6a passes.
- [ ] T7a. `brain/scripts/ui/change-route.test.mjs`: failing tests for —
      full drawer for a change with a spec and tasks (R881-8 S1: `GET
      /api/change/881` returns `spec.md` and `tasks.md` raw text with their
      paths); no change dir (R881-8 S2: both tabs get "no change dir" +
      the expected path, not an empty card); no committed `resume.md`
      (R881-8 S3: branch resolution — a PR row's `headBranch` first, else
      exactly one `feat/issue-<N>-*` match, else "no open PR and no
      `feat/issue-<N>-*` branch"; more than one match lists them and
      renders none; a resolved branch with no `resume.md` states "the
      uncommitted working tree is slice 5 / #883"); reviews carry their
      source and URL (R881-8 S4: two posted rounds render oldest first,
      each with its PR comment URL built from `/api/meta`'s `project`,
      and the tab states its source is the forge pending #880 — per
      reconciliation item 2 above, **not** conditioned on #880).
- [ ] T7b. `brain/scripts/ui/change-route.mjs`: implement `GET
      /api/change/{issue}` (injected `_read`/`_run`, the one caller of
      `resume-frontmatter.mjs`'s `parseFrontmatter`, D11/D12) so T7a
      passes.
- [ ] T8. `brain/scripts/ui/lib/source-guard.test.mjs`: guard test — no
      file under `ui/lib/**` imports anything outside `ui/lib/**` (no
      `node:` builtin, no `../status/*`, D9). Scans import lines of every
      module in `lib/` written in T1–T6; test-only.
- [ ] T9. `brain/scripts/ui/provenance.test.mjs`: A3 property test — over
      the fixture change, every object emitted by `spec-cards.mjs`,
      `tasks-list.mjs`, `blame.mjs`/`resume-view.mjs` and
      `change-route.mjs`'s reviews rows has a non-empty `source.path` or
      `source.url`. No DOM; test-only, composes T1–T7's modules.
- [ ] T10. Verify: `GIT_CONFIG_GLOBAL=/dev/null npm test` and `npm run
      brain:repo:check` both green.
- [ ] T11. `npm run memory:save -- "pure drawer parsers and the layout
      module land for #881" "<summary of layout.mjs's determinism/cycle
      handling, colour.mjs's exhaustive map, and change-route.mjs's
      branch-resolution order landed in this PR>" --issue 881 --type
      pattern`, staged with only the new `.memory/records/*.jsonl` file and
      `.memory/index.jsonl`.

**Done when**: the layout is deterministic and cycle-tolerant under test
(R881-7), every constant colour.mjs maps is exhaustive (R881-6), and every
value the four tab shapers emit carries a `source` (A3) — all without a
browser.

---

## PR 4 / B2 — the page

```brain-slice-scope/1
{"slice": 4, "claims": ["R881-6", "R881-8", "R881-9", "R881-10"], "files": ["brain/scripts/ui/static/index.html", "brain/scripts/ui/static/app.js", "brain/scripts/ui/static/app.css"], "terminal_pr": "this PR -> main"}
```

Estimated: ~400 source, ~40 test, **~440 total**. Depends on PR 3 merged
(consumes `lib/*.mjs` and `change-route.mjs`'s contract, and PR 1/2's route
table). Closes the SPA wiring of R881-6/R881-8, R881-9's degradation bands,
and R881-10's S2 "no management views" scenario.

**TDD note, stated rather than worked around**: there is no browser test
runner in this repo (proposal.md; design D9/D8). `static/app.js`,
`app.css` and `index.html` are DOM glue with no `node:test`-observable
behaviour beyond static text/shape scans — design's own delivery-seam table
calls B2 "DOM glue that a reviewer reads rather than tests." The tasks below
apply Strict TDD to every part of this PR that **is** mechanically
checkable (imports, served content-type, banner strings, absence of
management-view routes) and name the remainder as a manual verification
step per the work-unit-commits checklist's "N/A with reason."

- [ ] T1a. `brain/scripts/ui/server.test.mjs` (extend): failing test — `GET
      /`, `GET /lib/app.js`, `GET /app.css` (once real files replace PR 1's
      placeholder) return `200` with the right `content-type`
      (`text/html`, `application/javascript`, `text/css`) and the SPA's
      `index.html` (R881-1 S1, now against the real page instead of the
      placeholder).
- [ ] T1b. `brain/scripts/ui/static/index.html` +
      `brain/scripts/ui/static/app.css`: implement the page skeleton
      (canvas container, drawer container with four tab slots, poll-control
      markup) and the static-file serving path in `server.mjs` needed for
      T1a to pass.
- [ ] T2a. `brain/scripts/ui/static/app-source-guard.test.mjs`: failing
      text-scan test extending D9's guard to the browser entrypoint —
      `app.js` imports only from `/lib/*.mjs` and never a `node:` builtin
      (the same rule as PR 3's T8, applied to the file the browser loads).
- [ ] T2b. `brain/scripts/ui/static/app.js`: implement the SVG canvas
      renderer (consumes `layout.mjs` + `colour.mjs`), the drawer's four
      tabs (fetch `GET /api/change/{issue}`), the poll controls (`POST
      /api/poll/pause|resume|once`, render `/api/meta`'s last-polled/paused
      state), and the `EventSource` wiring to `/api/stream` (`sync` paints
      the initial graph, `section` repaints the diffed section, `refs`
      re-reads the open drawer's Working-memory tab, `status` renders the
      degradation bands) — so T1a and T2a pass, and so A1/A2 hold when
      exercised manually (T5).
- [ ] T3a. `brain/scripts/ui/static/degradation-banner.test.mjs`: failing
      text-scan test asserting the exact banner strings from Q3/D2 appear
      verbatim in `app.js`'s template strings — the watcher-failure banner
      ("the watcher failed: <reason> — the canvas updates on the forge poll
      only; press Refresh for repo changes.") and the poll-failure banner
      ("forge as of <time> — last poll failed: <reason>") — a regression
      guard so a future edit cannot silently drop them (R881-9 S1/S2).
- [ ] T3b. `brain/scripts/ui/static/app.js`: implement the two banners (and
      the per-section `{ok: false, reason}` inline rendering, R881-9 S1)
      so T3a passes.
- [ ] T4. `brain/scripts/ui/static/no-management-views.test.mjs`: guard
      test for R881-10 S2 — scan `app.js`'s route/view table and assert no
      roadmap, decisions, anti-patterns, or by-actor/history view
      identifier exists; only the canvas and the four-tab drawer. Test-
      only, no new production code beyond T2/T3.
- [ ] T5. Manual verification (no automated harness exists for this step —
      N/A is the honest answer, not a gap): with `npm run brain:ui` running
      against this repo, confirm (a) 90 nodes render, click one opens the
      drawer with its Spec/Tasks/Working memory/Reviews tabs sourced (A1,
      A3); (b) a commit in a linked worktree moves the canvas within the
      poll interval with no reload (A2); (c) toggling "disable polling" and
      pressing "poll now" behave per R881-4 S2; (d) killing and restarting
      `fs.watch` artificially (rename the watched dir) surfaces the
      watcher-failure banner from T3. Record the exact steps run and their
      result in the apply-progress note for this slice.
- [ ] T6. Verify: `GIT_CONFIG_GLOBAL=/dev/null npm test` and `npm run
      brain:repo:check` both green.
- [ ] T7. `npm run memory:save -- "the DAG canvas and inspector drawer ship
      for #881" "<summary of the SVG renderer, the four-tab drawer, the
      poll controls and the degradation bands landed in this PR, plus the
      manual verification result from T5>" --issue 881 --type decision`,
      staged with only the new `.memory/records/*.jsonl` file and
      `.memory/index.jsonl`.

**Done when**: `npm run brain:ui` shows every open issue as a node,
opening one shows its sourced spec/tasks/working-memory/reviews (A1, A3),
and the manual walkthrough in T5 is recorded — closing the full slice-3
scope (R881-1 through R881-10).

---

## Review Workload Forecast

Estimated changed lines: 2380 total (PR1 ~560, PR2 ~580, PR3 ~800, PR4 ~440)
400-line budget risk: High (all four PRs exceed the skill's generic 400-line trigger — 560/580/800/440; this repo's own configured budget is governance tier `lite` = 1000 lines/PR (`governance-tiers.mjs:273-275`, `brain.config.json:15-17`), and all four PRs stay under that repo-specific budget)
Chained PRs recommended: Yes
Decision needed before apply: No — `delivery_strategy: ask-on-risk` and `chain_strategy: stacked-to-main` are already cached for this session; the four-PR stacked chain above resolves the ask-on-risk gate, so apply may proceed directly to PR 1 (slice 1)

## Out of scope

Restated from spec.md R881-10 — no task above builds any of the following:

- Any worktree's uncommitted working tree, any machine cache, or
  "uncommitted" overlay marking — deferred to slice 5 / #883.
- Roadmap, decisions (ADR), anti-patterns, or by-actor/history management
  views — deferred to slice 4 / #882.
- Any MCP resource route or agent-pulse/heartbeat endpoint — deferred to
  slice 6 / #884.
- Any route accepting `POST`/`PUT`/`PATCH`/`DELETE` other than the three
  poller timer controls (`/api/poll/pause|resume|once`) — never in scope,
  enforced by R881-5's tests in PR 1 and PR 2.
- A cached or persisted snapshot — forbidden by #878 as a second source of
  truth; the server holds exactly one recomputed `current` in memory
  (D1).
- `type: review` records as the Reviews tab's source — the tab reads forge
  comments today and states that source; switching to records is #880's
  work, not this change's.
