---
status: tasked
issue: 889
epic: 864
---

# Proposal — #889 the lane is recognised: two required contexts, and an exemption no wider than its evidence

Parent: #864 (memory 2.0), task 3.1c — Wave 3. Owns the #862 ruling's **L1** (lane recognition),
**L3** (index off the lane), and **C1** (secret scrub as a required check)
(`openspec/changes/archive/862/spec.md:126-137`). Enabled by #887 (`collect`, landed) and #888
(`ship`, landed `2ec28558`). Gates #890's retirements.

## What is wrong today

`npm run memory:ship` opens a real lane PR — and **every gate refuses it**. `runIssueLinkCheck`
(`run-check.mjs:313-381`) calls the pure `issueLink(ctx.body)` unconditionally against a body that
carries no closing keyword by design (L1: a lane references no issue). Neither `lane-paths` nor
`lane-scrub` exists; branch protection on `main` arms six contexts and none of them is the path
check that makes the exemption safe. `brain:audit` walks a squashed lane merge into a false
`issueLink` [FAIL]. So the verb #888 shipped is invocable and un-mergeable, and the measured
latency ADR-0034 exists to fix (p50 21.6 h / p90 399.7 h learn→main) is unchanged.

**Measured, and it changes the shape of this slice**: `actor-check` **already passes a lane PR**.
`gatherActorCheckInputs` computes `extractIssueNumber(prBody, baseBranch)` (`actor-check.mjs:1247`);
a lane body has no issue number, so it returns early with `labeledEvents: []` (`:1253-1255`),
`evaluateActor` returns `{level:'warn'}` (`:722-729`), and `main()` maps anything not `fail` to
exit 0 (`:1359`). Nothing in this slice needs to teach `actor-check` a lane. See D2.

## Decisions

### D1 — Where the exemption gets its evidence

| option | what it means | cost |
|---|---|---|
| **(a) `issue-link`'s wrapper recomputes the path predicate itself** — head `^memory/…` regex on `ctx.sourceBranch` **AND** the added-only-under-`.memory/records/` predicate over `baseSha...headSha`, before `issueLink(ctx.body)` | the exemption is granted only on evidence the gate itself read. Safe **before** branch protection is flipped | the `issue-link` job gains `fetch-depth: 0` + `BASE_SHA`/`HEAD_SHA` (it has neither today — `governance.yml:44-63`); the diff can now be uncomputable inside `issue-link` |
| (b) trust `ctx.sourceBranch`'s regex; rely on `lane-paths` being REQUIRED as the safety net | ADR-0034's literal framing ("the exemption is exactly as wide as the path check makes it safe") | that safety is a **repository setting**, not code. Branch protection is a post-merge maintainer act, so between this PR merging and `brain:protect` running, a branch named `memory/x-2026-09-10` carrying **code** bypasses `issue-link` by name alone — the exact bypass ADR-0034 L1's own Risk paragraph names |

**Recommendation: (a).** Recognition is a conjunction in the spec
(`archive/862/spec.md:16-18`); making it a conjunction in the code costs one shared pure helper and
five YAML lines, and removes a window in which the repo is protected only by a setting nobody has
flipped yet. `lane-paths` still lands as a required context — it is the **loud** half (it names the
offending path and blocks the merge); `issue-link`'s recompute is the **quiet** half (it declines
the exemption). They are not redundant: one blocks, one refuses to excuse.

**The uncomputable rule, stated once**: if `sourceBranch` is absent (`GITHUB_HEAD_REF` is ambient on
`pull_request` only) or the diff cannot be computed, the PR is **not a lane** and standard
`issue-link` rules apply. An unverifiable lane is not a lane. Failing *closed on the exemption* is
the safe direction; the PR is then refused with the ordinary, well-understood message.

