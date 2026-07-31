---
status: verified
issue: 385
verdict: PASS WITH WARNINGS
---

# Verify Report — issue-385-m10-phase2-rank6-batch

**Verdict: PASS WITH WARNINGS — READY TO ARCHIVE (after opening the PR, task 7.4).**
Branch: `feature/385-m10-phase2-gapA-final-batch` (7 commits, off `feature/m10-seam-contract-coverage` @ `c923681`).
Engram: `sdd/issue-385-m10-phase2-rank6-batch/verify-report`.

## Task completeness
39/40 tasks `[x]`. Only 7.4 (open PR) unchecked — deliberately deferred to post-verify, per the apply report.

## Test evidence (clean-worktree measurement — see WARNING on dirty working tree)
Two disposable `git worktree` checkouts were used to get an apples-to-apples count, since the real working
directory (`/home/gandalf/IA/brain`) carries unrelated uncommitted changes (see WARNING 1):
- Baseline (`c923681`, clean worktree): **2073 tests, 0 fail**.
- Branch tip (`461acbb`, clean worktree): **2096 tests, 0 fail**.
- Delta: **+23**, matching the design's precomputed breakdown (4 whoami + 6 commitStatus in-loop + 2
  projectResolve + 2 repoCloneUrl-parity + 2 patSetupUrl-parity + 3 commitStatus-divergence + 1
  repoCloneUrl-divergence + 3 patSetupUrl-divergence = 23) exactly.
