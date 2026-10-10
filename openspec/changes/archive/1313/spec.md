---
status: draft
issue: 1313
---

# Spec — memory-ledger-shows-content (issue 1313)

## Delta requirements

**R1313-1 — A record's title comes from its own content.** When `content` is a string whose first
line is a bold lead `**<text>**` (the C4 fold, memory-format.md item 8), the title is `<text>`.
Otherwise the title is the first non-empty line of `content`, with markdown markers stripped. No
title is invented, and a raw `title` field on a record is not consulted.

**R1313-2 — The excerpt is bounded plain text.** The excerpt is the content after the title line,
with markdown markers stripped (emphasis, inline code, heading and list markers; a link keeps its
text and drops its URL) and every whitespace run collapsed to one space. It is at most
`EXCERPT_MAX` (120) characters; a longer excerpt is cut on a code-point boundary, ends with `…`, and
carries `truncated: true`. The title is capped at `TITLE_MAX` (200) the same way. Work per record is
bounded: at most `SCAN_MAX` characters of `content` are examined.

**R1313-3 — A record with nothing to show says so.** A record whose `content` is absent or not a
string carries `{ok: false, reason: NO_TEXT}`; one whose content is empty or whitespace-only
carries `{ok: false, reason: EMPTY_TEXT}`. Both wordings are exported constants and are the only
place the sentence is written. Neither uses the word "unreadable": the record was read.

**R1313-4 — The snapshot carries the summary, not the content.** `projectRecord` adds
`summary: {ok: true, title, excerpt, truncated} | {ok: false, reason}` to each row. `content` itself
is still never projected (#879 D3, amended by this change, design.md D157, to admit a bounded summary).

**R1313-5 — The ledger row shows it.** In the Memory view, the RECORD cell shows the title, then
the excerpt, then the record id. When `summary.ok` is false, the reason sentence takes the title's
place and no excerpt is shown. The id and the source stamp are always present. Every string is
set as text content, never as markup.

**R1313-6 — One wording per fact.** The title element's `title` attribute is the same title string
the cell shows; the excerpt element's `title` attribute is the same excerpt string. A reason row's
`title` attribute is the same reason sentence. No legend or tooltip rephrases these.

**R1313-7 — No new wait on the first render.** The summary is computed from records `readRecords`
already parses. Rendering the ledger makes no fetch, no worker call and no markdown tokenizing;
the Memory view still renders at most `MEMORY_RECENT_CAP` rows. The record route (R1313-8) and the
worker (R1313-10) are reached only by a click.

**R1313-8 — A local, read-only route serves one record's content.** `GET /api/record/{id}` (GET
and HEAD only) answers for an `id` matching `^rec-[0-9a-f]{16}$`. The id is never joined into a
path: the file is the entry of `.memory/records/` whose name ends `-<id>.jsonl`, found by listing
the directory. The content is capped at `DOCUMENT_CAP` bytes on a UTF-8 boundary and the answer
says `truncated` and where (`truncatedAt`, in bytes: the words `truncated at <N> bytes` an SDD document uses). An unknown id answers 404 `{ok:false, reason}`; an id that fails the pattern
(including `..`, `/`, encoded separators) answers 404 `not found` and reads nothing. A record
with absent or empty content answers `{ok:false, reason: NO_TEXT | EMPTY_TEXT}` (the R1313-3
sentences). The route is added to `KNOWN_ROUTES`.

**R1313-9 — A ledger row opens its full content inline.** Each RECORD cell carries a native
`<button>` toggle with `aria-expanded` and `aria-controls`; opening it shows a detail row directly
below the clicked row, closing it removes the content. Rows open independently (many at once). The
set of open ids survives a re-render of the view that is not a user action.

**R1313-10 — The content is rendered as markdown off the main thread.** The opened content goes
through the SDD reader's path: `renderOffThread` (worker, `RENDER_BUDGET_MS`), `renderMdBlocks`.
Markdown is never tokenized on the main thread; with no worker, or on a timeout or worker
failure, the page says so with the shared notice and shows the content as plain text.

**R1313-11 — Honest pending and failure.** While the route has not answered the detail row says
`loading record…`. A route answer with `ok:false` shows its `reason`; a network failure or a
non-OK status shows `the record <id> could not be loaded: <detail>`. The word "unreadable" is
used for neither, and a value not yet read is never called unreadable.

**R1313-12 — The drawer Records tab is unchanged** (follow-up #1373).

## Scenarios

- **S1** GIVEN a record with `content: "**Poller holds one timer**\n\nWhat: arm()/disarm() …"`,
  WHEN the Memory view renders, THEN its RECORD cell reads `Poller holds one timer`, then
  `What: arm()/disarm() …`, then its `rec-…` id; the source stamp cell is unchanged.
- **S2** GIVEN content whose body after the title exceeds `EXCERPT_MAX`, THEN the excerpt is exactly
  `EXCERPT_MAX` characters ending in `…`, and `truncated` is true.
- **S3** GIVEN content `"## Goal\n- ship **it** [now](https://x)"` (no bold lead), THEN the title is
  `Goal` and the excerpt is `ship it now`.
- **S4** GIVEN a record with no `content` key, THEN the row shows NO_TEXT in the title slot, the
  element's `title` attribute equals NO_TEXT, and the id and source stamp are present.
- **S5** GIVEN content `"   \n  "`, THEN the row shows EMPTY_TEXT, not NO_TEXT.
- **S6** GIVEN content containing `<script>alert(1)</script>`, THEN the excerpt is shown as those
  literal characters and no element is created from them.
- **S7** GIVEN a 1 MB content string, THEN summarizing it examines at most `SCAN_MAX` characters.
- **S8** GIVEN a records section with `ok: false`, THEN the view still says
  `the memory ledger could not be read: <reason>` (unchanged).
- **S9** GIVEN a ledger row, WHEN its toggle is clicked, THEN the toggle reads
  `aria-expanded="true"`, a detail row appears directly after the row, it first says
  `loading record…`, then shows the content rendered as markdown (a heading is an `h*`, a list is
  a `ul`), and one worker was spawned. Clicking again removes it and sets `aria-expanded="false"`.
- **S10** GIVEN a route answer `{ok:false, reason}`, THEN the detail row shows that reason. GIVEN
  the fetch rejects or answers non-OK, THEN it shows `the record <id> could not be loaded: <detail>`.
- **S11** GIVEN content `<script>alert(1)</script>` or `[x](javascript:alert(1))` in the opened
  record, THEN no `script` element exists and no anchor carries a `javascript:` href.
- **S12** GIVEN two rows opened, THEN both detail rows are visible; a stream frame re-renders the
  view and both stay open without a new fetch.
- **S13** GIVEN no `Worker` in the browser, THEN the detail row shows the unavailable notice and
  the content as plain text; no markdown is tokenized on the main thread.
- **S14** GIVEN `GET /api/record/rec-0123456789abcdef` for an existing record, THEN `{ok:true, id,
  file, content, truncated:false, truncatedAt:null}`. GIVEN an unknown valid id, THEN 404 with a reason. GIVEN
  `/api/record/..%2F..%2Fpackage.json`, `/api/record/rec-xyz` or `/api/record/rec-` + 17 hex, THEN
  404 `not found` and no file is read.
- **S15** GIVEN a record larger than `DOCUMENT_CAP` bytes, THEN the route returns at most that many
  bytes and `truncated: true`, and the detail row says `truncated at <N> bytes`.
- **S16** GIVEN a record with empty content, THEN the opened row shows EMPTY_TEXT, never
  "unreadable".
