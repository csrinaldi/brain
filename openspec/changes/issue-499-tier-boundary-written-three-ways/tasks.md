---
status: draft
issue: 499
---

# Tareas — tier boundary written three ways (issue 499)

- [x] T1 — **Measure before designing.** `BRAIN_MANAGED_PREFIXES = ['brain/core/',
      'brain/project/']` is what executes; CODEOWNERS agrees. Then the scan: **22 cited
      `brain/…` paths across 6 files do not exist**, with `brain:nav` green throughout.
      Wider than the ticket, which named only `agent-authorities.md` — the same four dead
      directories are also in `consolidation-protocol.md`'s own Hard Rule.
- [x] T2 — The cited-path check inside `check-brain-nav.mjs` (REQ-499-1, REQ-499-2).
- [x] T3 — Keep the script standalone-runnable (REQ-499-3). Learned by breaking it: the
      extractor briefly lived in `lib/cited-paths.mjs` and turned 5 existing tests red with
      `ERR_MODULE_NOT_FOUND`, because the script is copied on its own into fixtures and into
      the adoption scaffolding. Inlined back; the lib is deleted.
- [x] T4 — Tests for E1–E4, all spawn-based (`check-brain-nav.citations.test.mjs`).
- [x] T5 — **Red-proof: 4 mutations RED, 0 inert**, plus one deliberately GREEN.
      | mutation | result |
      | --- | --- |
      | the cited count leaves the exit condition | RED ×2 |
      | the citation is never compared to the filesystem | RED ×2 |
      | the regex demands `.md`, losing directories | RED ×3 |
      | the extractor always returns empty | RED ×3 |
      | the glob filter is disabled | **GREEN — by design**, pinning it as dead code |
      The first mutation is the one that mattered: it left `npm test` entirely green while the
      script still printed all 22 findings. The guard was unpinned, and a gate that reports
      without failing is `evidence-reader-empty-on-failure` wearing a checkmark.
- [x] T6 — Draft the doctrine corrections (REQ-499-4) at
      `brain-drafts/tier-boundary-and-dead-citations.md`, split into mechanical / ambiguous /
      dangling. Tier 2 — a human signs.
- [x] T7 — PR **#507**, opened red on purpose and labelled as such in the body.
- [x] T8 — **EXTERNAL cold review, run by the maintainer from `main`** —
      `npm run brain:review -- --pr 507`, per `reviewer-protocol.md` §13. First protocol-
      compliant review of this session, and the first confirmation of #501 in production:
      the verdict is signed **`csrinaldibot`**, and two further runs returned
      `anti-loop — nothing posted` instead of appending `rev: 2` and `rev: 3`.
      **It found something I had missed, and it was about my process, not my code:**
      `detection:phase-order` FAILURE — *"(Rule C) implementation code present but tasks.md
      has no checked item"*. All four SDD artefacts for this change were **still the empty
      scaffold**. I scaffolded the folder and went straight to implementing, having written
      the full set for #469 and #501. Written now; that is what this file is.
      The other two findings were expected: `gate:local-checks` (the 2 red nav-integrity
      tests, by design) and `gate:actor-check` (the label on #499, a human act).
- [x] T8b — **Second agent pass: the mechanical bucket is not mechanical.** Applying the
      rename table verbatim reaches 22 → 7 with the suite green, and introduces 7
      core→project citations — the class `check-brain-nav.mjs`'s own `coreLeaks` rule stops
      for links and does not yet check for citations. The prefix form reaches **22 → 3**,
      keeps 4/4 citation tests green, and names no consumer-specific path. Patch attached at
      `brain-drafts/tier-boundary.patch`, measured in a scratch worktree, `brain/` never
      committed by the agent.
- [x] T8c — **The two red nav-integrity fixtures split into two causes.** The fixture copied
      ONE script into a tree whose docs cite ten — `brain/scripts/**` is managed, so a real
      consumer has all of it. Fixed (12 → 0 and 10 → 2 with the doctrine patch applied). What
      survives is a real defect in a different tense: the scaffolded HOME.md cites
      `brain/project/**`, which is deliberately NOT managed, so a fresh consumer is handed an
      entry point naming two directories they do not have. Third citation class —
      PRESCRIPTIVE — recorded in the draft with options.
- [ ] T9 — **HUMAN: apply the drafted corrections**, which turns `brain:nav`, the two
      `nav-integrity` tests and `gate:local-checks` green together. Precedent for landing them
      with the code: #405/T18b, where the maintainer committed the promotion onto the agent's
      branch.
- [ ] T9b — **HUMAN: three rulings** — the two historical citations (a quotation of §2 as it
      read before #54, and a `Discovered in:` provenance line) and the one genuinely dead
      pointer (`agent-skills.md`, an inventory that has never existed). Options and a leaning
      for each are in the draft.
- [ ] T10b — **HUMAN: a fourth ruling** — the prescriptive class (scaffolded HOME.md →
      `brain/project/**`). (a) `ensureHome` creates the skeleton, or (b) the template drops
      the backticks. Leaning (a); see the draft.
- [ ] T11 — **Follow-up ticket:** the citation check should carry the `coreLeaks` rule, or a
      core doc can cite a `brain/project/…` path and pass. Found by T8b.
- [ ] T10 — **HUMAN: re-apply `status:approved` on #499** after the last agent commit — L5′
      wants it strictly after the newest foreign commit, and re-marking an already-present
      label emits no event.

## Micro-decisiones en caliente

- **The guard is the deliverable, the prose fix is the instance.** The words were wrong since
  the core/project reorganization and nothing failed, because the executable rule was right.
  That is exactly why nobody found it, and why correcting only the words fixes nothing
  durable.
- **`--ignored` has an analogue here:** the check must resolve directories, not just `.md`.
  Four of the 22 — all of Tier 3 — are directories, and a file-only check would have reported
  4 and looked complete.
- **An inert guard must be labelled inert.** The glob filter discards nothing today. It stays,
  and the source says so, because an unlabelled dead guard reads as a live one — which is the
  same defect as a prohibition naming a directory that does not exist.
- **The reviewer must run from `main`, never from the branch under review.** Otherwise a
  change to the reviewer reviews itself. Not written anywhere today: §13 says which command,
  not from where. Candidate for a doctrine line of its own.
