# Spec Delta — Rung-3 Auto-Revert Guardrails (Track D / slice D2)

> Hardens `.github/workflows/governance-postmerge.yml` + `brain/scripts/brain-audit.mjs` (shipped by
> #144/governance-v3). Every requirement below is bound to the PINNED owner rulings (engram #879 —
> `sdd/issue-259-d2/fork-rulings`) as refined by the FINAL checkpoint rulings (engram #886 —
> `sdd/issue-259-d2/checkpoint-rulings`, R-1/R-2, superseding any divergent detail here): cursor = custom
> git ref `refs/governance/audit-cursor`, resolved by EITHER an automatic revert-trailer OR a registered
> human acceptance (R-1, dual path — REQ-D2-1); emission = stdout `[FAIL-SHA] <sha>` via one shared
> parser; exit contract = A4 null=uncomputable doctrine (0 pass / 1 violation / 2 uncomputable-infra),
> with the narrow `brain-audit` range-uncomputable → exit-2 fix carved into Slice 1 (R-2). See
> [proposal.md](proposal.md) / [design.md](design.md) / [tasks.md](tasks.md). Cross-cutting: every
> requirement is written GitLab-port-ready — nothing below may be born GitHub-coupled.

## REQ-D2-1: Audit window derives from the persisted cursor, not the release tag

On a `schedule` run, the audit BASE MUST resolve from the persisted git ref
`refs/governance/audit-cursor`, NOT from `git describe --tags --abbrev=0`. The cursor MUST advance only
on a run that reaches a determinable clean state (no offender, a flagged offender's revert confirmed
merged, OR a flagged offender resolved via the documented manual human-acceptance command — R-1, dual
path) — a run that reverts an offender or exits 2 MUST NOT auto-advance it.

#### Scenario: a tag move does not drop a present offender

- GIVEN a persisted cursor at SHA C and an offending merge M landing after C
- WHEN a release tag is advanced past M before the next schedule run
- THEN the schedule run's audit window still starts at C (not the tag) and includes M

#### Scenario: cursor advances only on genuine resolution

- GIVEN a schedule run that completes with no offender in range
- WHEN the run finishes
- THEN the cursor advances to the new last-audited SHA; a run that reverts an offender or exits 2 leaves
  the cursor unchanged

#### Scenario: a registered human acceptance also advances the cursor (dual path, R-1)

- GIVEN an offending merge O that a human deliberately accepts (documented justification) instead of
  reverting, via the manual cursor-accept command
- WHEN the command runs
- THEN the cursor advances past O; a future schedule run's window starts after O and never re-flags it

## REQ-D2-2: Missing cursor is a loud exit 2, never auto-init, never a revert

If `refs/governance/audit-cursor` does not exist, the workflow MUST exit 2, open/update a labeled
infra-alert issue containing the exact documented init command, and MUST NOT auto-create the cursor or
revert anything.

#### Scenario: absent cursor exits 2 with the init command

- GIVEN `refs/governance/audit-cursor` does not exist
- WHEN the schedule run attempts to resolve the audit BASE
- THEN it exits 2 and opens a labeled issue containing the exact init command; no ref is auto-created

#### Scenario: no revert on the missing-cursor path

- GIVEN the missing-cursor exit-2 case above
- WHEN the workflow evaluates whether to revert
- THEN no revert branch/PR is created — the run is a no-op besides the loud issue

## REQ-D2-3: `brain-audit` emits `[FAIL-SHA]`; the workflow reverts exactly those SHAs

`brain-audit.mjs` MUST print one `[FAIL-SHA] <full-sha>` line per offending merge to stdout, additive to
the existing human `[FAIL]`/`[PASS]` output. `governance-postmerge.yml` MUST revert exactly the SHAs
emitted this way and MUST NOT revert `github.sha` unconditionally.

#### Scenario: good HEAD survives, mid-range offender is reverted

