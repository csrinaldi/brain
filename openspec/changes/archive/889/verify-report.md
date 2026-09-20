---
change: issue-889-lane-governance
status: PASS WITH WARNINGS
verified_at: 2026-09-10T17:00:00Z
head: ec1171417bec37a8f56239fbaa2ad53dcabdbe85
---

# Verification Report — #889 the lane is recognised: one predicate, three callers, and two contexts that report before they block

**Mode**: Strict TDD. Both slices landed: PR #907 (`Closes #905`, slice A — the gate surface,
merged `ffe038a0`, `size:exception`) and PR #908 (`Closes #889`, slice B — audit + index, merged
`ec117141`). Ruling `sdd/issue-889-lane-governance/ruling` (D1–D8, 2026-09-10) confirmed against
the current tree.

## Completeness

| Metric | Value |
|---|---|
| tasks.md checkbox items — Slice A (0.1–0.5, A1–A6, A.W1–A.W5) | all `[x]` |
| tasks.md checkbox items — Slice B (B1–B2, B.W1–B.W6) | all `[x]` |
| tasks.md checkbox items — D7 exit sequence (D7.1–D7.4) | `[ ]` — **intentional handover**, see below |
| Epic `openspec/changes/issue-864-memory-2-0/tasks.md:39` task 3.1c | `[x]` |

D7.1–D7.4 are documented in tasks.md's own D7 header as "the maintainer's sitting, not code, and
stay open past this change's archive on purpose." Per this task's Handover section below, D7.1 is
in fact already satisfied on live `main` (branch protection already carries both contexts), which
tasks.md's own note does not yet reflect — flagged as WARNING 3.

## Build & Tests Execution

**Focused** (`node --test` on the eleven named files — `lane.test.mjs`, `run-check.test.mjs`,
`lane-paths.test.mjs`, `lane-scrub.test.mjs`, `actor-check.test.mjs`, `governance-checks.test.mjs`,
`governance-tiers.test.mjs`, `contributor-scaffold.test.mjs`, `brain-audit.test.mjs`,
`index-lag.test.mjs`, `engine-blind-gates.test.mjs`): **436 pass / 0 fail**.

**CI-parity re-run**, isolated identity (`GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1
HOME=$(mktemp -d)`), same eleven files: **436 pass / 0 fail**.

**Full suite** (`npm test`): **5100 pass / 0 fail / 0 todo**, duration ~28.0s — matches
apply-progress's final reported count (tasks.md:319, :390) exactly.

**`check-refs.mjs`**: `✓ No prohibited references found.` / `✓ Artifact structure is valid.` (exit 0).

## Spec Compliance Matrix

| Requirement | Scenario | Test | Result |
|---|---|---|---|
| L1 — lane predicate narrow and structural | clean lane vs. foreign path; uncomputable diff refuses | `governance/checks/lane.test.mjs` | ✅ COMPLIANT |
| L1/D1a — `issue-link` recomputes the predicate | lane skips keyword; code-carrying memory branch refused; uncomputable ⇒ standard rules | `governance/run-check.test.mjs` | ✅ COMPLIANT |
| D2 — `actor-check` stays unmodified | pinned lane-shaped warn/exit 0; denied-approver fail/exit 1 | `vcs/actor-check.test.mjs` | ✅ COMPLIANT |
| D3 — `lane-paths` required, self-reporting | named refusal; explicit "not a lane" pass | `governance/lane-paths.test.mjs` | ✅ COMPLIANT |
| C1/D3 — `lane-scrub` non-waivable secret check | fail-closed without leaking; allow-patterns honoured; exit 0 non-lane | `governance/lane-scrub.test.mjs` | ✅ COMPLIANT |
| D3 — job registration atomic | drift guard red until ten jobs match across `GOVERNANCE_JOBS`/`GATE_MATRIX`/YAML | `vcs/governance-checks.test.mjs` + `governance-tiers.test.mjs` | ✅ COMPLIANT |
| D3/D7 — `brain:protect` arms both contexts | `checkContexts(tier)` derivation | `vcs/governance-checks.test.mjs` | ✅ COMPLIANT (unit); live-armed confirmed below |
| L6/D5 — template sentence describes the lane | emitted template matches committed byte-for-byte | `vcs/contributor-scaffold.test.mjs` | ✅ COMPLIANT |
| D4 — `brain:audit` reports `[LANE]` on both signals | squashed lane merge ⇒ `[LANE]`, `evaluateMerge` never called; marker-less records PR evaluated normally | `brain-audit.test.mjs` | ✅ COMPLIANT |
| L3 — `local-checks` warns on index lag, never fails | lag ⇒ warning, exit 0; sync ⇒ silent, exit 0; no file written | `memory/index-lag.test.mjs` | ✅ COMPLIANT |
| L3 — index-lag script declared in `VERIFICATION_SURFACE.scripts` | forge-wiring guard | `vcs/engine-blind-gates.test.mjs` | ✅ COMPLIANT |

