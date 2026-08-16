---
status: done
issue: 599
slice: 1
---

# Apply Progress — issue-599-adr-0023-citation-gap — Slice 1 (single PR)

## Scope

Single PR, no chain (`delivery_strategy: ask-on-risk`, forecast: `400-line
budget risk: Low`, `Chained PRs recommended: No`). All of tasks.md Phases
1-5 except 5.6 (PR creation, deferred to the orchestrator's cold-review
protocol) are complete.

## Status: DONE — all tasks complete except 5.6 (PR creation, explicitly deferred)

Worktree: `/home/gandalf/IA/brain-issue-599`
Branch: `feat/issue-599-docsadr-adr-0023-is-cited-by-two-plannin` (pushed,
tracks `origin/feat/issue-599-docsadr-adr-0023-is-cited-by-two-plannin`)

## Mode: Strict TDD (test runner: `npm test`, node:test, Node 22 ESM)

## TDD Cycle Evidence

| Task | RED | GREEN | REFACTOR |
|------|-----|-------|----------|
| KNOWN_GAPS deletion + 3-site reword (REQ-599-1, REQ-599-2, REQ-599-3) | Deleted both `KNOWN_GAPS` entries only (D4), ran `node --test test/adr-citation-resolves.e2e.test.mjs` directly — *every cited ADR-NNNN resolves* failed naming exactly 3 sites (see captured output below) | Applied D3 rewords to all 3 sites; re-ran same file — 10/10 pass | None needed — wording is pinned verbatim by design D3, no refactor step applicable |

## Captured RED output (Phase 2, task 2.4)

Command: `node --test test/adr-citation-resolves.e2e.test.mjs` (after deleting
both `KNOWN_GAPS` entries only, before any `docs/inbox/**` edit).

```
not ok 6 - adr-citations: every cited ADR-NNNN resolves to a file in brain/project/decisions/
  ---
  error: |-
    3 citation(s) point at a decision record that cannot be opened:
      docs/inbox/MASTER-PLAN-1.0.md:72  cites ADR-0023 — no brain/project/decisions/adr-0023-*.md
          | M5 | Role-as-port (C) | #312 + ADR-0023 (draft in `brain-drafts/`) |
      docs/inbox/MASTER-PLAN-1.0.md:93  cites ADR-0023 — no brain/project/decisions/adr-0023-*.md
          implementer, not a replacement. #312 · ADR-0023 (draft).
      docs/inbox/brain-v2-epic-plan.md:114  cites ADR-0023 — no brain/project/decisions/adr-0023-*.md
          - Ratificar **ADR-0023** (promover el draft a `decisions/` + HOME.md).

      A reader who follows one of these lands on nothing.
      Fix it by promoting the ADR (npm run brain:promote -- <draft path>) or by
      re-pointing the citation at the ADR that actually holds the reasoning.
      Do NOT add it to KNOWN_GAPS in test/adr-citation-resolves.e2e.test.mjs without a ticket.

    3 !== 0
  expected: 0
  actual: 3
# tests 10
# pass 9
# fail 1
```

Matched design D6 step 1 exactly: the failure named exactly three sites
(`docs/inbox/MASTER-PLAN-1.0.md:72`, `:93`, `docs/inbox/brain-v2-epic-plan.md:114`)
— no discrepancy with the design's measurement, so no STOP was needed (task 2.3).

## GREEN confirmation (Phase 3, task 3.4)

After applying all three D3 rewords: `node --test test/adr-citation-resolves.e2e.test.mjs`
→ `# tests 10 / # pass 10 / # fail 0`.

## Full gate (Phase 4)

- `npm test` before any change (baseline, task 1.2): `# tests 3925 / # pass 3925 / # fail 0`
- `npm test` after the reword (task 4.1): `# tests 3925 / # pass 3925 / # fail 0` — same
  total test count (KNOWN_GAPS entries are data, not subtests; deleting them
  does not change the top-level count), 0 failures either way.
