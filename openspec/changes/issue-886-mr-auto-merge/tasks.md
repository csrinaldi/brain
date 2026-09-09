---
status: tasked
issue: 886
---

# Tasks: #886 — `mrAutoMerge`: one outcome constructor, two transports, one human gate

Implements `spec.md` under the ratified ruling `sdd/issue-886-mr-auto-merge/ruling` (D1–D6,
2026-09-09). Parent: #864 task 2.5, ADR-0034 L2. Branch:
`feat/issue-886-featvcs-mrautomerge-merge-by-tier-on-the`.

STRICT TDD MODE IS ACTIVE. Every implementation task below is preceded by its failing test
task. Test runner: `npm test` (node:test). Run the focused command after each RED/GREEN pair,
run the full `npm test` before each commit.

## 1. Artifact status bumps

- [ ] 1.1 Bump `status:` frontmatter on `explore.md`, `proposal.md`, `spec.md`, `design.md` from
      `draft`/`proposed` to `tasked`, alongside this file — one shared value across the change
      dir, the way #862 (task 1.1) and #863 moved their artifacts together
      (`phase-order-check.mjs`'s `STATUS_LADDER` is forward-only; unknown/custom values no-op).
      No code touched by this task.

## 2. The live capture (evidence BEFORE any regex — design A5, non-negotiable order)

- [ ] 2.1 Capture GitHub's real "auto-merge is not allowed" stderr, READ-ONLY-SAFE. Do **not**
      create a throwaway PR — creating a PR is itself a WRITE. Instead run the mutating
      merge-arm command against an ALREADY-OPEN, pre-existing PR: GitHub validates
      `allow_auto_merge` on the **repository** before it touches the PR at all, so on
      `csrinaldi/brain` (measured live in `explore.md`: `allow_auto_merge:false`) the call is
      guaranteed to reject before any state change — no merge happens, no auto-merge is armed,
      regardless of which PR number is targeted.
      ```bash
      n=$(gh pr list --repo csrinaldi/brain --state open --limit 1 --json number -q '.[0].number')
      gh pr merge "$n" --auto --squash --repo csrinaldi/brain 2>&1 | tee /tmp/mrAutoMerge-capture.txt
      ```
      **Fallback (Tier 2, only if no PR is open in `csrinaldi/brain` at execution time):** ask
      the maintainer to run the same command against any PR that happens to be open, and paste
      the stderr back verbatim. Do not invent the string under any circumstance — an invented
      pattern is green in test and inert in production (D2). Record in `_provenance` which path
      was actually taken.
- [ ] 2.2 Create `brain/scripts/vcs/fixtures/github-mrAutoMerge-unsupported.json`:
      ```json
      {
        "_provenance": {
          "recorded": true,
          "endpoint": "gh pr merge <n> --auto --squash --repo csrinaldi/brain",
          "date": "2026-09-09"
        },
        "stderr": "<verbatim text captured in 2.1>"
      }
      ```
      Loaded through the existing `loadFixture` + `assertProvenance`
      (`vcs.contract.test.mjs:50-64`). The classifier regex in task 5.3 is written FROM this
      fixture's own words — if the live text differs from "auto-merge is not allowed for this
      repository", this fixture is the truth and the design's prose is wrong, not the capture.

Commit: `chore(vcs): capture github mrAutoMerge unsupported fixture (#886)` — fixture only, no
source change yet.

## 3. Unit layer — `lib/auto-merge-outcome.mjs` (the only writer of these keys)

- [ ] 3.1 RED: `brain/scripts/vcs/lib/auto-merge-outcome.test.mjs` — `AUTO_MERGE_REASONS` is
      frozen and exposes exactly `REQUIRES_HUMAN_APPROVAL`/`UNSUPPORTED`/`TRANSPORT`; `armed({url})`
      returns keys `['enabled','url']` sorted, `enabled:true`; `refused({reason})` (tier case)
      returns keys `['enabled','reason']`, no `error`; `refused({reason,error})` (unsupported /
      transport case) returns keys `['enabled','error','reason']`; a source guard asserting no
      provider file writes `enabled:` as an object literal by hand (grep-based, mirrors the
      `uncomputable-cause.mjs` precedent).
      Focused: `node --test brain/scripts/vcs/lib/auto-merge-outcome.test.mjs` — RED (module
      does not exist).
- [ ] 3.2 GREEN: `brain/scripts/vcs/lib/auto-merge-outcome.mjs` — `AUTO_MERGE_REASONS` (frozen),
      `armed({url})`, `refused({reason, error})`; `error` present iff passed (never fabricated
      for the tier-refusal branch, per A1). Imported, never re-exported, by both providers.
      Focused: same command — GREEN. `npm test` — still green project-wide (nothing imports the
      module yet).

Commit: `feat(vcs): add auto-merge outcome constructor (#886)`.

## 4. Contract layer — `MR_AUTO_MERGE_PROVIDERS` (both providers, RED first)

- [ ] 4.1 RED: add the `MR_AUTO_MERGE_PROVIDERS` block to
      `brain/scripts/vcs/providers/vcs.contract.test.mjs`, mirroring
      `BRANCH_PROTECT_PROVIDERS` (`:2168-2228`): a `{module, ok(args), fail(args)}` map per
      provider, GitHub glue via `setSpawn` (`lib/exec.mjs:11`), GitLab glue via injected
      `fetchImpl` — no network, no fixture file except the one from section 2. Write every case
      from spec.md's test map in this order (titles carry the shared
      `${providerName}.mrAutoMerge (contract): ` prefix):
      1. `an omitted requiredReviews refuses`
      2. `requiredReviews>0 refuses, provider seam UNCALLED` — GitHub seam is a counting
         `setSpawn`, GitLab seam is a counting `fetchImpl`; assert `calls === 0`, never a
         throwing seam (design A4 — a throwing seam would fail the never-throws test for the
         wrong reason).
      3. `gh: armed → {enabled:true,url} via gh pr merge --auto --squash`
      4. `gl: armed → {enabled:true,url} via PUT .../merge, pipeline+squash`
      5. `url is null when the provider reports none`
      6. `armed shape carries no merged/sha field`
      7. `gh: captured "auto-merge not allowed" stderr → unsupported` — feeds the section-2
         fixture into `failSpawn`.
      8. `gl: 405/406 merge response → unsupported`
      9. `network/5xx/401/403 → transport, carries error`
      10. `outcome key set is pinned, exactly`
      11. `never throws, even under a mocked transport failure`
      Focused: `node --test brain/scripts/vcs/providers/vcs.contract.test.mjs` — RED (neither
      provider exports `mrAutoMerge`; every case fails on "not a function").
