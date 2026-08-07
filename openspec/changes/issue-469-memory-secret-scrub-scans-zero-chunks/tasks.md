---
status: draft
issue: 469
---

# Tareas — memory secret scrub scans zero chunks (issue 469)

- [x] T1 — **Reproduce before designing.** Plant real chunks, run all four git spellings, and
      record which report files and which report the directory. Result in design D1: exactly
      one works, and it is not the one that reads as most precise.
- [x] T2 — `_defaultChangedChunkFiles` reads the filesystem (REQ-469-1, REQ-469-2). `_spawn`
      replaced by `_listDir`; exported name, arity and return type unchanged, so
      `scrubMaterializedChunks` calls it identically.
- [x] T3 — Docstring rewritten (REQ-469-4): it now describes the filesystem read, records
      that the git query returned an empty set on every run, carries the four-spelling
      measurement that rules out `--ignored`, and states that the "materialized THIS run"
      boundary did not narrow the scan — it emptied it.
- [x] T4 — `share()` calls `assertExportDestinationIsRead(root, { _resolveDir })` after the
      export and **before** the scrub (REQ-469-3). Throws, does not warn.
- [x] T5 — Tests for E1–E7, plus the acceptance case the spec claims and the first draft did
      not measure: a planted secret must abort **and** leave `records/` unwritten. The first
      version only asserted the throw; `appended` is now asserted empty.
- [x] T6 — **Red-proofed: 11 mutations, 11 RED, 0 inert.** Each asserted its substitution-site
      count before running, and the harness reports `inert: 0` — the #405 lesson applied up
      front rather than discovered at round 10, where four red-proofs turned out semantically
      inert while looking correct.
      | mutation | result |
      | --- | --- |
      | the git query restored (the original defect) | RED ×4 |
      | the read error swallowed to `[]` | RED |
      | `ENOENT` treated as an empty directory | RED |
      | the `isFile()` check dropped | RED |
      | the `.jsonl.gz` filter dropped | RED |
      | the `.engram` check removed from `share()` | RED |
      | the `.engram` check degraded to a warning | RED ×2 |
      | compared on raw paths instead of resolved | RED |
      | the `.engram` check moved AFTER the scrub | RED |
      | the records append moved BEFORE the scrub | RED ×3 |
      | the scrub skipped entirely | RED ×7 |
- [x] T7 — 2633 tests, 0 fail · `repo:check` ✓ · `brain:nav` ✓ · governed diff **152**.
- [ ] T8 — Cold review rounds. Criterion, as ruled by the maintainer on #405: **two
      consecutive rounds with nothing at blocker or correction severity.**
      Carry #405's rounds 21-29 forward as method, not as narration:
      - a round's entry records commit, verdict, findings, evidence — **no narration
        paragraph**, because on #405 the paragraph became the next round's finding, seven
        times in a row
      - **no counts of rounds** anywhere; enumerate instead
      - the PR body and this ledger land in **one edit or neither does**
      - sweep a diagnosis by **claim, not by wording**

## Micro-decisiones en caliente

- **`--ignored` is not the fix, and that is measured rather than argued.** Three of the four
  git spellings report `!! .memory/chunks/` — the directory — which the existing `.jsonl.gz`
  suffix filter drops, so the scan stays at zero. Only plain `--ignored -uall` lists files;
  `--ignored=matching -uall`, which reads as the tighter request, does not. Recorded in
  design D1 as the reason for choosing the filesystem: a gate that one plausible flag edit
  silently disarms is the defect being fixed, re-armed.
- **Scanning the whole store is a decision, not a side effect.** Both viable fixes scan every
  chunk; the git boundary was empty, not narrow. Restoring a real boundary is deliberately
  deferred to a ticket with a measurement in it (design D2).
- **The `.engram` check compares resolved paths, not symlink type.** What matters is that the
  export's directory and the reader's directory are the same one; `realpathSync` answers that
  for a symlink, a bind mount, or anything else.
- **The four replaced tests were not wrong about git — they were about the wrong question.**
  They pinned what `git status` printed and never what the function returned, so all four
  stayed green across every run in which the scan was empty. That is why this file now drives
  outcomes over a real temp directory with real gzip chunks: a suite that pins the plumbing of
  a query which cannot return anything is green for a gate that does nothing.
- **Cutover finding 7 (id:388) dissolves rather than moves.** The old code filtered porcelain
  DELETION lines so `scrubChunkFile` would not `readFileSync` a path that no longer exists.
  A deleted file is not in `readdirSync`, so the whole class is now structurally unreachable
  and needs no filter. The `isFile()` check is not its replacement — that one guards the
  opposite case (a *directory* named `*.jsonl.gz`), which is exactly what three of the four
  git spellings returned and what a suffix-only filter cannot see.
