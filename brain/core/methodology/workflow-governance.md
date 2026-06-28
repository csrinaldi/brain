# Workflow Governance — L3 Reference

> **Layer**: L3 (in-context guidance). See [ADR-0014](../../project/decisions/adr-0014-workflow-governance.md) for the architecture.
> **Status**: current | **Introduced**: S3 (governance change)

This document is the in-context reference for the governance workflow that enforces
brain's four load-bearing process invariants at the server-side layer (L1). It maps
each invariant to its CI gate, states the enforce-outputs/guide-judgment boundary
explicitly, and documents the operational procedures for recovery and rollback.

---

## Four Invariants and Their Gates

Each invariant maps to one GitHub Actions job in `.github/workflows/governance.yml`.
Job names are **load-bearing**: they form the check context strings
(`governance / <job-name>`) that branch protection requires.

| # | Invariant | CI job (`name:`) | Skip label | Character |
|---|-----------|-----------------|------------|-----------|
| 1 | Every PR links an approved ticket | `issue-link` | _(none — not skippable)_ | Hard |
| 2 | PR diff ≤ 400 changed lines | `diff-size` | `size:exception` | Hard with override |
| 3 | Memory dumped before closing (proxy) | `memory-gate` _(S4)_ | `skip:memory-gate` | Hard with override |
| 4 | ADR exists for labeled decisions | `decision-gate` _(S4)_ | label-conditional (see below) | Mixed |

Check context format: `governance / <job-name>` (GitHub prefixes the workflow `name:` field).

The constant `GOVERNANCE_JOBS` in `scripts/vcs/governance-checks.mjs` is the single source
of truth for these names. A drift-guard unit test reads `governance.yml` and asserts the
YAML job names match the constant — fail-closed on any mismatch.

### Invariant 4 — two-step `decision-gate` (S4)

- **Step 1 (hard)**: if the PR carries the `decision` label, require an `adr-NNNN-*.md` AND
  a `brain/HOME.md` change in the diff. Fails the PR if either is missing.
- **Step 2 (heuristic)**: scan known architectural surfaces (`scripts/.*/providers/`,
  `brain/core/`, `config-migrations.mjs`, `package.json`) for changes without the `decision`
  label → emit `::warning::`, always `exit 0`. **Never a hard block** — the heuristic can be
  wrong; it raises attention, not a veto.

---

## Enforce-Outputs / Guide-Judgment Boundary

L1 enforces **observable outputs** of each invariant. It does NOT enforce judgment.

| What L1 enforces | What L1 does NOT enforce |
|-----------------|--------------------------|
| A ticket link exists and has `status:approved` | Whether the ticket describes the right work |
| PR diff ≤ 400 lines (excluding ignore-list) | Whether the PR is sliced coherently |
| `.memory/` changed (memory-gate proxy) | Capture quality or session completeness |
| ADR exists when `decision` label is set | Whether the PR actually made a new decision |

This boundary is **not a gap to close** — it is the line between what a machine can verify
and what requires a human mind. The heuristic in step 2 of `decision-gate` warns and
`exit 0`s precisely because "is this a decision?" is judgment. Only the label-conditional
step is hard.

---

## Lockout Recovery

If branch protection is active and a CI job is red, ALL merges to `main` are blocked.

**Recovery path 1 — fix the CI job:**

Address the underlying issue (fix the PR, update the issue label, add the ADR, etc.)
and push a new commit. The gate re-runs and unblocks automatically.

**Recovery path 2 — admin override (logged):**

`enforce_admins: false` allows repo admins to merge through a failing check without
disabling protection. This is logged in the GitHub audit trail.

**Recovery path 3 — emergency disable (use sparingly):**

```bash
# Admin-only: disable protection entirely to unblock an emergency merge.
gh api -X DELETE "repos/{owner}/{repo}/branches/main/protection"

# After the emergency fix is merged, re-enable idempotently:
npm run brain:protect
```

Verify current protection status at any time:
```bash
gh api "repos/{owner}/{repo}/branches/main/protection" | python3 -c "
import json, sys
p = json.load(sys.stdin)
print('checks:', [c['context'] for c in p['required_status_checks']['checks']])
print('reviews:', p['required_pull_request_reviews']['required_approving_review_count'])
print('force push allowed:', p['allow_force_pushes']['enabled'])
"
```

---

## S3 Dual-Surface Rollback

Branch protection is a **GitHub setting**, not a file. Rolling back S3 requires TWO
separate actions — doing only one leaves the system in a broken state.

**Surface 1 — revert the files** (normal `git revert`):

```bash
git revert <S3-commit-sha>
# Removes: governance-checks.mjs, brain-protect.mjs, the branchProtect verb,
# the vcs-contract.md update, workflow-governance.md (this file), and the
# package.json brain:protect script.
```

**Surface 2 — disable the protection setting**:

```bash
gh api -X DELETE "repos/{owner}/{repo}/branches/main/protection"
```

If you only do surface 1, protection stays active with orphaned check context
references. The checks no longer exist (no CI runs them) but protection still
requires them, which deadlocks `main` permanently. Always disable both.

---

## brain:protect — Operator Reference

`npm run brain:protect` activates branch protection on `main` using the current
governance check contexts from `scripts/vcs/governance-checks.mjs`.

**Who runs it**: a repo admin, once. Not a per-developer step.

**When to run it**: after S3 merges to the tracker branch (`feature/governance`),
after all open non-compliant branches have been:
- merged to main in their current state, OR
- rebased to comply with the governance gates, OR
- explicitly documented as exceptions in the S3 PR description (REQ-E-2).

Activating protection while a non-compliant branch is open means that branch cannot
merge until it complies — it does not affect `main` stability, but it creates work.

**Idempotent**: re-running `brain:protect` refreshes the protection settings safely.
It does not break anything or create duplicate checks.
