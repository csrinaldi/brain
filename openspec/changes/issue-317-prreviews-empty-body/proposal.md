---
status: draft
issue: 317
epic: 313
---

# Proposal — Split `prReviews`: add `prReviewBodies` read verb (issue #317)

## Intent

Both providers' `prReviews` normalizers return `{ state, author }` with no `body`. `parseVerdict` requires a non-empty `body`, so `doctrine.priorVerdicts` is **always `[]` in production**. Three M3 guardrails are inert dead code today:

| Guardrail | Site | Why inert |
|---|---|---|
| Anti-loop lock | `poster.mjs:72` | `priorVerdicts` never non-empty |
| `rev >= 3` STOP + escalate | `verdict.mjs:58` via `cli.mjs:207` | `priorRevCount` always `0` |
| Board `seq:*`/`reviewed:*` reconciliation | `board.mjs:104-105` | `latestVerdict` always `null` |

Root cause: one verb serves two semantic needs over two structurally different GitLab resources — approvals (no body) for `brain-writes-reviewed.mjs`, notes (has body) for cold-boot/board. Unblocks epic #313 (M3 reviewer moat).

## Scope

### In Scope
- New contract verb `prReviewBodies({ project, number, apiBase?, token?, proxyUrl?, fetchImpl? }) -> Promise<Array<{ author, body, at }>|null>`. GH: Reviews API including `body`. GL: notes API — the same resource `prReviewComment` already writes to.
- Register it in all three drift-guard sources of truth: `vcs-contract.md` Required verbs table, `cli.mjs` `VERBS`, both provider exports.
- Switch `cold-boot.mjs` `defaultFetchReviews` and `board.mjs` `reconcileOnePr` to the new verb.
- Add the missing parity/contract test, plus an integration test that real normalizer output survives `parseVerdict`.
- Replace fabricated-`body` fixtures in `cold-boot.test.mjs` / `board.test.mjs` with real-shape ones.

### Out of Scope
- `prReviews` shape and behavior — deliberately unchanged; `brain-writes-reviewed.mjs` and `actor-check.mjs` are untouched.
- `buildVerdict` missing `protocol` (`cli.mjs:204-216`) — independent live defect, file separately.
- `renderVerdict` nested-YAML vs `parseVerdict` JSON-scalar `findings` mismatch — independent live defect, file separately.
- Durable `.memory/records/` verdict store (explore approach 3) — protocol §9 says the thread is truth.

## Capabilities

### New Capabilities
- `vcs-pr-review-bodies`: provider-agnostic read of verdict-bearing review comment bodies, semantically distinct from approval state.

### Modified Capabilities
- None. `prReviews`' documented contract is preserved by design.

## Approach

Exploration approach 2 (split the verb). Mirror the **read** verb to `prReviewComment`'s per-provider **write** target instead of merging GitLab approvals + notes by author — that join has no reliable key (a human can approve without commenting, or comment without approving). Reuse the established `prView`/`labelEvents` discipline: `null` = uncomputable, `[]` = genuinely empty, `body: ''` never `null`.

## Affected Areas

| Area | Impact | Description |
|---|---|---|
| `brain/scripts/vcs/providers/github.mjs` | New | `prReviewBodies` over `gh api ... /reviews --paginate`, keeping `body` |
| `brain/scripts/vcs/providers/gitlab.mjs` | New | `prReviewBodies` over `GET .../merge_requests/{iid}/notes` via `gitlabApiFetch` |
| `brain/core/methodology/vcs-contract.md` | Modified | Required-verbs row; clarify `prReviews` = approval state only |
| `brain/scripts/vcs/cli.mjs` | Modified | Add to `VERBS` (drift guard fails otherwise) |
| `brain/scripts/review/cold-boot.mjs` | Modified | `defaultFetchReviews` → new verb; drop the H1-2 NOTE |
| `brain/scripts/review/board.mjs` | Modified | `reconcileOnePr` reads real bodies |
| `providers/vcs.contract.test.mjs`, `providers.test.mjs` | New/Modified | First parity test for this shape |
| `cold-boot.test.mjs`, `board.test.mjs` | Modified | Real-shape fixtures replace fabricated `body` |

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| GitLab notes include non-verdict noise (system notes, human comments) | High | `parseVerdict` already returns `null` for non-verdict bodies; filter `system: true` |
| Regression in `brain-writes-reviewed.mjs` approval detection | Low | `prReviews` is not touched; its existing tests stay green |
| Verb registered in only 1-2 of 3 sources of truth | Medium | `verb-contract-drift-guard.test.mjs` fails the build automatically |
| GH review bodies paginate/truncate | Low | Keep `--paginate` (asserted by existing source test) |

## Rollback Plan

Single revert of the change commit(s). Since `prReviews` and its callers are untouched, rollback restores today's production behavior exactly — `priorVerdicts` returns to `[]` (already the live state), no data migration, no posted-comment cleanup.

## Dependencies

None. The two adjacent defects are explicitly out of scope and do not block this slice — though `brain-review/2` end-to-end remains blocked until they are fixed.

## Success Criteria

- [ ] `prReviewBodies` implemented on both providers; `verb-contract-drift-guard.test.mjs` green.
- [ ] Parity test asserts identical normalized shape across GH/GL, including `null` vs `[]` vs `''`.
- [ ] Integration test: real normalizer output → `parseVerdict` yields a non-null verdict, with **no fabricated `body`** in any fixture.
- [ ] `priorVerdicts` non-empty on a PR carrying a prior verdict; anti-loop lock and `rev >= 3` bound demonstrably fire.
- [ ] `brain-writes-reviewed.mjs` / `actor-check.mjs` tests unchanged and green.