- GIVEN a push landing M1 (good), M2 (offender), M3 (good, HEAD)
- WHEN `brain-audit` audits the range and flags M2
- THEN it prints `[FAIL-SHA] <M2-sha>` and the workflow reverts only M2 — M3/HEAD is untouched

#### Scenario: a clean range emits no `[FAIL-SHA]` lines and no revert

- GIVEN a range with zero violations
- WHEN `brain-audit` runs
- THEN it emits zero `[FAIL-SHA]` lines and the workflow performs no revert

## REQ-D2-4: Dedup is keyed on the offending SHA

The auto-revert branch/idempotency check MUST key on the offender SHA (not the push HEAD SHA). A
repeated detection of the same offender across cycles MUST NOT spawn a second branch/PR.

#### Scenario: a repeat cycle recognizes an offender already in flight

- GIVEN offender O already has an open auto-revert branch/PR from a prior cycle
- WHEN a later cycle re-flags O
- THEN the workflow recognizes the existing branch for O and no-ops — no new branch is created

#### Scenario: distinct offenders get distinct branches

- GIVEN two different offending SHAs O1 and O2 detected in separate cycles
- WHEN both are processed
- THEN each gets its own uniquely offender-keyed branch, with no collision between them

## REQ-D2-5: One shared, tested parser function — no inline YAML grep

Parsing of `[FAIL-SHA]` lines MUST live in exactly one tested function, consumed by both the GitHub
wrapper (today) and the future GitLab wrapper. No workflow YAML may contain inline shell grep/parsing of
the marker.

#### Scenario: the GitHub wrapper consumes the shared parser

- GIVEN `brain-audit` stdout containing `[FAIL-SHA]` lines
- WHEN `governance-postmerge.yml` needs the offender list
- THEN it calls the shared parser function — no inline grep appears in the YAML

#### Scenario: the parser is platform-agnostic and independently testable

- GIVEN the shared parser module
- WHEN it is unit-tested against synthetic stdout outside any CI runner
- THEN it returns the correct SHA list with zero GitHub-Actions-specific dependency

## REQ-D2-6: The 0/1/2 exit contract is wired via captured numeric exit code

Every evaluator and `brain-audit.mjs` MUST exit 0 (pass), 1 (violation), or 2 (uncomputable-infra: git
failed, adapter threw, required input absent/unreadable — catch-all exceptions map to 2, never 0/1). The
workflow MUST branch on the captured NUMERIC exit code (not an Actions boolean `outcome`): revert only on
1, loud issue only on 2, no-op on 0.

