---
status: draft
issue: 557
---

# Proposal — archive stops being a verb nobody calls: the post-merge green path sweeps it

`openspec/changes/` is advertised as the set of in-flight changes and is 96% closed work: 50 of the
52 unique issues with live folders are closed (only #267 and #284 remain open). The archive verb
that would drain it exists, works, and is *never triggered* — no hook, no CI step, no reminder. This
change makes the sweep automatic by attaching it to the one moment where "this work is verified good
on main" is actually known: the clean post-merge audit that advances the governance cursor.

## The ruling

**Archive stays optional for humans and becomes guaranteed by the machine.** The verb is not
promoted to a required verb and staleness is never turned into an audit failure class. Instead, the
post-merge workflow — already the only trusted writer — opens one `auto-archive/<date>` PR after a
green audit. The doctrine text is corrected to say exactly that, so "optional" stops reading as
"nobody's job".

Three deliverables, in dependency order:

| # | Deliverable | Shape |
|---|-------------|-------|
| 1 | Backfill the ~50 stale folders | One normal PR, human-reviewed |
| 2 | Sweep step in `governance-postmerge.yml` | Runs only on `steps.audit.outputs.code == '0'`, after cursor advance |
| 3 | Fix two dead doctrine references + state the archive policy | Docs-only |

## Why now

| Signal | Evidence |
|--------|----------|
| The directory lies about its own contents | 50/52 unique issues closed; 14 closed more than a week ago |
| The consolidated contract is stale | ~50 changes' spec deltas never reached `openspec/specs/`; last archive commit 2026-08-08 |
| Live consumers read dead data | `session-start.mjs:40-85` derives the active change by scanning folders that are 96% dead; `check-refs.mjs:98-125` and `vcs/phase-order-check.mjs` keep evaluating finished work |
| The verb works when run | Provenance headers in `openspec/specs/governance-v3/spec.md:1` prove `mergeSpecs()` consolidates correctly |
| Nothing calls it | Zero matches for `change:archive` in `.github/workflows/` and `brain/scripts/hooks/`; `harness-contract.md:50` files `/sdd-archive` under "Optional verbs" |
| The irony is diagnostic | issue-260 — the change that *implemented* the archive verb — sits unarchived at `openspec/changes/issue-260-featsdd-e1-brainchangearchive-verb-specs/`, closed 2026-07-22 |

The measured outcome of the status quo over the last 3.5 weeks is zero archives and 50 stale
folders. A WARN class in `brain-audit` would surface the same fact and still depend on a human
acting — which is precisely the failure mode that produced the 50.

## Two findings that change the work

These were verified in the current tree and are the reason the backfill is not a one-liner.

**1. `--all` is not a closed-issue backfill — it archives everything.**
`brain/scripts/archive.mjs:30-63` loops every directory under `openspec/changes/` and archives it if
`parseChangeId` matches, with exactly one hardcoded exclusion: `iid === '260'` ("Skipping active E1
change"). It never asks whether the issue is closed. Run today it would archive open #267 and #284,
and would skip #260 — which is now closed and is one of the folders that must be swept. Both the
backfill and the sweep therefore need a closed-issue filter, and the stale `260` hardcode has to go.

**2. Multi-folder issues collide in the archive destination.**
`archivePath(iid)` (`brain/scripts/lib/sdd-layout.mjs:47-49`) is keyed on the issue id alone, and
`archiveChange` throws `Destination directory ... already exists` when it is taken
(`archive-logic.mjs:87-89`). Three folders share issue 518 (`issue-518-rung3-residuals`,
`issue-518-squash-blindspot-recorded`, `issue-518-widen-audit-walk`) and two share 266. Under
`--all` the first wins and the rest fail into a `console.error` inside the loop — a non-zero-exit,
easily-missed skip. The sweep must not inherit that behaviour: a collision has to be a visible,
non-silent outcome.

## Scope

### In scope

- A closed-issue detector for live folders under `openspec/changes/`, keyed on `parseChangeId` and
  the issue's **closed** state (not merged), consumed by both the backfill and the sweep.
- Correcting `archive.mjs`'s backfill path: closed-issue filter, removal of the `260` hardcode,
  non-silent handling of destination collisions and of folders it refuses to touch.
- One-shot backfill of the stale folders through a normal PR, leaving `openspec/changes/` holding
  only #267, #284 and `archive/`.
- A sweep step in `.github/workflows/governance-postmerge.yml`, gated on `steps.audit.outputs.code
  == '0'` and running after the `advance` step, that opens one `auto-archive/<date>` PR.
- PR-head idempotency for `auto-archive/<date>`, mirroring the `auto-revert/<sha>` check at
  `governance-postmerge.yml:282`.
- Doc fixes: `openspec/README.md:5` → `brain/project/decisions/adr-0001-arquitectura-3-capas-harness-reemplazable.md`;
  `brain/core/methodology/harness-contract.md:6` → the correct ADR; and an explicit statement at
  `harness-contract.md:43-50` that `/sdd-archive` is human-optional but machine-guaranteed.
- Unit tests (`node --test`) for the closed-issue selection and collision handling.

### Out of scope

- Making staleness a `brain-audit` failure or warning class. **Binding non-goal** — see Constraints.
- Any change to the audit, the cursor model, `parse-failures.mjs`, or the revert path.
- Any new permission on `governance.yml`; the PR-time gate stays read-only (design.md §10-B).
- Changing `mergeSpecs()` semantics, the provenance header format, or `openspec/specs/` layout.
- Re-keying `archivePath()` to disambiguate multi-folder issues. If the collision needs a schema
  change rather than a visible skip, that is a separate change.
- A webhook or `issues: closed` trigger.
- Retro-fixing spec deltas whose content is stale or wrong; the backfill consolidates what exists.

## Constraints (agreed, not up for relitigation)

| # | Constraint | Why |
|---|------------|-----|
| C1 | Sweep runs **only** on a clean audit, after the cursor advances | A dirty or uncomputable window pins the cursor; sweeping mid-incident could archive a merge that is about to be auto-reverted |
| C2 | Staleness is **never** a `[FAIL]` audit class | Making it one weaponizes the revert machinery against housekeeping. This is a sweep step, not a gate |
| C3 | Keyed on issue **CLOSED**, not merged | A merge that does not close its issue leaves the folder alone |
| C4 | Output is one `auto-archive/<date>` PR, never a direct push to main | Branch policy: no direct commits to main, pre-commit enforced. Same pattern and idempotency as `auto-revert/<sha>` (REQ-D2-13) |
| C5 | Three deliverables ship: backfill, sweep step, doctrine fix | The sweep alone leaves 50 folders; the backfill alone regrows the pile |

## Approach

### Quick path

1. Add a closed-issue selector (a small lib module beside `archive-logic.mjs`, injectable VCS
   reader) that maps live folder names → `{iid, closed}` and returns the sweep set.
2. Rewire `archive.mjs --backfill` onto that selector; keep `--all` behaviour explicit and loud
   about what it refuses to archive.
3. Run the backfill locally, open it as a normal PR, review the consolidated `openspec/specs/` diff.
4. Add the `sweep` step to `governance-postmerge.yml` after `advance`, gated on audit code `0`.
5. Verify: a green post-merge run with no closed-and-unswept folder produces no PR; with one, it
   produces exactly one `auto-archive/<date>` PR, and a re-run produces none.

### Why the post-merge green path

`governance-postmerge.yml` already guarantees, independently of the PR-time gates, that main
actually works: it resolves the window from the governance cursor, runs `brain-audit` over it, and
either advances the cursor (clean), opens auto-revert PRs (offenders), or alarms (uncomputable). It
holds `contents: write` deliberately, separated from the read-only PR gate. The cursor-advance
moment is the only point in the system where "this work is verified good on main" is a computed
fact rather than an assumption. The daily `cron: '0 6 * * *'` gives the sweep a heartbeat even
without pushes.

The archive PR then passes through the normal gates like any other. `phase-order-check.mjs` already
models `archived` as a forward rung, so Rule B holds for the folders it moves.

### Alternatives considered

| Alternative | Verdict |
|-------------|---------|
| `issues: closed` webhook trigger | Rejected — closes the loop faster, but archives before the closing merge's audit passes; a change auto-reverted minutes later would already be archived |
| `brain-audit` WARN class for stale folders | Rejected — surfaces the problem and still relies on a human to act, the exact failure mode that produced 50 stale folders |
| Manual archiving / do nothing | Rejected — measured over 3.5 weeks: zero archives |
| Sweep pushes directly to main | Rejected — violates branch policy; also removes the human review of the consolidated spec diff |

### Failure-mode obligations

The sweep is a housekeeping step inside a fail-closed workflow. It must not be able to turn a green
run red-and-silent, and it must not be able to hide its own failure:

- A sweep failure must not undo the cursor advance and must not mask the audit result.
- The `always()` terminal step (REQ-TS-5) asserts no red-and-silent state; whatever the sweep does
  on failure has to satisfy that invariant, either by recording an alarm or by not failing the job.
- Which of those two it is — non-fatal skip with a log line, or an alarm label — is a design
  decision, flagged below.

## Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Sweep archives a folder whose merge is later reverted | Medium | C1: only on a clean audit after cursor advance. Residual: a revert landing *after* the sweep leaves an archived folder for finished-then-reverted work — recoverable by moving it back, since archive is a rename plus an append |
| The backfill's `openspec/specs/` diff is large and under-reviewed | Medium | Ship the backfill as its own PR, separate from the sweep step. Review the consolidated spec diff, not the folder renames |
| A sweep bug reddens `governance-postmerge` and blocks the revert path | High | Sweep runs strictly after `advance` and never gates it; failure-mode obligations above are a design deliverable, not an implementation detail |
| Multi-folder issues silently skip | Medium | Finding #2: collision becomes a visible outcome; sweep never reports success for a folder it did not move |
| Spec deltas merge badly into `openspec/specs/` (duplicate or contradictory requirements) | Medium | `mergeSpecs()` appends with a provenance header rather than rewriting; contradictions become visible history. Human review on the backfill PR is the check |
| `auto-archive/<date>` PRs accumulate unmerged and re-open daily | Low | PR-head idempotency keyed on the branch, `--state all`, same as REQ-D2-13. Date-keyed branches mean a stalled PR does not block the next day's, so an unmerged backlog is possible — worth a cap or a check in design |
| Doc fix touches doctrine files under a doctrine gate | Low | Docs-only, no behavioural claim beyond the archive policy statement |

## Rollback

The change is three separable pieces, each independently revertible.

| Piece | Rollback |
|-------|----------|
| Sweep step (2) | Revert the `governance-postmerge.yml` hunk. The workflow returns to audit + advance/revert/alarm with no other behaviour change; no state migration, no cursor implication |
| Backfill (1) | `git revert` the backfill PR. The archive operation is a directory rename plus an append to `openspec/specs/<capability>/spec.md`; a revert restores both. No data is deleted at any point |
| Doc fix (3) | Revert the docs commit |

If the sweep misbehaves after merge, the correct first action is to revert the workflow hunk (piece
2) and leave the backfill in place — the stale folders are the problem being solved, and reverting
the backfill would recreate it.

Emergency stop without a revert: close any open `auto-archive/*` PR. Nothing merges without it.

## Open questions for spec and design

1. **Issues closed as "not planned".** Does an abandoned change get archived (consolidating spec
   deltas for work that never shipped, into the durable contract) or discarded/left alone? Archiving
   would inject never-implemented requirements into `openspec/specs/`. This needs an explicit rule —
   likely: skip, and report as "closed but not archivable".
2. **Multi-folder issues.** `archivePath(iid)` collides for issue-518 (×3) and issue-266 (×2). Skip
   with a loud report, or extend the archive layout to disambiguate? The former is in scope; the
   latter is a separate change. Design must pick and justify.
3. **An issue that closes mid-sweep.** The selector snapshots issue state at sweep time and the PR
   merges later. Is a race worth handling, or is the next sweep's convergence enough? Related: what
   happens if the folder is deleted or renamed between selection and PR merge.
4. **Backfill PR sizing.** It moves ~50 folders of markdown plus a substantial `openspec/specs/`
   append. Does it need `size:exception`, or should it be split — for example by capability, or
   folders-only first and spec consolidation second? Splitting costs reviewer context; a single
   exception PR costs review depth.
5. **Sweep failure semantics.** Non-fatal skip with a log line, or a `governance:archive-blocked`
   alarm label? Must be reconciled with REQ-TS-5, which forbids a red-and-silent terminal state.
6. **Selector authentication.** The closed-issue lookup reads issue state through the VCS port. Does
   it use `VCS_TOKEN` like the audit step (#479), and what happens when the read fails — skip the
   sweep entirely (fail-closed, preferred) or archive nothing silently?
7. **Doctrine wording.** Exact phrasing at `harness-contract.md:43-50` for "human-optional,
   machine-guaranteed", and whether the archive row moves out of the optional table into a new
   category rather than staying under "Optional verbs (recommended)".

## Checklist for the next phase

- [ ] Spec covers: closed-issue selection rule, "not planned" handling, collision behaviour, sweep
      gating on audit code `0`, PR idempotency, and sweep failure semantics.
- [ ] Design resolves open questions 1, 2, 5 and 6 with rationale.
- [ ] Design states the interaction between the sweep step and REQ-TS-5.
- [ ] Delivery plan decides whether the backfill is one PR with `size:exception` or split.

## Next step

`/sdd-spec` and `/sdd-design` — they can run in parallel off this proposal.
