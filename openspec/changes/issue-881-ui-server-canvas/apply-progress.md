---
status: in-progress
issue: 881
---

# Apply progress — issue-881-ui-server-canvas

## Slice delivered this run

**PR 1 / A1 — the server serves the read model.** All 7 tasks (T1–T7)
complete. PR 2 (A2), PR 3 (B1) and PR 4 (B2) are not started.

## Tasks done, with commit SHAs

| Task | What | Commit |
|---|---|---|
| — | docs(sdd): planning artifacts (explore, proposal, spec, design, tasks) | `743794c9` |
| T1a/T1b | `forge-cache.mjs` + test — the cache-only port (D1) | `be277a3c` |
| T2a/T2b | `diff.mjs` + test — section-level diff (Q5) | `5c2589cb` |
| T3a/T3b | `server.mjs` core (`createUiServer`, `listen`/`close`, `GET /`, `GET /api/snapshot`) + `static/index.html` placeholder + test | `43aea8c7` |
| T4a/T4b | 405 method-guard test (production code already present from T3b — see deviation below) | `37d47f8b` |
| T5a/T5b | `parseArgs`, `EADDRINUSE`, `package.json` (`brain:ui`, `engines.node>=22`) + test | `23661264` |
| T6 | Verify: full suite + `brain:repo:check` green | (no separate commit — verified before the T5 commit) |
| T7 | `npm run memory:save` — `rec-b9a5a16c68582663` | this commit (`docs(memory): ...`) |

## RED/GREEN evidence, one line per pair

- **T1a/T1b** (forge-cache): RED — `forge-cache.test.mjs` failed with
  `ERR_MODULE_NOT_FOUND` (no `forge-cache.mjs`). GREEN — 3/3 passing after
  implementing `createForgeCache()`.
- **T2a/T2b** (diff): RED — `diff.test.mjs` failed with `ERR_MODULE_NOT_FOUND`
  (no `diff.mjs`). GREEN — 4/4 passing after implementing `diffSections()`.
- **T3a/T3b** (server core): RED — `server.test.mjs` failed with
  `ERR_MODULE_NOT_FOUND` (no `server.mjs`). GREEN — 7/7 passing after
  implementing `createUiServer`, `parseArgs`, `main`, and adding
  `static/index.html`.
- **T4a/T4b** (405 guard): the production method-check was already written
  as part of T3b's `handleRequest` (D7's "method check runs before routing"
  is one code path with the routing itself, and was implemented up front).
  To still produce honest RED evidence for this task pair rather than a
  trivially-passing test, the guard was TEMPORARILY reverted in the working
  tree (never committed), the two new T4a assertions were confirmed to fail
  (`8 not ok`, `9 not ok` — POST/PUT/PATCH/DELETE returned 200/404 instead of
  405), the guard was restored, and the same two tests were confirmed green
  (`9/9`). The committed diff for this task pair is test-only —
  `git diff --stat` on `server.mjs` between the T3b and T4 commits is empty.
  This is recorded as a deviation from a strict per-task RED-then-write-code
  sequence, not from strict TDD's actual guarantee (every assertion was
  proven to fail against production code that does not yet implement the
  behavior, before being proven to pass).
- **T5a/T5b** (argv/EADDRINUSE/package.json): same situation for
  `parseArgs`/`main`/`EADDRINUSE` — already implemented in T3b, since `main`
  needed a working `parseArgs` to exist for the module to import cleanly.
  Running the newly-added T5a tests against the T4 commit's code showed 13/14
  passing immediately and exactly 1 genuinely RED (`package.json exposes
  "brain:ui" and "engines.node" >= 22"` — neither key existed yet). GREEN —
  14/14 after adding both keys to `package.json`.

## Test counts

- Focused (`brain/scripts/ui/*.test.mjs`): 21/21 passing, run 5× consecutively
  with no flake (forge-cache 3, diff 4, server 14).
- Full suite (`GIT_CONFIG_GLOBAL=/dev/null npm test`): 5362/5362 passing,
  0 failing, stable across 2 consecutive clean runs (one earlier run showed
  5361/1 with no reproduction in 7 further runs — not attributable to any
  file this PR touches; see Risks).
- `npm run brain:repo:check`: green before every commit.
- `managed-paths.test.mjs` + both `test/publish-*.e2e.test.mjs`: 52/52
  passing after `package.json` changed — `MANAGED_SCRIPT_KEYS`'s 10-entry
  pin, `private`, `name`, and the zero-dependency assertion are all
  untouched by `engines` or `brain:ui`.

## Deviations from tasks.md / design.md

1. **T4/T5 RED sequencing** — see the RED/GREEN evidence above. The
   behavior tasks.md assigns to T4b and part of T5b (the method guard,
   `parseArgs`, `main`, `EADDRINUSE`) was implemented as part of T3b instead
   of being deferred, because D7's method-check-before-routing and D15's
   argv/EADDRINUSE handling are small enough that writing `server.mjs`'s
   skeleton naturally included them. Every assertion in T4a/T5a was still
   proven to exercise real production logic (via the temporary-revert
   technique for T4, and via the genuinely-new `package.json` keys for
   T5) — nothing here is an untested code path.
2. **SIGINT/SIGTERM lifecycle** — the prompt's "what slice 1 delivers"
   summary mentions "SIGINT/SIGTERM close cleanly," but tasks.md's PR 1
   section has no task for it; it is explicitly PR 2's T5a/T5b ("full D15
   lifecycle"). Per the instruction that tasks.md wins on conflict, and
   because there is no watcher or poller to stop yet in PR 1, signal
   handling was deferred to PR 2, not implemented here.
3. **Scope** — no file outside `brain-slice-scope/1`'s `files` list was
   touched: `brain/scripts/ui/server.mjs`, `brain/scripts/ui/forge-cache.mjs`,
   `brain/scripts/ui/diff.mjs`, `brain/scripts/ui/static/index.html`,
   `package.json`, plus their `*.test.mjs` siblings (implied by the slice,
   consistent with #879's own PR).

## What PR 2 (A2) needs to know

- `createForgeCache()` returns `{port, setIssueList, setMrList,
  setIssueView, setPrReviews}`. The poller composes against these four
  setters; `port` is what `createUiServer`'s `vcs` option expects (or omit
  `vcs` and let the server own its own cache — PR 2 will need to change this
  to share ONE cache instance between the server and the poller, since
  `createUiServer` currently creates its own when `vcs` is not injected).
- `diffSections(previous, next)` is ready for the SSE hub: call it with the
  last held snapshot and the freshly recomputed one; each returned entry is
  `{name, section}` with `section` already being the full new value to put
  in a `section` SSE frame.
- `createUiServer`'s route table currently only knows `/` and
  `/api/snapshot`; PR 2 adds `/api/stream` and the three `/api/poll/*`
  control routes, and must extend the 405 `Allow` header logic so the three
  control routes report `Allow: POST` instead of `Allow: GET, HEAD`.
- `server.listen(overridePort)` resolves to the bound port and also sets
  `server.port`; `server.close()` returns a promise. PR 2's SSE teardown
  (ending every open response before closing the listener) will need to
  hook into `close()`.
- The CLI guard at the bottom of `server.mjs` resolves `project` via
  `originIdentity()` but never a `vcs` — PR 2's poller is the first thing
  that will need to call `getVcs()` for a real forge port.
