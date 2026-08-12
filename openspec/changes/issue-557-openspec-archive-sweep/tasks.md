# Tasks: Issue #557 — OpenSpec Archive Sweep

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | PR1 ~550-650 · PR2 ~150-250 · PR3 ~350-500 · PR4 ~25-30 |
| 400-line budget risk | High (PR1, PR3) |
| Chained PRs recommended | Yes |
| Suggested split | PR1 → PR2 → PR3 → PR4 (design-mandated order; PR1 optionally splits into 1a VCS+selector, 1b rewire+allowlist if reviewer load is a concern) |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending (design's Quick Path merges sequentially to main — stacked-to-main fits; no tracker branch implied) |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Selector + VCS widening + archive.mjs rewire + phase-order allowlist fix + tests | PR1 | Base: main. Must merge before PR2/PR3. Largest unit — split into 1a/1b if reviewer load too high. |
| 2 | Backfill output (renames + spec appends, no code) | PR2 | Base: main (post-PR1). Diff is `governance.ignoreList`-exempt from gate, but human review load matters. |
| 3 | `governance-postmerge.yml` sweep step + drift guards | PR3 | Base: main (post-PR1). Depends on `lib/archive-sweep.mjs` existing. |
| 4 | Doctrine dead-reference fixes + policy statement | PR4 | Base: main. Independent, human-authored (`brain-writes-reviewed.mjs` blocks agent-authored `brain/core/**`). |

## Phase 1: PR1 — VCS Port Widening

- [x] 1.1 `brain/scripts/vcs/providers/github.mjs`: widen `issueView` — add `state` (`r.state`), `stateReason` (`r.state_reason ?? null`).
- [x] 1.2 `brain/scripts/vcs/providers/gitlab.mjs`: widen `issueView` — add `state` (`opened`→`open`), `stateReason: null`.
- [x] 1.3 Update `brain/core/methodology/vcs-contract.md`: `issueView` row + GitLab `stateReason` residual note.
- [x] 1.4 Extend `vcs.contract.test.mjs` + provider fixtures: assert `state`/`stateReason` on both providers.

## Phase 2: PR1 — Selector Module

- [x] 2.1 New `brain/scripts/lib/archive-sweep.mjs`: `OUTCOME` enum + `selectSweep({entries, exists, readIssueState})`, 10-row decision table (design D1), per-iid memoized reads.
- [x] 2.2 New `brain/scripts/lib/archive-sweep.test.mjs` (`node --test`): closed, open, not-planned, `stateReason: null`, `readIssueState` null, unrecognized state, collision (incl. reversed order), destination-exists, container/not-a-change (zero reads), iid `260` parity, memoization (Testing table cases 1-11).

## Phase 3: PR1 — archive-logic.mjs / archive.mjs Rewire

- [x] 3.1 `brain/scripts/lib/archive-logic.mjs`: `archiveChange` returns `{moved, consolidated, unconsolidated}`; `unconsolidated: true` replaces silent `console.warn`.
- [x] 3.2 Extend `archive-logic.test.mjs`: `unconsolidated: true` (flat, no `capability:`), `consolidated: ['<cap>']` (nested), existing-destination throw retained.
- [x] 3.3 `brain/scripts/archive.mjs`: route `--backfill` through `selectSweep`; alias `--all` with deprecation notice; delete `iid === '260'` hardcode; grouped non-archived report; exit 1 on `complete===false` or blocked, else 0.
- [x] 3.4 Test: no `'260'` literal remains in `archive.mjs`; iid 260 receives standard row-8/10 treatment.

## Phase 4: PR1 — Phase-Order Allowlist Fix

- [ ] 4.1 `brain/scripts/vcs/phase-order-check.mjs`: add `openspec/specs/` to `isAllowlisted`.
- [ ] 4.2 Extend `phase-order-check.test.mjs`: archive-PR diff shape (delete `changes/<name>/*`, add `changes/archive/<iid>/*`, modify `specs/<cap>/spec.md`) → `pass`; removing the allowlist entry restores Rule C/A failures (teeth).

## Phase 5: PR1 — Verification

- [ ] 5.1 Run `npm test` — all new/extended suites green.
- [ ] 5.2 Manual: confirm `archive.mjs <changeId>` single-folder path unchanged (no `readIssueState` call).

## Phase 6: PR2 — Backfill Execution (no code)

- [ ] 6.1 Run `node brain/scripts/archive.mjs --backfill` locally against current tree (PR1 merged).
- [ ] 6.2 Review report: `archived`/`consolidated`/`unconsolidated`/`blocked` counts match expectations; no unexpected collisions.
- [ ] 6.3 Commit renames (`changes/<name>/` → `changes/archive/<iid>/`) + `openspec/specs/**` appends only.
- [ ] 6.4 Verify `phase-order-check` passes on the resulting diff.

## Phase 7: PR3 — Governance Sweep Step

- [ ] 7.1 New `brain/scripts/governance/postmerge/sweep.mjs`: real `readIssueState` via `getVcs().issueView`, applies `archiveChange`, renders markdown report (by capability, blocked table, unconsolidated list, `Part of #557.`), prints `SWEEP archived=N blocked=M unconsolidated=K`; exit 0 clean / 3 incomplete-or-failed.
- [ ] 7.2 New `brain/scripts/governance/postmerge/sweep.test.mjs`: deterministic rendering, summary matches classification, exit 3 on `complete===false`.
- [ ] 7.3 `.github/workflows/governance-postmerge.yml`: add `- id: sweep` after `advance`/`uncomputable`, before terminal `always()`; `if: steps.audit.outputs.code == '0' && steps.advance.outcome == 'success'`; branch `auto-archive/$(date -u +%F)`; backlog-cap + same-day (`--state all`) idempotency checks; orphan-branch cleanup; `VCS_TOKEN: ${{ github.token }}`; on failure file `governance:archive-sweep-failed` alarm, exit 0.
- [ ] 7.4 Terminal step: add `ALARM_SWEEP: ${{ steps.sweep.outputs.alarm }}`; concatenate into `filed=`.
- [ ] 7.5 Extend `brain/scripts/vcs/release-postmerge-workflows.test.mjs`: source guards (ordering, `if:` shape, no `cursor.mjs` write, `VCS_TOKEN` declared, `--state all` dedup, `ALARM_SWEEP` declared+concatenated, no `continue-on-error`); executable guards (zero-archivable→no `pr create`; selector failure→alarm+exit 0; open `auto-archive/*`→skip; push failure→orphan delete+alarm).

## Phase 8: PR3 — Verification

- [ ] 8.1 Run `npm test` incl. workflow drift guards.
- [ ] 8.2 Dry-run walkthrough: 0 eligible→no PR; 1 eligible→exactly one `auto-archive/<date>` PR; same-day re-run→none.

## Phase 9: PR4 — Doctrine Fixes (human-authored)

- [ ] 9.1 [HUMAN] `openspec/README.md:5` dead ADR ref → `../brain/project/decisions/adr-0001-arquitectura-3-capas-harness-reemplazable.md`.
- [ ] 9.2 [HUMAN] `openspec/README.md` new rule 5: archived-automatically statement (design D9).
- [ ] 9.3 [HUMAN] `harness-contract.md:6` dead ref → link ADR-0005 + ADR-0001.
- [ ] 9.4 [HUMAN] `harness-contract.md` callout after §43-50: "human-optional, machine-guaranteed" (design D9 text, table category unchanged).
- [ ] 9.5 [HUMAN] Human opens and merges PR4 — `brain-writes-reviewed.mjs` blocks agent-authored `brain/core/**` changes at every tier.