**Shared surface**: one new pure module `governance/checks/lane.mjs` exporting `LANE_BRANCH_RE` and
`classifyLane({ sourceBranch, changedFiles, addedFiles })` → `{ lane: boolean, reason: string }`.
Imported by `run-check.mjs`, `lane-paths`, and `brain-audit.mjs` so the rule exists **once**
(ADR-0016: the evaluator stays context-unaware; the IO lives in each wrapper).

### D2 — `actor-check`: no code, and a test that says why

| option | what it means | cost |
|---|---|---|
| **(a) no change; add regression tests pinning today's behaviour** | a lane PR yields `warn` → exit 0 (measured above). The deny-set keeps guarding the surface it was built for — the **approver** identity on a labeled PR | the verdict on a lane reads "no labeled event found", which is true but not lane-explanatory |
| (b) an early lane branch that checks the PR **author** against `denyActors` and `fail`s on a match | "the deny list still applies" made literal | **it breaks the lane it is protecting**: `denyActors` is `governance.reviewActors` = `["csrinaldibot"]` (`brain.config.json:30-32`), and an unattended lane PR posted with `BRAIN_MEMORY_TOKEN` is authored by exactly that class of identity. Option (b) fails every unattended lane by construction |

**Recommendation: (a).** The deny-set is an **approval-authority** set, not an authorship set;
reusing it as one inverts its meaning. The lane's safety is structural, not identity-based — that is
ADR-0034's whole design. Two tests pin it: a lane-shaped PR (no issue number in the body) yields
`warn` and exit 0; a **labeled** PR whose approver is in `denyActors` still yields `fail` and exit 1.
The second is the one that proves a denied identity is still refused, and it must stay green.

### D3 — Two contexts, two jobs, and what they do on a non-lane PR

Two required contexts need two check-run identities. `governance.yml:3-6` states the invariant
("Each job name becomes the GitHub check context"); a single job with two steps produces one
context, and reporting a second via the Checks API is a mechanism this repo has never used.
**Two independent jobs.** The duplicate `git diff --name-only` is one cheap command.

| job | what it does | tier policy |
|---|---|---|
| `lane-paths` | `classifyLane` over `baseSha...headSha` (three-dot, via the existing `defaultDiffNameOnly`/`defaultDiffNameOnlyAdded` plumbing, `run-check.mjs:108-138`). Refuses M/D/R, `index.jsonl` (not under `.memory/records/`, so no special case), anything outside the prefix — **naming the path** | `required` at every tier |
| `lane-scrub` | `scrubRecordsFile` over every added record, patterns from `resolveSecretConfig(config)`. Prints **`pattern` + `lineNumber` only** — the wrapper destructures and drops `.line`, which `scanTextForSecrets` **does** return (`secret-scrub.mjs:87`). Fail-closed, no flag | `required` at every tier (C1, non-waivable) |

**On a non-lane PR both jobs RUN and PASS explicitly**, printing "not a lane — nothing to check".
Not skipped: a required context must report on every PR, and "skipped counts as success" is a
platform behaviour this repo should not have to depend on. Both jobs are offline (checkout + `git
diff` + file reads, no API call), so they add no new flake surface to every PR.

**Registration is a three-file atomic edit** (`governance-checks.mjs:27-28` says so itself):
`GOVERNANCE_JOBS` (`:41-50`), two `GATE_MATRIX` rows (`governance-tiers.mjs:150-219`), and the
workflow YAML — in one commit, or the drift-guard test turns red.

**The branch-protection change is the MAINTAINER's act, and it is not a raw `gh api` call.**
`checkContexts(tier)` derives the required-context list from the same `GATE_MATRIX`
(`governance-checks.mjs:123`), and `brain-protect.mjs:154-168` applies it. So the handover is:

```
npm run brain:protect      # admin token; arms checkContexts('lite') = the 6 of today + lane-paths + lane-scrub
npm run brain:governance-status   # verifies the armed set matches
```

**Until that runs**, both jobs report on every PR but block nothing — and D1(a) is what keeps the
repo safe in that window. **No real `memory:ship` run before `brain:governance-status` shows both
contexts armed.**

### D4 — `brain:audit`'s `[LANE]` row: paths **and** the body marker

