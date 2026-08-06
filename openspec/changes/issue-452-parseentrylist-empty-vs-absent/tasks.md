---
status: tasks
issue: 452
epic: 313
artifact_store: openspec
topic_key: sdd/issue-452-parseentrylist-empty-vs-absent/tasks
---

# Tasks — `parseEntryList` distinguishes empty from absent (issue #452)

- [x] T1 — SDD artefacts: proposal / spec (REQ-452-1..6) / design / tasks. Baseline on
      `main` @ `c724942`: **2482 tests / 2481 pass / 1 skip / 0 fail**. State space
      measured against the real parser before writing anything.
- [x] T2 — RED first (design D5 steps 1-2): the three-state case at `parseEntryList`'s
      level and the `'follow_ups' in result` case at `parseVerdict`'s, both written
      against the SHIPPED code and observed failing on the present-but-empty state only.
- [x] T3 — the fix: `return entries` — `null` recovers its single meaning. JSDoc updated
      to name all three states (it currently documents two).
- [x] T4 — REQ-452-3: pin the inline `findings: []` path unchanged, so the repair to the
      broken encoding cannot silently move the working one.
- [x] T5 — REQ-452-4: the `renderVerdict` → `parseVerdict` round trip for the empty list.
- [x] T6 — REQ-452-5/6: full suite as the check on the truthiness change (D4), and
      REQ-409-6's two pins verified still green — the operational test for staying out of
      the renderer half.
- [x] T7 — red-proof pass: restored the collapse (`entries.length > 0 ? entries : null`),
      **verified it landed on executable code first** (line 105, not the JSDoc above it) →
      the two present-but-empty cases go red, the absent / with-entries / inline controls
      stay green. Restored; 21/21.
- [x] T8 — full suite **2489 pass / 1 skip / 0 fail** (+7 from baseline) · `repo:check` ✓ ·
      `brain:nav` ✓ · diff 24 counted lines against `lite`'s 1000. **REQ-409-6's two pins
      green** — the operational check that the renderer half stayed untouched (D3).
- [x] T9 — **#477 filed**: the inline encoding's `parseJsonScalar` null is a FOURTH meaning
      of the same sentinel — a corrupt findings list parses as no findings, i.e. "could not
      be read" resolving as "nobody found anything". Worse direction than the ticketed half.
      Measurement and three candidate designs recorded there; `parseEntryList`'s JSDoc now
      names the overload so the next reader does not rediscover it.
- [x] T10 — PR to `main`, `Closes #452`.