- [ ] 4.2 GREEN (github only): implement `mrAutoMerge` in `brain/scripts/vcs/providers/github.mjs`
      after `mrCreate` (`:595`), via the `gh()` chokepoint (`:68`):
      `if (requiredReviews > 0) return refused({ reason: REQUIRES_HUMAN_APPROVAL })` as the
      first line (A4); else `gh(['pr','merge',String(number),'--auto','--squash','--repo',project])`;
      on success `armed({ url: null })` (A2 — no stdout parsing, ever); on failure classify
      `r.stderr` against the section-2 fixture's captured text → `unsupported`, else
      `transport` with `r.stderr.trim()` or `` `gh pr merge failed (status ${r.status})` ``.
      Focused: same command — GitHub cases (1,2,3,5,6,7,9,10,11 for `gh:`) GREEN; GitLab cases
      still RED (`gitlab.mjs` does not export the verb yet).
- [ ] 4.3 GREEN (gitlab): implement `mrAutoMerge` in `brain/scripts/vcs/providers/gitlab.mjs`
      after `mrCreate` (`:1147`): same refusal-first line; else `gitlabApiFetch` PUT
      `projects/{enc}/merge_requests/{number}/merge` with
      `{ merge_when_pipeline_succeeds: true, squash: true }` inside `try/catch`; on success
      `armed({ url: res.web_url ?? null })`; `catch (err)` classify `err.message` against
      `/API failed:\s*(?:405|406)\b/` → `unsupported`, else `transport` with `err.message`
      (A3 — anchor is `API failed:`, never a bare `\b405\b`, to avoid mis-reading a `500` on
      iid `405` as `unsupported`).
      Focused: same command — full `MR_AUTO_MERGE_PROVIDERS` block GREEN, both providers.
      `npm test` — green.

Commit: `feat(vcs): implement mrAutoMerge on github and gitlab providers (#886)` (4.1+4.2+4.3
as one work unit — the contract test and both adapters ship together; splitting them would
leave an intermediate commit red by construction).

