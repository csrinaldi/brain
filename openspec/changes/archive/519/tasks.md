---
status: draft
issue: 519
---

# Tasks — #519

- [x] **T1** Diagnose. Two phases: blocked by #469 until Aug 8, then unblocked and never
      resumed. Capture requires engram; `command -v engram` fails in the remote agent
      environment, and every session there prints the skip line and proceeds.
- [x] **T2** `step4bMemoryRecency` — reads committed records, not engram.
- [x] **T3** Banner line, in both locales; silent on a fresh store.
- [x] **T4** Eight guards: newest across files · unknown ≠ fresh · corrupt skipped ·
      answers without engram · fresh renders nothing · stale renders the age · unknown
      renders as unknown · an absent field is additive.
- [x] **T5** `memory-presence.mjs`'s header corrected — it named a directory #247 retired —
      and its repo-scoped meaning stated, since its name invites a stronger reading.
- [x] **T6** Full suite: **2934 tests, 0 failures**.
- [x] **T7** Four mutations, diffs printed first: unknown→0 · the line never emitted ·
      the field never threaded · a corrupt line promoted to newest.

## Recorded

- [x] **T8** M3 was GREEN on the first run. The composition test injected a fresh recency,
      which renders no line, so losing the field entirely was invisible to it. Fixed by
      injecting a stale value. A test that cannot see the thing it exists to see is the
      same shape as the gate this ticket is about.
- [x] **T9** Not done, on purpose: `memory-gate` is untouched. Its three options are a
      ruling, and tightening a gate while the writer is unreliable trades a silent outage
      for a total block.
