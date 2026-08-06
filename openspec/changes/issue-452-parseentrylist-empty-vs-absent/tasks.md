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
- [x] T11 — **cold review round (PR #478, verdict REVISE)** — an independent agent with
      zero context; all findings reproduced before acting.
      **F1 (BLOCKER, and it was mine)** the first version returned `entries`
      unconditionally, so `[]` answered BOTH "the list is empty" AND "the key had a body
      these indentation-anchored regexes could not read". Reproduced against `main`: a
      foreign verdict carrying REAL findings in 0-indent YAML block sequence (what
      `yaml.dump` emits by default) went from `undefined` (unknown) to `findings: []` — a
      positive, trusted assertion that **the reviewer found nothing**, on exactly the
      foreign-verdict population this change's own justification cites. I closed one
      instance of `evidence-reader-empty-on-failure` by opening a worse one — the same
      inversion I had just filed #477 about. Fixed per the anti-pattern doc verbatim:
      blank lines skipped, then `[]` only if the scan stopped at the next top-level key
      or the end of the block, else `null`. Proven both directions — collapsing
      unreadable into `[]` reddens the two F1 cases; calling everything unreadable
      reddens the genuinely-empty cases including #452's originals.
      **F2 (correction)** the state table in `spec.md` REQ-452-1 and the shipped JSDoc
      were promoted to normative while incomplete: a trailing space on the key line routes
      to the INLINE branch and returns `null` even WITH entries. Pre-existing, not fixed
      (the repair touches `scalar`, which every field reads) — now pinned by a test and
      recorded as REQ-452-1a instead of claimed away.
      **F3 (editorial)** `sequencing`'s unparseable scalar has the same shape AND a live
      production consumer (`board.mjs:61`'s `?? []` drives `toRemove` over every `seq:*`
      label). Out of scope here; added to #477 so the policy decision covers it.
- [x] T12 — post-review verification: suite **2492 pass / 1 skip / 0 fail** ·
      `repo:check` ✓ · `brain:nav` ✓ · REQ-409-6 pins still green (9/9 e2e).
