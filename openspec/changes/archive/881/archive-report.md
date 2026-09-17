---
status: archived
issue: 881
archived_at: 2026-09-16
archived_against: c442533a (origin/main, tracker PR #970 merged)
---

# Archive report — issue-881-ui-server-canvas

**The change is closed.** Issue #881 (Brain UI, epic #878, slice 3) shipped as
six pull requests on the tracker `feature/brain-ui`, which merged into `main`
as `c442533a` on 2026-09-16. All 53 tasks are `[x]`, all ten requirements
R881-1 … R881-10 and their 27 scenarios carry at least one test that passed at
runtime, and the verify report returned **0 CRITICAL** — READY TO ARCHIVE.

---

## What shipped

One local, read-only HTTP server over the #879 snapshot read model, and one
page that draws the issue graph and inspects a change.

| Slice | PR | What it added |
|---|---|---|
| **1 — the server serves the read model** | **#964** (`8d074e44`) | `brain/scripts/ui/server.mjs` (`npm run brain:ui`, default port 3000, `--port`, `127.0.0.1` only), `GET /` + `GET /api/snapshot` deep-equal to in-process `buildSnapshot()`, the cache-only forge port (`forge-cache.mjs`), the section-level diff (`diff.mjs`), and the `405` boundary on every other verb |
| **2 — the server notices** | **#971** (`59903959`) | the committed-tier watcher (`watcher.mjs`, 250 ms debounce, ref metadata and linked-worktree admin dirs only), the budgeted forge poller (`poller.mjs`, 60 s, bounded per-tick cost), `GET /api/stream` (SSE, `sync` first then `section`/`status` frames), and the three `POST`-only poll controls |
| **3 — the pure page logic** | **#979** (`21a37c21`) | the six pure `ui/lib/**` shapers (`layout`, `colour`, `spec-cards`, `tasks-list`, `blame`, `resume-view`) and `GET /api/change/{issue}` — the four-tab drawer's data, every leaf carrying its own `source` |
| **4 — the page** | **#982** (`35b6f7b4`) | `static/{index.html,app.js,app.css}` — the SVG canvas, the inspector drawer, the poll controls and the degradation bands — plus `lib/{frames,banners,canvas-model,drawer-model}.mjs` |
| correction | **#983** (`bb480809`) | the two corrections of #982's approving review: a staleness token for `loadChange`, and an import scan that a multi-line bare import could slip past |
| correction | **#985** (`c1e4e7ca`) | the tracker review's blocker: the bulk-import overflow is queued instead of dropped and the least-recently-refreshed bucket is never foreclosed; a never-fetched body says it is *queued*, not that the first poll has not completed |
| **tracker** | **#970** (`c442533a`) | the integration PR — the only one in the chain that targeted `main`; closed #881 |

**The acceptance criteria.** A1 (one node per open issue, activating it opens
spec + tasks), A2 (a commit or label change moves the canvas within one
interval, no reload), A3 (every drawer value carries a path or a URL), A4
(`GET /api/snapshot` deep-equals `buildSnapshot()`), A5 (no write verb is
reachable) — all five verified. A1 with one stated limit: no DOM runner exists
in this repo, so "a real browser paints it and clicking a node opens the
drawer" is not pinned by any test. The maintainer's by-eye check on the
tracker — server up, `http://127.0.0.1:3000/` opened, page rendered — is the
whole of that evidence, and it is a one-off observation, not an assertion.

---

## Verification summary

From `verify-report.md` (2026-09-16, against `c442533a`):

| | |
|---|---|
| Verdict | **READY TO ARCHIVE** — 0 CRITICAL, 5 WARNING, 6 SUGGESTION |
| Requirements | R881-1 … R881-10, **27/27 scenarios** covered by tests that passed in the verification run |
| Tasks | **53/53 `[x]`**, 0 unchecked; each slice's "done when" re-checked against the code and a live server |
| Full suite | `GIT_CONFIG_GLOBAL=/dev/null npm test` — **5582 pass / 0 fail / 0 skipped**, 33.8 s |
| UI subtree | `node --test brain/scripts/ui/**/*.test.mjs` — **211/211** |
| Guards | source guards + `no-management-views` + `degradation-banner` — **20/20** |
| Repo gates | `brain:repo:check` green, `brain:nav` green (no orphans, no broken links) |
| Design decisions | D1–D16 all implemented as written or with a recorded deviation; **no unrecorded deviation found** |

**Live probe** — one process, `server.mjs --port 0 --root <worktree>
--no-poll`, port 44767, stopped by PID and confirmed gone:

`GET /` 200 `text/html` · `/app.js` 200 · `/app.css` 200 · `/lib/layout.mjs`
200 · `/lib/nope.mjs` 404 · `/index.html` 404 (the allow-list holds) ·
`/api/snapshot` 200, 514 994 B · `/api/change/881` 200, 29 285 B (Spec 10
cards, Tasks 53 rows) · `/api/stream` 200 `text/event-stream`, first frame
`event: sync` · `POST /api/snapshot` 405 · `GET /api/poll/pause` 405 ·
`POST /api/poll/pause` 200. Under `--no-poll` every failed forge section named
its own reason in band and nothing degraded silently.

---

## The final chain

Feature-branch-chain on the tracker `feature/brain-ui` (maintainer ruling,
2026-09-14). **No child PR ever targeted `main`.**

| PR | Base | Merge sha | Lines | Cold-review verdict |
|---|---|---|---|---|
| #964 | `feature/brain-ui` | `8d074e44` | +2710/-1 | APPROVE |
| #971 | `feature/brain-ui` | `59903959` | +4006/-146 | APPROVE after seven rounds, each finding a real defect |
| #979 | `feature/brain-ui` | `21a37c21` | +2029/-56 | APPROVE rev 1, zero findings |
| #982 | `feature/brain-ui` | `35b6f7b4` | +2146/-30 | APPROVE rev 1, two non-blocking corrections → #983 |
| #983 | `feature/brain-ui` | `bb480809` | +74/-6 | APPROVE |
| #985 | `feature/brain-ui` | `c1e4e7ca` | +452/-38 | APPROVE, with one comment-wording correction taken before merge |
| **#970** (tracker) | **`main`** | **`c442533a`** | +11142/-2 (2784 counted) | **REVISE** on `budget` and `cold-1` — see below |

**The tracker's REVISE, and why it merged anyway.** Two grounds:

- **`cold-1`** was a real defect — a node that renders `UNREADABLE` forever on
  a working server after a bulk import. **Fixed by PR #985** and re-verified.
- **`budget`** is the known structural one. The reviewer counts the tracker's
  2784 lines against `main` and does not honour `size:exception`, which #970
  carries with a written justification. That is **issue #752** exactly — "a
  chained PR can never converge: the verdict judges the link, the chain is
  what ships". Every child is inside this repo's `lite` 1000-line budget as
  the gate counts it, and each holds its own APPROVE; the tracker is by
  construction their sum, so no further slicing could move its number.

The maintainer merged on the child approvals, with `budget` recorded as the
#752 instance rather than acted on. **#881 CLOSED** (`2026-09-16T17:01:19Z`).

---

## Deviations accepted

Fifteen deviations from `design.md` were recorded during apply and re-checked
at verification; the four that changed the contract rather than the code are
listed first. All fifteen are in `apply-progress.md` with their reason.

| Deviation | Resolution |
|---|---|
| **R881-4 S1 — "unchanged issues cost nothing"** | **Contract amended.** The absolute reading foreclosed design Q1/D2's least-recently-refreshed bucket, and a body-only edit moves no list-level field, so a body the poller never fetched could never be fetched again. Amended to the bounded claim ruling 2 actually bought — at most `B` calls per poll regardless of N — plus a new bulk-import scenario. No number in the budget table moved. |
| **R881-3 — the watcher's read allow-list** | **Contract amended.** `worktrees/*/gitdir` is read to resolve each linked worktree's admin id, and `worktrees/*/HEAD` via `git --git-dir` — never through the worktree path. |
| **R881-10 S1 — "no uncommitted content is ever read"** | **Contract amended at archive time (W5).** Literally false as written: R881-8 positively requires `GET /api/change/{issue}` to read `spec.md` and `tasks.md` from the served root's working tree. The scenario now states the reading the code and `design.md` Q3 have always carried — no reader of uncommitted state beyond `buildSnapshot`'s own, no linked worktree's working tree at all, and no "uncommitted" overlay anywhere (#883). |
| **R881-8 — "its PR comment URL"** | **Not amended; deviation recorded in `design.md` D14.** GitHub's `prReviews` drops `id`/`html_url`/`submitted_at`, so a per-round anchor cannot exist; the drawer links the PR URL. `spec.md:196`/`:213` still say "comment URL" — carried as SUGGESTION S2, harmless because design and code both state the real behaviour. |
| D4 — reuse `collect.mjs`'s `parseWorktrees()` | PR 2 shipped a private copy behind the file fence; **closed in PR 3** (`727e026a`) — `watcher.mjs` now imports it |
| D8 — the module map | four extra `lib/` modules (`frames`, `banners`, `canvas-model`, `drawer-model`); the page serves `/app.js`, not `/lib/app.js` |
| Q1/D2/Q3 — a `/api/meta` route | no such route: `meta` rides the `sync`/`status` frames and each control's answer |
| D10 — straight-line points for a layer skip, and the unlinked band | edges always carry exactly two endpoints; the `?` band wraps into `max(1, ceil(sqrt(n)), widest layer)` columns (16 160 px → 1960 px) |
| D9 — the colour map | explicit priority over all eight constants; an unknown status **throws** and the renderer marks that one node `node-unknown` while every sibling still draws |
| D8/T7a/D14/T3a/fence | `buildChangeView` takes an optional `project`; per-row `attribution` is its own leaf; the reviews caveat is one literal `REVIEWS_SOURCE_NOTE`; banner strings live in `lib/banners.mjs`; `lib/shipped-hostnames.mjs` gained +5 lines for the SVG namespace host |

D1, D3, D5, D6, D7, D11, D12, D13, D15 and D16 shipped exactly as written.

---

## The five verify-report warnings, and what became of them

All five were documentation-state defects. Four were fixed inside this change
dir by the archive phase; the fifth is fixed by re-saving to the memory
backend.

| # | Warning | What it became |
|---|---|---|
| **W1** | the engram copy of `spec.md` predates the R881-3/R881-4 amendments | **FIXED** — `spec`, `design`, `tasks` and `apply-progress` re-saved from the final files at archive time, so both halves of the hybrid store carry the same contract. `design` was included for the same reason the verify report gives: its engram copy predated the 2026-09-16 `judgment:cold-1` correction to Q1/D2. |
| **W2** | `tasks.md`'s Review Workload Forecast still said `chain_strategy: stacked-to-main` | **FIXED** — `tasks.md` now reads `feature-branch-chain`, matching its own header, `apply-progress.md`'s chain ruling and what shipped; the measured per-PR line counts were added beside the forecast |
| **W3** | all four `brain-slice-scope/1` fences declared `"terminal_pr": "this PR -> main"` | **FIXED** — all four now read `"this PR -> tracker (feature/brain-ui)"`. Worth naming the cause: `check-refs.mjs`'s S-1b validation only requires `terminal_pr` to be a non-empty string, so the wrong value stayed green through four slices. A guard that checks shape and not meaning is why this survived. |
| **W4** | neither copy of `apply-progress` recorded the final delivery state | **FIXED** — a closing section records #983 and #985 by number with their merge shas and verdicts, the tracker's REVISE with both grounds, the maintainer's by-eye check, and the follow-up table below |
| **W5** | R881-10's first scenario is literally false as written | **FIXED** — the requirement and its first scenario are amended in `spec.md` to the reading `design.md` Q3 and `change-route.mjs:15-22` have always carried, with a dated amendment note explaining why the text and not the code was wrong |

---

## Follow-ups

Nothing below blocks the archive; everything below must survive it.

| # | Item | Ticket |
|---|---|---|
| 1 | `brain:ui` and `brain:snapshot` resolve the forge identity from `process.cwd()`, not `--root`, so `--root <other repo>` serves that repo's tree with THIS repo's issues (`server.mjs:416-419`) | **#981, OPEN** |
| 2 | A chained PR can never converge — the reviewer's budget control judges the link and does not honour `size:exception`; #970 is a concrete 2784-line instance merged on child approvals, worth a comment on the ticket | **#752, OPEN** |
| 3 | `poller.mjs:11-12` claims "at most B = 5 calls" where the enforced per-tick ceiling is `BODY_CAP + NEW_BODY_CAP = 25` (`poller.mjs:21`, `:140`), ten lines apart in the same comment block — **and `LIB_MODULE_RE`'s comment in `server.mjs` is looser than the regex it describes** | **TO OPEN** — one ticket, "docs(ui): the `poller.mjs` header claims B = 5 where the bound is 25, and `LIB_MODULE_RE`'s comment is looser than its regex". Item 3's first half was recorded nowhere before this archive. |
| 4 | The `www.w3.org` allow-list entry is host-wide where only `http://www.w3.org/2000/svg` is needed; narrowing it touches #648's guard in a shared file | **TO OPEN** |
| 5 | The focus / Space-key / CLOSED-note editorials — product decisions, deliberately declined in a pre-push round | **TO OPEN if wanted** — declined, not lost |
| 6 | `spec.md` R881-8 still says "its PR comment URL" where D14 settled on the PR URL (SUGGESTION S2); under `--no-poll` the forge sections say "the first forge poll has not completed", true but describing a state the operator made permanent (S3) | wording, no ticket owed — both recorded here |

---

## The epic after this change

Epic **#878 (Brain UI)**:

| Slice | State |
|---|---|
| #879 — the snapshot read model | **DONE** (merged as part of #953) |
| **#881 — the local server and the DAG canvas** | **DONE — this change** |
| #880 — review rounds as `type: review` records | OPEN — informs the Reviews tab, does not block it; the tab reads forge comments today and says so |
| #882 — roadmap / decisions / anti-patterns / by-actor views | OPEN — explicitly out of scope here (R881-10 S2) |
| #883 — the uncommitted/working-tree tier | OPEN — explicitly out of scope here (R881-10 S1) |
| #884 — MCP resources and agent pulse | OPEN — explicitly out of scope here (R881-10 S3) |
| #885 | OPEN |
| #967 | IN FLIGHT |

Wording chosen deliberately: #880, #882, #883, #884 are not "missing" from
this change — R881-10 asserts their absence as a requirement, and their tests
are what keep the boundary honest.

---

## Artifact traceability

Store mode `hybrid`. The change dir moves to the archive path owned by
`sdd-layout.mjs`'s `archivePath(iid)` (`npm run brain:change:archive`); the
engram observations below are the other half.

| Artifact | Engram observation | Topic key |
|---|---|---|
| explore | **#3477** | `sdd/issue-881-ui-server-canvas/explore` |
| proposal | **#3479** | `sdd/issue-881-ui-server-canvas/proposal` |
| spec | **#3480** (re-saved at archive with the amended text) | `sdd/issue-881-ui-server-canvas/spec` |
| design | **#3482** (re-saved at archive, carries both Q1/D2 corrections) | `sdd/issue-881-ui-server-canvas/design` |
| tasks | **#3489** (re-saved at archive) | `sdd/issue-881-ui-server-canvas/tasks` |
| apply-progress | **#3498** (re-saved at archive) | `sdd/issue-881-ui-server-canvas/apply-progress` |
| verify-report | **#3622** | `sdd/issue-881-ui-server-canvas/verify-report` |
| archive-report | **#3632** (this file, saved at archive time) | `sdd/issue-881-ui-server-canvas/archive-report` |

Related decision/discovery records: #3478 (the proposal rulings), #3487 (the
POST reading of "no write surface"), #3523 (PR #971's seven review rounds),
#3535 and #3545 (slice 3), #3590 (slice 4). Memory records written by the
slices themselves: `rec-b9a5a16c68582663`, `rec-56e5504ba47fdf96`,
`rec-9cf68574b1310920`, `rec-aaeb5b317c39db5e`.

---

**SDD cycle complete.** Planned, specified, designed, implemented, verified,
archived. No CRITICAL issue, no unchecked task, no unrecorded deviation.
