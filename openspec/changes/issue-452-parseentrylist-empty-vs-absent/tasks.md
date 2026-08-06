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
- [x] T3 — the fix. **As shipped** (after two cold-review rounds, see T11/T13): `null`
      for absent OR unreadable, `[]` only for a genuinely empty body, entries otherwise.
      The `return entries` one-liner this task originally described was the draft that
      both rounds rejected — kept in `proposal.md`/`design.md` D0/D1 as the record.
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
- [x] T13 — **second cold review round (PR #478, verdict REVISE)** — a fresh zero-context
      agent, given the branch's own commit history as evidence but none of round 1's
      findings. All findings reproduced before acting.
      **F1 (blocker, on the CLAIM)** the unreadable test ran only in the
      `entries.length === 0` branch, so a list that read one entry and then hit unreadable
      content returned the truncated prefix as a confident, complete list — while the
      shipped state table asserted "body UNREADABLE → null" without qualification.
      Reachable from brain's OWN renderer, not just foreign input: measured through the
      real chain, a two-finding verdict with multi-line `evidence:` re-parsed to ONE
      finding, **silently dropping a blocker**, with `'findings' in result === true`.
      Fixed by applying the clean-end test at any entry count. The reviewer had already
      shown no test noticed the difference — I added three.
      **F2 (correction)** `proposal.md`'s `## Decision` still shipped the REVERTED
      one-liner and its refuted justification; `tasks.md` T3 the same. The SDD folder is
      the durable record — a future reader would have re-derived the bug round 1 caught.
      Both corrected, with the superseded draft kept explicitly labelled.
      **F3 (correction)** every measurement in the PR body was a commit stale, one by
      2.6× (diff 24 → 63 counted lines; suite +7 → +11). Re-measured and the body rewritten.
      **F4 (editorial)** my justification for deferring the trailing-space repair implied
      breakage the tree does not show. Measured: the candidate repair fails exactly ONE
      test in 2496 — the pin documenting the defect. The scope call stands; the reasoning
      was replaced with the measurement.
      **F5 (editorial)** `sequencing`'s conflation is the only member of this class with a
      destructive live consumer (`board.mjs:61` strips every `seq:*` label). Severity
      raised on #477.
- [x] T14 — **#481 filed** (`priority:high`): `renderVerdict` quotes but does not ESCAPE
      newlines, so brain's own multi-line `evidence:` emits a block no parser can read.
      This is the ROOT CAUSE of F1's measurement — the reader fix makes the loss honest
      (`null` instead of a false prefix); it cannot make it not a loss. The blocker is
      still missing from the posted artifact's machine-readable form.
- [x] T15 — post-review verification: suite **2496 pass / 1 skip / 0 fail** ·
      `repo:check` ✓ · `brain:nav` ✓ · REQ-409-6 pins green.
- [x] T16 — **#481 ruled IN SCOPE by the maintainer** (disposition ruling, not an agent
      scope call — see #473's addendum). `yamlScalar` now escapes `\n`/`\r` and
      `unyamlScalar` decodes them back to characters; the pair moves together, since the
      generic `\X → X` rule would have turned the new escape into a bare `n`.
      The original #481 measurement re-run: **2 findings built → 2 parsed, the blocker
      survives, evidence byte-identical**. REQ-452-7 added.
- [x] T17 — red-proof on BOTH halves of the pair, each verified to have landed by
      printing the diff before running: dropping the encoder's newline escape → 4 red;
      reverting the decoder to the generic `\X → X` → the same 4 red. **The first two
      attempts at these mutations silently failed to match and produced meaningless
      greens — the third occurrence of that trap in this lane, and the reason the diff is
      now printed before every mutation run.** Recovering from it also cost the working
      copy: `git checkout --` on an UNCOMMITTED fix reverted it entirely, and the fix had
      to be re-applied from scratch. Commit before mutating.
- [x] T18 — post-#481 verification: suite **2500 pass / 1 skip / 0 fail** · `repo:check` ✓
      · `brain:nav` ✓ · REQ-409-6 pins green (9/9 e2e).