**Measured**: `fetchPrMeta` returns `{prNum, prLabels, prBody, prAuthor, prReviews, prMetaError}`
(`merge-walk.mjs:296-298`) — **no head-branch field**. `prView` carries one elsewhere, but exposing
it here is a port-shaped change this slice does not need, because the walk already holds the better
half of the predicate: `changedFiles`/`addedFiles`, computed at `brain-audit.mjs:289`.

**Recommendation**: classify in `brain-audit.mjs`'s walk loop, **before** `evaluateMerge` (ADR-0016
keeps `evaluateMerge` context-unaware, so the branch cannot go inside it), on **two** signals —
every changed path is an addition under `.memory/records/` **AND** the commit body matches
`/^Memory lane: /m` (the grammar #888 already writes, `ship.mjs`). Emit `[LANE] <sha7> <subject>`
and `continue`, mirroring the existing `[SKIP]` short-circuits at `:266-282`. Paths alone would also
swallow a hand-made records-only feature PR that genuinely lacked an issue link; the marker line
closes that.

### D5 — The template sentence (L6)

The wording is already ratified verbatim (`archive/862/spec.md:95-96`, ADR-0034 `:158-160`). The
line to replace is `contributor-scaffold.mjs:274` — **not** `.github/PULL_REQUEST_TEMPLATE.md`,
which is emitted and whose hand-edit is refused by `contributor-scaffold.test.mjs`:

> - [ ] Session memory captured as a record (`npm run memory:save -- --issue N`); it reaches
>   `main` on the lane. Where the pipeline hands `memory-gate` this description, an unscoped record
>   does NOT satisfy it. `skip:memory-gate` is named in the docs but no gate reads it — applying it
>   exempts nothing.

**Ownership departure, stated rather than smuggled**: ADR-0034 assigns the wording to **3.1d**
(#890). #890 is gated on #874 *and* on the lane being proven, an unbounded wait during which the
template would tell contributors to use `memory:share` for a path that no longer describes how a
record reaches `main`. **Recommendation: land the one sentence here**; #890 keeps the *retirement*
of the five feature-PR surfaces (L7), which is a different act. Flagged in the question round.

### D6 — Triggers (D4's deferral from #888): a sub-ticket, not this slice

| option | cost |
|---|---|
| **(a) file a sub-ticket: `SessionEnd` hook + `day:start` sweep behind `memory.lane.enabled` (default `false`), landing AFTER the first real lane PR merges** | L5's automatic callers arrive one slice later than the gates |
| (b) include here | `compileSettingsHooksJson()` (`harness/backends/settings-hooks.mjs:42`) is shared by both platform backends and its output is asserted byte-equal against `.gemini/settings.json` (`antigravity.drift.test.mjs:111`). Adding a Claude-Code hook name emits it into Gemini's settings too — an unmeasured **two-platform** claim, made in the same PR as the gates. Blast radius: every session end, on every host, both platforms |

**Recommendation: (a).** #888 deferred these because a lane PR was un-mergeable; that reason
dissolves here, but a **second** one does not: an automatic trigger's blast radius is every session
on every host, and the honest sequence is to prove the manual verb end-to-end first (the exit
criteria below) and then automate a path already known to merge. A flag defaulted `false` is not a
knob with one setting — it is the switch the sub-ticket flips once, with evidence.

### D7 — Exit criteria and sequencing

1. Slice A merges. Maintainer runs `npm run brain:protect`; `npm run brain:governance-status`
   reports `lane-paths` and `lane-scrub` armed.
2. **The first REAL lane PR**, opened from this machine by `npm run memory:ship`. Merged **by hand**
   (`allow_auto_merge` is `false` on the repo today — a second maintainer act; auto-merge is only
   *enabled* by #805). Recorded: the PR number, the eight green contexts, the merge SHA.
3. **The `gh pr merge --auto` capture** (#888's unmeasured assumption): run `npm run memory:ship`
   **a second time the same day** while the PR is already armed. Step 5 re-calls `mrAutoMerge`
   unconditionally, so the already-armed response lands in `autoMerge.reason` in the `--json`
   output with zero new tooling and no state change. Store it verbatim as a fixture with
   `recorded: true` for #886's classifier, and quote it in the verify report.
4. `npm run brain:audit` over the window containing the merged lane prints `[LANE]`, not `[FAIL]`.

### D8 — Scope, split, delivery

`brain.config.json:18-29` excludes `**/*.test.mjs` and `openspec/changes/**` from the counted diff.

| slice | contents | counted |
|---|---|---|
| **A** | `checks/lane.mjs` (~45); `run-check.mjs` lane branch + diff wiring (~30); `governance/lane-paths.mjs` (~45); `governance/lane-scrub.mjs` (~55); `governance.yml` two jobs + `issue-link` fetch-depth/env (~48); `GOVERNANCE_JOBS` + two `GATE_MATRIX` rows (~20) | **~243** |
| **C** | `contributor-scaffold.mjs:274` + the regenerated template (~8) | **~8** |
| **B** | `brain-audit.mjs` `[LANE]` row (~30); new `memory/index-lag.mjs` + a `local-checks` step (~49) | **~79** |
| D | triggers — **sub-ticket** (D6) | — |

**Recommendation: two PRs, `stacked-to-main`.**
**PR 1 = A + C** (~251 counted, the gate surface and the sentence that describes it) — this is the
PR that must land before branch protection is flipped.
**PR 2 = B** (~79, read-only reporting: the audit row and a warning) — autonomous, revertible,
lands any time after.
Per the house pattern, PR 1 closes a new **sub-ticket**; PR 2 closes **#889** and carries the exit
evidence. `delivery_strategy: ask-on-risk` — the call belongs to `sdd-tasks`' forecast; this is its
input. Reviewer-visible with tests: ~700 (PR 1), ~250 (PR 2).

### L3 — where the index-lag warning lives

**Measured**: `check-refs.mjs` exports **nothing** — it is module-level side-effecting code, and its
`console.warn` at `:50` is a rules-file load failure, not a general warn channel. Adding the L3
warning there is untestable under STRICT TDD.

**Recommendation**: a new `brain/scripts/memory/index-lag.mjs` with a **pure**
`compareIndexToRecords({ indexLines, records })` → `{ lagged, indexed, rebuilt }` and a thin `main()`
that prints a warning and **always exits 0**, invoked as one more step in the `local-checks` job.
That satisfies L3 verbatim ("`local-checks` MUST warn, without blocking") without forcing exports
into a script that has none. **Constraint for `sdd-design`**: the comparison must be
**non-mutating** — the existing `rebuildIndex` *writes* `index.jsonl`, and a check that dirties a
committed file inside CI is a defect, not a warning.

## Capabilities (contract with `sdd-spec`)

**New: none. Modified: none.** `openspec/specs/**` is empty in this repo by convention; the
normative surface is ADR-0034 plus `archive/862/spec.md`, neither of which changes here.

## Non-goals

No change to `collect` / `plan` / `ship` / `mrCreate` / `mrList` / `mrAutoMerge` / `vcsToken()` or
the record format. **No `memory-gate` logic change** (L6: it reads the PR *tree*, not the diff, and
a rebased feature PR passes unchanged). No #805 supersedes machinery. No #890 retirements (the five
feature-PR surfaces stay). No new VCS port verb — in particular, no head-branch field on
`fetchPrMeta` (D4). No `--force` anywhere. No branch-protection API call from CI: arming contexts is
a human act with an admin token. No `type:*` label exemption — no gate reads one.

## STRICT TDD — tests first, in this order

| # | file | what it pins |
|---|---|---|
| 1 | `governance/checks/lane.test.mjs` (new) | `classifyLane`: branch+paths ⇒ lane; branch only ⇒ not; paths only ⇒ not; a modification/deletion/rename under the prefix ⇒ not; `index.jsonl` ⇒ not; `sourceBranch` null ⇒ not; the date-suffix grammar `(-\d+)?` |
| 2 | `governance/run-check.test.mjs` (extend) | a lane ctx skips `issueLink` and passes; a `memory/*` branch carrying a code path is **refused by the ordinary rule**; an uncomputable diff ⇒ not a lane ⇒ standard rules (never a silent exemption) |
| 3 | `governance/lane-paths.test.mjs` (new) | the offending path is **named**; exit 1 on a foreign path; exit 0 with "not a lane" on a non-lane PR; three-dot argv asserted |
| 4 | `governance/lane-scrub.test.mjs` (new) | a planted `ghp_…` fails closed; the output contains `pattern` + `lineNumber` and **never** the matched line; `memorySecretAllowPatterns` is honoured; exit 0 on a non-lane PR |
| 5 | `vcs/governance-checks.test.mjs` + `governance-tiers.test.mjs` (extend) | the drift guard sees ten jobs in `GOVERNANCE_JOBS`, `GATE_MATRIX` and the YAML — **red until all three land** (the intended signal) |
| 6 | `vcs/actor-check.test.mjs` (extend) | D2's two regressions: a lane-shaped PR ⇒ `warn`, exit 0; a labeled PR with a denied approver ⇒ `fail`, exit 1 |
| 7 | `brain-audit.test.mjs` (extend) | a squashed lane merge ⇒ `[LANE]`, `evaluateMerge` never called; a records-only merge **without** the `Memory lane:` marker ⇒ evaluated normally |
| 8 | `memory/index-lag.test.mjs` (new) | lag ⇒ warning, exit 0; in sync ⇒ silent, exit 0; no file is written |
| 9 | `vcs/contributor-scaffold.test.mjs` (extend) | the emitted template matches the committed one byte-for-byte with the new sentence |

## Affected areas

| path | impact | what changes |
|---|---|---|
| `brain/scripts/governance/checks/lane.mjs` | New | the one pure lane predicate |
| `brain/scripts/governance/run-check.mjs` | Modified | lane branch in `runIssueLinkCheck` + diff wiring |
| `brain/scripts/governance/lane-paths.mjs`, `lane-scrub.mjs` | New | the two check entrypoints |
| `.github/workflows/governance.yml` | Modified | two jobs; `issue-link` gains `fetch-depth: 0` + `BASE_SHA`/`HEAD_SHA`; `local-checks` gains an index-lag step |
| `brain/scripts/vcs/governance-checks.mjs`, `governance-tiers.mjs` | Modified | two job names, two `GATE_MATRIX` rows |
| `brain/scripts/brain-audit.mjs` | Modified | the `[LANE]` row |
| `brain/scripts/memory/index-lag.mjs` | New | L3's warning |
| `brain/scripts/vcs/contributor-scaffold.mjs` + `.github/PULL_REQUEST_TEMPLATE.md` | Modified | L6's sentence (source + regenerated output) |
| branch protection on `main` | Maintainer act | `npm run brain:protect` — **not** in the diff |

## Risks

| risk | likelihood | mitigation |
|---|---|---|
| A `memory/*` branch carrying code merges in the window before branch protection is armed | Med | **D1(a)**: `issue-link` recomputes the path predicate itself, so the exemption never outruns its evidence. No real `memory:ship` run until `brain:governance-status` shows both contexts armed |
| The three-dot diff is uncomputable (a vendored workflow without `fetch-depth: 0`) | Med | fails toward "not a lane" ⇒ standard `issue-link` rules ⇒ a real lane PR is **loudly** refused, never silently exempted. `lane-paths` fails closed the same way |
| `GITHUB_HEAD_REF` absent (non-`pull_request` trigger) ⇒ `ctx.sourceBranch` null | Low | same rule: not a lane. The workflow triggers on `pull_request` only (`governance.yml:12-14`) |
| Two more required contexts block **every** PR if either is flaky | Low | both are offline — checkout, one `git diff`, file reads. No API call, no token |
| `[LANE]` swallows a genuine records-only feature PR with no issue link | Low | the `Memory lane:` body marker is required alongside the path predicate (D4) |
| The index-lag check dirties `index.jsonl` in CI | Med | the comparison is pure and non-mutating by construction; test 8 asserts no file is written |
| `lane-scrub` reports only the FIRST hit per file (`scrubRecordsFile` is fail-fast) | Low | accepted: it fails closed either way, and the run stops the merge. Named, not hidden |
| The L6 sentence departs from ADR-0034's 3.1d assignment | Med | stated in D5 and raised in the question round; #890 keeps the L7 retirements untouched |

## Rollback

Revert the PR. `GOVERNANCE_JOBS`, `GATE_MATRIX` and the YAML revert together, so the drift guard
stays green in both directions. The two check contexts then stop reporting — **and a required
context that never reports blocks every PR**, so the revert is only complete once the maintainer
re-runs `npm run brain:protect` (which re-derives contexts from the reverted `GATE_MATRIX`) or
removes the two contexts by hand. That ordering is the rollback's one non-obvious step, and it is
the same act, in reverse, as the arming. No data migration, no record is touched, nothing merged
needs undoing.

## Success criteria

- [ ] `npm test` green; the drift guard sees ten jobs across `GOVERNANCE_JOBS`, `GATE_MATRIX` and
      `governance.yml`.
- [ ] A lane-shaped PR passes `issue-link` with no closing keyword; a `memory/*` branch carrying one
      code path is refused by the ordinary rule — both asserted in unit tests.
- [ ] `lane-paths` names the offending path and exits 1; on a non-lane PR it runs, prints "not a
      lane", and exits 0.
- [ ] `lane-scrub` fails closed on a planted token and its output contains the pattern and the line
      number and **never** the matched line.
- [ ] `actor-check` is unmodified; both D2 regressions are green.
- [ ] `npm run brain:governance-status` reports `lane-paths` and `lane-scrub` armed on `main`.
- [ ] The first real lane PR is opened by `npm run memory:ship`, goes green on all eight contexts,
      and merges; `brain:audit` prints `[LANE]` for it.
- [ ] The already-armed `mrAutoMerge` response is captured verbatim and recorded as a fixture.
- [ ] `local-checks` prints an index-lag warning when the committed index lags and never fails.
- [ ] No change to `memory-gate`, the port, `collect`/`ship`, or the five #890 surfaces.

## Proposal question round

Each has a working recommendation above; none blocks `sdd-spec` / `sdd-design`.

1. **D1 raises the cost of the exemption on purpose.** Option (a) makes `issue-link` read the diff
   itself, which means the `issue-link` job now needs full history and can be uncomputable for a
   reason it never had before. The payoff is that the repo is not protected by a maintainer's
   memory to run `brain:protect`. Is buying that window worth a second diff and five YAML lines?
2. **D2 declines to write code the ticket asked for.** "The deny list still applies" cannot be
   implemented against the PR *author* without failing every unattended lane, because the denied
   identity **is** the poster. Is "no change, plus two pinning regressions" the right reading, or
   does the deny-set need a lane-specific meaning this proposal has not invented?
3. **D5 moves one sentence out of #890's slice.** ADR-0034 assigns the template wording to 3.1d, but
   3.1d is gated on #874 and would leave the template describing a path that no longer exists. Land
   the sentence here, or leave the template stale until #890?
4. **D6 keeps the triggers out.** #888 deferred them because a lane PR was un-mergeable — a reason
   this slice removes. The remaining reason is blast radius (every session end, two platforms, a
   drift-tested compiled settings file). Sub-ticket behind `memory.lane.enabled: false`, or include?
5. **Delivery.** Two PRs (A+C ~251 counted, then B ~79), `stacked-to-main`, with PR 1 closing a
   sub-ticket and PR 2 closing #889 — or one PR at ~330 counted / ~950 reviewer-visible?
