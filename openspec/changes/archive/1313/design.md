---
status: draft
issue: 1313
---

# Design — memory-ledger-shows-content (issue 1313)

## Current data path

- `readRecords` (`brain/scripts/memory/lib/store.mjs:385`) already parses every record, `content`
  included, on every snapshot build.
- `readRecordRows` (`brain/scripts/status/snapshot.mjs:370-375`) maps them through `projectRecord`
  (`:130-139`), which drops `content` (#879 D3) and copies a `title` no record has (0 of 2505).
- `buildMemoryModel` (`brain/scripts/ui/lib/memory-model.mjs:229`) sorts, caps at 50
  (`MEMORY_RECENT_CAP`, `:64`) and shapes rows in `recentRow` (`:128`).
- `renderMemory` (`brain/scripts/ui/static/app.js:377-459`) writes the id alone into the RECORD cell
  (`:450`).
- The drawer Records tab (`change-route.mjs:527`, `drawer-model.mjs:221`) has the same gap; there is
  no content formatting to reuse.

## Decisions

| Decision | Choice | Rejected | Why |
|---|---|---|---|
| D151 Where the summary is computed | Server-side, in `projectRecord`, per record | Lazy route per row / per page | The content is already in memory server-side; a per-row route would put a fetch before every row is complete. (The full content, by contrast, IS fetched lazily: D159.) |
| D152 Title source | Bold lead line, else first non-empty line | The raw `title` field; a type-based placeholder | 2505/2505 records carry the bold lead (C4 fold). The raw field is never present; a placeholder invents text. |
| D153 Excerpt shape | Plain text, conservative marker strip, whitespace collapsed, cut on code points | marked-based plain text | marked may run only in the worker (`marked-usage-guard.test.mjs`, #1218 R1218-4); the snapshot is node-side and a regex strip over a bounded slice is linear. |
| D154 Work bound | Examine at most `SCAN_MAX = 2000` chars | Whole content | Bounds the cost per record whatever a record holds. |
| D155 Absence wording | Two exported constants: `NO_TEXT`, `EMPTY_TEXT`; neither says "unreadable" | One "unreadable" catch-all | Two different facts, and the record was read. |
| D156 Module home | New pure `brain/scripts/memory/lib/record-summary.mjs` | Inline in `snapshot.mjs`, or in `ui/lib` | The bold-lead rule is record-format knowledge (memory-format.md item 8); the memory domain owns it. |
| D157 Amend #879 D3 | A bounded summary is projected; `content` never is | Keep D3 literally | D3 refused making the snapshot "a transport of the store"; a capped summary keeps that. See the amendment note below. |
| D158 Excerpt length | RULED 2026-10-06: `EXCERPT_MAX = 120`, `TITLE_MAX = 200` | 160 | 120 saves about 100 KB of snapshot JSON and still fits about two table lines. |
| D159 Full content | RULED 2026-10-06: clicking a row fetches `GET /api/record/{id}`: a read-only local file read of `.memory/records`, id validated against `^rec-[0-9a-f]{16}$` and never joined into a path (the file name comes from a directory listing), content capped at `DOCUMENT_CAP` bytes, 404 for an unknown id | Put the content in the snapshot; read it from the browser | The content stays out of the snapshot (D157). The route is called only on a click, so the first render waits on nothing new. |
| D160 Where and how many | RULED 2026-10-06: inline: the row expands below itself, in a second `<tr class="memory-detail">` spanning the table. MANY rows may be open at once, each toggled alone, restored across a re-render from a page-only set of ids (as `expandedDocs` is for SDD documents). The toggle is a native `<button>` in the RECORD cell carrying `aria-expanded` and `aria-controls`. Not the drawer | One at a time; the drawer | Independent toggles match the SDD reader (#1198) and need no "close the other" state. A collapse evicts that record's fetch and render entries, so open content is bounded by what the reader has open. |
| D161 Markdown path | RULED 2026-10-06: the full content is rendered as markdown by the SAME worker and render budget as an SDD document (`renderOffThread`, `requestDoc`, `showDocumentOutcome`, `renderMdBlocks`): never `marked` on the main thread, the PUA-placeholder safety stays in the worker's pre-scan. A timeout, a failed or unavailable worker shows the notice and the record as plain text, as for an SDD document | A second render path; plain text only | Records are markdown (bold lead, lists, tables, code). One render path means one safety review. |
| D162 Drawer Records tab | RULED 2026-10-06: NOT changed in this change. Follow-up #1373 | Same title and excerpt in the drawer | The tab reads a different shape (`change-route.mjs:535`) and would add a second render path to review. |

### Amendment to #879 D3

`openspec/changes/archive/879/design.md:27` (D3) says the snapshot carries index metadata and a
file pointer, never record content. This change amends it, here and not in the archive (which is
not edited): the snapshot now also carries `summary`, a bounded derivation of the content (title
at most `TITLE_MAX`, excerpt at most `EXCERPT_MAX`, work bounded by `SCAN_MAX`). The full content
is still never in the snapshot; it is read on demand through `/api/record/{id}` (D159).

## Data flow

    .memory/records/*.jsonl -> readRecords -> projectRecord + summarizeRecord
       -> snapshot.records[].summary -> buildMemoryModel.recentRow -> renderMemory (textContent)

    click a row -> GET /api/record/{id} (record-route.mjs: readdir + one file read, capped)
       -> renderOffThread (worker, 1500 ms budget) -> renderMdBlocks into the detail row

## Interface

```js
// record-summary.mjs (pure: no node: import, no clock)
export const TITLE_MAX, EXCERPT_MAX, SCAN_MAX, NO_TEXT, EMPTY_TEXT;
export function summarizeContent(content)
  // -> {ok:true, title, excerpt, truncated} | {ok:false, reason}
```

```js
// record-route.mjs (node: reads one file; the server calls it)
export const RECORD_ID_RE = /^rec-[0-9a-f]{16}$/;
export function buildRecordView({ root, id })
  // -> {status: 200, body: {ok:true, id, file, content, truncated, truncatedAt}}
  //  | {status: 200, body: {ok:false, reason}}   (content absent / empty: NO_TEXT / EMPTY_TEXT)
  //  | {status: 404, body: {ok:false, reason}}   (unknown id)
  //  | {status: 400, body: {ok:false, reason}}   (id fails RECORD_ID_RE)
```

`recentRow` adds `summary` through `summaryOf`, which guards its shape (a row with no usable summary says
`SUMMARY_MISSING`, one sentence, never "unreadable"). In `app.js` the RECORD cell becomes a stack:
a `button.memory-toggle` holding `span.memory-record-title` (title or reason), then
`span.memory-record-excerpt` (omitted when `!summary.ok`), then `span.memory-id`. Each text span's
`title` attribute equals its own text. The wording of the loading and failure states is built by
pure `memory-model.mjs` helpers (`RECORD_LOADING`, `recordFailure`), so `app.js` only renders.

## Payload / render budget

Estimate (measured numbers are in apply-progress.md): the summary adds the title (about 110 chars
measured on samples), the excerpt (up to `EXCERPT_MAX = 120`) and about 45 B of keys per row. It is
served from localhost and SSE sends a section only when it changes (`diff.mjs`). The ledger DOM
gains one hidden detail row per ledger row (50 rows), empty until opened. The summary involves no
markdown. Markdown is tokenized only for an opened record, in the worker under #1218's 1500 ms
budget.

## Testing

| Layer | What | How |
|---|---|---|
| Unit | S2, S3, S5, S6, S7, bold-lead vs first line, code-point cut, caps | `record-summary.test.mjs` |
| Unit | `projectRecord` carries `summary`, not `content` | update `snapshot.test.mjs:321` |
| Unit | `recentRow` passes `summary` through; loading/failure wording helpers | `memory-model.test.mjs` |
| Unit | `/api/record/{id}`: ok, truncated, unknown id, traversal id, bad id, empty and absent content | `record-route.test.mjs` |
| Server | route wired, GET/HEAD only, 404 shapes, `KNOWN_ROUTES` | `server.test.mjs` |
| Fake DOM | S1, S4: cell text AND `title` attributes, id present, no element from content | `test-support/dom.mjs` + `load-app.mjs` |
| Fake DOM | S9-S13: toggle, pending, rendered markdown via the worker, failure states, many open, re-render keeps open | `static/record-expand-render.test.mjs` |
| Guard | `app-source-guard.test.mjs` still passes (textContent only) | existing |

## Size

`record-summary.mjs` about 90 lines, `record-route.mjs` about 60, `server.mjs` +10, `snapshot.mjs`
+3, `memory-model.mjs` +25, `app.js` +110, `app.css` +40: about 340 gated lines (tests and
`openspec/` are outside the budget). Budget 1000.

## Maintainer rulings

RULED 2026-10-06: (a) Excerpt AND full content on click, in this change (D159).

RULED 2026-10-06: (b) The full content is rendered as markdown through the SDD reader's worker path (D161). The excerpt stays plain text.

RULED 2026-10-06: (c) `EXCERPT_MAX = 120`, `TITLE_MAX = 200` (D158).

RULED 2026-10-06: (d) The drawer Records tab is not changed; follow-up #1373 (D162).

RULED 2026-10-06: (location) The full content opens inline, in a row below the clicked one; not the drawer (D160). Many rows may be open at once.

## Open questions

- [ ] Remove `projectRecord`'s dead `title` copy (`snapshot.mjs:136`), or keep it? Default: keep it. It is out of scope and harmless.
