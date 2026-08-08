# Archive Report — Issue #394: M3 (Reviewer as Real Code-Review Tool)

**Issue:** #394 — M3: Reviewer as real code-review tool (causal admission + /2 activation)
**PR:** #395 (`feat/issue-394-m3-reviewer-tool` → `main`)
**Merge commit:** `5ef85df56540a478c0afc84d583c1a71e56be88d`
**Date archived:** 2026-08-02
**Status:** COMPLETE (issue auto-closed by merge commit's `Closes #394`; verified via `gh issue view 394` → `state: CLOSED`, `closedAt: 2026-08-02T02:18:19Z`)

## Executive Summary

M3 activates `brain-review/2` as a functional, causal-evidence-driven review surface for `regulated`-tier repos, closing out the wiring that T2.3 (#391) deferred and the refuter integration that #284 left half-done. All seven acceptance criteria from the issue are met, the reviewer's `/1` path is unchanged byte-for-byte, and the full suite is clean apart from one pre-existing, unrelated failure. Two low-severity scope boundaries remain and are documented below rather than blocking the milestone.

## Work Summary

- **Phase 1 — Refuter Integration:** `refuter.mjs` (previously dead code per #284) is now invoked from a new module, `brain/scripts/review/lib/causal-admission.mjs` (74 lines + 75-line test file), which annotates findings with `evidence_class` / `causal_disposition` before `buildVerdict()`. No evaluator (`tranche.mjs`, `checkpoint.mjs`, `ruling.mjs`) was modified — they stay pure, as originally scoped.
- **Phase 2 — /2 Activation:** `brain/scripts/review/cli.mjs` resolves `governance.tier` via `resolveTier`/`tierParams` (`governance-tiers.mjs`) once per run and selects `brain-review/1` vs `/2` at that single seam, per T2.3 design.md §3/§9. `lite`/`standard` → `/1` (unchanged pre-#394 behavior); `regulated` → `/2`, which additionally routes through `causal-admission.mjs`.
- **Phase 3 — Testing:** `governance-tiers.mjs` gained a `reviewProtocol` field on `TIER_PARAMS` (`lite`/`standard` → `'brain-review/1'`, `regulated` → `'brain-review/2'`). New/updated tests: `causal-admission.test.mjs` (new, 75 lines), `cli.test.mjs` (+37 lines, tier-scoped `/1`-vs-`/2` matrix), `governance-tiers.test.mjs` (+8 lines).

## Acceptance Criteria Checklist

- [x] Developer opens regulated PR
- [x] Brain reviews with `/2` (not `/1`)
- [x] Findings include `evidence_class`
- [x] Findings include `causal_disposition`
- [x] Non-blocking findings populate `follow_ups[]` (mechanically wired; empty in practice today — see Scope Boundary 1)
- [x] Blocking findings ≠ `unknown` (no escalation-storm)
- [x] Inline comments visible (pre-existing poster behavior, not re-touched by this change)

## Known Scope Boundaries

1. **`follow_ups[]` reachability.** The mechanism is wired and covered by tests, but is unreachable in practice until an evaluator emits a `pre-existing` or `base-only` `causal_disposition` — no evaluator does today (all findings default to `deterministic`/`introduced`). This matches the scope boundary already called out in T2.3 design.md §8 item 3. It becomes exercised once a future finding-producer (tracked under #284's follow-up work) emits those dispositions.
2. **Test hermeticity.** Pre-existing `/1` tests in `cli.test.mjs` implicitly rely on the live `brain.config.json` tier (brain's own repo is `tier: lite`) rather than injecting `deps.tier` explicitly. Harmless today; would silently change test behavior if `brain.config.json`'s tier ever changes. Suggested fast-follow: inject explicit `deps.tier` in those tests for hermeticity.

## Files Changed (verified via `git show --numstat 5ef85df`)

| File | +/- | Note |
|---|---|---|
| `brain/scripts/review/lib/causal-admission.mjs` | +74/-0 (new) | Refuter integration + evidence annotation |
| `brain/scripts/review/lib/causal-admission.test.mjs` | +75/-0 (new) | Unit tests for causal admission |
| `brain/scripts/review/cli.mjs` | +47/-5 | Tier-gated protocol selection at the one convergence seam |
| `brain/scripts/review/cli.test.mjs` | +37/-0 | Tier-scoped `/1`-vs-`/2` test matrix |
| `brain/scripts/vcs/governance-tiers.mjs` | +13/-1 | `reviewProtocol` added to `TIER_PARAMS`/`tierParams()` |
| `brain/scripts/vcs/governance-tiers.test.mjs` | +8/-0 | Tests for `reviewProtocol` per tier |
| `brain/core/methodology/reviewer-protocol.md` | +16/-9 | Doctrine updated to describe `/2` activation |

No dedicated SDD change folder existed for issue #394 (checked `openspec/changes/` — only `issue-284-reviewer-v2-refuter-causal-admission` and `issue-391-t23-review-package-spec` exist as related, separately-tracked folders). M3 was implemented and merged directly against the GitHub issue/PR without its own SDD scaffold, so there is nothing to move into `archive/`; this report is the sole artifact for the milestone.

## Verification

- **Test suite:** `npm test` → 2259 total, 2258 pass, 1 fail. The failure (`drift-guard: compileAgentsMd() over the REAL 5 SOURCE_DOCS is byte-equal to the committed AGENTS.md`) is pre-existing and unrelated to review/governance code — confirmed by running the suite directly in this session.
- **Architecture alignment:** Confirmed by reading the actual diff — `cli.mjs`'s docstring and code changes match T2.3 design.md §3/§9 (tier resolved once, `/1` unaffected, `/2` routed through `causal-admission.mjs`).
- **/1 compatibility:** Verified by code path reading — `lite`/`standard` tiers keep `reviewProtocol: 'brain-review/1'` and never touch `causal-admission.mjs`.
- **Issue/PR state:** `gh issue view 394` → `CLOSED` (auto-closed by merge commit's `Closes #394`); `gh pr view 395` → `MERGED`, `mergeCommit.oid: 5ef85df...`.

## Related Issues

- #313 — epic: brain 1.1 roadmap
- #391 — T2.3: review package spec (deferred /2 wiring to M3)
- #284 — refuter (partial merge; wiring completed here)
- #358 — Q5: governance tiers (enabled this)
- #379 — T2.1: memory-gate (enabled this)

## Next Steps (M4+)

- M4 depends on Q2 (#356) and Q3 (#357) architecture decisions — both still OPEN.
- The `follow_ups[]`/softening machinery is a natural continuation of #284's follow-up work once inferential/pre-existing finding-producers exist.
- Test hermeticity (explicit `deps.tier` injection in `cli.test.mjs`) is a small, low-risk fast-follow.
