---
schema: gentle-ai.verify-result/v1
evidence_revision: git:c3d21c90a8eb8c0e72dc73cf535a9f73a1d61d9b
verdict: pass-with-warnings
blockers: 0
critical_findings: 0
requirements: 12/12 compliant
scenarios: all mapped, 0 missing (1 note: credential-prompt scenario proven by env pass-through only)
test_command: "npm test"
test_exit_code: 0
test_output_hash: sha256:e69aecb174a06f0eae065a53ea43217595feb8e2acf7d89b3fd3dbe7cf1d3e3c
build_command: "npm run brain:repo:check && npm run brain:change:verify"
build_exit_code: 0
build_output_hash: sha256:not-captured
---

# Verify Report: issue-1201-multidev-remote-branches

**Verdict**: PASS WITH WARNINGS (0 CRITICAL, 3 WARNING, 4 SUGGESTION).
**Verified in**: /home/gandalf/IA/brain-issue-1201, HEAD c3d21c90, 9 commits over origin/main. Read-only: no code edited, nothing committed, no git stash used; every mutation reverted with git checkout -- <file>, git status shows only the untracked change dir.
**Mode**: Strict TDD. apply-progress.md was read from the change dir.

## Part 0 - incident audit: PASS

1. git status --short: no unmerged path, no change under openspec/changes/issue-864-memory-2-0/; only the untracked issue-1201 change dir.
2. git stash list: stash@{0} is still "WIP on claude/epic-864-spec-analysis-6t9gip: f3fb199c ..."; 13 stashes in total (0..12), none dropped.
3. git diff origin/main...HEAD --stat: 38 files, none under openspec/changes/issue-864-* or .memory/.
4. git log origin/main..HEAD --name-only: only brain/scripts/ui/**, brain/scripts/status/**, brain/scripts/lib/git-tree.mjs(+test), test/publish-allowlist.e2e.test.mjs, test-support. No stash content.
5. Main checkout: git -C /home/gandalf/IA/brain status --short without untracked lists only " M .memory/index.jsonl", identical to the session-start snapshot. Not changed.

## Build and tests (executed)

| Command | Result |
|---|---|
| npm test | 7231 tests, 7228 pass, 0 fail, 3 skipped, exit 0 (matches apply-progress) |
| npm run brain:repo:check | exit 0, no prohibited references, artifact structure valid |
| npm run brain:change:verify | exit 0 (node --check over every changed file) |
| Gated diff (expected 977) | 977 measured; under the lite 1000 budget, no size:exception needed |

Tasks: 44 ticked, 1 unticked: 8.5 (PR notes, human-gated Tier 2). Expected.

## Strict-TDD evidence (red on the parent)

Each commit carries its tests. For four commits the commit's test files were checked out on the parent in a detached scratch worktree (/tmp/.../verify-1201, removed afterwards; git worktree list confirms) and run:

| Commit | Tests run on parent | Result |
|---|---|---|
| c4e65a37 resume path | resume-path.test.mjs + fake-git | 3 of 4 fail (R2 real-writer, root-only, no-dir) |
| b2d2e058 readRemoteChanges | remote-changes.test.mjs + fixtures + git-run-guard | remote-changes.test.mjs fails (module absent) |
| 0c789f52 poller lane | poller, git-run, server-remote | 9 fail (7 poller lane tests, git-run.test.mjs, server-remote.test.mjs) |
| 2fc5edaf remote-model | remote-model.test.mjs + banners.test.mjs | 4 fail (module absent, 3 remotes-band tests) |

Per-commit file lists show a test file in every feature commit. Note: the final commit c3d21c90 landed (apply-progress still says it was blocked; stale text).

## Requirement compliance (spec R1201-1..12)

| Req | Proving tests | Verdict |
|---|---|---|
| 1 section, no network | remote-changes.test.mjs:28, :119 (two for-each-ref spawns), :204 (no fetch state, byte-identical), :159 (blob metadata, no text), :86/:94 (uncomputable); snapshot-cli.test.mjs:56, :78; remote-source-guard.test.mjs:34 | COMPLIANT |
| 2 author, no session | remote-changes.test.mjs:212; remote-model.test.mjs:94, :100; remote-render.test.mjs:73 (markup inert), :176; remote-source-guard.test.mjs:55, :67 | COMPLIANT |
| 3 classification | remote-changes.test.mjs:40 (lanes), :48 (merged/empty), :57 (open PR wins), :68, :79 (prs uncomputable); remote-render.test.mjs:125 | COMPLIANT |
| 4 one node with its PR | remote-changes.test.mjs:144; remote-render.test.mjs:82 | COMPLIANT |
| 5 unjoined group | remote-changes.test.mjs:129 (sorted, 400-day-old kept); remote-model.test.mjs:67; remote-render.test.mjs:97 (collapsed, count) | COMPLIANT |
| 6 documents at SHA | remote-drawer.test.mjs:49, :57, :68, :80, :92 (cap 3), :102 (sameAsServed), :111; remote-changes.test.mjs:178; remote-render.test.mjs:133 | COMPLIANT |
| 7 resume path | resume-path.test.mjs:54 (real featureCheckpoint), :77 (root not read), :87; remote-drawer.test.mjs:121 | COMPLIANT |
| 8 three resume states | remote-changes.test.mjs:234, :246, :264; remote-model.test.mjs:85; remote-drawer.test.mjs:131; remote-render.test.mjs:91 | COMPLIANT |
| 9 poller owns fetch | poller.test.mjs:683, :693, :704, :717, :735; server-remote.test.mjs:127, :145, :166, :70 (watch never fetches); git-run.test.mjs:75, :84, :91 (SIGKILL timeout); server-remote.test.mjs:273; remote-source-guard.test.mjs:42, :49 | COMPLIANT (see W3) |
| 10 no local writes | server-remote.test.mjs:186 (heads, HEAD, worktrees, status identical, no FETCH_HEAD), :219 (prune only stale remote ref) | COMPLIANT |
| 11 degraded band | poller.test.mjs:755; server-remote.test.mjs:236; banners.test.mjs:149, :155, :161, :167, :172; remote-render.test.mjs:167 | COMPLIANT |
| 12 bounds | remote-changes.test.mjs:307 (74 spawns, 24 read, 6 deferred), :324, :334 (warm = 2 spawns, deep-equals cold), :345; server-remote.test.mjs:47, :70; snapshot-cli.test.mjs:56 (CLI cold) | COMPLIANT |

Note on the credential-prompt scenario (R1201-9): proven by GIT_TERMINAL_PROMPT=0 reaching the child (git-run.test.mjs:84) and the SIGKILL timeout, not by a real prompting remote. Acceptable.

## Acceptance criteria

- AC1 COMPLIANT (remote-changes.test.mjs:28, bare-remote fixture, no forge).
- AC2 COMPLIANT (:234, :246, :264; distinct wording remote-model.test.mjs:85).
- AC3 COMPLIANT. rg -n -i session over the new modules: one hit in a header comment (ui/lib/remote-model.mjs:7, "no session") and "supersession" in a comment at app.js:1381 (unrelated). Code-only guard remote-source-guard.test.mjs:55 and rendered-DOM test remote-render.test.mjs:176 pass.
- AC4 COMPLIANT. recording-git.mjs refuses checkout, switch, reset, merge, pull, push, update-ref, rebase, stash, restore, clean, bare branch and worktree add (confirmed by a direct call: checkout and worktree add refused). server-remote.test.mjs:186 runs a real fetch on a dirty clone: only refs/remotes moved, FETCH_HEAD absent. See S1 on the shim's gaps.
- AC5 COMPLIANT. AC6 COMPLIANT.
- R2 COMPLIANT: resume-path.test.mjs:54 calls the real featureCheckpoint, finds <dir>/resume.md; :77 shows a root-only file is missing.

## Mutations (all reverted, git status clean)

| Mutation | Result |
|---|---|
| (a) readRemoteChanges calls fetch | remote-source-guard.test.mjs:34 and :42 fail; remote-changes.test.mjs:119 (spawn assertion) also fails |
| (b) resume read at the root again | resume-path.test.mjs R2 tests (found, root-only) fail, plus 3 remote-drawer tests |
| (c) drop the open-PR-wins rule (!openPr) | remote-changes.test.mjs:57 fails (1 fail) |
| (d) remove the budget cap | remote-changes.test.mjs:307 fails (1 fail) |

All four are real detectors.

## Apply deviations judged

- gitErrorLine moved to lib/git-tree.mjs, re-exported from ui/git-run.mjs:24: ACCEPT. Needed so status/ does not import ui/ (layer inversion, D35); existing import sites keep working.
- Guard exempts test-support: ACCEPT. The fixture builds real repos with child_process; the exemption is scoped to test-support/ and commented (git-run-guard.test.mjs:32, remote-source-guard.test.mjs:28).
- Hidden counts not rendered: ACCEPT, required. R1201-3 says hidden branches MUST NOT appear in any list, count or group of the UI; the counts stay in the section (D33).
- Tarball canary 9.2 to 9.3 MB: ACCEPT with the same justification as #1218 (organic source and suites, no bulk; #1076). The commit message and comment state it.
- Forge-less server never fetches on its timer: ACCEPT as spec-conformant (see W3).

## Findings

CRITICAL: none.

WARNING
- W1. The 8.5 PR note is still open: the PR body must state the R2 behaviour change, the --no-write-fetch-head addition to R1's argv (maintainer may veto) and the single-PR size ruling (977 gated, under 1000, so no size:exception label is needed; R9's conditional label does not apply).
- W2. apply-progress.md is stale: it says the final test-guard commit "is staged but blocked"; commit c3d21c90 exists and the tree is clean. Refresh it before archive.
- W3. D40 consequence: a server started without a forge starts with initialError, hence paused, so the timer never fetches. Teammates' branches then go stale until someone presses refresh, and no band appears (the remotes band needs lastError, so a never-attempted fetch is silent). Matches R1201-9 literally ("paused: a tick MUST NOT fetch"), but a forge-less operator, the case AC1 explicitly serves, gets no hint. Suggest naming it in the PR notes and, in a follow-up, decoupling the remotes lane from the forge pause.

SUGGESTION
- S1. recording-git's verb finder takes the first non-dash argument, so git -C <path> checkout x is not refused (verified by a direct call). Production code never uses -C, so it is theoretical. Also the shim has no self-test of its refusals; add two assertions.
- S2. The credential-prompt scenario has no test against a really prompting remote.
- S3. The comment at ui/lib/remote-model.mjs:7 contains the word "session"; harmless, but a raw rg -i session on the module is not empty.
- S4. The spec says at most 74 spawns while design D36 says 72 plus 2; the test uses 74. Align the wording.

## Resolution

| Finding | Fix |
|---|---|
| W1 | Left open: the PR note is written by the orchestrator (task 8.5). |
| W2 | apply-progress.md refreshed: the final guard commit is c3d21c90, and the stash incident was resolved by the orchestrator with the maintainer's authorisation. |
| W3 | Ruling: the remotes lane is decoupled from the forge. The poller keeps `userPaused` apart from `forgeHalted`; the timer runs unless the user paused, so a forge-less server fetches on its timer. A lane that never attempted a fetch and is not running now shows the R7 band. Spec R1201-9 and R1201-11 and design D40 updated, one WHEN/THEN per scenario. Commit 23e757c8 (RED first: three new tests failed before, green after). |
| S1 | recording-git skips git's value-taking global options (`-C`, `-c`, `--git-dir`, `--work-tree`, `--namespace`) before identifying the verb; a new self-test refuses `-C x checkout`, `-c a=b worktree add`, `--git-dir=x reset` and allows `-C x fetch`. Commit a7cb3985. |
| S2 | Not changed (credential prompt stays proven by env pass-through and the kill timeout). |
| S3 | The remote-model.mjs header comment no longer contains the word "session"; it says no per-agent identity is shown. Included in 23e757c8. |
| S4 | Spec and design now share one phrasing: "at most 2 + 3×24 = 74 spawns per cold build". |