> **Slice carve-out (R-2, checkpoint ruling #886, FINAL):** the narrow `brain-audit.mjs` range-uncomputable
> → exit-2 site (git-log-for-the-range throws) ships in **Slice 1**, one site, no drift-guard, no rollout —
> coherence with REQ-D2-2 already shipping exit-2 for the cursor-missing path in the same slice. The
> general contract below (every evaluator's runner boundary + the top-level `brain-audit` catch-all) and
> the workflow's full numeric-exit branching ship in **Slice 2**.

#### Scenario: exit 1 drives the revert path only

- GIVEN `brain-audit` exits 1 with `[FAIL-SHA]` lines
- WHEN the workflow reads the captured numeric exit code
- THEN it proceeds to the revert path and opens no infra issue

#### Scenario: exit 2 opens a loud issue and never reverts

- GIVEN `brain-audit` exits 2 (e.g., an uncomputable git range)
- WHEN the workflow reads the captured numeric exit code
- THEN it opens a labeled infra-alert issue and performs no revert, even if stray `[FAIL-SHA]`-like text
  is present in stdout

## REQ-D2-7: Drift-guard asserts every evaluator implements 0/1/2 with both fixtures

A drift-guard test MUST assert every check/evaluator exits only 0/1/2 (a binary 0/1 implementation fails
CI) and MUST require each check to ship BOTH a violation (→1) fixture and an uncomputable (→2) fixture.

#### Scenario: a binary 0/1 evaluator fails the drift-guard

- GIVEN a hypothetical evaluator exiting only 0 or 1
- WHEN the drift-guard test runs
- THEN it fails, naming the evaluator missing the 2 path

#### Scenario: an evaluator missing its exit-2 fixture fails the drift-guard

- GIVEN an evaluator with correct 0/1/2 logic but no fixture exercising its 2 path
- WHEN the drift-guard runs
- THEN it fails, naming the missing fixture

## REQ-D2-8: Fixtures are 100% synthetic — no real fossils

All D2 regression fixtures (bugs 1–3, emission, dedup, exit-2 boundary) MUST be synthetic git
ranges/data hand-built to reproduce each failure shape. Fixtures MUST NOT replay or reference the real
historic fossils (re-measured: 168 closed PRs, 0 with an `auto-revert/*` head).

#### Scenario: a synthetic fixture is RED under pre-fix behavior

- GIVEN a synthetic fixture for bug 1 (tag-move masking)
- WHEN run against the pre-fix workflow/emitter
- THEN it fails (RED), proving the bug shape without referencing real repo history

#### Scenario: no fixture derives from real fossils

- GIVEN the full D2 fixture suite
- WHEN audited for provenance
- THEN none reference or replay the deleted real auto-revert branches or real closed-PR history

## REQ-D2-9: GitLab-porting constraint is drafted, never committed to the doc zone by this PR

D2 MUST author a draft under `openspec/changes/issue-259-d2/brain-drafts/` stating that rung-3
auto-revert must not be ported to GitLab until D2's fixes land, and that the GitLab port covers PR-time
gates (`GOVERNANCE_JOBS`) only. The D2 PR MUST NOT commit this constraint to the doc zone
(ADR/`brain/core/`/PLAN); a human co-promotes it via a separate MR (pattern #216).

#### Scenario: the draft exists in the drafts zone

- GIVEN D2 is complete
- WHEN `openspec/changes/issue-259-d2/brain-drafts/` is inspected
- THEN it contains the GitLab-porting-constraint draft document

#### Scenario: the doc zone shows zero changes from D2

- GIVEN the D2 PR diff
- WHEN any ADR, `brain/core/`, or PLAN file is inspected
- THEN it shows zero changes attributable to D2 — any such change is a STOP-finding

## Out of scope (non-goals)

- **Porting rung-3 auto-revert to GitLab.** D2 unblocks it, does not do it.
- **D1 and D3.** Sibling Track-D slices, no dependency edge.
- **Rewriting evaluator semantics.** `diffSize`/`issueLink`/`adrPresence`/`memoryPresence` decisions are
  unchanged; only the exit contract is added.
- **Committing the GitLab constraint into the doc zone.** Draft only (REQ-D2-9).
- **Using real fossil PRs as fixtures.** Re-measured to zero; all fixtures synthetic (REQ-D2-8).
- **`brain-audit.mjs`'s chunk-reader drift.** Separate cleanup, not in scope unless design finds it
  blocks emission.

## Gate

`npm test`, `brain:repo:check`, `brain:change:verify` MUST stay green. Docs in English (ADR-0009). STRICT
TDD: synthetic fixtures for every scenario above are written FIRST (RED→GREEN). Slice boundary (checkpoint
rulings #886, FINAL): Slice 1 = REQ-D2-1 (incl. R-1 dual-path resolution), REQ-D2-2, REQ-D2-3, REQ-D2-4,
REQ-D2-5, REQ-D2-8, REQ-D2-9, PLUS the narrow `brain-audit` range-uncomputable → exit-2 carve-out of
REQ-D2-6 (R-2 — one site, no drift-guard, no rollout); Slice 2 = the REMAINDER of REQ-D2-6 (the full
cross-evaluator numeric-exit contract + workflow branching), REQ-D2-7. Each slice ≤400 counted lines;
neither uses `size:exception`.
