---
schema: gentle-ai.verify-result/v1
evidence_revision: git:6d9e534abd554bae6d8c43392c59228c77e27a54
verdict: pass-with-warnings
blockers: 0
critical_findings: 0
requirements: 11/11 compliant
scenarios: all mapped, 0 missing (2 notes: W1 meta.poller was the apply agent's misreport, not a defect; W2 the spec's "Part of #878" scenario is not the grammar the code reads)
test_command: "npm test"
test_exit_code: 0
test_output_hash: sha256:not-captured
build_command: "npm run brain:repo:check && npm run brain:change:verify"
build_exit_code: 0
build_output_hash: sha256:not-captured
---

# Verify Report: issue-1257-nonblocking-forge-reads

**Verdict**: PASS WITH WARNINGS (0 CRITICAL, 3 WARNING, 4 SUGGESTION).
**Verified in**: /home/gandalf/IA/brain-issue-1257, HEAD 6d9e534abd554bae6d8c43392c59228c77e27a54, 8 commits over origin/main. Read-only: no code edited, nothing committed, no git stash; every mutation reverted with git checkout -- <file>, git status shows only the untracked change dir.
**Mode**: Strict TDD.

## Runs
- npm test: 7354 tests, 7351 pass, 0 fail, 3 skipped.
- npm run brain:repo:check: clean. npm run brain:change:verify: "Validacion completa: repo + scripts", exit 0.
- Gated diff: 841 (matches expected; budget 1000 at `lite`). tasks.md 9.4 still says 774 (W3).
- Flakiness, taskset -c 0, 10x each: server.test.mjs 0/10, poller.test.mjs 0/10, server-remote.test.mjs 0/10, forge-thread.test.mjs 0/10 failures.
- Untouched: `git diff origin/main...HEAD --stat` holds no path under brain/core/, and neither brain/scripts/vcs/cli.mjs nor brain/scripts/vcs/lib/exec.mjs.

## Red-on-parent (detached scratch worktree, parent checkout + commit's test files, removed afterwards)
| Commit | Parent run | Verdict |
|---|---|---|
| 7c8594a9 issueList state/body/updatedSince | contract.test.mjs 4 fail, providers.test.mjs 4 fail | RED |
| 700eb95d closed lane | poller.test.mjs 9 fail | RED |
| 42973831 loading band | banners.test.mjs 2 fail, app-smoke.test.mjs 1 fail | RED |
| e12b0d59 threads/probe | forge-thread.test.mjs fails (module absent); server.test.mjs 4 fail: the probe (51), first snapshot held (52), closed loading (54), snapshot mirrors poller (55). "the stream syncs while a forge call is held" (53) passes on parent: a guard, not a red | RED (probe included) |
| 6d9e534a maxBuffer / --jq | providers.test.mjs 6 fail | RED |

