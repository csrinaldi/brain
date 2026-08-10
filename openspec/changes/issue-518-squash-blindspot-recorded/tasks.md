---
status: draft
issue: 518
---

# Tasks

- [x] **T1** `countUnauditedNonMerges` — the exact complement of the walk's filter, `null` on
      an unreadable range.
- [x] **T2** The `[WARN]` line, advisory.
- [x] **T3** `KNOWN-LIMITATIONS` — the measurement, what it does and does not mean, the
      operator action, and the pointer to (b).
- [x] **T4** Four guards: a squash-only window is reported · a merges-only window is silent ·
      the count is the unaudited set · unknown ≠ zero.
- [x] **T5** Full suite: **2945 tests, 0 failures**.
- [x] **T6** Four mutations RED: the warn never emitted · the count includes merges · unknown
      reported as zero · the count fed into `uncomputable`.

## Recorded

- [x] **T7** The unknown-vs-zero guard was green at first because it asserted an `||` over CLI
      output and the audit dies on a bad range before the count runs. Driven as a unit now.
- [x] **T8** One mutation attempt (`process.exitCode = 1`) landed textually and had NO effect —
      the script calls `process.exit(code)` explicitly, which overrides it. Replaced with one
      that bites (`uncomputableCount += skipped`). A mutation that changes the source and not
      the behaviour is the same false green as one that fails to match.
- [x] **T9** (b) NOT done here, deliberately, and the ticket is re-scoped to say so.
