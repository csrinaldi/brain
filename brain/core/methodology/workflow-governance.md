# Workflow Governance — L3 Reference

> **Layer**: L3 (in-context guidance). See ADR-0014 (workflow-governance) in the brain project for the architecture. (Core docs reference project ADRs by name, not by path — `brain/project/**` is consumer-owned and varies per repo.)
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
| 2 | PR diff ≤ the declared tier's budget — **1000** `lite` · **400** `standard` · **200** `regulated` | `diff-size` | `size:exception` — **refused at `regulated`** | Hard with override |
| 3 | `.memory/` has EVER held a session summary (repo-scoped) | `memory-gate` _(S4)_ | _(none — `skip:memory-gate` is named but unimplemented)_ | Soft — see below |
| 4 | An ADDED ADR co-occurs with a `brain/HOME.md` entry | `decision-gate` _(S4)_ | _(none — the gate reads no labels)_ | Hard, in one direction — see below |

> **Invariant 2 is tier-resolved, and this text restates the numbers by hand** (#496). The
> authority is `TIER_PARAMS` in `brain/scripts/vcs/governance-tiers.mjs` — `diffBudget` and
> `honorSizeException` per tier. Doctrine restating a value the code owns is a drift risk
> accepted deliberately here rather than left implicit: a reader needs the numbers in front of
> them, and the alternative — a pointer with no values — is what let this row say a flat `400`
> for as long as it did. **brain itself declares `lite`**, so a checkpoint report written in
> this repo cites `N/1000`, not `N/400`; a report quoting the wrong budget is itself a blocking
> finding (`parseBudgetClaim`, #472).

### Invariant 3 scope — what `memory-gate` does and does not check

**It is repo-scoped and it is permanently satisfied.** `memoryPresence` asks whether ANY
`session_summary` observation exists in `.memory/records/`. There are 205. The gate therefore
passes on every PR regardless of whether that PR captured anything, and it will keep passing if
nothing is ever captured again.

**Nothing enforces per-change capture.** The PR template's "Memory materialized before closing"
is a promise the checklist makes and no gate keeps. Read invariant 3 as *"this repository has a
memory layer"*, never as *"this change was remembered"*.

Measured 2026-08-11 (issue #529): `.memory/records/` went **seven days** without a new record
while **34 merges** landed. `memory-gate` was green on all of them — correctly, by the definition
above. That is the gap this scope note exists to stop hiding.

**`skip:memory-gate` does not exist in code.** No path checks for it. It is listed here and in
`AGENTS.md` as documentation of an intent, and `brain:metrics` counts its usage raw without ever
subtracting it. Applying the label changes nothing.

**This is a ruling, not a resting place** (issue #529). The sequence is: #530 makes capture a
mechanism rather than a habit → `skip:memory-gate` becomes real → invariant 3 tightens to
recency. Tightening it before the writer is reliable would block every PR with no override,
which is how a gate teaches people that gates are obstacles.

Check context format: `governance / <job-name>` (GitHub prefixes the workflow `name:` field).

The constant `GOVERNANCE_JOBS` in `scripts/vcs/governance-checks.mjs` is the single source
of truth for these names. A drift-guard unit test reads `governance.yml` and asserts the
YAML job names match the constant — fail-closed on any mismatch.

### Invariant 4 scope — what `decision-gate` does and does not check

**It reads no labels, and it runs on every PR.** `adrPresence` takes the changed-file list and
the added-file list; no call site passes labels and the workflow job carries no condition. The
`decision` label changes nothing about the verdict.

**It fails in exactly two cases** (measured 2026-08-11, issue #516):

| condition | verdict |
|---|---|
| an ADR is **added** and `brain/HOME.md` is not in the diff | fail |
| `brain/HOME.md` is in the diff and **no** ADR path is touched | fail |
| anything else, including a **modified** ADR alone | pass |

The two are keyed differently on purpose: the first reads the ADDED list, the second the
TOUCHED list. That asymmetry is #510's content — a PR correcting one line of an old ADR must
not be forced to re-index it (the previous behaviour blocked PR #507 for months) — and its
consequence is that **an amendment's `brain/HOME.md` marker has no gate behind it**
(`consolidation-protocol.md` §1c now says so; the net belongs in the amendment verb, #509).

**There is no step-2 heuristic.** This file described one — a scan of
`scripts/.*/providers/`, `brain/core/`, `config-migrations.mjs` and `package.json` emitting a
`::warning::` for changes without the `decision` label. Nothing scans those surfaces and
nothing emits that warning; the description was aspirational and read as shipped. An
architectural change carrying no ADR simply passes, in silence.

Both facts are pinned by test (`run-check.test.mjs`, #516), each proven a real detector by a
mutation that IMPLEMENTS the claim. If either is ever built, those tests fail and name this
section, so the doctrine cannot silently fall behind the code again.

---

## Enforce-Outputs / Guide-Judgment Boundary

L1 enforces **observable outputs** of each invariant. It does NOT enforce judgment.

| What L1 enforces | What L1 does NOT enforce |
|-----------------|--------------------------|
| A ticket link exists and has `status:approved` | Whether the ticket describes the right work |
| PR diff ≤ the tier's budget (excluding ignore-list) | Whether the PR is sliced coherently |
| `.memory/` changed (memory-gate proxy) | Capture quality or session completeness |
| An added ADR is indexed in `brain/HOME.md` | Whether the PR actually made a new decision |

This boundary is **not a gap to close** — it is the line between what a machine can verify
and what requires a human mind. *"Is this a decision?"* is judgment, and `decision-gate` does
not attempt it: it verifies a cascade (an added ADR is indexed) and says nothing about whether
an ADR was owed. Applying the `decision` label is a human act with no gate reading it.

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

---

## governance-metrics — `brain:metrics` Operator Reference

`brain:metrics` is a **read-only reporting verb**, introduced M9 (issue #324). It
re-derives governance-effectiveness signals from brain's own merged git history by
re-executing the SAME pure check functions `brain-audit` runs (shared via
`scripts/lib/merge-walk.mjs`) over the same first-parent merge walk — measurement
cannot drift from enforcement because it is the same code, not a re-derived copy.
It introduces **zero new gates, invariants, or CI-blocking behavior**: nothing it
reports can fail a merge, and it persists no state between runs (each report is
point-in-time only).

**Usage:**

```bash
npm run brain:metrics                                    # origin/main..HEAD, monthly, markdown
npm run brain:metrics -- <git-range>                     # e.g. HEAD~30..HEAD, origin/main..HEAD
npm run brain:metrics -- <git-range> --json               # flat JSON array, one object per period
npm run brain:metrics -- <git-range> --period=week         # ISO 8601 weekly buckets instead of monthly
npm run brain:metrics -- --help                            # usage text, exits 0
```

The range argument is **positional**, mirroring `brain:audit`'s own signature (never
a `--range=` flag) — `git log` already accepts range syntax like `HEAD~30..HEAD` or
`origin/main..HEAD` directly.

**What it measures, per period bucket:**

| Signal | What it is |
|---|---|
| Changes merged | Count of first-parent merges landing in the bucket |
| Median lead time | Median of: issue's **last** `status:approved` label-add at-or-before merge → merge date |
| `diff-size` / `issue-link` / `decision-gate` (raw / enforced) | `raw` = the check's real result, ignoring any exemption; `enforced` = `raw` minus `size:exception`-labeled and net-parity-exempted merges (the same exemption decisions `brain-audit` itself makes) |
| `size:exception` / `skip:memory-gate` usage | Raw count of merges whose PR carries the label, by period |
| `size:exception` usage by author | A separate "Exception usage by author" table: `size:exception` count per (period, label-adding actor) pair. The actor is read from the PR's own label-add events, not the linked issue's; unresolvable actors (VCS not configured, `labelEvents` fetch failure) are bucketed as `unknown` — never dropped |
| `phase-order` / `actor-check` / `brain-writes-reviewed` | Single pass/fail count column (DETECTION_JOBS never block merge, so there is no raw/enforced split). Supported on both providers — see the GitLab caveat below |
| Uncomputable | Merges where a per-merge git-plumbing read failed — counted visibly, never silently dropped or silently passed |

**Reported once, separately from the per-period table (repo-level, not a time series):**

- **`memory-gate` (memoryPresence) at HEAD** — whether a `session_summary` observation
  exists in `.memory/records/` right now. This check reads repo state ONCE per
  `brain-audit`/`brain-metrics` run, so its result is IDENTICAL for every merge in
  the window — a per-period column would be a constant masquerading as a series.
- **Memory-records coverage** — total records under `.memory/records/`, how many
  carry a populated `issue` field, and the resulting coverage %. Labeled **"adoption
  pending"** in every report: the `issue` field is not yet populated in practice
  across brain's own history, so this number is expected to read near 0% until
  memory-record tagging is adopted. Reports `Unavailable` (never a fabricated 0%
  passed off as measured) when `.memory/records/` is missing or unreadable.

**Caveats — read before trusting a number:**

- **Lead time is an issue-approval proxy, not PR-review-approval time.** It measures
  the gap between the referenced ISSUE's `status:approved` label and the merge —
  not how long the pull request itself sat in review. A short lead time can still
  reflect a long-considered issue approved well before the PR existed.
- **`memoryPresence`/`memory-gate` is repo-global, not per-merge.** See above — do
  not read it as "did this specific merge have memory captured".
- **`skip:memory-gate` is documented, not enforced.** The label is named in
  `AGENTS.md` and this file, but no code path anywhere checks for it or exempts
  anything on its presence — unlike `size:exception`, which `diff-size` genuinely
  honors. `brain:metrics` reports `skip:memory-gate` usage as a RAW label count only
  and **never subtracts it** from an enforced count — subtracting it would invent an
  exemption that does not exist in code.
- **`decision-gate` counts are label-conditional.** Only PRs carrying the `decision`
  label contribute to its raw/enforced counts, matching its mixed (Step 1 hard /
  Step 2 heuristic) enforcement described above.
- **GitLab detection-job reporting uses a `status` fallback.** GitLab's
  `prStatusRollup` always normalizes `conclusion: null` (its commit-status model has
  no field distinct from the terminal `status`) — reading `conclusion` alone would
  silently report 0/0 for all three detection jobs on every GitLab repo forever.
  `detectionConclusion()` falls back to `status` when `conclusion` is `null`, mapping
  GitLab's own vocabulary (`success` → pass, `failed` → fail; anything else —
  `pending`/`running`/`canceled`/`skipped`/etc. — stays uncounted). This is verified
  against a GitLab-shaped fixture in `brain-metrics.test.mjs`, but has not yet been
  confirmed end-to-end against a live GitLab repo (GitHub is the only provider
  exercised in brain's own real-history integration run, Phase 8).

**Failure policy differs from `brain-audit` on purpose.** `brain-audit` is
fail-closed and exits 2 on an uncomputable merge (never a silent PASS on an
enforcement gate). `brain:metrics` is a reporting tool: a per-merge git-plumbing
failure is caught and counted in the `Uncomputable` column instead, and the run
still exits 0. It exits non-zero ONLY when the requested range itself cannot be
resolved (an invalid `<git-range>`), with an actionable error suggesting valid
range syntax — never as a verdict about governance health.