## Requirement compliance
| Req | Proving test | Result |
|---|---|---|
| R1257-1 state/body normalized in adapters (R12) | contract.test.mjs "issueList (contract): state and body distinguish cannot-see (null) from a read value" (both adapters, fixtures github/gitlab-issueList-state.json; opened->open, description->body at :634); providers.test.mjs:1984, :1999 | COMPLIANT |
| R1257-2 six-key lock | contract.test.mjs issueList contract tests | COMPLIANT |
| R1257-3 pagination is the code's | providers.test.mjs:249 | COMPLIANT |
| R1257-4 brain-draft, core untouched | diff holds no brain/core path; brain-drafts/ present | COMPLIANT |
| R1257-5 updatedSince | providers.test.mjs:268, :280, :298 | COMPLIANT |
| R1257-6 bodies/state from the list, issueView fallback | snapshot.test.mjs:537, :544, :551, :560 | COMPLIANT |
| R1257-7 closedIssues | snapshot.test.mjs:601, :609, :619, :627; snapshot-cli.test.mjs:108, :113 | COMPLIANT (W2 on one scenario's input) |
| R1257-8 forgeLoad | poller.test.mjs:797-856, :1006, :1022; snapshot.test.mjs:571, :580; server.test.mjs:1363 (deep-equal, status frame) | COMPLIANT |
| R1257-9 no first render waits | server.test.mjs:1259 (probe), :1311, :1328, :1345; forge-thread.test.mjs:74, :91; poller.test.mjs:864, :879; banners.test.mjs:229, :242; snapshot.test.mjs:587; app-smoke.test.mjs:573 | COMPLIANT |
| R1257-10 closed lane | poller.test.mjs:911-1046; forge-cache.test.mjs:82, :94, :103 | COMPLIANT |
| R1257-11 capped null-body fallback | poller.test.mjs:749, :758, :777, :786 | COMPLIANT |

## Cross-session contract with brain-ad (#1251, ADR-0039)
- (a) issueList `state: 'open'|'closed'|null`, `body: string|null`; absent key -> null, present JSON null -> '' (R12). github.mjs `state: r.state === 'open' || r.state === 'closed' ? r.state : null`, `body: 'body' in r ? (r.body ?? '') : null`; gitlab.mjs `mapGitlabIssueState` + `'description' in r`. Pinned on both adapters by the contract test over derived fixtures. COMPLIANT.
- (b) forgeLoad in BOTH places: COMPLIANT. The apply agent's report was incomplete. `poller.state()` (poller.mjs:139) carries `forgeLoad: forgeLoad()`, and server.mjs:170 builds `meta` as `{ project, watcher, poller: poller.state(), servedBranch }`, so `meta.poller.forgeLoad` exists as the bare `{open, closed}`. The snapshot top level carries `forgeLoad` as `field({open, closed})` = `{ok, value:{open, closed}}` (snapshot.mjs:468, :518). server.test.mjs:1363 asserts `current.forgeLoad` deep-equals `meta.poller.forgeLoad` in the status frame. Shape: open `pending|complete|failed`, closed `pending|complete|failed|disabled`; each `{state, at, reason?}`. `failed` additionally carries `lastCompleteAt` (poller.mjs:128, :214), required by spec Fixed values (spec.md:37) and additive to the agreed contract. brain-ad must read `meta.poller.forgeLoad.<lane>` bare and the snapshot's as `.value.<lane>`.
- (c) No provider-name branch added outside axes/vcs/adapters (the threads load `getVcs` by module path, no gh/glab). vcs/cli.mjs and vcs/lib/exec.mjs are untouched. COMPLIANT.

## R11 (no first render waits on the forge)
- Atomics probe: server.test.mjs:1259 with ui/test-support/blocking-forge-adapter.mjs. Fails on the parent of e12b0d59 (see table), passes at HEAD. `/api/snapshot` and the SSE sync are served while a forge call is held and sections are `pending` (server.test.mjs:1311, :1328). The SSE test is a guard on the parent (already passes), the snapshot one is red.

## Mutations (each reverted; git status clean of code changes)
| Mutation | Result |
|---|---|
| a. thread seam bypassed in main() (`threadResolve = null`) | probe test 51 FAILS |
| b. pending treated as failed in failedSections | banners tests 26, 27 FAIL |
| c. closed delta loses `complete` (delta runs only) | poller tests 51, 52 FAIL (coarser variant, all runs: 51, 52, 54) |
| d. maxBuffer dropped from ghListRaw (github issueList path) | providers tests 156, 157, 161 FAIL |
| e. present-null body coerced to null | contract test 20 FAILS |

## Class sweep
- Spawn list reads in adapters: github list verbs (issueList, mrList, prReviews, labelEvents, prCommits, labelList, issueRelations) go through ghListRaw/ghListJson with LIST_MAX_BUFFER; gitlab issueList and mrList pass it to runJson. Unprotected remaining reads: github `commits/<sha>/pulls` (--paginate, bare gh(), github.mjs:600), `actions/runs?per_page=100` (:1115, :682), `check-runs` (:348, :570), gitlab `commits/<sha>/statuses` (per_page=1) and `protected_branches`. Judgment on commit-pulls: one commit maps to a handful of PRs, bounded in practice, and the verb is not on the UI path (S1). `actions/runs` at per_page=100 is the only one that could approach 1 MiB (S1).
- Forge reads on the server's main thread: none in production. `main()` routes the live port through two forge threads; the only forge-shaped work left on the main thread at startup is `resolveForgeSource()` (git `originIdentity` spawn plus `getVcs()` import), once, before listen, and no network (S2). With `_resolveForgeSource` injected alone (tests) or `vcs` injected, the stub runs on the main thread by design.

## Design / deviations in tasks.md
- Non-string body (`null`/`undefined`) takes the issueView fallback: OK, equals the spec for every conforming port.
- Threads only when `_forgeThreadResolve` is given or `_resolveForgeSource` is not injected: OK, a test-safety rule; the probe exercises the real seam via `_forgeThreadResolve`.
- forgeLoad passed to buildSnapshot only without an injected `vcs`; `at` = run start; fullOverdue after a failed periodic full re-list; pending reaches the page via `saidUnavailable`: OK, consistent with D64-D68.
- "Part of #878" scenario: see W2.

## Issues
CRITICAL: none.

WARNING
- W1. The apply agent reported forgeLoad as snapshot-only. It is in `meta.poller` too (poller.state(), server.mjs:170) and pinned by server.test.mjs:1363. No code change needed; the apply-progress note is wrong and should not propagate to brain-ad.
- W2. spec.md scenario "A closed row without a body is unresolved, not dropped silently" uses body `Part of #878` and expects `parent: 878`. The prose grammar reads only a line-initial `Parent: #N`, so the test uses `Parent: #878 (the epic)`. The spec text and its test disagree; fix the spec wording at archive (the code is right).
- W3. tasks.md 9.4 records 774 gated lines over 7 commits; the measured figure at HEAD is 841 over 8 commits (the maxBuffer/--jq commit added the rest). Under the 1000 budget; update the record.

SUGGESTION
- S1. Give `actions/runs?per_page=100` and `commits/<sha>/pulls` the LIST_MAX_BUFFER ceiling in a follow-up (class completeness; not on the UI path).
- S2. `resolveForgeSource()` still runs one git spawn on the main thread at startup; harmless, document it in D63 if kept.
- S3. GitLab ENOBUFS has no readable reason (only github's ghListRaw maps it); symmetrical handling would keep the adapters parallel.
- S4. Test 53 (stream syncs while held) passes on the parent, so only the snapshot and probe tests are red for R11; consider noting it as a guard in tasks.md.

## Next
sdd-archive after W2 and W3 are corrected in the artifacts (no code change required).

## Resolution

| Finding | Resolution |
|---|---|
| W1 | No change. The apply report was wrong: `forgeLoad` is in `meta.poller` as well as the snapshot top level, pinned by server.test.mjs:1363. |
| W2 | spec.md scenario "A closed row without a body" now uses a line-initial `Parent: #878 (the epic)`, the grammar the code and the test use. One WHEN, one THEN. |
| W3 | tasks.md 9.4 now records 859 gated lines over 9 work-unit commits (10 with the artifacts commit). |
| S1 | `commits/<sha>/pulls`, `actions/runs?per_page=100` and `gh run list` now go through the list helpers (LIST_MAX_BUFFER). A spy test pins each call, and a guard test scans github.mjs for any `--paginate`, `per_page` or `'list'` call made outside `ghListRaw`/`ghListJson`. |
| S2 | design.md D63 documents the single startup `originIdentity` git spawn and the `getVcs` import before listen: both local, no network. |
| S3 | GitLab issueList and mrList go through `glabListJson`: ENOBUFS reads "the list exceeded 64 MiB (ENOBUFS)", mirroring GitHub. Pinned by a test with a fake `error.code === 'ENOBUFS'`. |
| S4 | tasks.md marks the "stream syncs while a forge call is held" test as a GUARD (passes on the parent). |
