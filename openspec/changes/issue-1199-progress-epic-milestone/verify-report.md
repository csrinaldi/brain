---
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:eb712a267e1dfaa8210759a60dd4cc25d802db221b8865d4aa183c97ce72a148
verdict: pass-with-warnings
blockers: 0
critical_findings: 0
requirements: 8/8 compliant, 0/8 partial
scenarios: 33/33 compliant, 0/33 partial
test_command: "npm test"
test_exit_code: 0
test_output_hash: sha256:7cf923dd50b7814a6ad13b0a4ba9d573e872b931e493e512de88f2ccf65590e2
build_command: "npm run brain:repo:check && npm run brain:change:verify"
build_exit_code: 0
build_output_hash: sha256:c225d7a332e5b23e40176c0911cb85a374b8df99ea6c08d3a8d0a46076a65a39
---

# Verify Report: issue-1199-progress-epic-milestone

**Date**: 2026-10-02
**Verdict**: PASS WITH WARNINGS (0 CRITICAL, 2 WARNING, 3 SUGGESTION). The warnings are a silently wrong rollup number in one reachable failure window (W1, reproduced) and stale `ADR-0039` citations in the change artifacts (W2).
**Verified in**: `/home/gandalf/IA/brain-issue-1199`, branch `feat/issue-1199-featui-progress-per-change-and-a-rollup`, HEAD `30595c92`, 6 commits over `origin/main` (which includes merged #1257). Read-only: no source file edited, nothing committed. `evidence_revision` is the sha256 of `git diff origin/main...HEAD`.
**Mode**: Strict TDD. Full artifact set: proposal, spec, design, tasks. apply-progress could not be read (engram unavailable to this executor), so the TDD cycle table was replaced by a direct red-on-parent audit (below).

## Completeness

Tasks: 7 units, every checkbox ticked (1.1 to 6.5, 7.1 to 7.3), none open. Task state matches code state: every file named in the tasks exists; `ui/lib/tasks-list.mjs` is gone (moved with `git mv`, R059); `lib/ticket-hierarchy.mjs` does not exist.

## Build and tests (executed)

| Command | Result |
|---|---|
| `npm test` | exit 0. tests 7412, pass 7409, fail 0, cancelled 0, skipped 3, todo 0 (duration 37.7s). The 3 skips are pre-existing and unrelated. |
| `npm run brain:repo:check` | exit 0. "No prohibited references found." and "Artifact structure is valid." |
| `npm run brain:change:verify` | exit 0. repo + `node --check` over every changed script, "Validacion completa: repo + scripts". |
| Gated diff | **426** (expected 426). Forecast was about 350; budget is 1000 at `lite`. |

## TDD compliance: red on the parent of each commit

Method: a detached scratch worktree at `<commit>~1`, only the commit's added, modified or renamed `*.test.mjs` files checked out from the commit, `node --test` on each. The worktree was removed afterwards (`git worktree list` no longer shows it).

| Commit | Unit | Test files red on parent (fail count) | Verdict |
|---|---|---|---|
| `54ee28b1` | 1, grammar | `lib/tasks-list.test.mjs` (1, missing module), `ui/lib/provenance.test.mjs` (1, import path) | RED |
| `9cdbabb8` | 2, progress | `status/snapshot.test.mjs` (4), `ui/lib/sdd-model.test.mjs` (1) | RED |
| `06d18a98` | 3, card/drawer | `change-route` (3), `drawer-model` (1), `progress-view` (1), `app-smoke` (1), `progress-render` (2), `sdd-view` (1) | RED |
| `e6914c76` | 4, adapter | `status/hierarchy-adapter.test.mjs` (1, missing module) | RED |
| `f1d2693b` | 5, hierarchy section | `snapshot-cli` (1), `snapshot` (5), `server` (1) | RED |
| `30595c92` | 6, rollup | `lane-model` (2), `rollup-model` (1, missing module), `rollup-render` (4) | RED |

Two test files in `30595c92` are green on the parent, and that is correct: `hierarchy-adapter.test.mjs` changed one header comment (the citation re-point) and `test/publish-allowlist.e2e.test.mjs` changed the canary constant. Neither carries behaviour.

## Spec compliance matrix (R1199-1 to R1199-8)

Runtime evidence: every test below passed in the `npm test` run above.

| Req | Proving test (file:line, all under `brain/scripts/`) | Status |
|---|---|---|
| R1199-1 grammar | `lib/tasks-list.test.mjs:70` (3 of 5), `:74` (no-items, no numbers), `:81` (readers agree, CRLF), `:92` (one grammar in `status/**` and `ui/**`) | COMPLIANT |
| R1199-2 progress | `status/snapshot.test.mjs:161` (3/5 and `tasks.checked`), `:168` (missing, unreadable, no-items, three distinct reasons), `:181` (archived rows) | COMPLIANT |
| R1199-3 card and SDD view | `ui/lib/progress-view.test.mjs:16,24,37`, `ui/static/progress-render.test.mjs:49,61`, `ui/static/sdd-view.test.mjs`, `ui/static/app-smoke.test.mjs:228` | COMPLIANT |
| R1199-4 drawer at HEAD | `ui/change-route.test.mjs:165` (2/5 HEAD vs 3/5 tree), `:172`, `:177` (truncated, items still render), `ui/lib/drawer-model.test.mjs:93`, `progress-render.test.mjs:49` | COMPLIANT |
| R1199-5 adapter | `status/hierarchy-adapter.test.mjs:18` (exact keys), `:26` (children once, closed and nested), `:36` (levelSource), `:48` (closed null), `:54`, `:62` (parent-not-epic top level, no repeat), `:72`, `:83`, `:89` (no track/files, no `ticket-hierarchy.mjs`) | COMPLIANT |
| R1199-6 hierarchy section | `status/snapshot.test.mjs:695` (closed from `closedIssues`), `:711` (closed failure open-only), `:720` (pending / uncomputable), `:729` (one shape), `:739`; `status/snapshot-cli.test.mjs:138` (byte-identical `--json`); `ui/server.test.mjs:1397` (override); `ui/lib/lane-model.test.mjs:217,241` (`childrenOf` follows `children`, the detector); `ui/lib/rollup-model.test.mjs:34` | COMPLIANT |
| R1199-7 rollup | `ui/lib/rollup-model.test.mjs:43,48,52,61,65,71,76,80,85,95,100` (every row of the wording table, R3, R8, R9) | COMPLIANT (see W1) |
| R1199-8 heading and drawer | `ui/static/rollup-render.test.mjs:47,53,59,70,79` (heading complete and counting, drawer label and note, non-epic gets none, markup inert) | COMPLIANT |

No `innerHTML` and no Array method over `childNodes` in the new `app.js` lines; every string reaches the DOM through `el()`.

## Adapter contract (the shape agreed for #1251's resolver)

`status/hierarchy-adapter.mjs#hierarchyFromGraph` compared field by field.

| Contract | Code | Match |
|---|---|---|
| Return `{issues: Map<number, Entry>, divergences}` | `return { issues: entries, divergences }` | yes |
| `Entry` keys exactly `level, levelSource, parent, children, tracker, milestone, state, divergences` | the object literal has those eight keys and no other; test `:18` pins the sorted list | yes |
| `level` `'epic'` or `'ticket'`, `null` when unreadable | `unreadable ? null : kind === 'epic' ? 'epic' : 'ticket'`; unreadable is `ok === false` only | yes |
| `levelSource` `'block'` / `'default'` / `null` | same expression shape | yes |
| `parent`, `tracker` copied; `milestone` null | `n.parent ?? null`, `n.tracker ?? null`, `null` | yes |
| `state` `'open'` / `'closed'` / `null` | `ENTRY_STATES.has(n.state) ? n.state : null` | yes |
| `children` ascending, closed and nested included, computed once | built from all entries, sorted with `byNumber` | yes |
| Divergence `{source, field, expected, found}` per issue; `parent-ambiguous` is `prose`, others `block` | `sourceOf`, mapped from `declarationDivergences` (open and closed), never re-derived | yes |
| Cross-issue divergence at top level naming issues | `{issues:[child, parent], field:'parent', source:'graph', expected:'parent-not-epic', found}` | yes |
| Unresolved closed row has no entry | never added to `all` | yes |
| Never reads `track`, `blocks`, `needs`, `files` | test `:89` scans the source; confirmed by reading it | yes |

`brain/scripts/lib/ticket-hierarchy.mjs` does NOT exist. No file under `vcs/`, no adapter, `cli.mjs` or `exec.mjs` appears in `git diff --name-only origin/main...HEAD`.

## R3, R8, R9 wording and counting

| Rule | Code | Evidence |
|---|---|---|
| Direct children only (R9) | `states` maps `entry.children` once; a nested epic counts once by its own state | `rollup-model.test.mjs:95` |
| Unknown counted apart, never open nor closed (R3) | three separate filters; suffix " · n state unknown" | `:48` |
| "counting closed children…" while closed is pending | `uncountedWords`, `closed`/`total` are `null` | `:52` |
| "closed children unknown (reason)" on failure with no data | same function | `:65` |
| "no children declared" only when counted and total is 0 | `closed === null` is tested first, so pending with no children reads "counting…" | `:85` |
| Never a bare % and never `0/0` | no percentage is computed anywhere; `null` numbers while uncounted | `:52,65,76` |

## Open risk from apply: confirmed, WARNING W1

**Claim**: `readForge` can find `forgeLoad.closed` `complete` while reading the cached closed list throws (`snapshot.mjs:467-476`; the `else` branch there sets `closedIssues = uncomputable(...)` but leaves `closedEntry` as the poller's `complete`). `hierarchy` is then open-only, and the rollup reads under the complete wording.

**Reproduced** with `/tmp/claude-1000/-home-gandalf-IA-brain/f80e7b18-3c95-4821-a98d-a3668bc37feb/scratchpad/repro.mjs`: a port whose `issueList({state:'closed'})` throws, called with the server-path option `forgeLoad: {open: complete, closed: complete}`, and an epic #878 with two open children.

```
closedIssues {"ok":false,"reason":"the closed-issue list could not be read: cache unreadable"}
LABEL: 0 / 2 children closed
```

That is a count nobody took, shown as a fact, which is the "silently wrong number" the proposal's R3 forbids. The CLI path is safe (its own `closedEntry` becomes `failed` with no `lastCompleteAt`). Only the server path with a `complete` entry is exposed, so the window is narrow, but the failure is unannounced and no test covers it. The design's Risks section recorded it as "not closed here", so it is a known gap, not a surprise.

**Minimal fix (not applied)**:
1. `readHierarchy(graph, closedIssues)` adds `closedRead: closedIssues.ok ? {ok:true} : {ok:false, reason: closedIssues.reason}` to the section value (JSON-safe, one key).
2. In `epicRollup`, `counted = hasClosedData(load) && h.value.closedRead.ok`, and when the lane says data but `closedRead` is not ok, use `load = {state:'failed', reason: closedRead.reason, lastCompleteAt: null}`. The existing `uncountedWords` then yields "closed children unknown (the closed-issue list could not be read: cache unreadable)". The reason comes from `closedIssues`, the data actually present, not from `forgeLoad`.
3. One RED test in `snapshot.test.mjs` (the repro above, asserting `closedRead.ok === false`) and one in `rollup-model.test.mjs` (a `complete` load with `closedRead` not ok reads "closed children unknown" and never "0 /"). The spec's R1199-6 shape needs the extra key stated.

## Mutations (each reverted with `git checkout -- <file>`, `git status` clean afterwards)

| # | Mutation | Test result | Killed |
|---|---|---|---|
| a | `countTasks`/`taskItems` treat only lowercase `x` as done (`- [X]` miscounted) | `lib/tasks-list.test.mjs`: 2 failures | yes |
| b | rollup `open` counts every non-closed child (unknown counted as open) | `ui/lib/rollup-model.test.mjs`: 1 failure | yes |
| c | `childrenOf` filters nodes by `parent` instead of reading `children` | `ui/lib/lane-model.test.mjs`: 1 failure (the `:241` detector) | yes |
| d | `missing` and `unreadable` share one reason | `status/snapshot.test.mjs`: 2 failures | yes |

## Flakiness

`taskset -c 0`, 10 runs each: `ui/static/rollup-render.test.mjs` 10/10, `ui/static/progress-render.test.mjs` 10/10, `ui/lib/lane-model.test.mjs` 10/10. No timing constants in the new tests.

## Design coherence and deviations

| Decision | Followed | Note |
|---|---|---|
| D50 one grammar in `lib/tasks-list.mjs`, moved with `git mv` | yes | `deriveTasks` now reads `taskItems`; the stricter CRLF split is the only behaviour change, covered by `:81` |
| D51 `progress` from one read, `exists` before read | yes | `missing` vs `unreadable` distinct by value and by sentence |
| D52 drawer counts its own HEAD text | yes | truncated gives no total |
| D59 adapter | yes | table above |
| D60 `hierarchy` section and server override | yes | `closedUnresolved` copied from `closedIssues` |
| D61 `childrenOf(graph, hierarchy, issue)` | yes | `buildEpicGrouping` inversion kept, named residual |
| D62 UI | yes | `el()` only |
| Reconciliation with #1257 | yes | `epicRollup` takes the `forgeLoad` section and reads `.value.closed` |

Judgement on the four deviations:

1. **Citations re-pointed from ADR-0039 to #1251 (in code and tests).** Correct. `brain/project/decisions/` holds no ADR-0039, so the old citation pointed at nothing. No `ADR-0039` string remains under `brain/scripts` or `test`. But the change artifacts still cite it (W2).
2. **Canary raised 9.4 to 9.5 MB.** Justified. The unpacked size is 9.400 MB, so `mb < 9.4` could no longer hold; a 0.1 step with a written reason is the established pattern in that line (#1218, #1201, #1257). The growth is the adapter, two modules and their suites, no bulk.
3. **`progressLabel(null)` returns "no progress was read · <source>".** Acceptable and safe: it never prints a number. The spec table does not name this wording (S1).
4. **Existing tests that changed.** All mechanical and in the design's own list: `provenance.test.mjs` import path, `lane-model.test.mjs` call signature, `sdd-model.test.mjs` pass-through, `app-smoke.test.mjs:228` ("tasks 1/2" becomes "tasks 1 / 2 · working tree", which R1199-3 requires), the canary. None weakens an assertion.

## Issues

### CRITICAL
None.

### WARNING
- **W1. A `complete` closed lane over an unreadable closed section yields "0 / n children closed" over open children only.** Reproduced above; narrow window (server path, cache read throws after the poller marked the lane complete); minimal fix above. Recommended before archive, or file as a follow-up with the risk entry copied into the issue.
- **W2. Stale `ADR-0039` citations in the change artifacts.** `proposal.md:42,63,107`, `spec.md:166` (R1199-5's title) and `design.md:77` name an ADR that does not exist; the code and tests were already re-pointed to #1251. Correct the wording in a follow-up commit to the artifacts (they are the acceptance text for R1199-5).

### SUGGESTION
- **S1.** Add the `progressLabel(null)` wording ("no progress was read") to the spec's progress wording table, so the deviation has a requirement behind it.
- **S2.** `rollupLabel` reads "no children declared" when the list is complete and there are no children, even if `closedUnresolved` is non-empty (those rows might be children). The spec table gives no unresolved suffix for that row, so this is compliant, but "more children may exist" would be the honest wording.
- **S3.** The header comment of `lib/tasks-list.mjs` still carries the Q2 paragraph about `git blame` attribution from the old module; it is accurate for `parseTasksList` but now sits above the unrelated grammar. Optional tidy.

## Verdict

PASS WITH WARNINGS. All eight requirements and all 33 scenarios are proven by passing tests; red-on-parent holds for all six commits; four mutations are killed; flakiness 30/30. W1 is the one real correctness gap, with a reproduction and a small fix; W2 is documentation drift. Neither blocks archive by the SDD rules, but W1 should be fixed or filed first.

## Resolution

| Finding | Resolution |
|---|---|
| W1 | Fixed. `readHierarchy` adds `closedRead: {ok:true} \| {ok:false, reason}`; `epicRollup` counts only when `hasClosedData(lane) && closedRead.ok`, otherwise it reads "closed children unknown (`<reason>`)". `hierarchyOf` reads a section without `closedRead` as not read. RED first in `status/snapshot.test.mjs` and `ui/lib/rollup-model.test.mjs`; the repro now prints "closed children unknown (...) · 2 open". Spec R1199-6 shape, rollup rules and wording table updated, plus one scenario. Class sweep: `epicRollup` is the only consumer that trusted a lane's `complete`; banners, `lane-model` and the drawer do not read `forgeLoad`. |
| W2 | Fixed. The five stale `ADR-0039` citations read "the ticket-hierarchy resolver contract (#1251; ADR-0039 in draft)". |
| S1 | Done. The progress wording table names `progressLabel(null)` as "no progress was read". |
| S2 | Done. A complete list with no children and unresolved closed issues reads "no children declared; N closed issue(s) could not be read". RED first. |
| S3 | Done. The `git blame` paragraph moved from the module header to `parseTasksList`'s doc comment. |
