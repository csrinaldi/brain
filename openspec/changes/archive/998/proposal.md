# Proposal — issue-998: the Brain UI surface per the design

Source of the design: the maintainer's Claude Design project "Brain UI implementation proposal" (`8cf52106-ac32-41a2-9c2e-d040f478819d`), mapped to the code in the design-to-implementation map kept with the maintainer's design docs; `design.md` beside this file carries that map's decisions. The issue body follows verbatim.

---

Parent: #878 (Brain UI) — the surface, after slice 3. Slice 3 (#881, merged as #970) proved the data path: a server, a stream and a bare page. This ticket builds the surface the maintainer designed in Claude Design ("Brain UI implementation proposal", project `8cf52106-ac32-41a2-9c2e-d040f478819d`) on top of that path, as six chained PRs. The management views stay in #882 and the epic lanes' data in #967.

## What the design showed and the data can already feed

The design-to-implementation map (kept with the maintainer's design docs) walked every region of the canvas against `brain:snapshot`'s sections. About 80 % of what the design shows is fed by data that exists today; the gaps are PR lifecycle state, review findings detail and epic grouping. Seventeen design fields have no data source today: seven need a reader that does not exist (the findings array that `parse-verdict.mjs` already returns and `snapshot.mjs:133` throws away; records by issue; archived changes; the served branch; the poll countdown; an anti-pattern gloss; promotions), five arrive with open tickets (#967 ×3, #880, #981), five have no source anywhere and by rule zero are not shown (PR merged state and line counts, "merged not archived", per-requirement verified, a 15 s polling fallback, "approved not implemented").

## Rulings taken (maintainer, 2026-09-16)

1. Typography: system font stack; no Google Fonts link (the brief forbids external resources; `app-source-guard.test.mjs` already fails on it); no self-hosted woff2.
2. `APPROVED` / `REVISE` are round verdicts, never node states: rendered on the review round and the PR chip inside the node; the node stays in-flight until the ticket closes.
3. The node door has six tabs: Overview, Spec, Tasks, Working memory, Reviews, Linked records. Provenance stays inline beside every value; no "sources" tab.
4. Theme: `prefers-color-scheme`, a complete light palette on bare `:root`, the design's dark palette under the media query, no persisted toggle.
5. Slice-plan PR state is shown as declared scopes only, with "PR state is not read" said; `unclassified` stays the code value and "undeclared" the word on screen; the promotions row leaves the design; until #967 lands, epic lanes say in band that `kind` and `parent` are absent.

## Expected: six chained PRs on a tracker `feature/issue-<this>-ui-surface`, each under the tier's budget, each reviewed cold on its own

| PR | Scope | Blocked on |
|---|---|---|
| 1 | `lib/state-vocab.mjs` (eleven states → `{code, label, mark, className}`, `node-unknown` distinct from "not computed") + `lib/provenance.mjs` (`sourceLabel` moved out of `drawer-model.mjs`) + the `app.css` token block, light `:root` and dark under `prefers-color-scheme`, system font stack | — |
| 2 | `lib/view-model.mjs`, the nav and view router in `app.js` (four modes, `Tab`, `Esc`, `J/K`); `no-management-views.test.mjs` rewritten into `views-owned.test.mjs`, the absence proof enumerating the views this PR owns | PR 1 |
| 3 | `lib/lane-model.mjs`, track lanes, the `?` holding lane collapsed with a visible total and the declare snippet; no node filtered; epic grouping says "not data yet" | PR 2 |
| 4 | `lib/sdd-model.mjs`, the SDD view (seven stages per change, phase-order violations named, grandfathered claims no stage); `readChanges` also lists `openspec/changes/archive/` | PR 3 |
| 5 | `snapshot.mjs` carries `findings[]` per verdict; `lib/review-timeline.mjs`; the verdict queue; the Reviews tab gains severity and the cited text; an unreadable thread is a row with its reason | PR 4 |
| 6 | `change-route.mjs` records-by-issue tab; the door's six tabs wired; `buildMeta()` names the served branch; `poller.state()` gains `intervalMs` and `nextAttemptAt`, the bands gain a countdown | PR 5 |

PR 7 (governance view) is #882's content; PR 8 (epic lanes read `node.kind` / `node.parent`, the tracker chip) lands after #967.

## Constraints (from #878 and #881, unchanged)

No dependency, no CDN, no build step; ES modules from `/lib/*.mjs`; pure logic in `lib/` under `node:test` and the source guard (no `node:` builtins, no clock, no randomness, no `process`, no `fetch`, no `import.meta`); the browser file is wiring; every rendered value carries its `source.path` or `source.url`; text from the forge and from files is rendered as text, never markup; read-only; committed tier only; a failure is a reason in band, never an empty area.

## Acceptance

- After PR 3, `npm run brain:ui` shows the map view of the design: lanes by track, the `?` lane collapsed with its total, every open issue present, the state vocabulary as colour + mark + word, in light and in dark.
- After PR 6, the door opens six tabs, each keeping its own reason on failure; the SDD view names every change's stage; the Reviews timeline shows findings by severity; the header names the branch it serves; the bands show the next poll.
- Every PR: red tests first, a mutation per unit, a fresh-context review before push, a posted cold-review APPROVE on its final head; the source guards stay green.

## Out of scope

The governance view (#882), the epic lanes' data (#967), review rounds as records (#880), the forge identity from `--root` (#981), a browser test runner, any write surface, tier 2 (#883), telemetry (#884).

```brain-graph/1
track:    UI
blocks:   [882]
needs:    [881]
files:    ["brain/scripts/ui/static/**", "brain/scripts/ui/lib/**", "brain/scripts/ui/change-route.mjs", "brain/scripts/status/snapshot.mjs"]
```