- `rg -n "ADR-0023" --glob '!openspec/**' .` (task 4.2): one hit —
  `brain-drafts/adr-0023-sdd-role-port.md:1` (the draft's own title). That
  path is in `UNSCANNED_ROOTS` (`.memory/`, `openspec/`, `brain-drafts/` —
  test file line 71), so it is outside the scanned surface and not a
  citation-gap finding. Zero hits in `docs/inbox/**` or anywhere else in the
  scanned surface.
- `git status --short` / `git diff --stat` (task 4.3): only the three
  expected files touched (`docs/inbox/MASTER-PLAN-1.0.md`,
  `docs/inbox/brain-v2-epic-plan.md`, `test/adr-citation-resolves.e2e.test.mjs`).
  `brain-drafts/adr-0023-sdd-role-port.md`, `.gitlab-ci.yml`, and
  `brain/project/decisions/` are untouched. No ADR file was created.
- `git diff --name-only` (task 4.4): confirms the same exact three-file list
  — matches spec REQ-599-4 diff-scope check.
- Optional D5/D6 staleness-guard probe (task 4.5): re-added one
  `KNOWN_GAPS` entry (`docs/inbox/MASTER-PLAN-1.0.md`, `'0023'`, probe
  `why` text) after the reword landed and re-ran the e2e file directly.
  Result: test 9 (*no registry entry outlives the citation it exempts*)
  went red as expected — `these entries no longer match an unresolved
  citation — delete them: docs/inbox/MASTER-PLAN-1.0.md → ADR-0023 (...)`.
  Test 10 (ticket-reference assertion) also failed on the probe's `why`
  text, incidentally confirming that assertion's teeth too. Reverted the
  probe immediately (`KNOWN_GAPS = Object.freeze([])` restored); re-ran —
  back to 10/10 green. Probe was never committed.

## Commits

1. `d947b55` — `docs(openspec): add issue-599 citation-gap planning artifacts (#599)`
   (proposal.md, spec.md, design.md, tasks.md — 4 files, 516 insertions)
2. `387e0e0` — `docs(inbox): reword ADR-0023 citations to reserved-draft form (#599)`
   (docs/inbox/MASTER-PLAN-1.0.md, docs/inbox/brain-v2-epic-plan.md,
   test/adr-citation-resolves.e2e.test.mjs — 3 files, 7 insertions, 9
   deletions — single work-unit commit per design D5, deletion and all
   three rewords land together)
3. `47527b4` — `chore(memory): sync engram records for the #599 citation-gap slice`
   (`.memory/` — 10 files, `npm run memory:share` output, follow-up commit
   per repo convention)

Branch pushed: `feat/issue-599-docsadr-adr-0023-is-cited-by-two-plannin` →
`origin/feat/issue-599-docsadr-adr-0023-is-cited-by-two-plannin`.

`npm run brain:repo:check` (task 5.3): passed — "No prohibited references
found." / "Artifact structure is valid."

## Deviations from Design

None — implementation matches design D1-D6 verbatim (exact replacement
text for all three sites, `KNOWN_GAPS` reduced to `Object.freeze([])`,
docblock at lines 126-144 untouched, atomic single commit for
deletion+reword).

## Issues Found

None.

## Remaining Tasks

- [ ] 5.6 Open PR with body including `Closes #599`. Explicitly deferred —
  this executor does not open PRs; the orchestrator runs the cold/fresh
  review protocol (repo protocol #604/#575) before or after PR creation.
  Delivery in this apply batch is WITHOUT a self-review pass, per
  instruction.

## Workload / PR Boundary

- Mode: single PR (no chain — forecast was `400-line budget risk: Low`,
  `Chained PRs recommended: No`)
- Current work unit: Unit 1 (planning artifacts) + Unit 2 (doc+test repair,
  atomic) — both landed on this branch, both commits pushed
- Boundary: this apply batch starts from a clean checkout of `main` at the
  branch tip and ends with the pushed branch ready for PR #5.6 (deferred)
- Estimated review budget impact: ~6-10 changed lines across
  `docs/inbox/**` (well under the 400-line default and the repo's
  1000-line lite-tier ceiling); the `test/adr-citation-resolves.e2e.test.mjs`
  change matches `**/*.test.mjs` in `governance.ignoreList` and is not
  counted toward the budget

## Status

10/11 tasks.md items complete (all except 5.6, explicitly deferred).
Ready for sdd-verify.
