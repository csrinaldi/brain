---
status: draft
issue: 334
epic: 335
sequence: 313
artifact_store: hybrid
---

# Proposal — `brain:ship` derives PR labels from the issue (issue #334)

## Intent

`brain-ship.mjs:94` hardcodes `labels: ['kind:feature']`. That label does not exist on
the remote — this repo's taxonomy is `type:*`. So the golden-path verb **fails on brain's
own repository** on first real use while tests stay green: the injected `mrCreateFn` stub
accepts any `labels` value and nothing asserts on it. This is M10's first worked example
of seam blindness (logic proven, boundary untested). Secondary defect: `titleFromBranch`
emits plain text, not the conventional-commit format the PR template requires.

## Scope

### In Scope
- Inject `issueViewFn` into `runShip()` (mirroring `brain-start.mjs`); pass the issue's own `type:*` label **verbatim** to `mrCreateFn`.
- PR title = conventional-commit prefix (`deriveBranchType` mapping) + de-hyphenated slug.
- Pre-flight conformance seam: assert the label exists in the remote's declared label set **before** `mrCreateFn` (Gap B).
- Rewrite `brain-ship.test.mjs` stub to assert `labels`; add missing-label, pre-flight-rejection, and title-format cases.
- `issueView` contract test + fixtures (GitHub recorded, GitLab derived) — closes one Gap-A verb.
- Document the label-resolution rule in `vcs-contract.md`.

### Out of Scope
- `brain-start.mjs` hardcoded `feature/<n>-<slug>` naming; reconciling `ticket-start.mjs` vs `brain-start.mjs`.
- Full Gap-A coverage audit (#336); generalizing pre-flight beyond labels (milestones, assignees, required checks).
- ADR/doctrine promoting "every write ships a pre-flight check".

## Capabilities

### New Capabilities
- `vcs-issue-view-contract`: cross-provider contract coverage + fixtures for the `issueView` verb.
- `vcs-label-preflight`: pre-flight existence check for labels against the remote's declared set before a mutating write.
- `ship-pr-label-resolution`: `brain:ship` derives PR label and title prefix from the issue's type.

### Modified Capabilities
- `governance`: REQ-S5-4's vague "correct labels" becomes a defined source (the issue's own `type:*`) plus a pre-flight gate.

## Approach

**Two vocabularies, one source.** The issue's `type:*` label is the single source of truth:
passed verbatim as the PR label (never re-mapped — `bug` ≠ `fix`, and no `ci`/`build`
labels exist remotely), and mapped through `deriveBranchType`'s table *only* for the
commit-type prefix in the title. No inference from branch prefix (`brain-start` encodes no
type there), no config indirection. Pre-flight is a new injectable seam so tests stay
network-free; it is the real root-cause guard — a derived `mrCreate` fixture would just
re-encode the same wrong belief.

## Affected Areas

| Area | Impact | Description |
|---|---|---|
| `brain/scripts/brain-ship.mjs` | Modified | `issueViewFn` param, label derivation, title prefix, pre-flight call |
| `brain/scripts/vcs/providers/*.mjs` | New | Remote label-set read for pre-flight (provider-aware `:` vs `::`) |
| `brain/scripts/brain-ship.test.mjs` | Modified | Stub asserts `labels`; new error-path cases |
| `providers/vcs.contract.test.mjs` + `fixtures/` | New | `issueView` contract test, GH/GL fixtures |
| `brain/core/methodology/vcs-contract.md` | Modified | Label-resolution rule; new verb row |

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Approved issue lacks a `type:*` label | Med | **Fail closed** with an actionable error — ship is not the place to infer |
| GitLab `type::feature` vs GitHub `type:feature` scoping | High | Provider-aware mapping, same shape as `approved-label.mjs` |
| No live GitLab mirror for fixtures | High | Derived fixtures, per this suite's existing precedent |
| Extra remote read per ship | Low | Injectable seam; no live calls in unit tests |
| Two divergent start scripts re-introduce drift | Low | Depend only on `issueView`, never on branch shape |

## Rollback Plan

Single revert of the change commit(s). Restores today's hardcoded label — already broken,
so rollback cannot regress production. No state, no migration, no posted-PR cleanup.

## Dependencies

None; Phase 0 is independent. Unblocks #336 (Phase 1 audit) and #317 (Phase 2).
Source of truth for phase sequencing: `docs/inbox/seam-contract-coverage-roadmap.md` (#335, #313).

## Success Criteria

- [ ] `brain:ship` opens a PR on brain's own repo with a label that exists on the remote.
- [ ] `brain-ship.test.mjs` asserts the exact `labels` array sent to `mrCreateFn`.
- [ ] Pre-flight rejects a label absent from the remote's set before any write occurs.
- [ ] `issueView` contract test green on both providers with no fabricated happy-path GH fixture.
- [ ] PR title matches `type: description` conventional-commit format.
