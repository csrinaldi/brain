---
status: archived
issue: 1061
archived_at: 2026-09-19
archived_against: c061b2a7 (origin/main; PR #1063 squash-merged)
---

# Archive report — issue-1061-engram-duplicate-heal

**The change is closed, and the store is healed.** Issue #1061 (memory 2.0 epic #864,
task 1.2a) shipped as PR #1063, squash-merged into `main` as `c061b2a7` on 2026-09-19. The
maintainer then ran the heal once on the shared engram store; the audit's backend line moved
from `rows 2451 · distinct 2448 · duplicated 3` to `rows 2448 · distinct 2448 · duplicated 0`.
All 14 tasks are `[x]`; the 5 requirements and 10 scenarios are covered; the post-merge
verify report returned **pass** with 0 CRITICAL and 0 WARNING.

## What was archived

`npm run brain:change:archive -- issue-1061-engram-duplicate-heal` moved the folder to
`openspec/changes/archive/1061/` and created the canonical spec
`openspec/specs/memory-backend/spec.md` (REQ-MB-1 … REQ-MB-5) under an `[issue-1061]`
provenance header. Until this change, no canonical spec owned the memory backend contract.

The verify report carries the `gentle-ai.verify-result/v1` envelope (evidence revision
`sha256:99083298d6a68d57f27dbac6b2ed2a2db4740b3de37d2d7e7712ef4e1f7a879b`).

## Delivery

- `c061b2a7` — PR #1063 (`fix(memory)`, closes #1061): `npm run brain:memory:heal-duplicates`
  reads an `engram export`, groups live `rec-` rows by `topic_key`, keeps the lowest
  observation id, and with `--apply` hard-deletes the rest one id at a time, stopping at the
  first failure and verifying afterwards. It refuses, deleting nothing, on differing copies,
  more than two live rows, an unknown export shape, or engram outside 1.20.x. It never
  touches `.memory/records/`.
- The real run (evidence on #1061): the read-only steps (version, `doctor`, audit, snapshot
  `~/engram-pre-1061.json`, dry-run listing 3092, 3093, 3094) were run by the orchestrator;
  the maintainer ran `--apply` (`deleted 3 row(s): 3092, 3093, 3094`, `heal verified`); a
  second run reported nothing to heal.

## Facts measured during the change (engram 1.20.0, throwaway store)

- A soft delete (`engram delete <id>`) keeps the row in `engram export` with `deleted_at`
  set; only `engram delete <id> --hard` removes it. `delete` takes the numeric id, with
  `--hard` after it.
- Re-importing the same export does not duplicate (deduped by `sync_id`); importing a copy
  with rewritten `sync_id`s does — the shape of the pre-guard duplicates.
- The three duplicated pairs were byte-identical (content, title, type), created in the same
  second, ids 3089-3091 and 3092-3094: one import ran twice before the #820 guard.

## Open follow-ups

- The audit's backend line counts a soft-deleted row as a live row (the export returns it
  with `deleted_at`). Not triggered here because the heal hard-deletes; task 6.1 should
  decide whether the audit filters `deleted_at`.
- The records line still reads `excess 2` (`rec-4a22e13fd3c3aebd`, `rec-95740755792f0f1c`):
  divergent copies of one record inside their own file, kept by `merge=union`. Out of scope
  under ADR-0017 (report, never collapse). Task 6.1 must say which layer its
  "distinct = rows" criterion measures.
- engram 2.0.0 is available; the heal refuses outside 1.20.x until its behaviour is measured
  again.
- The record of this ticket (`rec-b2ce326d64c7a31e`) travels on lane PR #1064.