**Compliance summary**: 11/11 spec-derived requirement rows fully COMPLIANT with passing covering
tests.

## Correctness (Static + Runtime Evidence)

| Decision | Status | Evidence |
|---|---|---|
| D1 — `issue-link` recomputes the predicate | ✅ | `run-check.mjs:68` imports `LANE_BRANCH_RE, classifyLane`; `:326` short-circuits on `LANE_BRANCH_RE.test(ctx.sourceBranch)` before touching git; `:342` calls `classifyLane({sourceBranch, changedFiles, addedFiles})`, only then decides to skip `issueLink()`. |
| D2 — `actor-check` unmodified in both merges | ✅ | `git show ffe038a0 --stat -- brain/scripts/vcs/actor-check.mjs` and `git show ec117141 --stat -- brain/scripts/vcs/actor-check.mjs` both empty — neither merge diff touches the file. (The literal ticket command `git log --stat ffe038a0 ec117141 -- <path>` is NOT empty because it walks all reachable history, not just these two merges; it surfaces one unrelated pre-existing commit, `6900ee6b` / PR #857 / #124, from 2026-09-05 — five days before this change started. That commit is outside this change's diff and does not touch this ruling.) Two regression pins confirmed green in `vcs/actor-check.test.mjs`. |
| D3 — two jobs registered atomically | ✅ | `GOVERNANCE_JOBS` (`governance-checks.mjs:41`), `GATE_MATRIX` rows at `governance-tiers.mjs:225,230`, `.github/workflows/governance.yml` jobs `lane-paths`/`lane-scrub` at lines 278/300, GitLab mirror `gitlab-governance.yml` lines 181/190. Neither workflow job's `env:` block declares `PR_NUMBER` (confirmed by source comment at `governance.yml:274-278` and grep — no `PR_NUMBER` match in the `lane-paths`/`lane-scrub` job bodies). |
| C1 — `lane-scrub` non-waivable, fail-closed, no leak | ✅ | `lane-scrub.mjs` never imports `governance-tiers` (grep clean, only a comment references it); output line 100 prints `pattern=... lineNumber=...`, never the matched text (`.line` explicitly dropped, comment at :97); two distinct `uncomputable` reasons (`:169` invalid config pattern, `:187` cannot read an added record) confirmed at lines 128/169/187; patterns compiled only when `recordPaths.length > 0` (`:141-146`, the batch-5/176e0f50 fix). |
| D4 — `[LANE]` row by paths AND body marker, before `evaluateMerge` | ✅ | `brain-audit.mjs:345-349` — `classifyLane(...).lanePaths && /^Memory lane: /m.test(issueLinkBody ?? '')`, `continue` immediately after printing, `evaluateMerge` at `:351` unreachable on that path. Production-shape test present (commit message confirms a squash-subject + PR-body-only marker case was added, mutant-killing). |
| L3 — index-lag non-mutating, counts only, exit 0 | ✅ | `index-lag.mjs` has zero `writeFileSync`/`writeFile` calls (grep clean); `main()` (`:92`) always calls `process.exit(main(...))`-style return, no throw path found; `governance-tiers.mjs:129` lists it in `VERIFICATION_SURFACE.scripts`; both `.github/workflows/governance.yml:133-134` and `gitlab-governance.yml` local-checks chain invoke it. |
| D5 — template sentence in scaffold + regenerated templates byte-equal | ✅ | `contributor-scaffold.mjs:276` and `.github/PULL_REQUEST_TEMPLATE.md:135` both read `it reaches \`main\` on the lane.` word-for-word; `vcs/contributor-scaffold.test.mjs` (in the 436-pass focused run) asserts byte-equality including the GitLab `Default.md` mirror per PR #907's commit log. |
| D6 — no hook/`day:start`/settings.json change in either merge | ✅ | `git show --stat ffe038a0 -- '.claude/settings.json' '.gemini/settings.json' brain/scripts/hooks/` and the same for `ec117141` both return empty; `git show <sha> --stat \| rg -i "day.start\|SessionEnd\|hooks/"` empty for both. |
| A3 — branch regex matches `plan.mjs`'s grammar | ✅ | `lane.mjs:15` `LANE_BRANCH_RE = /^memory\/[a-z0-9][a-z0-9-]*-\d{4}-\d{2}-\d{2}$/` vs. `plan.mjs:42` `REF_GRAMMAR_RE = /^refs\/heads\/memory\/[a-z0-9][a-z0-9-]*-\d{4}-\d{2}-\d{2}$/` — identical grammar past the `refs/heads/` prefix; the `lane.test.mjs` date-suffix table (task A1.1) asserts every ref `plan.mjs` can produce satisfies `LANE_BRANCH_RE`, and a literal `memory/host-2026-09-10-2` is asserted NOT a lane. |
| A6 — scrub on every PR | ✅ | `lane-scrub.mjs:107-108` docstring "Runs and reports on EVERY PR (never gated on a lane branch — A6)"; `main()` never reads `ctx.sourceBranch`; `lane-scrub.test.mjs` asserts a `feat/*` branch with a planted secret fails identically to a lane branch. |
| Epic task 3.1c ticked | ✅ | `openspec/changes/issue-864-memory-2-0/tasks.md:39` — `[x] 3.1c`. |

## PR & Review Evidence

- `gh pr view 907`: `MERGED`, `mergeCommit.oid: ffe038a0f0098e4919bd657499c4c9164d1e9343`, `mergedAt: 2026-09-10T14:59:40Z`, labels `type:feature`, `size:exception`, 3109/+ 18/- across 28 files (raw GitHub count; ~514 counted per tasks.md's own governance-ignoreList measurement).
- `gh pr view 908`: `MERGED`, `mergeCommit.oid: ec1171417bec37a8f56239fbaa2ad53dcabdbe85`, `mergedAt: 2026-09-10T16:24:38Z`, labels `type:feature`, `needs-decision` (the two non-blocking open questions — A3's suffix grammar, A6's every-PR scrub scope — flagged for the maintainer per tasks.md's Review Workload Forecast; disclosed, not silent).
- `gh api repos/csrinaldi/brain/pulls/907/reviews`: one `csrinaldibot` review, `verdict: APPROVE` at `head_sha: 698dc86f`, one `correction`-severity finding (cold-1, the misattributed `lane-scrub` read-error reason) — the finding that batch 5/PR #908's prep note (`60af7abc`) already fixed ahead of PR 2.
- `gh api repos/csrinaldi/brain/pulls/908/reviews`: two rounds — round 1 `verdict: REVISE` at `head_sha: f9e93ca1`, one `blocker` (a bad secret-config regex blocking every PR, not just record-adding ones — matches apply-progress batch 5 exactly, fixed at `176e0f50`); round 2 `verdict: APPROVE` at `head_sha: 176e0f50`, one `correction` (tasks.md's B.W1 test-count note said 5091/5091 where the measured/correct number is 5100/5100 — a documentation-only discrepancy inside tasks.md itself, not a code defect; apply-progress already carries the correct 5100 figure).
- `gh issue view 905` / `889`: both `state: CLOSED`, `closedAt: 2026-09-10T14:59:41Z` / `:42Z` — one second apart, both after PR #907 merged (`:40Z`) and #889 after PR #908 merged (`:16:24:38Z` — note #889 closed BEFORE #908 actually merged by GitHub's auto-close-on-#907-merge event; see WARNING 1 below, the same recurring pattern flagged in `archive/888/verify-report.md`).
- Both PR bodies state the D4/D6 deferrals: PR #907's body names `#906` as the deferred trigger sub-ticket and the PR-2-builds-on-this-branch relationship; PR #908's body states D4's audit scope and names `#906` again as the still-deferred trigger.
- `.memory/` scope: `git show --stat ffe038a0 -- .memory` → exactly `index.jsonl` + `2026-09-rec-c66b567ee099e321.jsonl` (2 insertions). `git show --stat ec117141 -- .memory` → exactly `index.jsonl` + `2026-09-rec-564da1c907fe7ba6.jsonl` (2 insertions). Both minimal, matching A.W2/B.W2.

## Handover — D7 exit sequence

tasks.md marks D7.1–D7.4 unticked on purpose, as maintainer/orchestrator acts outside any PR diff.
Live state, checked read-only:

- `gh api repos/csrinaldi/brain/branches/main/protection --jq '.required_status_checks.contexts'`
  → `["issue-link","diff-size","local-checks","decision-gate","actor-check","brain-writes-reviewed","lane-paths","lane-scrub"]`
  — **both `lane-paths` and `lane-scrub` are ALREADY armed on `main`.** This means D7.1
  (`npm run brain:protect` then `npm run brain:governance-status`) appears to already be
  satisfied in reality, even though tasks.md's own D7 header text implies it is still pending
  ("the first `brain:protect` was run from a stale `main` (six contexts); D7.1 is the re-run from
  `ffe038a0` or later"). This verify pass did not run `brain:protect`/`brain:governance-status`
  itself (forbidden by this task's scope) — the finding above comes only from the read-only
  `branches/main/protection` API, which is the authoritative signal `brain:governance-status`
  itself would report against. See WARNING 3.
- D7.2 (first real `memory:ship` lane PR merged by hand) — **not evaluated**; no evidence gathered
  in this read-only pass (no `memory:ship` run permitted). Remains the maintainer's act.
- D7.3 (same-day second `memory:ship --json` capturing the already-armed `mrAutoMerge` fixture for
  #886) — **not evaluated**, depends on D7.2 having happened first.
- D7.4 (`brain:audit` over the D7.2 merge window, confirming `[LANE]` not `[FAIL]`) — **not
  evaluated**; `brain:audit` against the real forge is out of scope for this verify pass.

**Commands for the maintainer to run D7.1–D7.4** (as documented in tasks.md, reproduced here for
convenience — not executed by this verify pass):
```
npm run brain:protect
npm run brain:governance-status
npm run memory:ship            # D7.2, merged by hand
npm run memory:ship -- --json  # D7.3, same day
npm run brain:audit             # D7.4, over the window containing D7.2's merge
```

## TDD Compliance

| Check | Result | Details |
|---|---|---|
| TDD evidence reported | ✅ | apply-progress (engram #3286/#3287) reports RED→GREEN per task across 5 batches, including two cold-review correction batches. |
| All tasks have tests | ✅ | Every implementation task (A1–A6, B1–B2) is preceded by its RED task in tasks.md. |
| RED confirmed | ✅ | apply-progress documents RED states for A1.1, A2.1, A4.1, A4.3, A5.1, A6.1, B1.1, B2.1, B2.2, and both cold-review reproduction cases (batch 5's zero-added-records regression). |
| GREEN confirmed | ✅ | 436/436 focused (both normal and identity-isolated runs), 5100/5100 full suite, this verify pass. |
| Triangulation adequate | ✅ | `lane.test.mjs`'s branch × path table, `lane-scrub.test.mjs`'s two distinct uncomputable reasons + zero-added-records early-return, `brain-audit.test.mjs`'s production-shape PR-body-marker case (added specifically to kill a mutant the commit-body-fallback test missed) — no single-case behaviors standing in for multi-scenario specs. |
| Safety net for modified files | ✅ | Full `npm test` green after each commit per apply-progress; reconfirmed 5100/5100 in this pass. |

**TDD Compliance**: 6/6 checks passed.

### Assertion Quality

No tautologies found in the current test files. Two tautologies that DID exist earlier in the
change's own history were caught and fixed before merge, not left in the shipped tree: PR #907's
cold review corrected `lane-scrub.test.mjs`'s original A6 test (which called `evaluateLaneScrub`
twice with byte-identical args) into a direct `main()`-level assertion; PR #908's review corrected
`brain-audit.test.mjs`'s happy-path test riding the commit-body fallback instead of the production
PR-body-marker shape. Both corrections are visible in the merge commit logs and confirmed present
in the current tree.

**Assertion quality**: ✅ All assertions verify real behavior.

### Quality Metrics

**Linter**: not run — no linter invocation configured for this verify pass; no lint failures reported by apply-progress.
**Type Checker**: not applicable — plain `.mjs`, no TS build step.

## Issues Found

**CRITICAL**: None.

**WARNING**:
1. **Issue #889 shows `closedAt` one second after #905, both timestamped to PR #907's merge
   (`2026-09-10T14:59:4{1,2}Z`), roughly 90 minutes before PR #908 (the PR whose body says
   `Closes #889`) actually merged (`2026-09-10T16:24:38Z`).** This is GitHub's own auto-close
   behavior for a cross-referenced issue mentioned by a merging PR, not a manual close — but it
   reproduces the identical pattern flagged as WARNING 1 in `archive/888/verify-report.md` for
   the immediately preceding change: an issue reads closed while a PR that has not yet merged is
   the one whose body actually says `Closes`. Functionally harmless (PR #908 did merge, correctly,
   ~90 minutes later), but this is now the THIRD consecutive lane-slice change (#887, #888, #889)
   where the same close-before-merge timing artifact appears. Recommend the process note from
   `archive/888`'s report be acted on rather than re-flagged a third time: either stop naming a
   sub-ticket issue number in a PR body that GitHub will cross-reference before the closing PR
   itself merges, or accept this as expected GitHub behavior and drop it from future verify
   passes as a non-issue.
2. **PR #908 round-1 cold review found one genuine blocker** (a bad `governance.memorySecretPatterns`
   regex would have fail-closed every PR on the repo, not just ones adding `.memory/records/`
   paths) that reached an OPEN PR before being caught and fixed. The fix (commit `176e0f50`) is
   confirmed correct and tested in the current tree, and the review process worked exactly as
   designed (blocker caught, fixed, re-reviewed, approved) — noted here only because it is evidence
   the reviewer's own audit trail should carry forward, not because anything remains broken.
3. **Live branch protection on `main` already shows both `lane-paths` and `lane-scrub` armed**,
   which appears to satisfy D7.1, but tasks.md's own D7 section header states the first
   `brain:protect` run was "from a stale `main` (six contexts)" and frames D7.1 as still a
   re-run the maintainer needs to perform. These two statements are in tension: either the
   maintainer already re-ran `brain:protect` after `ffe038a0` (in which case D7.1 should be
   ticked, not left open) and simply has not updated tasks.md/apply-progress to reflect it, or
   the current live-armed state was reached some other way this verify pass did not investigate
   (out of scope: no `brain:protect`/`brain:governance-status` run permitted here). Recommend
   `sdd-archive` ask the maintainer to confirm which is true and reconcile D7.1's checkbox with
   the live protection state before archiving, rather than carrying the ambiguity forward silently.

**SUGGESTION**:
1. PR #908 still carries the `needs-decision` label from its two disclosed, non-blocking open
   questions (A3's `(-\d+)?` suffix grammar reconciliation, A6's every-PR vs. lane-only scrub
   scope) — both explicitly deferred to the maintainer's call per `design.md`'s own framing and
   `tasks.md`'s Non-goals section. Since the PR has merged and the questions are informational,
   `sdd-archive` should confirm whether the label should be removed now or intentionally kept as
   a durable pointer to an open maintainer decision.
2. D7.2–D7.4 (the first real `memory:ship` lane PR, its same-day #886 fixture capture, and the
   `brain:audit` confirmation over that window) remain genuinely unverified by any automated or
   read-only means — they require an actual `memory:ship` execution, which is out of scope for
   both this verify pass and (per tasks.md) this change's own PRs. Carry these forward explicitly
   in the archive report as the change's real, still-open exit criteria — not resolved by this
   verify pass, and not blocking archive per the ratified handover framing in tasks.md's D7
   section.

## Verdict

**PASS WITH WARNINGS**

All 11 spec-derived requirement rows have passing covering tests (436/436 focused, reconfirmed
436/436 under CI-parity identity isolation); full suite 5100/5100 green, matching apply-progress's
own final count exactly; `check-refs.mjs` clean; every code-bearing tasks.md item `[x]`; D1–D6,
C1, A3, and A6 confirmed by source inspection against the current tree; `.memory/` scope minimal
in both merge commits (index + one record each); epic task 3.1c ticked; both PRs merged with a
cold-review APPROVE posted (PR #907 first-round, PR #908 second-round after one genuine blocker
was found and fixed). Zero CRITICAL — nothing blocks archive. Three WARNINGs: a recurring
issue-close-before-PR-merge timing artifact (now three changes running, informational), a
blocker-caught-and-fixed note in PR #908's review trail (already resolved, carried for the audit
record), and a reconciliation needed between tasks.md's D7.1 framing and the ALREADY-ARMED live
branch protection state on `main`. D7.1–D7.4 are correctly treated as an intentional handover per
this task's own framing — not gaps — but D7.1 specifically warrants a maintainer confirmation
before archive closes the loop on it.
