# Apply Progress: #809 — single PR, one batch

**Worktree**: /home/gandalf/IA/brain-issue-809 (off origin/main @ 89f4b71). Strict TDD.

- [x] U1 — `lib/migration-draft.mjs`: parser (JSON-only, one block, migrate()
      refused), proposeVersion (computed-only — D2 AMENDED during apply: no
      `--as`, parseArgs's own "no options" doctrine found and honored;
      monotonic-forever pinned by test instead of a dead refusal branch),
      splicer (anchor-refusing). 12 tests.
- [x] U2 — the arm in `brain-promote.mjs`: basename dispatch BEFORE the
      ADR/amendment split; async planner; the D3 proof (temp import +
      migrateConfig over the candidate) runs BEFORE the plan is offered.
      4 runPromote tests against temp git worlds.
- [x] U3 — the three pending drafts converted (1.2.0 #456, 1.3.0 #312,
      1.4.0 #814), prose kept, contract block added; pinned by a test that
      parses all three REAL files.

Verified: suite green, repo:check + nav clean (run at commit). The verb's
first real promotions are the backlog itself — three drafts, one ceremony
each, the human's commit as signature.

## Review note — 02/09/2026, the two half-verdicts at dab58cc

Two cold-review runs at head `dab58cc` produced deterministic-only APPROVEs,
neither with the judgment half applied: the first ran from THIS worktree
(clean config, no transport — the #812 trap, walked into after documenting
it), the second from the review checkout, where the anti-loop lock refused
the engine because "this reviewer's last verdict at this head is its own" —
conflating "a verdict exists at this head" with "the judgment half ran at
this head". Distinct defect, same family as #812; ticketed separately.

This commit exists to move the head so the full review can run — the
maintainer's call (option B), taken in the open rather than by amending.
