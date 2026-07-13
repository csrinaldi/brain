# Checkpoint Report — CP-A4a (Slice A4, issue #244)

> **Fixture-phase verdict tranche.** The real GitLab server-hook install + its live rejection demo are a
> **SCIT-bundle runbook step** (named precondition: Gitaly `custom_hooks/` host-filesystem admin), NOT this
> checkpoint's evidence. **Hand this report to the external reviewer.** Work pauses for the verdict.
> **This is the last fixture-phase slice of Track A.**

## What A4 delivered
The governance substrate ladder is now GitLab-aware **and honest**. GitLab rung-1 is modeled as three
distinct, independently-armable sub-gates (not collapsed), each carrying a `verifiable`/`mechanism` signal:

| Sub-gate | Source | Blocks | `verifiable` |
|----------|--------|--------|--------------|
| **`pipelineMustSucceed`** (load-bearing) | new `gitlab.mjs#projectMergeSettings` → `only_allow_merge_if_pipeline_succeeds` (`glab api projects/:id`) | MERGES | true (API-read) |
| **`protectedBranches`** | per-branch `protected_branches/:name` read (NOT `capabilities()` — it false-positives on an empty collection) | direct PUSHES | true (API-read) |
| **`preReceive`** | config-declared (`selfHostedPreReceive`) | (server-side) | **false** — not remotely detectable |

rung-1 `active = OR` of the armed gates; `selectRung()` untouched.

## Why three gates, not "presence-alone" (owner's CP-A2b evidence)
`pipelineMustSucceed` is **load-bearing**: it is what actually blocked the non-compliant MR-A on the mirror in
CP-A2b. The mirror's protected branches are **not configured** (`feature/v2.0.0` runs unprotected), so a
"protected-branch-presence-alone" signal would have falsely reported rung-1 **absent** in the very repo where
CP-A2b demonstrated enforcement working. Three distinct signals, reported distinctly.

## Honesty (the A4 through-line)
- `null` = uncomputable, **never a fabricated `false`** — enforced end-to-end. A source-level coercion
  (`Boolean(undefined)→false` when `glab` returns JSON that omits the field) was caught in review and fixed
  (`typeof v === 'boolean' ? v : null`), with a propagation proof asserting `rungs[1].gates.pipelineMustSucceed`
  reports `available:false` + remedy (not "not configured") on the uncomputable path.
- `preReceive` is **always** `verifiable:false`; `governance-status` renders "not remotely detectable; verify
  via install runbook" and **never** the word "verified". The old unconditional static "pre-receive available"
  line was removed.

## CP-A4a evidence (fixture-tested)
- **Bare-repo `pre-receive` rejection** — reuses the existing `pre-receive.test.mjs` harness (`setupFixture`/
  `commitAndPush` + an append variant); a non-compliant push to a local `git init --bare` with the hook
  installed is rejected. `sh`+`git` only, no GitLab. The hook binary itself is **unchanged**.
- **`npm test` 1219/1219** · `brain:repo:check` · `brain:nav` green. Non-test counted diff **267/400** (no
  `size:exception`). Fresh-context adversarial review: clean after the null-coercion fix.
- **Behavior-preservation:** the GitHub rung-1 path is byte-for-byte unchanged — existing `substrate.test.mjs`
  assertions are zero-modified (pure additions); the sub-gate refactor only appends `verifiable`/`mechanism`
  fields to the returned object.
- **Fixtures** `derived` + `_provenance` (scoped "from this sandbox"), never `recorded`; live-verifiable by
  curl against the mirror per the CP-A3a precedent once access exists.

## Honest disclosure — `brain:audit`
`brain:audit` exits 1 with **2 PRE-EXISTING** `adrPresence` FAILs on ancient merge commits `04ae992`/`8d60661`
(PRs #198/#199, merged 2026-07-03). Verified identical on the unmodified baseline (`git stash`) — **A4
introduced no new audit failure**. Track A's "brain:audit passes" acceptance is met *for this slice's history*;
the 2 pre-existing failures are unrelated and predate this branch by dozens of merges (track separately).

## Acceptance split
- **This slice (fixture-phase):** bare-repo rejection fixture-tested + honest `governance-status` + suite green
  + no new audit failure. ✅
- **Track A closing (post-SCIT install):** a non-compliant MR blocked at rung 1 on the real self-hosted
  GitLab — completes once the server hook is installed via the SCIT runbook.

## Deferred (the SCIT bundle — one key: the human's mirror endpoint)
Real GitLab server hook install (Gitaly `custom_hooks/`, host-fs admin), the live rejection demo, CP-A3b, and
CP-A2b SCIT smoke. All endpoint-dependent.

## Track A status
A0 ✅ · A1 ✅ · A2 ✅ (mirror, CP-A2b) · A3 ✅ (fixture, shapes live-verified) · **A4 ✅ (fixture)** — Track A
fixture phase COMPLETE. Remaining: the SCIT bundle, gated on the human restoring live-mirror access.
