<!--
DRAFT — proposed addition to brain/core/methodology/memory-format.md, §Layout.
Not applied anywhere. See README.md in this directory for why this exists and
what a human should do with it. Suggested placement: immediately after the
existing bullet on `records/<yyyy-mm>-<id>.jsonl` (currently line ~37).
-->

- **Which worktree a record lands in.** `memory:share` (`engram.mjs#dualWriteRecords`) exports
  from the host-global engram DB into `.memory/records/` — **project-scoped, not
  worktree-scoped**. Left unscoped, every worktree that runs `share` re-materializes every
  project record the DB holds, whether or not that worktree authored it (issue #701). Since
  #701, the export declines a candidate whose `id` is already present in `records/` at the
  **upstream base** (`origin/main`, or an operator-stated `BRAIN_MEMORY_UPSTREAM_REF` /
  `memory.upstreamRef` config key) — content-addressed only, no authorship semantics. A record
  authored in a **sibling** worktree that has not yet reached the upstream base is not covered by
  this predicate and may still be written into another worktree; this is a known, accepted
  residual (it self-heals once that record lands on the trunk), not something this scope claims
  to solve. A `pre-commit` gate (`staged-records-check.mjs`) refuses staging a
  `records/*.jsonl` file that is byte-identical to the upstream base's copy of that path, using
  the same predicate — so an accidental `git add .memory/` cannot commit a record the trunk
  already durably holds.
