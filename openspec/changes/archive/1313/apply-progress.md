---
status: done
issue: 1313
---

# Apply progress — memory-ledger-shows-content (issue 1313)

Mode: Strict TDD. Single PR, ask-on-risk, budget 1000 gated lines. Tasks: 14/14 done.

## TDD cycle evidence

| Task | RED (failure seen) | GREEN | REFACTOR |
|---|---|---|---|
| 1.1-1.3 summarizer | `record-summary.test.mjs` run with no module: `ERR_MODULE_NOT_FOUND`, 1 fail | 18 pass | the bold-lead branch kept; empty-title promotion and table-separator rows added later, each with its own failing test first (19, 20 pass) |
| 2.1 projectRecord | `snapshot.test.mjs`: 2 fail (the old deepEqual and the new `summary` test) | 54 pass | none |
| 2.2 model | `memory-model.test.mjs`: `SyntaxError ... does not provide an export named 'RECORD_LOADING'` | 34 pass | `recordTruncated` added with its test |
| 3.1 route | `record-route.test.mjs`: `ERR_MODULE_NOT_FOUND` | 10 pass | `truncatedAt` added to the answer after the page test needed it (3 fail, then pass) |
| 3.2 server | `server.test.mjs`: 2 fail (`KNOWN_ROUTES`, the new route test) | 62 pass | none |
| 4.1-4.3 page | `record-expand-render.test.mjs`: 16 of 16 fail (no toggle, no title element) | 16 pass | `async` IIFE replaced by a named `fetchRecord` after `app-source-guard` flagged it; `requestDoc` gained a `store` parameter |
| harness | `dom.test.mjs` for `insertBefore`, `nextSibling`, `records` | 18 pass | none |
| perf | n/a | n/a | summarizer cut from 90 ms to 70 ms per 2503 records: lines read only until the excerpt is full, `cap` no longer expands a whole body |

## Verification at close

- `npm test`: 8282 tests, 8279 pass, 0 fail, 3 skipped (the 3 skips are pre-existing). One earlier run had 1 fail: the publish canary, fixed below.
- `npm run brain:repo:check`: no prohibited references, artifact structure valid.
- `npm run brain:nav`: navigation intact.
- Gated diff vs `origin/main` (tests, `openspec/changes`, `.memory` outside the budget): 239 added / 8 removed in tracked files, 182 lines in two new files (`record-summary.mjs` 112, `record-route.mjs` 70), 32 in `test-support/dom.mjs`: about 453 added, 10 removed. Budget 1000.
- `node --test test/publish-allowlist.e2e.test.mjs`: tarball 10.31 MiB / 914 files against the 10.3 canary: over. Raised `SIZE_CANARY_MB` to 10.4 with a line naming #1313 and what grew (two new modules, the page code and CSS, three new `*.test.mjs` suites, harness additions); 7 pass.

## Measurements (this repo, 2503 record rows)

| What | Before | After |
|---|---|---|
| `JSON.stringify(snapshot.records).length` | 450155 B | 1085969 B (+635814 B, 2.41x; +254 B per row) |
| `readRecordRows` build (5-run mean, idle machine) | 194 ms | about 265 ms (+70 ms, all of it `summarizeContent`) |
| `JSON.stringify(records)` | 1.6 ms | about 6 ms |
| `GET /api/snapshot` total (live server) | not measured before | 1475859 B after |

The first render does not wait on anything new: no fetch, no worker. The extra cost is node-side, once per snapshot recompute, and SSE sends a section only when it changes.

## Mutations (each failed a test, then was reverted; the suite is green again)

| Mutation | Failed tests |
|---|---|
| Title taken as the raw first line instead of the bold lead's text | 8 (`record-summary` 1-5, 18, 19; the page's RECORD cell test) |
| Excerpt not bounded (`cap` bypassed) | 2 (S2, the code-point cut) |
| Route accepts a traversal id (id pattern check removed in `buildRecordView`, route regex widened to `.+`) | 2 (route refuses a bad id; server traversal test) |
| Full content tokenized on the main thread (`markdownTree` called in `showRecord`, no worker) | 5 (the #1218 R1218-4 guard, S9, no-Worker S13, failed-worker, evict) |
| An empty record worded "unreadable" | 4 |

Note on the first mutation: removing only the bold-lead branch (`BOLD_LEAD`) is an equivalent mutant, because the fallback strips the same `**` markers. The mutation that matters is taking the title without the strip, and that one is caught.

## Real-browser proof (headless Chrome, CDP)

- `shots/v1313-ledger.png`: the live repo (2503 records). RECORD column shows, per row, a bold title (`Lane cards show the joined PR and its latest verdict (#1312)`), one muted excerpt line ending in `…`, then the `rec-…` id in mono. Type, actor (with AGENT tag) and source stamp are unchanged.
- `shots/v1313-expanded.png`: the same view with the first row open. A detail row spans the table under the row: the file name, then the full content as markdown (bold lead, paragraph). The toggle title turns accent colour.
- `shots/v1313-expanded-rich.png` and `-lower.png`: a scratch root with four hand-made records, all four open. One shows a rendered heading, bullet list, table, code block and link; the absent-content and empty-content rows say `this record has no content field` and `this record has no text in its content`; the hostile one shows `<script>alert(1)</script>` and the `javascript:` link as literal text. (This server started before the table-separator fix, so its excerpt still shows `|---|`.)

All paths are under `/tmp/claude-1000/-home-gandalf-IA-brain/f80e7b18-3c95-4821-a98d-a3668bc37feb/scratchpad/shots/`. Both servers were stopped by PID.

## Deviations and findings

- The tarball canary was raised to 10.4 (above).
- `test-support/dom.mjs` gained `insertBefore`, `nextSibling` and a `records` option (a harness change, tested in `dom.test.mjs`).
- `requestDoc` gained an optional `store` parameter so opened records use their own map: an issue change empties `docTrees` and must not cancel an open record.
- The route answers 400 from `buildRecordView` for a bad id, but the server's own regex sends every non-matching path to the generic 404, so a traversal id is `404 not found`, as the spec says.
- Residual: a record whose first 2000 characters are all whitespace reads as `EMPTY_TEXT` even if text follows; the scan window is the contract (design D154).
- The Memory view's detail row repeats the reason sentence for an opened record with no text (once in the title slot, once in the opened row); both are the same string.
