---
status: verified
issue: 881
verified_at: 2026-09-16
verified_against: c442533a (origin/main, tracker PR #970 merged)
---

# Verify report — issue-881-ui-server-canvas

## Summary verdict

**READY TO ARCHIVE.** 0 CRITICAL, 5 WARNING, 6 SUGGESTION.

Every one of R881-1 … R881-10 and all 27 scenarios has at least one covering
test that passed at runtime in this verification (`5582/5582` for the full
suite, `211/211` for `brain/scripts/ui/**`), including the two amendments the
review cycle made to the contract itself (R881-3's read allow-list, R881-4's
bounded quiet tick) and the R881-5 POST-control boundary. All 53 tasks in
`tasks.md` are `[x]` and each "done when" was re-checked against the code and
a live server. Every design decision D1–D16 is implemented as written or has
its deviation recorded with a reason in `apply-progress.md`; no unrecorded
deviation was found.

Nothing found here blocks the archive. The five warnings are all
documentation-state defects — stale planning metadata and an engram copy of
`spec.md` that predates the two amendments — which the archive phase should
fix as part of closing the change rather than by reopening apply.

---

## CRITICAL

None.

## WARNING

**W1 — the engram copy of `spec.md` is the pre-amendment text.** Store mode is
`hybrid`, so both copies are supposed to hold the same contract. Engram
observation `#3480` (topic `sdd/issue-881-ui-server-canvas/spec`) still carries
the 2026-09-14 wording: R881-3 reads "`.git/HEAD` … `.git/worktrees/*/HEAD` …
MUST NOT read or watch any other working-tree content" and R881-4's first
scenario reads "the second poll issues no per-issue `issueView` call for any of
those N issues". Both were superseded in the file on 2026-09-16
(`spec.md:54-64`, `spec.md:85-104`). A cold session that recovers the spec from
engram would verify the implementation against a contract the implementation
deliberately no longer meets — the exact failure mode the amendment was written
to prevent.
*Verify*: `mem_get_observation(3480)` and diff against
`openspec/changes/issue-881-ui-server-canvas/spec.md:54-104`.
*Fix*: re-save `spec` (and, for the same reason, `design`) at archive time.

**W2 — `tasks.md`'s Review Workload Forecast still says `stacked-to-main`.**
`tasks.md:454` reads "`chain_strategy: stacked-to-main` are already cached for
this session", contradicting the file's own header (`tasks.md:10-17`, the
feature-branch-chain ruling) and contradicting what actually shipped. The
engram copy of `tasks` (`#3489`) already carries the corrected text
(`chain_strategy: feature-branch-chain`); the file is the stale side.
*Verify*: `rg -n "stacked-to-main" openspec/changes/issue-881-ui-server-canvas/tasks.md`.

**W3 — every `brain-slice-scope/1` block in `tasks.md` declares
`"terminal_pr": "this PR -> main"`.** `tasks.md:61`, `:138`, `:248`, `:366`.
No child PR targeted `main`: #964, #971, #979, #982, #983 and #985 all targeted
`feature/brain-ui`, and only tracker #970 targeted `main`. The engram copy
already says `"this PR -> tracker (feature/brain-ui)"`. `check-refs.mjs`'s S-1b
validation only requires `terminal_pr` to be a non-empty string
(`brain/scripts/lib/sdd-layout.mjs:452-455`), so `brain:repo:check` stays green
and the wrong value is never caught by a machine — which is precisely why it
survived four slices.
*Verify*: `rg -n "terminal_pr" openspec/changes/issue-881-ui-server-canvas/tasks.md`
against `gh pr view <n> --json baseRefName`.