## 5. Provider-specific pins and the regression guard

- [ ] 5.1 RED then GREEN, `brain/scripts/vcs/providers.test.mjs`, beside `branchProtect`'s argv
      tests (`:357-568`): GitHub — exact argv is
      `['pr','merge','<n>','--auto','--squash','--repo','<project>']`. GitLab — exact path
      `projects/{enc}/merge_requests/{number}/merge` and exact payload
      `{ merge_when_pipeline_succeeds: true, squash: true }`. These assert provider detail the
      contract layer deliberately does not (A6) — `--repo <project>` matters because `mrCreate`
      resolves the repo from the git remote instead (`github.mjs:579`), a real behavioural
      difference worth pinning.
- [ ] 5.2 RED then GREEN, same file: the A3 false-positive regression — a GitLab `500` on
      iid **405** classifies `transport`, not `unsupported` (`GitLab API failed: 500
      (projects/x%2Fy/merge_requests/405/merge)` must NOT match the unsupported regex). Sibling
      precedent: `gitlab.branchProtect`'s anchored `': 409'` test (`providers.test.mjs:543`).
      Focused: `node --test brain/scripts/vcs/providers.test.mjs`. `npm test` — green.

Commit: `test(vcs): pin mrAutoMerge argv/payload and the gitlab 405-vs-500 regression (#886)`.

## 6. `cli.mjs` — one `VERBS` entry, the guard goes red by design

- [ ] 6.1 Add `'mrAutoMerge'` to `cli.mjs`'s `VERBS` array (`:38-46`). No flag parsing needed —
      the CLI takes one JSON blob (`cli.mjs:184-192`), so `requiredReviews` arrives as a JSON
      key exactly as `branchProtect`'s does; `bindIdentity` (`:159-168`) wraps every export
      exhaustively, so credential binding needs no extra wiring.
      Focused: `node --test brain/scripts/vcs/verb-contract-drift-guard.test.mjs` — **RED on
      check `:82`, by design.** Both providers now export `mrAutoMerge` (fires check `:120`
      too), so `VERBS` and the doc row cannot be split — this task alone cannot turn the guard
      green. It is made green only by task 9.1 (the maintainer's promotion commit landing the
      `vcs-contract.md` doc row on this same branch). Do not "fix" it by adding the verb to
      `DOCUMENTED_BUT_NOT_REQUIRED` — that would record a contract verb as a probe.
      `npm test` — red on this one file, expected, everything else green.

Commit: `feat(vcs): dispatch mrAutoMerge from cli.mjs (#886)`.

## 7. The doc draft — `brain-drafts/vcs-contract.draft.md` (Tier 1: agent drafts; Tier 2: maintainer promotes)

