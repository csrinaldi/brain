---
status: archived
issue: 874
archived: 2026-09-11
---

# Archive Report: #874 — record first, backend after

## Destination

`openspec/changes/archive/874/` — via `npm run brain:change:archive -- issue-874-record-first`
(numbered destination was free; the verb was used, not `git mv`).

`archiveChange()` reported no `openspec/specs/` merge target (`git status --short
openspec/specs/` is empty after the run) — consistent with the proposal's own
"Modified capabilities: None in `openspec/specs/`" note: this change's
`spec.md` is a standalone per-change spec (repo convention, cf.
`issue-864-memory-2-0/spec.md`), not a capability delta merged into a shared
spec.

## Delivery

- PR A (sub-ticket #924, `Part of #874`): merged as `8e1e8bc7`.
- PR B (`Closes #874`): merged as `56de7408`.
- Issue #874: CLOSED.

## Verify verdict

PASS — 0 CRITICAL, 0 WARNING, 3 disclosed SUGGESTION (non-blocking, already
known). Full detail: `verify-report.md` in this same folder, also persisted
to engram (`sdd/issue-874-record-first/verify-report`).

## What moved to epic task 2.4 (per O1, ratified 2026-09-11)

- `dualWriteRecords()` (`engram.mjs:252-269`) — kept, unchanged, with the
  #924 hydrated-topic gate intact; its two direct-call tests
  (`engram.upstream-scope.test.mjs`, `engram.duplicates.test.mjs:46-65`)
  stay green.
- Ledger rows 6-7 (manifest untracking, `.gitattributes` merge driver,
  `bootstrap.sh` driver registration, `.engram` symlink confinement,
  `.memory/legacy/*.gz`, `secret-scrub.mjs`'s gunzip path, `.gitignore`
  chunk block) — untouched by #874, confirmed via `git log 8e1e8bc7..56de7408`
  showing zero commits on those files.

## Owed by the maintainer

- Promote both `brain-drafts/` amendments via `brain:promote`, in order
  (Amendment 1 — `save` column flip — before Amendment 2 — rule 2 flip,
  since Amendment 2 states it never touches the `save` column "Amendment 1
  owns that one").
- `brain/core/methodology/memory-backend-contract.md` still reads the
  pre-#874 "Today:" text (`unsupportedOp`, `plainfiles`-pinned) at the `save`
  row — confirms neither draft has been promoted yet.
