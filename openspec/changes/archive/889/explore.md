---
status: tasked
issue: 889
---

# Explore — #889 the lane is recognised

Parent: #864 task 3.1c (ADR-0034 L1, L3, C1). Depends on #888 (landed, `2ec28558`) and #887
(landed). Owns: lane recognition in `issue-link`/`actor-check`, `lane-paths` (path restriction,
required context), `lane-scrub` (C1, required context), the `brain:audit` `[LANE]` row, and
`local-checks`' index-lag warning (L3). **Not** owned here (confirmed, measured): a `type:*`
label exemption — no gate reads one (`openspec/changes/issue-888-lane-ship/design.md:142-149`).

## Current state, measured

**Branch protection on `main` today** (`gh api repos/csrinaldi/brain/branches/main/protection`):
6 required contexts — `issue-link`, `diff-size`, `local-checks`, `decision-gate`, `actor-check`,
`brain-writes-reviewed`. Neither `lane-paths` nor `lane-scrub` exists yet. `governance.tier: lite`
(`brain.config.json`).

**The governance surface has exactly four `run-check.mjs` checks**
(`SUBCOMMAND_PORT_REACH`, `run-check.mjs:454-459`): `memory-gate`, `decision-gate`, `issue-link`,
`diff-size`. `actor-check` and `brain-writes-reviewed` are separate CLI entrypoints
(`vcs/actor-check.mjs`, `vcs/brain-writes-reviewed.mjs`), each with their own `main()`.

