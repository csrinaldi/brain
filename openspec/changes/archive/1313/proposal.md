---
status: draft
issue: 1313
---

# Proposal — memory-ledger-shows-content (issue 1313)

## What

Each row of the Memory view's ledger shows what the record says: its title and a bounded,
plain-text excerpt of its content, next to the id, type, actor (human/agent) and source stamp it
already shows. Clicking a row opens the record's full content inline, below the row, rendered as
markdown through the SDD reader's worker path.

## Why

The RECORD column today shows only `rec-<hash>` (`brain/scripts/ui/static/app.js:450`). A reader
cannot tell one record from another without opening `.memory/records/` by hand. The design's
memory ledger (`stitch_brain_ui_dashboard_design_system/brain_ui_minimalist_surface_2/code.html:449-477`)
shows a one-line summary per record beside the actor tag and type. Issue #1313.

Measured on current `main`: none of the 2505 record lines carries a `title` field (memory-format.md
§"Engram fields with no brain equivalent" item 8: C4 folds the title into `content` as a leading
`**…**` line), and all 2505 `content` values begin with `**`. So `projectRecord`'s `title` copy
(`brain/scripts/status/snapshot.mjs:136`) is never set, and the snapshot carries no content at all
(D3 of #879, `openspec/changes/archive/879/design.md:27`). The title must be derived from `content`.

## Scope

Includes:
- A pure summarizer that derives `{title, excerpt, truncated}` from a record's `content`, plain
  text only, bounded in length and in work.
- `projectRecord` carries that bounded summary per record (an explicit amendment of #879 D3: a
  bounded summary, never the content).
- `memory-model.mjs` passes the summary to each ledger row; `app.js` renders title and excerpt as
  text in the RECORD cell, keeping the id and the source stamp.
- A record whose content is absent, not a string, or empty says so in its row, in one wording.
- A new local read-only route `GET /api/record/{id}` that returns one record's content (bounded),
  and an inline expansion under the ledger row that renders it as markdown through the existing
  worker and render budget (#1198/#1218), with honest pending and failure states.

Does not include:
- The drawer Records tab (`drawer-model.mjs:221`), which has the same gap: follow-up #1373
  (RULED 2026-10-06, design.md D162).
- Any change to the record format, the store, or `.memory/index.jsonl`.

## Acceptance

- [ ] Each ledger row shows the record's title plus a bounded excerpt, as text (no HTML).
- [ ] Each row keeps its id and source stamp.
- [ ] A record whose content cannot be shown says so in its row, never blank.
- [ ] Clicking a row shows the record's full content as rendered markdown, inline under the row,
      with a pending state and a stated failure.
- [ ] The first render does not wait on anything new: no new fetch, no markdown tokenizing on the
      main thread (#1218), no forge read (#1257). The record route is called only on a click.
- [ ] The snapshot payload growth is measured and stated in the PR.

## Constraints

- One wording per fact across text, `title` attribute and legend (#1308/#1309/#1312 reviews).
- A value that is read but absent is never called "unreadable".