**W4 — neither copy of `apply-progress` records the final delivery state.**
The file ends at `apply-progress.md:1811` with "No push, no PR", and the engram
copy (`#3498`) ends with "This fix branch is unpushed and must land on the
tracker before PR #970 moves toward `main`." Since then: that branch shipped as
PR #985 (`c1e4e7ca`), the #982 corrections shipped as PR #983 (`bb480809`), the
tracker merged into `main` as `c442533a`, and #881 is CLOSED. The two
correction PRs are never named by number anywhere in the change dir.
*Verify*: `rg -n "#983|#985" openspec/changes/issue-881-ui-server-canvas/` returns nothing;
`gh pr view 983 985 970`.
*Fix*: the archive report is the right place to state the final chain.

**W5 — R881-10's first scenario is literally false as written, and it is the
one scenario of the three amended requirements that was never amended.**
The scenario says "no server route, watcher event, or drawer tab reflects that
uncommitted content". `GET /api/change/{issue}` reads `spec.md` and `tasks.md`
from the served root's working tree (`change-route.mjs:55`, `:79`, `:188`), so
an uncommitted edit to either file does show in the Spec and Tasks tabs. The
reading that makes this correct is recorded twice — `design.md:215-221`
("committed tier here means no new reader of uncommitted state beyond what
`buildSnapshot` already reads") and verbatim in the code
(`change-route.mjs:15-22`) — and R881-8 positively requires those reads, so the
implementation is right and the scenario text is what is stale. R881-3 and
R881-4 were both amended in the same review cycle; this one was missed.
*Verify*: `spec.md:239-241` against `change-route.mjs:15-22`.

## SUGGESTION

**S1 — `poller.mjs`'s header understates its own bound.** `poller.mjs:11-12`
says "On every later tick the body lane spends at most B = 5 calls", while
`poller.mjs:21` and `:140` state the real per-tick ceiling,
`BODY_CAP + NEW_BODY_CAP = 25`. Both sentences are in the same comment block,
ten lines apart. This is the "B vs 25" item from the brief and it is recorded
*nowhere* — not in apply-progress, not in an issue, not in a PR body.
*Verify*: `sed -n '1,30p' brain/scripts/ui/poller.mjs`.

**S2 — `spec.md` R881-8's "PR comment URL" was never softened to the PR URL
that D14 rejects an anchor for.** `spec.md:196`, `:213` ask for "its PR comment
URL"; `design.md:641-647` explains why a per-round anchor cannot exist
(`prReviews` drops `id`/`html_url`/`submitted_at`) and settles on the PR URL;
`change-route.mjs:138` builds `https://github.com/<project>/pull/<pr>`. The
deviation is recorded in design, not in spec.

**S3 — under `--no-poll` the forge sections say "the first forge poll has not
completed".** Measured on a live server (below). It is true, but it describes a
state the operator has made permanent; `forge-cache.mjs`'s two-sentence split
landed in #985 for exactly this class of "true but useless" message. The page's
poll indicator does say "paused" beside it, so nothing is silent.

**S4 — `LIB_MODULE_RE`'s comment is looser than the regex** (`server.mjs`).
Carried and recorded (`apply-progress.md:1663-1666`); still open.

**S5 — the `www.w3.org` allow-list entry is host-wide** where only
`http://www.w3.org/2000/svg` is needed (`brain/scripts/lib/shipped-hostnames.mjs`).
Carried and recorded (`apply-progress.md:1667-1671`); still open.

**S6 — the focus / Space-key / CLOSED-note editorials** are unresolved by
choice. Recorded (`apply-progress.md:1672-1676`).

---

## Requirement → test map

Every row names tests that PASSED in this verification run. Line numbers are
the `test(` call site.

| Requirement / scenario | Covering test(s) |
|---|---|
| **R881-1 S1** default port + static root | `server.test.mjs:118` "no --port defaults to port 3000"; `:122`; `:127` "GET / returns the SPA static placeholder"; `:997` "GET / serves the real SPA shell"; live `GET /` → 200 `text/html` |
| **R881-1 S2** ephemeral port | `server.test.mjs:141` "--port 0 listens on an OS-assigned port and reports it" |
| **R881-1 S3 / A4** shape parity | `server.test.mjs:165` "GET /api/snapshot deep-equals in-process buildSnapshot on the same fixture root, port and clock" |
| R881-1 script/engines pin | `server.test.mjs:847` "package.json exposes brain:ui and engines.node >= 22" |
| **R881-2 S1** first frame is full state | `server.test.mjs:384` "the first SSE frame is `sync`, carrying the whole current snapshot"; live: first frame `event: sync`, 515 288 B |
| **R881-2 S2** committed-tier change reaches the client | `server.test.mjs:409` "a committed-tier change (via the watcher) yields a `section` frame within the debounce"; `:441` "(refs) … naming {worktree, head}" |
| **R881-2 S3** forge change reaches the client | `server.test.mjs:535` "a forge change (via the poller) yields a `section` frame on the next tick" |
| **R881-3 S1** uncommitted edit fires nothing | `watcher.test.mjs:171` "the watcher registers watches only for the Q3 set — an edit anywhere else can never fire an event" |
| **R881-3 S2** commit in a linked worktree is seen | `watcher.test.mjs:199`; `:231` (first worktree ever created); `:276` (rescan) |
| **R881-3 amended allow-list** (`worktrees/*/gitdir`, `--git-dir` for HEAD) | `watcher.test.mjs:307` "two worktrees whose paths share a leaf name are both watched under their own admin-dir ids"; `:403` malformed `gitdir` is said; `:438` unmatched porcelain path is said; `server.test.mjs:486` "resolves its branch via --git-dir on its own admin dir, never -C on the worktree path"; code: `watcher.mjs:244-262`, `server.mjs:198-199` |
| **R881-4 S1 (amended)** bounded quiet tick | `poller.test.mjs:54` "N unchanged issues cost at most B calls on the next poll, not N"; `:474` "with nothing new and nothing changed, the body lane still refreshes up to BODY_CAP least-recently-refreshed bodies, oldest first"; `:358` "30 simulated ticks hold the budget"; `:310` "bounded to BODY_CAP + NEW_BODY_CAP per tick even when every issue changes at once" |
| **R881-4 S2 (new)** bulk import never left unreadable | `poller.test.mjs:423` "a bulk import of new issues beyond NEW_BODY_CAP queues the overflow and drains it under the per-tick bound"; `:528` "a queued import overflow drains ahead of later churn"; `forge-cache.test.mjs:54` "a never-fetched number says it is queued" |
| **R881-4 S3** disable + manual poll | `poller.test.mjs:80` "disabling stops the timer; 'poll now' still triggers exactly one poll; two /once calls inside 5s collapse"; `server.test.mjs:261` "--no-poll composes with R881-4 S2" |
| **R881-4 S4** last-polled state visible | `poller.test.mjs:115` "last-polled state is visible after success and after failure"; `banners.test.mjs:111`, `:117` "paused is visible in the indicator itself", `:126` |
| **R881-5 S1** mutation methods rejected | `server.test.mjs:212`; `:229` "the method check runs before routing"; `:686` "(re-run) … including /api/stream"; live `POST /api/snapshot` → 405 |
| **R881-5 S2** controls accept POST only | `server.test.mjs:703` "the three poll-control routes accept POST only, and POST mutates only in-process state"; `:730` "POST … leave the served root, the refs and the forge untouched"; live `GET /api/poll/pause` → 405, `POST` → 200 `{"paused":true,…}` |
| **R881-5 S3 / A5** read-only port | `server.test.mjs:188`; `:772` "(re-run) — with the poller wired in, a full poll cycle plus every route completes with no write verb ever invoked"; `poller.test.mjs:205` |
| **R881-6 S1** no node filtered away | `colour.test.mjs:17` (90-node fixture); `canvas-model.test.mjs:26` "every open issue becomes exactly one node"; `layout.test.mjs:69`, `:78` (unlinked band) |
| **R881-6 S2** "not computed" ≠ planned | `colour.test.mjs:30`; `canvas-model.test.mjs:45` |
| **R881-6 S3** blocked overrides state | `colour.test.mjs:36`; `canvas-model.test.mjs:62` |
| R881-6 exhaustiveness | `colour.test.mjs:48` (unknown status THROWS, naming it), `:59` (all eight constants); `canvas-model.test.mjs:69`, `:83` |
| **R881-7 S1** determinism | `layout.test.mjs:19`, `:27` (shuffled input); `canvas-model.test.mjs:105` |
| **R881-7 S2** cycle tolerance | `layout.test.mjs:34`, `:113` (`reversed:true`); `:137` `droppedEdges`; `:104` empty graph |
| **R881-8 S1** full drawer | `change-route.test.mjs:74`; `drawer-model.test.mjs:38` (Spec cards + path + line), `:73` (Tasks + attribution); live `/api/change/881` → Spec 10 cards, Tasks 53 rows |
| **R881-8 S2** no change dir | `change-route.test.mjs:131`; `drawer-model.test.mjs:62` |
| **R881-8 S3** no committed `resume.md` | `change-route.test.mjs:186`, `:203`; `drawer-model.test.mjs:93`, `:100` |
| **R881-8 S4** reviews, oldest first, sourced | `change-route.test.mjs:221`; `drawer-model.test.mjs:120`; unreadable threads: `change-route.test.mjs:290`, `:310`, `drawer-model.test.mjs:140`, `:159` |
| **A3** every value sourced | `provenance.test.mjs:36`, `:56`, `:82`, `:87`, `:150`; `drawer-model.test.mjs:173`, `:188` |
| **R881-9 S1** failed section stated in band | `banners.test.mjs:93` "every {ok:false} section is named with its reason"; `:39`; `canvas-model.test.mjs:19`; `frames.test.mjs:50`; `degradation-banner.test.mjs:24`, `:54` |
| **R881-9 S2** failed poll keeps stale data + reason | `poller.test.mjs:145`; `banners.test.mjs:23`, `:29`, `:68`; `degradation-banner.test.mjs:31` |
| **R881-10 S1** no uncommitted content | `watcher.test.mjs:171`; `no-management-views.test.mjs:53` "nothing on the page reads a worktree path"; blame pinned to `HEAD` (`change-route.mjs:87`, `change-route.test.mjs:164`, `server.test.mjs:803`). See **W5** |
| **R881-10 S2** no management views | `no-management-views.test.mjs:32`, `:41`, `:45`, `:60` |
| **R881-10 S3** no MCP / heartbeat | `server.test.mjs:796` over `KNOWN_ROUTES` (`server.mjs:58`) |

Guards that back the whole set: `lib/source-guard.test.mjs:32/37/52`,
`static/app-source-guard.test.mjs:55/65/73/92/102/113`.

---

## Task check

**53/53 items `[x]`, 0 unchecked** (`rg -c '^- \[x\]' tasks.md` = 53,
`^- \[ \]` = 0).

| Slice | "Done when" | Verdict |
|---|---|---|
| PR 1 (T1–T7) | `/` and `/api/snapshot` served, everything else 405, A4 + A5 under test, no `gh`/git/repo write per request | HOLDS — `server.test.mjs:165/188/212`; live probes below; memory record `rec-b9a5a16c68582663` present |
| PR 2 (T1–T8) | a commit or label move reaches a connected SSE client within one interval, controls work, 405 boundary over the full table | HOLDS — `server.test.mjs:409/441/535/703/730`; `rec-56e5504ba47fdf96` present |
| PR 3 (T1–T11) | layout deterministic + cycle-tolerant, colour map exhaustive, every emitted value carries a `source` | HOLDS — `layout.test.mjs`, `colour.test.mjs:59`, `provenance.test.mjs`; `rec-9cf68574b1310920` present |
| PR 4 (T1–T7) | every open issue is a node, the drawer shows sourced spec/tasks/working-memory/reviews, T5 walkthrough recorded | HOLDS — `apply-progress.md:1461-1529` records the walkthrough with its measured numbers and names the one by-eye check the maintainer still owes; `rec-aaeb5b317c39db5e` present |

**Delivery header vs what happened.** The header (`tasks.md:10-17`) claims
feature-branch-chain on `feature/brain-ui`, PR 1 = #964 squash-merged as
`8d074e44`, tracker #970 the only PR targeting `main`. Confirmed on the forge:

| PR | base | merge sha | lines |
|---|---|---|---|
| #964 | `feature/brain-ui` | `8d074e44` | +2710/-1 |
| #971 | `feature/brain-ui` | `59903959` | +4006/-146 |
| #979 | `feature/brain-ui` | `21a37c21` | +2029/-56 |
| #982 | `feature/brain-ui` | `35b6f7b4` | +2146/-30 |
| #983 (correction) | `feature/brain-ui` | `bb480809` | +74/-6 |
| #985 (correction) | `feature/brain-ui` | `c1e4e7ca` | +452/-38 |
| #970 (tracker) | `main` | `c442533a` | +11142/-2 |

#881 is CLOSED (`2026-09-16T17:01:19Z`). #970 carries `size:exception` with a
written justification (counted 2784 lines against `main`, each child under the
`lite` 1000-line budget with its own APPROVE). The header is accurate; the two
stale metadata blocks are W2 and W3, and the two correction PRs are W4.

---

## Design deviations

| # | Decision | Deviation | Recorded? |
|---|---|---|---|
| 1 | D4 — reuse `collect.mjs`'s `parseWorktrees()` | PR 2 shipped a private copy (file fence) | YES — `apply-progress.md:152-164`, and CLOSED in PR 3 (`727e026a`); `watcher.mjs:31` now imports it |
| 2 | D2 — body lane `B = 5` | never capped the "changed" bucket; then foreclosed bucket (c) entirely | YES — `apply-progress.md:387-421` and `:1707-1803`; `design.md:123-164` carries both dated corrections; `spec.md:85-104` carries the amendment |
| 3 | D2 — "the body lane always spends up to B" | PR 2 made bucket (c) round out a non-empty batch only | YES — recorded as PR 2 deviation 2 (`apply-progress.md:165-181`) and explicitly REVERSED by the tracker review (`:1783-1803`) |
| 4 | R881-4 S2 (implicit) | `resume()` re-arms the interval, does not poll immediately | YES — `apply-progress.md:182-190` |
| 5 | D8 — module map | four extra `lib/` modules (`frames`, `banners`, `canvas-model`, `drawer-model`) | YES — `apply-progress.md:1570-1575` |
| 6 | D8/T1a — serve the page at `/lib/app.js` | serves `/app.js`; `KNOWN_ROUTES` names `/app.js`, `/app.css`, `/lib/{module}.mjs` | YES — `apply-progress.md:1554-1558` |
| 7 | Q1/D2/Q3 — `/api/meta` | no such route; `meta` rides the `sync`/`status` frames and each control's answer | YES — `apply-progress.md:1560-1565`; confirmed live (`meta` present in the `sync` frame) |
| 8 | D10 — "straight-line points for a layer skip > 1" | edges always carry exactly two endpoints | YES — `apply-progress.md:1236-1241` |
| 9 | D10 — unlinked band | band wraps into `max(1, ceil(sqrt(n)), widest layer)` columns (16 160 px → 1960 px) | YES — `apply-progress.md:1588-1595` |
| 10 | D9 note — `colour.mjs` map | explicit priority order over all eight constants; unknown status THROWS and the renderer catches per node | YES — `apply-progress.md:1242-1251` and `:1652-1659` |
| 11 | D8 — `buildChangeView({root, issue, snapshot})` | `project` added as an optional parameter (D14 needs it for the PR URL) | YES — `apply-progress.md:1289-1297` |
| 12 | T7a — per-row attribution | a distinct `attribution: {ok,…}` leaf beside `actor`/`ts` | YES — `apply-progress.md:1298-1308` |
| 13 | D14 — the caveat "verbatim in the UI" | one literal `REVIEWS_SOURCE_NOTE = 'forge comments until #880 lands'` | YES — `apply-progress.md:1313-1318`. Spec text not updated → S2 |
| 14 | Fence — `lib/shipped-hostnames.mjs` | +5 lines to allow the SVG namespace host | YES — `apply-progress.md:1576-1581` |
| 15 | T3a — banner strings in `app.js` | strings live in `lib/banners.mjs`, asserted by value there plus a wiring scan | YES — `apply-progress.md:1566-1569` |

**No unrecorded deviation was found.** D1, D3, D5, D6, D7, D11, D12, D13, D15
and D16 are implemented as written (`forge-cache.mjs` four verbs;
`providers.mjs` untouched; `watcher.mjs` 250 ms debounce; `sync` first;
`POST`-only controls with `/once` collapsing; `{ok, value|reason, source}`;
`git show <branch>:resume.md`; `git blame --porcelain HEAD`; `parseArgs`/exit 2
/signal teardown/`127.0.0.1`; `engines.node >= 22`).

---

## Measured runs (this verification, worktree `/home/gandalf/IA/brain-issue-881`, `c442533a`)

| Command | Result |
|---|---|
| `GIT_CONFIG_GLOBAL=/dev/null npm test` | **pass 5582 / fail 0 / skipped 0**, 33.8 s (matches `apply-progress.md:1807-1809`) |
| `npm run brain:repo:check` | green — "No prohibited references found. Artifact structure is valid." |
| `npm run brain:nav` | green — no orphans, no broken links |
| `node --test brain/scripts/ui/**/*.test.mjs` | **211/211** |
| source guards explicitly (`lib/source-guard`, `static/app-source-guard`, `no-management-views`, `degradation-banner`) | **20/20** |

**Live server** — one process, `node brain/scripts/ui/server.mjs --port 0
--root /home/gandalf/IA/brain-issue-881 --no-poll`, PID 1485398, port 44767,
stopped with `kill -TERM <recorded PID>` and confirmed gone (`ss -ltnp`: port
free). No `pkill -f`, no `pgrep -f`.

| Request | Status | Content-type / body |
|---|---|---|
| `GET /` | 200 | `text/html`, 1269 B |
| `GET /app.js` | 200 | `application/javascript`, 14 173 B |
| `GET /app.css` | 200 | `text/css` |
| `GET /lib/layout.mjs` | 200 | `application/javascript` |
| `GET /lib/nope.mjs` | 404 | allow-list holds |
| `GET /index.html` | 404 | allow-list holds |
| `GET /api/snapshot` | 200 | `application/json`, 514 994 B |
| `GET /api/change/881` | 200 | `application/json`, 29 285 B |
| `GET /api/stream` | 200 | `text/event-stream`, first frame `event: sync` with `{generatedAt, meta, snapshot}` |
| `POST /api/snapshot` | 405 | |
| `GET /api/poll/pause` | 405 | |
| `POST /api/poll/pause` | 200 | `{"paused":true,"lastPolledAt":null,…}` |

**Degradation under `--no-poll` — every forge section says its reason in band:**

- `graph`: `ok:false` — "the issue list could not be read: the first forge poll has not completed"
- `prs`: `ok:false` — same cause, its own sentence
- `reviews`: `ok:false` — "no PR list to read threads for (…)"
- `changes`, `records`: `ok:true` — the tree sections still render (R881-9 S1)
- `sync` frame `meta`: `project csrinaldi/brain`, `watcher {ok:true, watched:143}`, `poller {paused:true, lastError:null}`
- `/api/change/881`: Spec `ok:true` 10 cards, Tasks `ok:true` 53 rows, Working
  memory `ok:false` naming the real cause ("more than one `feat/issue-881-*`
  branch in this clone: …"), Reviews `ok:false` — "the PR list could not be
  read" — with its `forge comments until #880 lands` note.

Nothing degraded silently; every failed leaf carried a sentence.

---

## Acceptance A1–A5

| # | Statement | Verdict |
|---|---|---|
| **A1** | one node per open issue, activating it opens spec + tasks | **VERIFIED, minus the by-eye check.** `canvas-model.test.mjs:26`, `colour.test.mjs:17`, `layout.test.mjs:69/78`; the T5 walkthrough rendered the live `/api/snapshot` through the browser's own modules in node — 91 nodes for 91 open issues, 0 unreadable, 0 `node-unknown` (`apply-progress.md:1490-1495`). What is NOT verified: that a real browser paints it and that clicking a node opens the drawer — no DOM runner exists here and the maintainer's by-eye check is still owed (`apply-progress.md:1522-1529`). |
| **A2** | a commit or a label change moves the canvas within one interval, no reload | **VERIFIED.** `watcher.test.mjs:199`, `poller.test.mjs:54/358`, `server.test.mjs:409/441/535`. End-to-end against the real forge was done once in PR 2 (`apply-progress.md:601-617`) and again in PR 4's walkthrough. |
| **A3** | every drawer value carries a path or a URL | **VERIFIED.** `provenance.test.mjs` (5 property tests), `drawer-model.test.mjs:173/188`; live drawer for #881: 91 leaves, 0 without a source (`apply-progress.md:1500-1501`). |
| **A4** | `GET /api/snapshot` deep-equals in-process `buildSnapshot()` | **VERIFIED.** `server.test.mjs:165`, same fixture root and pinned clock. |
| **A5** | no write verb is reachable | **VERIFIED.** `server.test.mjs:188/772`, `poller.test.mjs:205`, plus the negative assertion D7 promised (`server.test.mjs:730`: tree snapshot before/after + a counting write-verb port across pause/resume/once). |

---

## Carried items (not this change's defects)

| Item | Recorded where | Status |
|---|---|---|
| Forge identity resolved from `process.cwd()`, not `--root` | **Issue #981, OPEN** — "fix(ui): brain:ui and brain:snapshot resolve the forge identity from the process cwd, not from --root", with `server.mjs:416-419` evidence; also `apply-progress.md:1596-1602` (which describes it but does not cite the number) | RECORDED. Suggest adding the `#981` number to the apply-progress entry when archiving. |
| The reviewer's budget control vs `size:exception` | **Issue #752, OPEN** (`status:approved`, `type:bug`) — "a chained PR can never converge — the verdict judges the link, the chain is what ships"; PR #970 carries `size:exception` with a written justification | RECORDED as an issue. **NOT linked** from this change's artifacts or from #970's body — the concrete instance (a 2784-line tracker merged on child approvals) is exactly #752's subject and is worth a comment there. |
| `poller.mjs` header wording, `B = 5` vs the real 25 | — | **NOT RECORDED ANYWHERE.** See S1. |
| `LIB_MODULE_RE`'s comment wording | `apply-progress.md:1663-1666` | RECORDED, no ticket yet |
| `www.w3.org` allow-list width | `apply-progress.md:1667-1671` | RECORDED, no ticket yet |
| focus / Space / CLOSED editorials | `apply-progress.md:1672-1676` | RECORDED, deliberately declined |

Two of six have no ticket of their own and one has no record at all. None
blocks the archive; all six should survive it, which is what this section is
for.

---

## What the archive phase should do

1. Re-save `spec` and `design` to engram so the hybrid copies match the
   amended files (W1).
2. Correct `tasks.md:454` and the four `terminal_pr` values (W2, W3), or state
   in the archive report that the engram copy is authoritative on both.
3. Record the final chain in the archive report: #983, #985, tracker #970
   merged as `c442533a`, #881 CLOSED (W4).
4. Either amend R881-10's first scenario to the reading design and the code
   already state, or record in the archive report that it is knowingly
   superseded by `design.md:215-221` (W5).
5. Carry S1–S6 forward; open tickets for S1, S4 and S5 if they are to survive.
