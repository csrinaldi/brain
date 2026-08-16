# Tasks: Memory export scope (issue 701)

Confirmed: proposal.md Scope item 2 explicitly requests the staged-record
gate ("the staged-record gate reusing that predicate"). Spec Requirement 4
is kept as-is — not an unrequested inference, not split out.

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 350-550 (production only; this repo's JSDoc-per-function style runs verbose) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 → PR 2 → PR 3 (feature-branch-chain) |
| Delivery strategy | auto-chain |
| Chain strategy | feature-branch-chain |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | PR | Notes |
|------|------|----|-------|
| 1 | `lib/upstream-records.mjs` (I/O + pure predicate) + unit tests | PR 1 | base = tracker branch; no consumers wired |
| 2 | Wire dedup into `dualWriteRecords`/`share`, accounting, `cli.mjs`, mutations M1/M2a/M2b/M3/M4/M5/M8, integration test | PR 2 | base = PR 1 branch; closes Req. 1,2,3,5,6 |
| 3 | Staged-record gate + `pre-commit` wiring + operator message, mutations M6/M7 | PR 3 | base = PR 2 branch; closes Req. 4 |

## Phase 1: Predicate module (PR 1, base = tracker branch)

- [x] 1.1 `lib/upstream-records.mjs`: `parseLsTree(text)` — pure, `<yyyy-mm>-rec-<16 hex>.jsonl` regex → `{byId, byPath, unnamed}`.
- [x] 1.2 `resolveUpstreamRef({root, env, config, _spawn})` — env > config > `origin/HEAD` > `origin/main`; resolve via `git rev-parse --verify --quiet <ref>^{tree}`.
- [x] 1.3 `upstreamRecordEntries({root, env, config, _spawn})` — `git ls-tree -r -z --full-tree <ref> -- .memory/records`; returns `{ok:true,...}` or `{ok:false, ref, stated, reason}`.
- [x] 1.4 Test `parseLsTree`: per-record name, month-file→`unnamed`, nested path, empty tree, garbage.
- [x] 1.5 Test `resolveUpstreamRef`: fake `_spawn`, all 4 levels resolve/fail-through.
- [x] 1.6 Test `upstreamRecordEntries`: `ok:false` on no git binary, not-a-repo, no remote, non-zero `ls-tree`.

## Phase 2: Dedup wiring (PR 2, base = PR 1)

- [ ] 2.1 `engram.mjs#dualWriteRecords`: add `_upstreamRecordIds = upstreamRecordEntries`, call after secret scan / before dedup loop.
- [ ] 2.2 Widen decline: `existingIds.has(id) || seenInBatch.has(id) || upstream.byId.has(id)`.
- [ ] 2.3 Add `accounting.dedupedUpstream` (own bucket) + `accounting.upstreamScope = {applied, ref, stated, reason, entries, unnamed}`.
- [ ] 2.4 `engram.mjs#share`: add `_upstreamRecordIds` opt, thread into its `dualWriteRecords(...)` call.
- [ ] 2.5 `cli.mjs`: `applied:false`→stderr (ref+reason); `unnamed.length>0`→stderr (`memory:split-records`); `dedupedUpstream>0`→stdout.
- [ ] 2.6 i18n keys under `memory.share.*` (`en.mjs`, `es.mjs`) for the three messages.
- [ ] 2.7 **Deliberate** test: inject `_upstreamRecordIds: () => ({ok:false, reason:'no remote'})`; assert every candidate written AND `upstreamScope.applied===false` with non-empty reason (not the incidental `/fake/root` pass).
- [ ] 2.8 Test spec scenarios: upstream-present deduped, own-record dedup unchanged, genuinely-new (`issue=545`) still written.
- [ ] 2.9 Test `share`: seam-injected, asserts `_upstreamRecordIds` is actually threaded through.
- [ ] 2.10 Integration test (real git, temp repo): seed trunk record, branch, `share`, assert nothing untracked; `git merge`, assert record readable (Req. 5).
- [ ] 2.11 Mutation M1 (predicate inverted) — must redden new-record + re-export cases.
- [ ] 2.12 Mutation M2a (drop `ok:false` fallback) — must redden 2.7's write-everything assertion.
- [ ] 2.13 Mutation M2b (report `applied:true` on `ok:false`) — must redden 2.7's `applied===false` assertion only.
- [ ] 2.14 Mutation M3 (dedup narrowed to own records) — must redden every upstream-decline case.
- [ ] 2.15 **Mutation M4** (decline also unlinks local file) — must redden 2.10's reachability assertion; proves "stopped writing" ≠ "lost".
- [ ] 2.16 Mutation M5 (any `*.jsonl` accepted, id from suffix strip) — must redden the month-file case (1.4).
- [ ] 2.17 Mutation M8 (negative control: revert the filter) — `store.duplicates.test.mjs` + `resolve-index.integration.test.mjs` must stay green (0 red), proving they're orthogonal.

## Phase 3: Staged-record gate (PR 3, base = PR 2)

- [ ] 3.1 `staged-records-check.mjs`: pure `evaluateStagedRecords({staged, upstream})` → `{level, offending}`.
- [ ] 3.2 I/O wrapper: `git diff --cached --raw -z -- .memory/records`; reuse `upstreamRecordEntries`'s `byPath` oids (no second git call).
- [ ] 3.3 Rule: `dstOid === upstream.byPath.get(path)` → refuse; zero-oid deletion and divergent bytes → allow; `ok:false` → PASS + stderr notice.
- [ ] 3.4 **Operator message task**: on refusal, print the lossless remedy verbatim (`git restore --staged <paths>`, `rm` if untracked) — loud, mechanical, never silent.
- [ ] 3.5 Wire into `brain/scripts/hooks/pre-commit`, between the main/master block and `check-refs.mjs`.
- [ ] 3.6 i18n keys for gate messages (`en.mjs`, `es.mjs`).
- [ ] 3.7 Test `evaluateStagedRecords`: identical→refuse; divergent/new/deleted/empty-upstream→allow.
- [ ] 3.8 Mutation M6 (gate compares path, not OID) — must redden "divergent content allowed" case.
- [ ] 3.9 Mutation M7 (`ok:false` branch fails) — must redden lookup-unavailable-must-PASS case.

## Phase 4: Docs and follow-ups

- [ ] 4.1 Draft `brain-drafts/memory-format.note.draft.md` + `brain-drafts/README.md` (Tier 3 — draft only, never applied).
- [ ] 4.2 Retract the issue body's `index.jsonl` premise in the change record (proposal Scope item 3).
- [ ] 4.3 **Own task**: open a follow-up ticket for `post-merge`'s conflicted-merge unreachability; never apply `status:approved` (#124).
- [ ] 4.4 `npm run brain:repo:check` before each commit; no AI-attribution trailers.
