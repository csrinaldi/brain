# Why this draft exists (issue #701)

`brain/core/**` is **Tier 3** — nothing under it is committed by this change (hard constraint,
verified with `git log --name-only main..HEAD | rg 'brain/(core|project)/'` before every commit
in this branch).

`memory-format.md` §Layout (lines 19-47) is nonetheless silent on **who writes a record into a
worktree** — it documents the file layout, not the export path that populates it. Issue #701's
whole defect was exactly that gap: nothing said `memory:share` materializes *every*
project-scoped observation into *whichever worktree ran it*, so nothing said what changed once
the export scoped itself to the upstream base. Without a note here, the next reader who wants to
know "why did this record show up in my worktree" has to re-derive it from six files
(`engram.mjs`, `upstream-records.mjs`, `staged-records-check.mjs`, `store.mjs`, this ticket's
`design.md`, and the `pre-commit` hook).

## What is attached here

- `memory-format.note.draft.md` — the proposed addition, sized to slot into §Layout right after
  the existing bullet on `records/<yyyy-mm>-<id>.jsonl`.

## What this is NOT

- **Not applied.** No file under `brain/core/**` or `brain/project/**` is touched by this
  change's commits.
- **Not a format change.** ADR-0017 is not amended — the note describes an export-scope
  *behaviour*, not the record schema, the id, or the merge policy.

## What a human should do with it

Review the draft, adjust tone/placement if needed, and paste it into `memory-format.md` under
`## Layout` in a follow-up commit that a maintainer authors directly (Tier 3's own rule: brain
never rewrites `brain/core/**` on a consumer's behalf, including from inside this repo's own
tooling).
