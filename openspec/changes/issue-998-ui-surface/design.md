# Design — issue-998: the Brain UI surface

This design is the design-to-implementation map of the maintainer's Claude Design, sections 2–5, copied here so the change dir is self-contained; its recommendations are numbered D1… and were ratified or amended by the maintainer's rulings of 2026-09-16 (in `proposal.md`: system font stack; verdicts on rounds and PR chips, never node state; six door tabs; `prefers-color-scheme`; declared scopes only; `unclassified`/`undeclared`; no promotions row; epic lanes say kind/parent are absent until #967). Where a recommendation below disagrees with a ruling, the ruling wins.

## 2. State vocabulary map

`plan:47-58` gives ten state codes. The data produces a different set.

| Design code (`plan`) | Word / mark / hex / var | What the data actually says | Verdict |
|---|---|---|---|
| `PLANNED` | Planned `○` `#64748B` `--state-planned` | `roadmap.value.state === 'planned'` | fits → `state-planned` (`colour.mjs:21`) |
| `IN_FLIGHT` | In-Flight `◐` `#06B6D4` | `'in-flight'` | fits → `state-in-flight` |
| `DONE` | Done/Merged `●` `#6366F1` | `'done'` (the ticket is closed, `snapshot.mjs:72`) | fits → `state-done`; **the word "Merged" over-claims** — `done` is issue state, never a merge |
| `BLOCKED` | Blocked `⊘` `#FB7185` | `node.blockedBy.length > 0`, priority 3 (`colour.mjs:44`) | fits → `status-blocked` |
| `AWAITING_REV` | Awaiting Review `◇` `#F59E0B` | `node.status === 'awaiting-human'` (`epic-graph.mjs:441`: no `status:approved` label) | fits → `status-awaiting-review`, **but the meaning is "no human approved the ticket", not "a PR is waiting on a verdict"**. The design uses it for both (`dc:209` node vs `dc:307` queue row). Two different facts; keep two marks. |
| `UNDECLARED` | Undeclared `?` `#D97706` | `node.status === 'unclassified'` (`epic-graph.mjs:439`) and `track == null` | fits → `status-unclassified`; the design's word "undeclared" and the code's `unclassified` should be reconciled in one direction |
| `UNREADABLE` | Unreadable `⚠` `#D946EF` | `node.status === 'unreadable'`, priority 1 (`colour.mjs:42`) | fits → `status-unreadable` |
| `NOT_COMPUTED` | Uncomputed `—` `#475569` | `roadmap.ok === false`, priority 2 (`colour.mjs:43`) → `roadmap-not-computed` | fits |
| `APPROVED` | Approved `✓` `#10B981` | **not a node state.** It is `reviews[].latest.verdict === 'APPROVE'` for a PR of that issue (`snapshot.mjs:137`), reachable per node through `roadmap.value.evidence.verdict` (`snapshot.mjs:81`) | a **round** state, not a node state — render it on a PR/round chip; a node whose latest round approved is still `in-flight` until the ticket closes |
| `REVISE` | Revise `✕` `#EF4444` | same: `reviews[].latest.verdict === 'REVISE'` | same |

**States the data has and the design lacks:**

- `status-ready` (`epic-graph.mjs:442`, `colour.mjs:27`) — declared, unblocked, `status:approved`. Its class exists and is never returned (colour falls through to the roadmap state), but it is what makes the map exhaustive; a vocabulary that drops it will throw the first time the priority order changes.
- `node-unknown` (`canvas-model.mjs:24`) — the node whose state `colour.mjs` **refuses** to map. `colourClass` throws by design (`colour.mjs:49`) and the renderer catches per node so one unknown state cannot blank the canvas. `plan:490` gets this right ("`colour.mjs` keeps throwing … the vocab maps it to *not computed*") — **except that it must NOT become `not computed`**: that word already means `roadmap.ok:false`. Keep the eleventh mark.
- `edge.reversed` (`layout.mjs` pass 1, drawn dashed at `app.js:145`) — a cycle broken in the declarations. The legend has no mark for it.
- `graph.divergences`, `droppedEdges`, `blocksUnreadable`, `filesUnknown`, `conflictsWith` (`epic-graph.mjs:454-468`, `canvas-model.mjs:80`) — facts the page already lists (`app.js:162-167`) with no place in the design.

**Hex tokens**: the ten `--state-*` variables are dark-calibrated and have no
light equivalents; today's palette lives at `app.css:79-88` as flat fills. See §3.

---

## 3. Constraint conflicts

1. **Google Fonts.** `dc:11-13` carries two `<link rel="preconnect">` and a
   `<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono…">`.
   This is not merely against the brief (§6, "no dependency, no CDN") — it is a
   **red test**: `app-source-guard.test.mjs:95` asserts
   `!/<link[^>]+href="https?:/.test(html)` with the message *"index.html must not
   load a stylesheet or font from the network"*. **Recommendation**: drop the
   link and set `font-family: 'Plus Jakarta Sans', ui-sans-serif, system-ui,
   sans-serif` / `ui-monospace, SFMono-Regular, Menlo, monospace` — `plan:63`
   already specifies exactly that mono stack for the provenance tags. Self-hosting
   the woff2 files is the only alternative and needs a maintainer ruling (binary
   assets in the repo, a `/fonts/*` route in `server.mjs`).
2. **Inline handlers.** Every interactive element in the design uses
   `onClick="{{ … }}"` (`dc:52`, `72-75`, `94-95`, `118`, `303`, `567-573`).
   That is the Design Components runtime, not HTML, but it must not be
   transcribed: `app-source-guard.test.mjs:96` forbids `\son[a-z]+=` in
   `index.html`, and `app.js:116-118, 156-157, 217` already wires every listener
   with `addEventListener`. Keep that.
3. **`innerHTML`.** Nothing in the design forces it, and nothing in the page
   uses it — `app.js:36-41` builds every node with `createElement` +
   `textContent`. The brief's "untrusted text is rendered as text" survives only
   if that holds. Two new surfaces are the risk: the declare-snippet `<code>`
   block (`dc:254`) and record/finding bodies. Both are `textContent`.
   **Recommendation**: add an `innerHTML`/`insertAdjacentHTML`/`document.write`
   assertion to the source guard in the first PR.
4. **Dependencies.** None implied. The 7-stage strip, the swimlanes, the tables
   and the timeline are CSS grid and flex. `support.js` is the Design Components
   runtime and is explicitly not ours (`claude-design/README.md:9`).
5. **Dark theme vs today's light page.** `dc:15` sets `body{background:#0b0f17}`;
   `app.css:13-20` is a light token block. The design's own open question 4
   (`dc:540`) recommends "one token block at the top of `app.css` and
   `prefers-color-scheme`, no toggle to persist". **Agreed, with one amendment**:
   define the light palette on bare `:root`, redefine the same names under
   `@media (prefers-color-scheme: dark)`, and never give a colour its only
   definition inside the media block. No `localStorage` toggle — nothing on this
   page persists per viewer, and a toggle would be the page's first piece of
   state that is not in the read model.
6. **Six tabs vs four — actually seven vs four.** `plan:33-38` says six; the
   canvas renders seven (`dc:567-573`, adding `sources`). Today: four
   (`drawer-model.mjs:22`), asserted by `no-management-views.test.mjs:41`.
   **Recommendation**: ship six (`spec, sdd, tasks, memory, reviews, records`)
   and drop `sources` as a tab — every entry already carries its source string
   inline (`drawer-model.mjs:26-33`, `app.js:243`), so a seventh tab repeating
   them is a second projection of the same values with no new fact in it. If the
   maintainer wants the "everything and where it came from" summary, it is a
   footer on the door, not a tab.
7. **The absence tests are a real dependency.** `no-management-views.test.mjs`
   (`:32-38` endpoints, `:41` tab ids, `:47` forbidden identifiers including
   `nav`, `adrs?`, `anti-?pattern`, `by-?actor`, `:61-64` the four mount ids) is
   #881's proof that it did not build #882. It has to be **rewritten per PR**, as
   the new surface's own absence proof, in the same commit that adds the surface.

---

## 4. Component → module map

`app.js` stays wiring; every decision lands in a pure `lib/*.mjs` with a
`node:test`, per brief §6 and `source-guard.test.mjs`.

| Design component | Exists today | Change / new module |
|---|---|---|
| status bar, poll controls | `banners.mjs:96` `pollIndicator`, `app.js:108-121` | extend `pollIndicator` with `nextAttemptAt` → countdown text. Same tests file. |
| degradation bands | `banners.mjs:60-81` `degradationBands` | add an `as_of` per band (it already has `lastOkAt` in scope) and a band id per section. |
| nav / view router | — | **new `lib/view-model.mjs`**. In: `{view, snapshot, selectedIssue}`. Out: `{views:[{id,label,badge,ok,reason}], active}`. Tests: awaiting-verdict badge counts only `reviews[].ok` rows; a `prs`-failed snapshot yields a badge of `null`, never `0`. |
| state chips, marks, legend | `colour.mjs` (class only) | **new `lib/state-vocab.mjs`**. In: `node` (or `{verdict}`). Out: `{code,label,mark,className}`. It **wraps** `colourClass` and keeps its throw; `node-unknown` gets its own eleventh entry, distinct from `not computed`. Tests: every constant in `epic-graph.mjs` and `snapshot.mjs` maps; the unknown state maps to `node-unknown` and not to `roadmap-not-computed`. — `plan:81-84` calls this slice 1 and is right; it is also right that `provenance.mjs` is missing, except that **`lib/provenance.test.mjs` already exists with no module** (it property-tests the four parsers). Name the new module `provenance-label.mjs`, or move `sourceLabel` (`drawer-model.mjs:26`) out into `provenance.mjs` and let the existing test file keep its name. |
| track / epic lanes, `?` lane | `layout.mjs` (layered DAG), `canvas-model.mjs` | **new `lib/lane-model.mjs`** (`plan:87` calls it `cluster-layout.mjs`/`cluster-model.mjs` and says it "extends `layout.mjs`" — it must **not**: `layout.mjs:152` is a coordinate engine and the lanes are a grouping, not a layout). In: `graph.value` + `{groupBy:'track'|'epic'}`. Out: `{lanes:[{id,label,source,nodes[],count}], holding:{nodes[],total,page}}`. Tests: the undeclared majority lands in `holding` and is never dropped; `kind`/`parent` absent → `epic` grouping falls back to tracks **with a said reason**; a cycle-broken edge is still carried. |
| SDD stages + slice plan | `changes[]` raw | **new `lib/sdd-model.mjs`** (`plan:83` `sdd-parser.mjs`). In: `changes.value[]`. Out: per change `{stages:[{n,artefact,present}], phaseOrder:[violations], tasks:{checked,open,total,next}, slices:[{slice,claims,terminal_pr}], reasons:[]}`. Tests: grandfathered claims no stage; a missing artefact is named; `14/18` from checked+open; **slices carry no PR state and the model says so**. |
| the door, six tabs | `drawer-model.mjs:100-117` | extend: `TAB_IDS` grows `sdd` and `records`; `reviewEntries` (`:78-92`) gains `findings[]` with severity; one new entry shape field `severity`. Keep "an unreadable thread is an entry, not a skip" (`:84-90`). |
| reviews timeline / verdict queue | `change-route.mjs:142-163` | **new `lib/review-timeline.mjs`**. In: `{prs, reviews}` sections. Out: `{rows:[{pr,issue,rounds,latest,headSha,ok,reason}], unreadable:[]}`, ordered oldest-first per PR. Tests: an `ok:false` thread is a row with its reason; a PR with zero verdicts is "no round posted", not "approved". |
| management views | — (`no-management-views.test.mjs` asserts absence) | **new `lib/management-model.mjs`** (`plan:94`). In: `{adrs, antiPatterns, records, actors, releaseDebt, drift}`. Out: five projections, each `{ok, rows|reason, source}`. Tests: drift both ways; the supersession chain; records filtered by type and actor; `releaseDebt.lines` passed through verbatim. |
| records-by-issue | — | `change-route.mjs` gains a fifth tab builder over `snapshot.records` — no new IO, it is already in the snapshot the route holds (`server.mjs:308`). |

Corrections to `plan:76-101`: `layout.mjs` and `colour.mjs` already exist and
`plan` treats both as new; the drawer model exists; the SSE frames exist
(`frames.mjs`); `provenance.test.mjs` exists without its module; and the
findings YAML needs no new parser (§1.9 item 1).

---

## 5. Delivery plan

**Tracker branch**: `feature/issue-878-ui-surface`. `feature/brain-ui` is gone
from `origin` (slices 1-3 merged; `#970` is on `main`), and the `feature/`
prefix is what `stranded.mjs:19-28` recognises as a tracker. `feature/brain-ui-2`
would work; a name carrying the epic number is the house pattern
(`origin/feature/issue-138-…`, `origin/feature/issue-337-…`).

Counted lines exclude `**/*.test.mjs` and `openspec/changes/**`
(`brain.config.json:18-29`); `index.html`, `app.js`, `app.css` and every
`lib/*.mjs` count. Hard cap 1000 (tier `lite`); each PR below is planned under
**400** so cold review stays focused.

| PR | Scope | Counted | Blocked on | Acceptance | Tests |
|---|---|---|---|---|---|
| 1 | `lib/state-vocab.mjs` + `lib/provenance.mjs` (`sourceLabel` moved out of `drawer-model.mjs`); `app.css` token block, light `:root` + `prefers-color-scheme` dark; system font stack | ~330 | — | every state maps to `{code,label,mark,className}`; `node-unknown` stays distinct from `not computed`; the page renders identically in light | `state-vocab.test.mjs`, existing `provenance.test.mjs` retargeted, `colour.test.mjs` unchanged, source guard gains the `innerHTML` assertion |
| 2 | `lib/view-model.mjs` + nav + view router in `app.js`; rewrite `no-management-views.test.mjs` into `views-owned.test.mjs` | ~300 | PR 1 | four modes switch with `Tab`, `Esc` closes the door, `J/K` traverse; the absence proof now enumerates the views this PR owns | `view-model.test.mjs`, the rewritten absence test, `app-source-guard.test.mjs` |
| 3 | `lib/lane-model.mjs` + lane rendering + the `?` holding lane with the declare snippet, paged | ~380 | PR 2 | no node is filtered; 67 undeclared render in a collapsed holding lane with a visible total; `epic` grouping says "not data yet" instead of faking lanes | `lane-model.test.mjs` (undeclared majority, reversed edge kept, `kind`/`parent` absent) |
| 4 | `lib/sdd-model.mjs` + the SDD tab + archived-change reader in `snapshot.mjs` (`readChanges` also lists `openspec/changes/archive/`) | ~360 | PR 3 | seven stages per change, phase-order violations named, grandfathered claims no stage, archived changes appear with their archive path | `sdd-model.test.mjs`, `snapshot.test.mjs` extended for the archive dir |
| 5 | `snapshot.mjs` carries `findings[]` per verdict; `lib/review-timeline.mjs`; the verdict-queue view; the reviews tab gains severity | ~340 | PR 4 | a round shows its findings with severity and the text it cites; an unreadable thread is a row with its reason; a PR with no verdict is "no round posted" | `review-timeline.test.mjs`, `snapshot.test.mjs` (findings survive), `drawer-model.test.mjs` |
| 6 | `change-route.mjs` records-by-issue tab; the door's six tabs wired; `buildMeta()` gains the served branch; `poller.state()` gains `intervalMs`/`nextAttemptAt` and the bands gain a countdown | ~300 | PR 5 | the door opens six tabs, each keeping its own reason on failure; the header names the branch it is serving | `change-route.test.mjs`, `poller.test.mjs`, `banners.test.mjs` |
| 7 | `lib/management-model.mjs` + the governance view (ADR table, drift, anti-patterns, actors, release debt, history) | ~390 | PR 6, **#882** | "where is the epic, what is blocked, who did what this week" answerable from these views; every row names its file | `management-model.test.mjs` |
| 8 | epic lanes read `node.kind`/`node.parent`; the tracker chip; lane header slice counts | ~180 | **#967** | with #967 merged, `epic clusters` groups without any UI change beyond removing the fallback reason | `lane-model.test.mjs` extended |

**Can start now**: PRs 1-6 (nothing in them depends on #967 or #882). **Blocked**:
PR 7 on #882 (it is that ticket's content — #882 declares `needs: [881, 880]`, so
its full "by actor / reviews posted" pane also wants #880), PR 8 on #967.

---

