# DRAFT — GitLab-porting constraint for rung-3 auto-revert (REQ-D2-9)

> **Status: DRAFT.** This file lives in `openspec/changes/issue-259-d2/brain-drafts/`
> (outside the doc zone by construction — see `brain.config.json`'s
> `governance.ignoreList`, which excludes `openspec/changes/**`). It is
> authored by the agent as the FULL extent of its authority over this
> constraint. A **human** co-promotes it into the canonical doc zone (an ADR,
> `brain/core/…`, or the PLAN) via a **separate** MR/PR the human owns
> (pattern #216). This PR/commit MUST NOT write into ADR / `brain/core/` /
> PLAN — any such change is a STOP-finding (design.md §7).

## Constraint

**Rung-3 auto-revert (`governance-postmerge.yml` + `brain/scripts/brain-audit.mjs`
+ `brain/scripts/governance/postmerge/*.mjs`) MUST NOT be ported to GitLab
until D2's fixes have landed and been running cleanly on GitHub.**

D2 (issue #259, slice 2 of Track D) hardens three historically-real defects
in rung-3 (bugs 1–3: tag-move masking, revert-of-HEAD-instead-of-offender,
missing dedup-key-on-offender) and adds the audit-cursor mechanism, the
`[FAIL-SHA]` emission/parser contract, and (Slice 1) a narrow uncomputable-range
exit-2 fix. Porting the auto-revert mechanism to a second platform BEFORE these
fixes are proven in production would duplicate the same historical failure
mode onto GitLab before it is even confirmed fixed on GitHub — the opposite
of what D2 exists to prevent.

## What IS unblocked by D2 (scope clarification)

D2 deliberately makes the **core** of rung-3 platform-neutral
(`brain/scripts/governance/postmerge/{cursor,parse-failures}.mjs` — no GitHub
Actions coupling, no `GITHUB_OUTPUT`, no `gh` CLI, no Actions cache). This
LIFTS the technical blocker that made a GitLab port unsafe by construction.
It does **not**, by itself, authorize shipping a `gitlab-postmerge.yml` (or
equivalent GitLab CI job) that calls this core — that is a separate,
explicit, human decision, gated on the constraint above.

## What the GitLab port covers today (unaffected by this constraint)

The **PR-time gates** (`GOVERNANCE_JOBS` — decision-gate, diff-size,
issue-link, memory-gate, run via `brain/scripts/governance/run-check.mjs`)
are **already ported** to GitLab (issue #231, Track A) and are **NOT**
affected by this constraint. This constraint is scoped **exclusively** to the
post-merge auto-revert mechanism (rung 3) — a fundamentally different trust
boundary (`contents: write` / `pull-requests: write`, post-merge on the
default branch) from the read-only PR-time gates.

## Promotion path (human-owned, pattern #216)

1. A human reviews this draft after D2 (Slice 1 + Slice 2) has merged and run
   cleanly on GitHub for an observation period the human judges sufficient.
2. The human opens a **separate** PR promoting this constraint into the
   canonical doc zone — e.g. a new ADR, or an addition to
   `brain/core/governance.md` (whichever the house convention at promotion
   time dictates).
3. Only after that promotion does "port rung-3 to GitLab" become an
   authorized, separately-scoped change (not part of D2 or D1/D3).

## Provenance

- Issue: #259 (Track D, slice D2)
- Rulings: engram #879 (fork rulings, PINNED), engram #886 (checkpoint
  rulings R-1/R-2, FINAL)
- Pattern: #216 (draft-then-human-co-promote for doc-zone writes)
- Related: proposal.md / spec.md / design.md / tasks.md in this change folder
