# Tasks: ADR-0023 citation gap repair (#599)

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~6-10 counted lines (`docs/inbox/MASTER-PLAN-1.0.md` + `docs/inbox/brain-v2-epic-plan.md`; `test/adr-citation-resolves.e2e.test.mjs` matches `**/*.test.mjs` on `governance.ignoreList` and is NOT counted) |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | ask-on-risk |
| Chain strategy | n/a (single PR, no chain) |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

Tier is `lite` (1000-line review budget for this repo's guard). Only the two
`docs/inbox/**` rewords count toward it; the test-file `KNOWN_GAPS` deletion is
governance-ignored. Nowhere close to either the 400-line default or the
1000-line lite ceiling — single PR, no chain, no `size:exception`.

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Openspec planning artifacts (spec, design, tasks) | PR 1 | Base `main`; precedent: issue-557's `docs(openspec): add issue-NNN planning artifacts` commit, landed first and separately |
| 2 | Doc+test repair: delete both `KNOWN_GAPS` entries AND reword all three citation sites, atomically | PR 1 (same PR, second commit) | Base `main`; ONE work-unit commit — design D5 forbids a split between deletion and reword |

## Phase 1: Pre-flight

- [x] 1.1 In `/home/gandalf/IA/brain-issue-599`, confirm branch `feat/issue-599-docsadr-adr-0023-is-cited-by-two-plannin` is checked out and clean (`git status`).
- [x] 1.2 Run `npm test` on branch tip; record baseline pass count before any change.

## Phase 2: RED — negative control (design D6 step 1)

- [x] 2.1 In `test/adr-citation-resolves.e2e.test.mjs`, delete both `KNOWN_GAPS` entries (the `docs/inbox/MASTER-PLAN-1.0.md`/`'0023'` and `docs/inbox/brain-v2-epic-plan.md`/`'0023'` object literals at lines ~145-150), leaving `KNOWN_GAPS = Object.freeze([])`. Do NOT touch the docblock (lines ~126-144) or the three call sites (`registry` spread, `0018` baseline guard, per-entry ticket assertion). Do NOT touch any `docs/inbox/**` file yet.
- [x] 2.2 Run `node --test test/adr-citation-resolves.e2e.test.mjs` directly. Expect *every cited `ADR-NNNN` resolves* to FAIL, naming exactly three sites: `docs/inbox/MASTER-PLAN-1.0.md:72`, `docs/inbox/MASTER-PLAN-1.0.md:93`, `docs/inbox/brain-v2-epic-plan.md:114`.
- [x] 2.3 If the failure names fewer or different sites than the three above, STOP — a citation moved since the design was written; re-measure line numbers in `docs/inbox/**` before continuing.
- [x] 2.4 Paste the red failure output into `apply-progress` as evidence the check has teeth on these exact lines before the reword lands.

## Phase 3: GREEN — reword all three sites (design D3)

- [x] 3.1 Reword `docs/inbox/MASTER-PLAN-1.0.md:72` (milestone table row) to the exact replacement in design D3 Site A: `| M5 | Role-as-port (C) | #312 — owns the decision record; \`0023\` reserved, unpromoted draft at \`brain-drafts/adr-0023-sdd-role-port.md\` |` — single line, no wrap.
- [x] 3.2 Reword `docs/inbox/MASTER-PLAN-1.0.md:93` (§4 key decision 1, prose) to the exact two-line replacement in design D3 Site B, keeping the file's 3-space continuation indent and ~100-column wrap.
- [x] 3.3 Reword `docs/inbox/brain-v2-epic-plan.md:114` (Spanish bullet under M5/#312) to the exact three-line replacement in design D3 Site C — neutral/professional Spanish, infinitive-led, no voseo, `(#312)` restated inline.
- [x] 3.4 Run `node --test test/adr-citation-resolves.e2e.test.mjs` again. Expect all 10 tests green, including the staleness guard and the vacuity guards (`scanned > 100`, `citations.length > 100`, `signed.size >= 25`).

## Phase 4: Full gate and verification

- [x] 4.1 Run full `npm test`; confirm 0 failures, count is baseline (1.2) minus the 2 previously-known-gap entries now resolved without exemption.
- [x] 4.2 `rg` the tree for bare `ADR-0023` tokens outside `UNSCANNED_ROOTS` (i.e. outside `openspec/`); confirm zero remaining hits in `docs/inbox/**` or elsewhere in the scanned surface.
- [x] 4.3 Confirm `brain-drafts/adr-0023-sdd-role-port.md`, `.gitlab-ci.yml`, and everything under `brain/project/decisions/` are untouched (`git status` / `git diff --stat` shows no changes to these paths). No ADR file was created.
- [x] 4.4 `git diff --name-only` against the pre-change tip lists exactly `docs/inbox/MASTER-PLAN-1.0.md`, `docs/inbox/brain-v2-epic-plan.md`, and `test/adr-citation-resolves.e2e.test.mjs` (per spec REQ-599-4 diff-scope check).
- [x] 4.5 Optional confirmation (design D6, 30 seconds): re-add one deleted `KNOWN_GAPS` entry and re-run the e2e test file — the staleness guard must go red. Revert the re-add immediately; do not commit it.

## Phase 5: Delivery

- [x] 5.1 Commit openspec planning artifacts (`openspec/changes/issue-599-adr-0023-citation-gap/{proposal,spec,design,tasks}.md`) as their own commit — conventional commit, e.g. `docs(openspec): add issue-599 planning artifacts`, no AI-attribution trailer.
- [x] 5.2 Commit the doc+test repair (both `docs/inbox/**` rewords AND the `KNOWN_GAPS` deletion) as ONE work-unit commit — do not split reword from deletion (design D5). Conventional commit referencing #599.
- [x] 5.3 Run `npm run brain:repo:check`; must pass before push.
- [x] 5.4 Run `npm run memory:share`; `git add .memory/` if it produced changes, and include in the same or a follow-up commit before push per repo convention.
- [x] 5.5 Push branch `feat/issue-599-docsadr-adr-0023-is-cited-by-two-plannin`.
- [x] 5.6 Open PR with body including `Closes #599`. This is the final task — the orchestrator runs cold/fresh review per session protocol before or after PR creation, not this executor. (PR #711, cold review APPROVE before creation.)