- [ ] 7.1 Create
      `openspec/changes/issue-886-mr-auto-merge/brain-drafts/vcs-contract.draft.md`, a
      `brain-amendment/1` non-ADR draft (no `amendment:`/`home-summary:` keys — ADR-only, hard
      parse error otherwise):
      ```
      target: brain/core/methodology/vcs-contract.md
      issue: 886
      ```
      Two `amend-find`/`amend-replace` pairs, each anchoring on a whole, unique line (the
      guard's row regex is `^\|\s*\`([a-zA-Z]+)\`\s*\|` — name must be backticked, alphabetic):
      1. the `` | `mrCreate` | … | `` **Required verbs** row (`vcs-contract.md:33`) → itself +
         a new row: `` | `mrAutoMerge` | mutating; arms auto-merge by tier, never merges, never
         throws | ``.
      2. the `` | `mrCreate` | implemented | implemented (A3 — issue #239) | `` **Phase 3
         adapter** row (`:99`) → itself + `` | `mrAutoMerge` | implemented | implemented (#886)
         | ``.
      - [ ] 7.2 Verify before handing over (`planAmendment`, no disk write, no confirmation
      prompt):
      ```bash
      node --input-type=module -e "
      import { readFileSync } from 'node:fs';
      import { planAmendment } from './brain/scripts/lib/amendment-draft.mjs';
      const r = planAmendment({
        draftText: readFileSync('openspec/changes/issue-886-mr-auto-merge/brain-drafts/vcs-contract.draft.md','utf8'),
        targetText: readFileSync('brain/core/methodology/vcs-contract.md','utf8'),
        homeText: null, gitUserName: 'draft-check', today: '2026-09-09', issueFallback: '886',
      });
      console.log(r.ok ? (r.plan ? r.plan.acts.map(a=>a.act+':'+a.state).join(' ') + ' | ' + r.plan.commitSubject : 'ALREADY APPLIED') : r.error);
      "
      ```
      Expected: `2:pending 2:pending | docs(brain): amend brain/core/methodology/vcs-contract.md (#886)`.
      Anything else (`blocked`, partial) means an anchor moved — re-anchor the draft, never
      hand-edit the target (agents may not commit to `brain/core/**`).

Commit: `docs(vcs): draft mrAutoMerge contract row amendment (#886)`.

## 8. Wrap-up before the push

- [ ] 8.1 `npm test` full run — every file green except
      `verb-contract-drift-guard.test.mjs` check `:82` (expected red, task 6.1's note).
- [ ] 8.2 `memory:save --issue 886` — record-first, BEFORE the push (ADR-0034 lane discipline).
- [ ] 8.3 Tick epic task 2.5 in `openspec/changes/issue-864-memory-2-0/tasks.md` if not already
      reflecting `#886` as filed/in-progress.

## 9. The PR

- [ ] 9.1 Push `feat/issue-886-featvcs-mrautomerge-merge-by-tier-on-the`. Open the PR:
      `Closes #886`, `Parent: #864` in prose, label `type:feature`. Body: summary, changes
      table (the File changes table in design.md), test plan (the `npm test` output, noting the
      one expected-red check and why), the D5 handover note verbatim:

      > **Maintainer action required before merge.** This branch is red on
      > `verb-contract-drift-guard.test.mjs` check `:82` by design (D5) — the code and the
      > contract-doc row cannot land in the same commit without an agent writing to
      > `brain/core/**`, which is forbidden. Run, **on this branch**:
      > ```
      > npm run brain:promote -- openspec/changes/issue-886-mr-auto-merge/brain-drafts/vcs-contract.draft.md
      > ```
      > and commit the result. CI turns green only after that commit.

      Commit order on the branch, non-negotiable: (1) this PR's own commits (sections 2–8,
      agent-authored) land first; (2) the maintainer's `brain:promote` commit lands second, on
      the same branch; (3) CI green; (4) `brain:review`; (5) merge.
- [ ] 9.2 Run `brain:review` only after (1) and (2) above are both on the branch — a review
      against the red-by-design state would flag a false blocker.

## 10. Non-goals (D6 — restated, no work items)

This slice ships the verb only. Explicitly out of scope, unchanged by this PR:

- No caller wired — #888 (lane push + PR) consumes `mrAutoMerge` later.
- No collector — #887.
- No repository setting flipped — `allow_auto_merge` stays `false` on `csrinaldi/brain`; #805
  gates enabling it.
- No `lane-paths`/`lane-scrub` contexts — #889.
- No change to `mrCreate` or any other existing verb.
- No `brain:*` npm verb touched.

## Review Workload Forecast

- Estimated changed lines (counted per `brain.config.json:18-29`, which excludes
  `**/*.test.mjs` and `openspec/changes/**` from `diff-size-count.mjs`): `lib/auto-merge-outcome.mjs`
  ~30, `providers/github.mjs` ~40, `providers/gitlab.mjs` ~45, `cli.mjs` ~1,
  `fixtures/github-mrAutoMerge-unsupported.json` ~10, `brain/core/methodology/vcs-contract.md`
  (maintainer's promotion commit) ~4 — **counted total ~130, Low risk**.
- Reviewer-visible total, including ignore-listed test/draft paths (`vcs.contract.test.mjs`,
  `providers.test.mjs`, `lib/auto-merge-outcome.test.mjs` ~180, the draft ~45): ~355 — still
  under the 400-line budget even uncounted.
- 400-line budget risk: Low.
- Chained PRs recommended: No — one PR, one review order (outcome module → refusal branch →
  each provider's classifier → the draft), matching design.md's own recommendation.
- Decision needed before apply: No — D1–D6 already ratified 2026-09-09
  (`sdd/issue-886-mr-auto-merge/ruling`, engram #3233). The only human-gated act is the
  maintainer's `brain:promote` commit (task 9.1), which is a known, designed-for handover, not
  an open decision.
