---
status: proposed
issue: 936
absorbs: 930
---

# Proposal: the lane sweep revisits every unreconciled `memory/<host>-*` branch (#936)

## Intent

Two defects strand or misreport memory on the lane (ADR-0034). Exploration: `explore.md` in this dir.

- **Same-day (#1023/#1050 shape).** `collectLane` step 8 (`brain/scripts/memory/lane/collect.mjs:276-282`) always parents a new append on the local ref's tip, even when that tip was squash-merged. The merge-base stays at the old `origin/main`, so the three-dot diff (PR title, body, "Files changed", `lane-paths`/`lane-scrub`) lists records that are already on `main`. #1050 listed `rec-0ae8abdbc96f2b8c`, which #1036 had already merged.
- **Cross-day.** Every entry point computes `date = today` (`cli.mjs:488`), and no entry point enumerates `refs/heads/memory/<host>-*`. A lane stranded across midnight is never revisited. `ship.mjs:326-333` names this gap.

## Scope

### In Scope
- **Absorbs #930 (maintainer decision 2026-09-19).** `mrList` in both providers (`brain/scripts/vcs/providers/github.mjs`, `gitlab.mjs`) stops discarding the state it already receives: each item gains an additive `merged` boolean (and the closed/open state), with fixtures and the port contract test (`vcs.contract.test.mjs`) updated. Existing consumers keep working because the change is additive. The sweep classifies "closed unmerged" from this fact, never by inference.
- A shared, fail-closed content-delivery helper that returns delivered, pending or unknown. It extracts `surveyDelivery`'s primitive (`ship.mjs:75-119`) into `collect.mjs` or a sibling module, which avoids a circular import.
- **Same-day reparent (explore option c).** In step 8, the new commit parents on `origin/main`'s tip, with a CAS `update-ref`, only when the existing tip's own tree is fully delivered. Partial or unknown delivery keeps appending as today.
- **Cross-day sweep** over this host's local and remote `memory/<host>-*` refs. There is no age cutoff.

| Branch state | Action |
|---|---|
| Delivered by content to `origin/main` | Delete the local ref only |
| Pending, no PR or an open PR | Re-ship through today's ship path, without collecting new records into it |
| Pending, PR closed unmerged | Never re-ship and never reopen; report branch + PR on every run |
| Unknown | Fail closed: keep the branch and report it |
| Stale remote branch blocks a push | Fail loud (`diverged`); never force |

- Reporting: sweep lines in `day-start-sweep.mjs` and in both i18n catalogs.
- A Tier 2 draft: `brain-drafts/adr-0034-l2-auto-merge-note.md`.
- Bare-origin integration tests that reproduce #1050 red-first, plus a test for each row of the sweep table.

### Out of Scope
- `LANE_BRANCH_RE`, branch grammar, every governance gate, and `memory-gate` semantics.
- Force-push in any path.
- The ADR-0034 L2 auto-merge policy, deferred to epic #864 task 6.1. No write under `brain/**`.
- Other hosts' lane refs.
- An age cutoff or retention expiry.

## Capabilities

### New Capabilities
None.

### Modified Capabilities
None. By repo convention (#888, #920), `openspec/specs/**` has no memory-lane capability. The normative surface is this change's `spec.md` plus ADR-0034.

## Approach

1. Extract the helper and pin it with unit tests.
2. Reparent in step 8. `collected` stays tree-diff based.
3. Add a sweep that enumerates refs, classifies each one with the helper plus PR state, and dispatches each branch to delete, re-ship or report. `shipLane` gets an injected no-collect path so that a re-shipped prior-day ref never absorbs today's records. Nothing in `collect.mjs` filters candidates by date.

## Affected Areas

| Area | Impact |
|---|---|
| `brain/scripts/vcs/providers/{github,gitlab}.mjs`, `brain/scripts/vcs/fixtures/*mrList*`, `memory/__fixtures__/fake-vcs-port.mjs` | Modified (additive `mrList` shape, #930) |
| `brain/scripts/memory/lane/collect.mjs`, `ship.mjs` (+ possible sibling helper) | Modified |
| `brain/scripts/memory/day-start-sweep.mjs`, `cli.mjs` | Modified |
| `brain/scripts/i18n/{en,es}.mjs` | Modified |
| `lane/*.integration.test.mjs`, `ship.test.mjs` | Tests |

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| **"Closed unmerged" is ambiguous today.** `mrList` returns only `{number,title,headBranch}` with no merged flag (#930, `github.mjs:457-459`). A same-name branch whose earlier PR merged and whose later append never opened a PR (the M1 case) could be misread as human-closed and stranded | Low (after #930) | Resolved: #930 is absorbed, so `mrList` reports `merged`. A read failure or missing field classifies the branch as unknown (keep + report) |
| The closed-PR policy reverses #920 R8 ("closed ⇒ fresh PR") for today's branch too | Med | State the reversal in the spec and update R8's code comment |
| The closed-PR scan misses old PRs (`per_page=100`, no pagination) | Med | The design bounds the read or fails closed |
| Reparent reads a partial tree as delivered | Low | Check the tip's own tree, all-or-nothing, fail closed |
| Remote branch survives a merge (setting flipped) | Low | `memory.ship.diverged`, loud, never force |

## Rollback Plan

Revert the PR. Local ref deletion applies only to refs that are delivered by content, and those records are already on `main`. No config, hook or gate changes.

## Success Criteria

- [x] The #1050 repro (ship X, squash-merge on a bare origin, keep the local ref, add Y, ship) fails before the change. After it, the diff lists only Y and the commit's parent is `origin/main`'s tip.
- [x] Partial or unknown delivery still appends.
- [x] Each row of the sweep table is asserted against a bare origin, including a prior-day ref.
- [x] A re-shipped prior-day ref never gains today's records.
- [x] No force-push anywhere, and `LANE_BRANCH_RE` is unchanged.

## Proposal question round — resolved (2026-09-19)

1. **Detection of "closed without merge".** Absorb #930: widen `mrList` additively with a `merged` flag in both providers. The PR resolves #936 and #930.
2. **"By a human".** Every closed-unmerged lane PR counts as a human decision. The port cannot tell who closed it, and ship never closes PRs.
3. **Report channel.** Both: `day:start` and `memory:ship --json`.
4. **#920 R8 reversal.** Closed-unmerged now reports instead of opening a fresh PR, for today's branch too. The spec states it and R8's code comment is updated.