- `npm run repo:check` — 1 structural problem, pre-existing on the clean branch tip *before* this change
  (`issue-362-m10-phase2-issueList-contract` missing `proposal.md`) — unrelated to issue #385, not introduced
  by it (confirmed present on the same clean worktree at this branch's tip).

## Diff size
`git diff --numstat c923681..HEAD` on code/fixture/doc files only: **396 insertions + 6 deletions = 402
lines** across `vcs-contract.md` (+8/-6), 10 fixtures (146 insertions), `vcs.contract.test.mjs` (242
insertions) — matches the apply report's claimed 402 exactly. Separately, this branch also commits the
previously-uncommitted SDD planning artifacts (`design.md` 560, `proposal.md` 132, `spec.md` 206, `tasks.md`
96 = 994 lines across 4 files) in its own housekeeping commit (`461acbb`) — not counted in the 402 because
they are planning docs, not implementation, but a reviewer will see ~1396 total lines changed across 16
files if they diff the whole branch. Flagged as WARNING 2 below for transparency, not a defect.

## Production-code diff
`git diff c923681..HEAD -- github.mjs gitlab.mjs normalize.mjs exec.mjs` → **empty**. Confirmed zero
production files touched.

## Fixture provenance
All 10 new fixtures pass `assertProvenance` (exactly one of `recorded`/`derived`, plus `endpoint` + `date`;
all also carry `note` although the helper doesn't enforce that field). `github-whoami-happy.json` was
independently spot-checked against a **live** `gh api /user` call run during this verification: `login`,
`id`, `node_id`, `avatar_url`, all URL fields, `created_at`, `updated_at`, `public_repos`/`followers`/
`following` counts are byte-identical to the fixture. The live call currently returns non-null
`email`/`notification_email`; the fixture nulls both with an explicit provenance-note disclosure — the
redaction claim is genuine, not merely asserted. This is the strongest possible confirmation available
(a live re-recording during verify), and it passes cleanly.

## Scenario coverage vs spec.md
| Verb | Spec scenario | Test(s) | Status |
|---|---|---|---|
| whoami | happy `{username}` | `whoami happy` (per-provider) | VERIFIED |
| whoami | transport failure rejects | `whoami failure` (per-provider) | VERIFIED |
| commitStatus | happy enum + two-field read + selection asymmetry | `commitStatus happy` (in-loop) + 2 standalone divergence tests (two-field read, selection asymmetry) | VERIFIED (split across in-loop + standalone, all present) |
| commitStatus | null incl. neutral/skipped collapse | `commitStatus empty` (in-loop) + standalone neutral/skipped test | VERIFIED |
| commitStatus | transport failure rejects | `commitStatus failure` (in-loop) | VERIFIED |
| projectResolve | identity, both providers | single in-loop test, 2 assertions (flat + nested path) | VERIFIED |
| repoCloneUrl | credential position + user-literal | in-loop parity test (`new URL()` parse) | VERIFIED |
| repoCloneUrl | falsy-host divergence | standalone divergence test | VERIFIED (real defect exercised — see below) |
| patSetupUrl | path/query shape + key divergence | in-loop parity floor + 2 standalone divergence tests | VERIFIED |
| patSetupUrl | GH ignores host (GHES-breaking) | standalone divergence test | VERIFIED (real defect exercised) |
| fixture provenance | all 10 fixtures | `assertProvenance` runs on every fixture-driven test | VERIFIED |
| vcs-contract.md rows | 26/35/36/37/38 + enum section | diff reviewed line-by-line | VERIFIED, correctly cross-referenced |

No scenario silently dropped.

## Divergence-lock authenticity (not tautologies)
Cross-checked each locked assertion against the actual (unchanged) production source:
- `gitlab.mjs:531` — `` `https://oauth2:${token}@${host}/${project}.git` `` — confirmed no fallback; a falsy
  `host` really does template-literal-stringify to `"undefined"`. The test's
  `assert.equal(gl.host, 'undefined', ...)` exercises the real bug, not a vacuous string check.
- `github.mjs:485` — `` `https://github.com/settings/tokens/new?description=...` `` — confirmed `host` is
  never read; the divergence-lock test's `assert.equal(parsed.host, 'github.com', ...)` against a supplied
  GHES host genuinely proves the parameter is ignored.
- Neither `github.mjs` nor `gitlab.mjs` calls `encodeURIComponent` anywhere near `patSetupUrl`/
  `repoCloneUrl` (grepped both files) — the shared no-encoding lock test's
  `parsed.searchParams.has(' co')` assertion genuinely names the injected spurious parameter mechanism,
  confirmed real for both providers.
All three are genuine, currently-failing-if-fixed assertions, not tautological "returns a string" checks.

## Secret safety
`repoCloneUrl` tests use `PLACEHOLDER_CREDENTIAL = 'placeholder-not-a-real-token'` — no `ghp_`/`glpat-`/
`gho_` prefix, no base62 entropy, prose-like. `authLogin`'s pre-existing `'sample-cred-9x7'` fixture is
untouched. No realistic-looking secret shape anywhere in the new test/fixture code.

## Naming / rank-6 leakage
Grepped the full branch diff and commit log for "rank-6"/"rank 6"/"rank-7": the only occurrences are (1)
the pre-existing, untouched `authCheck` row 24 context line, and (2) the SDD planning docs' own
*discussion* of why rank-6 was deliberately avoided (the folder name stays `rank6-batch` by design decision,
but every new doc row / test comment / commit message / filed issue correctly reads "issue #385, M10 Phase
2 — final Gap-A batch"). No leakage into actual new content.

## Follow-up issues
`gh issue view` confirms #386, #387, #388 all exist, each `type:bug`, each references epic #335, and each
describes exactly one of the three distinct latent defects (GitLab `repoCloneUrl` no host fallback / GitHub
`patSetupUrl` ignores host / neither provider URL-encodes name/scopes) — filed separately, not combined.

## Findings
- **CRITICAL**: none.
- **WARNING 1**: the real working directory (`/home/gandalf/IA/brain`) has unrelated uncommitted/untracked
  changes (memory index/records, i18n files, `backfill-issue`/`issue-extraction` scripts+tests, other
  in-progress SDD docs) that inflate `npm test`'s in-place count to 2136/2136 and cause `npm run
  change:verify` to report 46 changed files (not 16). This is pre-existing local dirty state unrelated to
  issue #385 — verified via disposable clean worktrees that the branch's own delta is exactly baseline
  2073 → tip 2096 (+23, 0 fail). Recommend stashing/committing that unrelated work before merging so CI
  runs against a clean tree; not a defect in this change.
- **WARNING 2**: total branch diff (including the SDD planning-artifact housekeeping commit) is ~1396
  lines across 16 files, not the ~402/~360 figure quoted for "the change" — the apply report's 402-line
  figure only counts code/fixture/doc files, excluding `design.md`/`proposal.md`/`spec.md`/`tasks.md`
  (994 lines). Both figures are individually accurate for what they measure, but a PR reviewer opening the
  diff will see the larger number; worth calling out in the PR description so it isn't mistaken for scope
  creep.
- **WARNING 3**: `npm run repo:check` reports one pre-existing structural problem
  (`openspec/changes/issue-362-m10-phase2-issueList-contract` missing `proposal.md`) — confirmed present on
  a clean checkout of this branch's tip, i.e. NOT introduced by issue #385. Unrelated repo hygiene debt;
  flagging so it isn't mistakenly attributed to this PR during review.
- **SUGGESTION**: task 7.4 (open the PR) is the only remaining unchecked item — expected, since this
  verify pass runs before PR creation per the tasks.md sequencing.

**Ready to archive: YES, once task 7.4 (PR opened) completes.** No CRITICAL blockers found.
