---
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:7fad98411a579e465706756a2d8669d6fbdafe7770833010c3f3fa1696fe4927
verdict: pass-with-warnings
blockers: 0
critical_findings: 0
requirements: 10/10 compliant, 0/10 partial
test_command: "npm test"
test_exit_code: 0
build_command: "npm run brain:repo:check && npm run brain:change:verify"
build_exit_code: 0
---

# Verify Report: issue-1276-tabs-follow-lookup-order

**Date**: 2026-10-04
**Verdict**: PASS WITH WARNINGS (0 CRITICAL, 3 WARNING, 5 SUGGESTION). The warnings are a served root with no `openspec/changes` directory that never reaches the worktree step (W1, the orchestrator ruling; the code follows the spec's text, the spec text is what needs amending), the process deviation of writing phases 2 to 4 in one pass (W2, the tests are real detectors), and design drift on the `from` wording source and the `tabSource` shape (W3).
**Verified in**: `/home/gandalf/IA/brain-issue-1276`, branch `fix/issue-1276-fixui-the-spec-sdd-and-tasks-tabs-read-a`, HEAD `6c67f6b6`, 4 commits over `origin/main`. Read-only: no source edited and left edited (mutations reverted, `git status` clean), nothing committed, no stash, no write into another worktree. `evidence_revision` is the sha256 of `git diff origin/main...HEAD`.
**Mode**: Strict TDD. Full artifact set. engram was unavailable, so apply-progress was read from the change dir file and the TDD cycle was cross-checked by a red-on-parent audit.

## Completeness

Tasks: 22 of 22 ticked, none open (`rg -c '^\s*- \[x\]' tasks.md` = 22, unchecked = 0). `git diff origin/main...HEAD --numstat` touches only `brain/scripts/ui/**` and this change dir. R3 is withdrawn and the diff confirms it: no `batch-tile` or `selectNode` line is touched; `app.js` changes only `renderDrawer`'s empty-state line and `renderTab`, and `app.css` only adds the `.tab-from` selector next to `.tab-progress`.

## Build and tests (executed)

| Command | Result |
|---|---|
| `npm test` | exit 0. tests 7530, pass 7527, fail 0, cancelled 0, skipped 3, todo 0 (42 s). The 3 skips are pre-existing. |
| `npm run brain:repo:check` | exit 0. "No prohibited references found." and "Artifact structure is valid." |
| `npm run brain:change:verify` | exit 0. "Validacion completa: repo + scripts". |
| Gated diff | **355** (expected 355), against the `lite` budget of 1000. |
| Flakiness | tab-source, change-route, static/local-render, local-overlay, 10 runs each under `taskset -c 0`: 0 failing runs in 40. |

## TDD compliance: red on the parent of each commit

Method: a detached scratch worktree at `<commit>~1` under the session scratchpad, the commit's test files checked out from the commit, `node --test --test-timeout=20000`. The scratch worktree was removed (`git worktree list` shows no `verify-1276`).

| Commit | Test file, result on the parent | Verdict |
|---|---|---|
| `9fdc65ce` | `tab-source.test` 18 of 18 fail; `change-route.test` 5 fail (59 pass); `drawer-model.test` 4 fail (44 pass); `local-overlay.test` 2 fail (27 pass); `git-run.test` 1 fail (12 pass) | RED |
| `9e134f10` | `local-render.test` 5 fail (9 pass) | RED |

The counts match apply-progress exactly (18, 5, 4, 2, 1, 5). Every new test is a real detector, and it fails on assertions about behaviour that the parent does not have (no `tabSource`, no `from`, no origin step), not on a missing import.

**Process deviation (W2).** Apply-progress admits that, after the first RED and its GREEN, the route code for phases 2 to 4 was written in one pass and the REDs were recorded against a `git archive HEAD` snapshot instead of between edits; phases 2 to 4 also landed in one commit. This is confirmed by the single `9fdc65ce` commit. It is not a reordering of tests after code: the tests demonstrably fail on the pre-change code, and the mutation audit below shows each is load-bearing. Classification: WARNING (process only, no product risk). Task 2.1's R1276-2 test is the one written to pass on arrival (its stated expectation), and it also fails on the parent only because it asserts `tabSource.kind === 'head'`; behavioural R2 was therefore re-proven independently (R1276-2 below).

## Spec compliance matrix (R1276-1 to R1276-10)

Runtime evidence: every test below passed in the `npm test` run above. Paths are under `brain/scripts/ui/`.

| Req | Proving test (file:line) | Status |
|---|---|---|
| R1276-1 lookup order | `tab-source.test.mjs:33` (worktree-only feeds SDD), `:298` (worktree wins over origin), `:356` (no source keeps today's reason); `change-route.test.mjs:876` (a main change never consults origin) | COMPLIANT |
| R1276-2 main unchanged | `tab-source.test.mjs:268` (three tabs deep-equal head-only, no `from`, no `progressSource`); `local-overlay.test.mjs:405`; independent proof below | COMPLIANT |
| R1276-3 tie-break, several refused | `tab-source.test.mjs:62` (two holders refused, both leaves, origin not read), `:79` (a no-dir worktree does not count); `resolveBranch` calls `holdingWorktrees` (`change-route.mjs:236`) | COMPLIANT |
| R1276-4 origin, Q1 | `change-route.test.mjs:826` (origin-only, blame at the origin sha), `:843` (open PR head wins), `:854` (no PR, refused, branches named), `:864` (capped holder said, not read) | COMPLIANT |
| R1276-5 unread step, Q2 | `tab-source.test.mjs:312` (uncomputable and pending section stop the walk, origin unread), `:328` (unreadable holder block said with its reason), `:343` (served `changes` section unreadable keeps today's reason) | COMPLIANT as written, see W1 |
| R1276-6 source line | `tab-source.test.mjs:94`, `:160` (`from worktree <leaf> · uncommitted: modified`, `progressSource` `working tree`); `lib/drawer-model.test.mjs:664`, `:681`; `static/local-render.test.mjs:198`, `:207`, `:215`, `:232`, `:239` | COMPLIANT |
| R1276-7 cards from the source | `tab-source.test.mjs:94` (cards cite `worktree <leaf>:`), `:111` (`spec.md is not in worktree`) | COMPLIANT |
| R1276-8 SDD stages | `tab-source.test.mjs:126` (deleted `design.md` not present, archive `not read outside the served root`), `:144` (slice plan from the worktree text); `lib/drawer-model.test.mjs:687` | COMPLIANT |
| R1276-9 attribution | `tab-source.test.mjs:160` (row 1.2 uncommitted, others the author), `:180` (untracked: no blame recorded, every row uncommitted), `:193` (failing blame said per row, checklist whole); `git-run.test.mjs:107` (stdin piped only when given) | COMPLIANT |
| R1276-10 bounds | `tab-source.test.mjs:229` (throwing forge proxy, no `-C`/`--git-dir`/`--work-tree`, no argument under the worktree, the one `blame --porcelain --contents - <head>`, byte digests of worktree and admin dir), `:252`; `static/local-render.test.mjs:222` (hostile leaf, `Array.from`); `rg node:fs change-route.mjs` matches only the header comment | COMPLIANT |

## Rulings, checked

| Ruling | Evidence | Status |
|---|---|---|
| R1 one choice, main, worktree, origin | `pickTabSource` (`change-route.mjs:594`) is called once (`:673`) and its value feeds `buildSpecTab`, `buildSddTab`, `buildTasksTab` and `documents`. Mutation (a) below. | HOLDS |
| R2 main unchanged | Independent proof: one real-git fixture (a main change with `proposal`, `spec`, `tasks`, plus a worktree of the same issue with a dirty `tasks.md` and an extra `design.md`) run against `origin/main` code and against this HEAD. `spec`, `sdd` and `tasks` JSON are byte-identical (`cmp`, 1785 bytes each). | HOLDS |
| Q1 several origin holders | Open PR head branch wins; none, or no PR, refuses and names the holders (`change-route.mjs:617-623`). Mutations (b1), (b2). | HOLDS |
| Q2 unread step stops | `change-route.mjs:602` and `:610` return `none` with the reason; nothing falls to origin. Mutation (c). | HOLDS, with the W1 exception |
| R4 read-only, text-only | No new write verb or fs import; all new strings reach the DOM through `el()` (`textContent`); the one new spawn is the blame; no forge call in the new code. | HOLDS |
| R3 withdrawn | No tile code in the diff (see Completeness). | CONFIRMED |

## Mutations

Each was applied with `sed -i`, the suites run (tab-source, change-route, local-render, plus drawer-model for (c) and (d)), then reverted with `git checkout -- <file>`. `git status --short` was clean after every revert and at the end.

| Mutation | Result |
|---|---|
| (a) `pickTabSource` skips the worktree step (`holding = []`) | CAUGHT: 14 fail (R1276-1, 3, 7, 8, 9, 10, the worktree-wins and unreadable-holder tests) |
| (b1) arbitrary origin holder = `holders[0]` instead of the PR head | CAUGHT: 3 fail (`change-route.test.mjs:843`, `:854`, `:864`) |
| (b2) arbitrary origin holder = the last one | CAUGHT: 1 fail (`:854`, the no-PR refusal). The PR-head test alone passes here because the fixture's PR branch happens to be the last holder; `holders[0]` and the refusal test cover it. |
| (c) unreadable `localWorktrees` section falls through to origin | CAUGHT: `tab-source.test.mjs:312` |
| (d1) `withFrom` stops emitting `from` | CAUGHT: 9 fail (R1276-1, 4, 7, 8, 9, 10 tests) |
| (d2) `renderTab` stops drawing `tab.from` (`app.js:1818`) | CAUGHT: 3 fail (`local-render.test.mjs:198`, `:207`, `:222`) |

## Issues

### CRITICAL

None.

### WARNING

**W1. A served root with no `openspec/changes` directory never reaches the worktree step (orchestrator ruling: this falls under R1).** Reproduced with `ui/test-support/git-worktree-fixture.mjs`: `makeWorktreeRepo({mainFiles: {}})` plus a worktree on `feat/issue-7-x` holding an uncommitted `spec.md` and `tasks.md`. The snapshot is `changes: {ok:false, reason:"openspec/changes could not be listed: ENOENT: no such file or directory, scandir ..."}` and `localWorktrees` is ok with the entry (`dirState: present`, `dir: openspec/changes/issue-7-x`). `buildChangeView` returns `tabSource: {kind:"none", reason:"no change dir at openspec/changes/issue-7-*"}`, and `spec`, `sdd` and `tasks` all fail with that reason. The first-ever change of a repo, living only in a worktree, is therefore never shown in the tabs, although it is exactly the R1 case ("main has no change dir").
- **Exact code site**: `brain/scripts/ui/change-route.mjs:599`, `if (!snapshot?.changes?.ok) return stop('none', plain);`, in `pickTabSource`. The branch is deliberate (R1276-5, first sentence; D90), so spec text, design D90 and the test at `tab-source.test.mjs:343` (which builds exactly this ENOENT state and pins `kind === 'none'`) all encode it; the apply agent recorded it as a deviation.
- **Minimal fix**: the section carries only a `reason` string (`status/snapshot.mjs:297`, `uncomputable(...)`), so the route must read ENOENT from it: `if (!snapshot?.changes?.ok && !/\bENOENT\b/.test(snapshot?.changes?.reason ?? '')) return stop('none', plain);`. Verified in a scratch worktree at HEAD with that one-line patch: the repro then gives `tabSource.kind: "worktree"` with the SDD and Spec tabs ok, and `tab-source` plus `change-route` run 81 of 82 pass; the single failure is `tab-source.test.mjs:343`, which must be changed from the ENOENT state to a non-ENOENT uncomputable section (for example EACCES, via the injected `_list` seam or a hand-built `{ok:false, reason: 'openspec/changes could not be listed: EACCES ...'}`) and a new ENOENT test added (worktree-only change in a repo with no `openspec/changes`). Other read errors keep stopping the walk per Q2. Spec R1276-5 sentence 1 and D90 need the amendment: "an absent `openspec/changes` directory counts as no row for N". The cleaner alternative, making `readChanges` return an empty ok section on ENOENT, widens the change to every snapshot consumer and is not recommended here. Caveat: the regex matches the message text of the section's reason; a structured code on the section would be sturdier, but that is a snapshot-contract change.
- **Severity**: WARNING (the code is compliant with the written spec; the ruling changes the spec). If the ruling is accepted, fix before archive.

**W2. Process deviation: phases 2 to 4 written in one pass.** See "TDD compliance". Tests are real detectors (18 of 18, 5, 4, 2, 1, 5 red on the parents; six mutations caught), so this is a process note, not a product defect. Not a blocker.

**W3. Design drift in two places, no behaviour impact.** (i) D92 says the `from` wording comes from `LOCAL_STATE_WORDING` already imported by the route; the route imports the new exported `localStateWording` (`lib/drawer-model.mjs`), which is `localRowDetail`'s own state half factored out, so it is the same table and the same wording with no copy. The deviation is sound (it avoids duplicating the `committed`/`deleted` branches) and is better than the design. (ii) D86 says `tabSource` is `{kind, leaf, branch, sha12, dir, reason}`; `publicSource` (`change-route.mjs:631`) returns `{kind, dir}` for `head`, `{kind, leaf, branch, dir, label}` for a worktree, `{kind, branch, sha12, dir, label}` for origin and `{kind, reason}` for `none`/`refused`. The extra `label` is what the empty-state line uses. Update D86 and D92 to say so.

### SUGGESTION

**S1. R2 test compares against the new code's head-only view, not a pre-change pin.** `tab-source.test.mjs:268` deletes `localWorktrees` and compares the two views of the same code; design says "a pinned copy built before the change". The byte-for-byte comparison against `origin/main` code recorded above closes the gap for this verify, but a golden pin would make it permanent.

**S2. A snapshot with no `localWorktrees` key at all is read as "holds nothing" and reaches origin** (`change-route.mjs:602`, `worktrees && !worktrees.ok`). The real snapshot always sets the section (`status/snapshot.mjs:564`), so this is reachable only from a hand-built snapshot, but Q2's principle ("an unread step is not a step that holds nothing") would also treat an absent section as unread.

**S3. An `unreadable` worktree document counts as present in the SDD rows and its row detail is the bare word `unreadable`** (`buildSourcedSddTab`, `localRowDetail`). R1276-8 reads "present exactly when the source holds that document", so the file existing makes this compliant; the reason (`doc.reason`) is not shown on the row. Appending it to the detail would say why.

**S4. The recording shim does not itself refuse `-C`, `--git-dir` or `--work-tree`.** `test-support/recording-git.mjs` is untouched by this change; it skips those options to find the verb and refuses write verbs. The ban on the three flags is asserted by the R1276-10 test (`tab-source.test.mjs:229`), over the recorded calls, which is sufficient but is not a shim guarantee for later tests.

**S5. The change artifacts keep `status: draft`** in `spec.md`, `design.md` and `tasks.md` front matter although apply is complete. Align with the convention at archive.

## Final verdict

PASS WITH WARNINGS. No CRITICAL: all ten requirements are compliant and each is covered by a passing test; the suite is green and was run 10 times on each of four files under one core without a failure. Recommended before archive: apply the W1 ruling (one line at `change-route.mjs:599`, one flipped test, one new test, a note in R1276-5 and D90) in a short follow-up apply batch, then archive.

## Resolution

| Finding | Resolution |
|---|---|
| W1 | Fixed at the source. `readChanges` (`status/snapshot.mjs`) now treats ENOENT on `openspec/changes` itself as a repository with no changes: `{ok: true, value: []}`. Any other read error stays `{ok: false, reason}` and still stops the walk (Q2). The route is untouched and no reason text is matched. RED: a `readChanges` test for an absent directory and a tab-source test (`makeWorktreeRepo({mainFiles: {}})` plus an uncommitted worktree change) failed first. `tab-source.test.mjs` "keeps today's reason" now uses an EACCES section. R1276-5 sentence 1 and D90 amended. The consumers of `snapshot.changes` (`findChangeDir`, `pickTabSource`, `buildSddModel`, `sddForIssue`, `buildSlicePlan`, the snapshot text line `N change dir(s)`) all handle an empty list. |
| W2 | No change: process note only; the tests were shown to be real detectors. |
| W3 | Fixed in the design. D86 states the real `publicSource` shapes, including `label`. D92 states that the route imports `localStateWording`. |
| S1 | Done. `tab-source.test.mjs` compares the three tabs of a main-held change with a golden recorded from `origin/main` code (`test-support/golden/tab-source-main-change.golden.json`). |
| S2 | No change: only a hand-built snapshot can omit the `localWorktrees` key; the real snapshot always sets it. |
| S3 | No change: the row is present exactly when the file exists (R1276-8); showing the reason is a wording improvement outside this fix. |
| S4 | No change: the ban on `-C`, `--git-dir` and `--work-tree` is asserted over the recorded calls by the R1276-10 test, and the shim is untouched. |
| S5 | Fixed: `spec.md`, `design.md` and `tasks.md` now carry `status: approved`. |