**`GOVERNANCE_JOBS`** (`vcs/governance-checks.mjs:41-50`) is the single source of truth for job
names — a drift-guard test (`vcs/governance-checks.test.mjs`) parses `.github/workflows/
governance.yml` and asserts the job `name:` fields match this array exactly. Adding `lane-paths`/
`lane-scrub` means touching **three files together**: the array, a `GATE_MATRIX` row
(`vcs/governance-tiers.mjs:150-219`), and the workflow YAML — the comment at the top of
`governance-checks.mjs` says as much ("add a GATE_MATRIX row AND add the job to governance.yml in
the same commit, or the drift-guard test turns red").

**`diff-size` needs no lane change.** `.memory/**` is already in `governance.ignoreList`
(`brain.config.json`), so a lane PR of any size passes it unlabelled — confirmed by #888's design
(`design.md:142-149`), not re-derived here.

## The two required contexts

### `lane-paths`

Not yet a job. Must compute the diff **three-dot** — `git diff --name-only <base>...<head>` —
never two-dot (#887's D2 makes a same-day second `collect` append onto the same lane ref; a
two-dot diff against the day's first-run tree reports every record `main` gained since as a
**deletion**, failing the lane by construction — the exact risk #887's design.md flagged and #889
inherits, sourced in the issue-comment).

Two existing helpers already use three-dot notation, just spelled with SHAs, not a ref name:
`defaultDiffNameOnly`/`defaultDiffNameOnlyAdded` (`run-check.mjs:99-122`) run
`git diff --diff-filter=A --name-only ${base}...${head}` where `base`/`head` come from
`ctx.baseSha`/`ctx.headSha` (env `BASE_SHA`/`HEAD_SHA`, i.e. `github.event.pull_request.base.sha`).
For a PR targeting `main`, `base.sha` **is** `origin/main`'s tip at trigger time — so reusing this
exact plumbing (not a literal `origin/main` ref) satisfies the #887 comment's three-dot
requirement without inventing a second diff mechanism. Needs `fetch-depth: 0` on checkout (today
only `decision-gate`, `diff-size`, `phase-order`, `brain-writes-reviewed` set it —
`issue-link`/`actor-check`/`memory-gate`/`local-checks` do not).

**Predicate**: every path in `diffNameOnly()` (the full changed set, not just added) must (a) lie
under `.memory/records/` and (b) appear in `diffNameOnlyAdded()` too — i.e. no path is a
modification, deletion, or outside the prefix. `index.jsonl` is a name-only check away from
tripping this (it is *not* under `.memory/records/`), so it fails the lane by the path check alone
— consistent with L3's default (records-only) without a special case.

### `lane-scrub` (C1, non-waivable)

Reuses `scrubRecordsFile` (`memory/lib/secret-scrub.mjs:137-139`) → `scanTextForSecrets` (`:79-92`)
over every path in the lane's added-file set. **Measured, and worth flagging**: `scanTextForSecrets`
returns `{pattern, lineNumber, line}` — it does **not** omit `line`. The ticket's "pattern +
lineNumber only, never the line" is a printing discipline the new `lane-scrub` wrapper must
enforce itself (destructure and drop `.line` before `console.log`); it is not already true of the
function it wraps. No existing CI consumer of `scrubRecordsFile`/`scanTextForSecrets` exists today
(`engram.mjs` is the only caller, for chunk-scrub, non-CI) — this is new wrapper code, not a rewire.

### One job, two steps vs two jobs

`governance.yml`'s own header states the constraint: "Each job name becomes the GitHub check
context" (`:3-6`). Two required contexts need two check-run identities; a single job with two
steps produces **one** job name and therefore one context, which cannot satisfy ADR-0034's L1 +
C1 (two named required checks). Reporting a second check run from inside one job would need the
GitHub Checks API directly — a mechanism nothing in this repo uses today.

| option | cost |
|---|---|
| **two jobs, each own checkout + diff** (matches every existing pattern) | diffs the same base/head twice (cheap — one `git diff`); no new mechanism |
| one job, two steps, second context via Checks API | new API surface, no precedent, breaks the "job name = context" invariant the workflow file documents |
| one job computing the added-file list once, exported via `needs`/outputs, consumed by two dependent jobs | avoids the double diff; adds a fan-out dependency edge governance.yml has never had (every job today is independent) |

**Leaning**: two independent jobs (cheapest diff to duplicate, zero new mechanism), unless the
design phase finds the duplicate `git diff --name-only` non-trivial in cost — it is not, on this
repo's scale (same argument #888's D2 makes about `mrList`'s per-run scan).

## The gate branch: issue-link and actor-check

**`issue-link`** (`run-check.mjs:313-381`, `runIssueLinkCheck`): the lane branch goes after the
`typeof ctx.body !== 'string'` guard (`:320-326`) and before `issueLink(ctx.body)` (`:327`) —
exactly where the ticket names it. The pure `issueLink()` evaluator
(`checks/issue-link.mjs:22`) stays unchanged (ADR-0016).

**The head branch is already threaded into `ctx` — no new plumbing needed.** `ci-context.mjs`
already normalizes `ctx.sourceBranch` on both providers: `env.GITHUB_HEAD_REF` (GitHub, an
*ambient* Actions env var for `pull_request` events — no workflow YAML change required to obtain
it) and `env.CI_MERGE_REQUEST_SOURCE_BRANCH_NAME` (GitLab) (`vcs/ci-context.mjs:94`, `:183`). The
lane's `^memory/[a-z0-9][a-z0-9-]*-\d{4}-\d{2}-\d{2}(-\d+)?$` regex (ADR-0034 L1) runs against
`ctx.sourceBranch`.

**The exemption is exactly as wide as `lane-paths`** (issue body, ADR-0034 L1's own risk): does
`issue-link`'s wrapper recompute the path predicate itself (a shared `laneContext()` helper, the
issue's own suggestion) or trust the `sourceBranch` regex alone and rely on `lane-paths` being a
REQUIRED context as the actual safety net? ADR-0034's own text reads as the latter ("3.1c must
land the path check as a required context in the same PR that teaches the gates the lane branch —
never before"), not that `issue-link` re-verifies paths itself. Design-phase call.

**`actor-check`** (`vcs/actor-check.mjs`): **no `headBranch`/diff-path field is threaded into
`gatherActorCheckInputs`** today (`:1229-1264` — its args are `author, prBody, baseBranch, repo,
provider, prNumber, cwd, tier, deps`; no head ref, no changed-files). Adding lane recognition here
needs either (a) `gatherActorCheckInputs` to accept `sourceBranch` from `ctx` the same way
`run-check.mjs` does, or (b) a shared `laneContext({ ctx, ... })` helper importable by both files
(the issue's own suggestion) so the regex + path logic exists once.

**Open, measured discrepancy worth flagging to the design phase**: `evaluateActor`
(`:671-855`) already returns `{level: 'warn', ...}` when `labeledEvents.length === 0` (`:722-729`)
— i.e., a PR with no human "approved"-label event (exactly what a `lite`-tier auto-merged lane
looks like) **already warns rather than fails**, without any lane-specific code. `actor-check` is
`required` at every tier (`GATE_MATRIX['actor-check']`, `governance-tiers.mjs:201-208`), but
`level: 'warn'` and `level: 'fail'` may map to different exit codes (`main()`'s
`mapDetectionToWarning`/`resultToExit` split, not read to exhaustion in this pass). **The design
phase must confirm whether actor-check needs a lane branch at all**, or whether the deny-list
check the ticket asks for ("the deny list still applies") is better placed as an *early* branch —
above the `labeledEvents.length === 0` warn — that special-cases a lane head to check `author`
(or the pushing identity) against `denyActors` and returns `fail` on a match, `warn` (unchanged)
otherwise. This needs `author` — already threaded — and possibly nothing else.

## `brain:audit`'s `[LANE]` row

`evaluateMerge` (`lib/merge-walk.mjs:440`) is the shared pure classifier `brain-audit.mjs` calls
per first-parent merge (`brain-audit.mjs:326`). It already receives `changedFiles`/`addedFiles`
(threaded from `readMergeDiff`, `:289`) but calls the **pure** `issueLink(issueLinkBody)`
(`:460`) unconditionally — no lane awareness exists here at all, and ADR-0016 keeps this evaluator
context-unaware by design, so a lane branch cannot go inside `evaluateMerge` itself. It must go in
`brain-audit.mjs`'s walk loop (`:263-344`), **before** calling `evaluateMerge`, using the same
`changedFiles`/`addedFiles` already computed at `:289` — classify lane, emit `[LANE] <sha7>
<subject>` and `continue`, skipping the four-check evaluation entirely (mirrors the existing
`[SKIP]` baseline/resolved-by-revert short-circuits at `:266-282`). **Gap**: the walk has no head
branch name for a squashed merge (`readMergeDiff` reads a diff, not a ref name) — `fetchPrMeta`
(`:300`) fetches PR metadata via the VCS port and may expose `headRefName`/`headBranch`
(`prView`'s normalized shape carries it elsewhere, e.g. `approve/cli.mjs:264`); confirming whether
`fetchPrMeta`'s return already carries it, or needs a one-field addition, is design-phase work.

## `local-checks` and the index-lag warning (L3)

`local-checks` job (`governance.yml:109-123`) runs `repo:check` → `check-refs.mjs`, whose "sole
warn channel is at `:50`" per ADR-0034's own citation (not independently re-confirmed at that
exact line in this pass — `check-refs.mjs`'s structure was read, its warn call site was not
diffed). The warning: "committed `index.jsonl` ≠ `rebuild(records)`" — needs a
`resolveIndex`/`reindex` comparison (referenced by name in ADR-0034 L3, `post-merge:67 →
resolve-index`) run inside `check-refs.mjs` or a sibling script it calls, never blocking.

## Deferred to #889 by #888's D4 — status check

`SessionEnd` hook and `day:start`'s sweep (the two automatic `memory:ship` triggers) are **not**
touched by any code read in this pass: no `SessionEnd` in `compileSettingsHooksJson()`
(`harness/backends/settings-hooks.mjs:42`), no `memory:ship`/`memory.lane` reference in
`day-start.mjs`. #888's stated reason still holds verbatim: wiring them before the gates recognise
a lane opens one un-mergeable PR per host per day. **This ticket's scope question**: does #889
wire the triggers now that the gates land in the same PR (removing #888's blocking reason), or
does that stay a follow-up once the first real lane PR is proven? The issue's own "for_889" note
implies #889 is exit-criteria-bounded by the first real lane PR + capturing `gh pr merge --auto`'s
stderr — not explicitly by shipping the triggers — so treat trigger-wiring as **optional scope**,
flagged for the proposal to decide, possibly gated behind `memory.lane.enabled` per the issue's own
suggestion.

## Testing — STRICT TDD, files named

| surface | test file (existing pattern) |
|---|---|
| `runIssueLinkCheck` lane branch | `brain/scripts/governance/run-check.test.mjs` (extend) |
| `evaluateActor`/`gatherActorCheckInputs` lane branch | `brain/scripts/vcs/actor-check.test.mjs` (extend) |
| `lane-paths` predicate (new pure fn, likely `checks/lane-paths.mjs`) | new `checks/lane-paths.test.mjs` |
| `lane-scrub` wrapper | new, mirrors `run-check.test.mjs`'s injected-ctx shape |
| `GOVERNANCE_JOBS`/`GATE_MATRIX` drift | `vcs/governance-checks.test.mjs` (extend — will fail red until both jobs are added) |
| `brain-audit`'s `[LANE]` row | existing `brain-audit.test.mjs` (not opened this pass — confirm file name before apply) |
| `check-refs.mjs` index-lag warning | existing `check-refs.test.mjs` (not opened this pass) |

No `governance.yml` YAML-parse test beyond the drift-guard (`governance-checks.test.mjs`) was
found in this pass — it is the only structural check on the workflow file's job names.

## Split candidates (Wave 3's largest slice)

`brain.config.json`'s `governance.ignoreList` excludes `**/*.test.mjs` and `openspec/changes/**`
from the counted diff — estimates below are counted lines only.

| split | contents | rough counted est. |
|---|---|---|
| **A — gates + two new jobs** | `run-check.mjs` lane branch (~25), `actor-check.mjs` lane branch (~30-50, pending the open question above), new `checks/lane-paths.mjs` (~40), new `lane-scrub` wrapper (~50), `governance.yml` two jobs (~40), `governance-checks.mjs` + `governance-tiers.mjs` GATE_MATRIX rows (~20) | ~205-225 |
| **B — audit + local-checks** | `brain-audit.mjs`/`merge-walk.mjs` `[LANE]` row (~30-50, pending the headBranch-source question), `check-refs.mjs` index-lag warning (~20-30) | ~50-80 |
| **C — template wording** | `.github/PULL_REQUEST_TEMPLATE.md` memory line | ~1-3 |
| **D — deferred triggers** (optional scope) | `SessionEnd` hook emission + `day:start` sweep, `settings-hooks.mjs`, `.gemini/settings.json` parity | unestimated — out unless the proposal pulls it in |

A + B alone is likely inside the 400-line budget as one PR (~255-305 counted); C is small enough
to ride along. D, if pulled in, is its own PR regardless (touches the drift-tested
`compileSettingsHooksJson()` output, per #888's own reasoning for deferring it).

## Open questions for the proposal

1. Does `issue-link`'s lane branch re-verify the path predicate itself, or trust `sourceBranch` +
   rely on `lane-paths` being a required context as the actual safety net (ADR-0034's own
   framing)? Affects whether a shared `laneContext()` helper is warranted (issue's own suggestion)
   or two independent regex+trust checks suffice.
2. Does `actor-check` need a new lane branch at all, given `evaluateActor` already warns (not
   fails) on zero labeled events — or does it need an *early* deny-list check that `fail`s a
   denied author on a lane head, ahead of that existing warn path?
3. Two jobs vs. a fan-out dependency for `lane-paths`/`lane-scrub` (leaning: two independent jobs
   — see table above).
4. Does `fetchPrMeta` already expose a head-branch field brain-audit's `[LANE]` row can use, or
   does the port need a one-field addition?
5. Are the `SessionEnd` hook + `day:start` sweep (D4's deferral) in scope for #889, or a further
   follow-up once the first real lane PR is proven? Leaning: out of #889's committed scope, optional
   if time permits, based on the issue's own exit-criteria framing.
6. Confirm the exact warn-channel line and test file names for `check-refs.mjs` and
   `brain-audit.mjs`/`merge-walk.mjs` before `sdd-tasks` — not opened to exhaustion in this pass.

## Exit criteria (handed over, not re-litigated here)

The first **real** lane PR (via `memory:ship`; needs `allow_auto_merge` — maintainer act — and
#805 before auto-merge is *enabled*, so it may be merged by hand) and capturing `gh pr merge
--auto`'s stderr on an already-armed PR (#888 D2's unmeasured assumption). Both stated in #888's
design as #889's to prove.
