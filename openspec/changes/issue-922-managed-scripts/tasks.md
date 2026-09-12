# Tasks: issue #922 — MANAGED_SCRIPT_KEYS omits doctrine-recommended scripts

## Review Workload Forecast

- Changed lines: ~1 new test file (~120 lines) + openspec artifacts (docs
  only, not counted against reviewer code budget) + a brain-draft (not
  applied code). Production array edit is a draft, not a diff to
  `brain/core/**`.
- 400-line budget risk: Low
- Chained PRs recommended: No
- Decision needed before apply: No

## Tasks

- [x] 1.1 Read issue #922 (`gh issue view 922 --comments`) — spec is the
      issue body.
- [x] 1.2 Measure: enumerate every `npm run <script>` mention across
      `brain/core/**`, `brain/project/**`, `AGENTS.md`, `CLAUDE.md`,
      `docs/**` (excluding `docs/inbox/**`); cross-reference against
      `MANAGED_SCRIPT_KEYS` and `package.json` scripts; produce the three
      sets (recommended-and-managed, recommended-but-not-managed,
      managed-but-not-recommended).
- [x] 1.3 Verify the ticket's named minimum (`memory:save`, `memory:ship`,
      `memory:audit`, `brain:config`) are all confirmed present in the
      recommended-but-not-managed set.
- [x] 2.1 Write `brain/scripts/lib/managed-script-keys-doctrine.test.mjs` —
      data-driven drift test (RED). RED — confirms the measured gap is real.
- [x] 2.2 Write the sanity companion test (every managed key is a real npm
      script) — GREEN.
- [x] 3.1 Verify `brain-amendment/1` can/cannot target `managed-paths.mjs`
      by simulation, importing the real `parseAmendmentDraft`/`assessEdit`
      from `brain/scripts/lib/amendment-draft.mjs`. **Found: cannot** — the
      contract hard-refuses non-`.md` targets. Documented as a correction
      to the task brief.
- [x] 3.2 Verify the proposed anchor block occurs exactly once in
      `managed-paths.mjs`, via the real `countOccurrences`.
- [x] 3.3 Write the brain-draft under `brain-drafts/` following the generic
      Tier-2 draft path (not a `brain-amendment/1` fence).
- [x] 4.1 Write `proposal.md` with the three measured sets and the
      expected-red decision + reasoning.
- [x] 4.2 Update `openspec/changes/issue-864-memory-2-0/tasks.md` task 4.8 —
      left unticked, noted why (promotion pending).
- [x] 5.1 Run focused test (`managed-script-keys-doctrine.test.mjs`) —
      confirm expected RED shape and content match the measurement.
- [x] 5.2 Run full `npm test` — confirm exactly one new failing test (this
      one), no other regressions vs. the `origin/main` baseline.
- [x] 6.1 Record-first closing commit via `npm run memory:save`.
