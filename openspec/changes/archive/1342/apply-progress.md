# Apply progress — issue 1342 (chips-and-states-followups)

Mode: Strict TDD. All tasks in tasks.md are done (6/6 groups, 14 tasks).

## TDD cycle evidence

| Issue | Spec | RED | GREEN | Mutation that fails a test |
|---|---|---|---|---|
| #1298 | R1342-1 | tab-source.test.mjs: missing export, then unknown state | allow-list `READABLE_STATES` | deny-list restored: R1342-1 test fails |
| #1303 | R1342-4 | inflight-model.test.mjs 2 failures; state-vocab idle test | `idle` state in `missingSources`, notices, `describeMissing`, `hierarchyOf` | `pendingFrom` drops `idle`: snapshot #1262 test fails (loop now covers hierarchy, localWorktrees) |
| #1360 | R1342-5 | state-vocab.test.mjs failed-with-lastCompleteAt lane | `staleSuffix` shared | suffix removed from Ready to close: test fails |
| #1342 | R1342-2, R1342-3 | roadmap-model + views-owned tests; label test | `roadmapRow` reason, `renderRoadmapRow` title, `approval-label.mjs` | `stateReason: unreadReason`: roadmap test fails; literal back in epic-graph: R1342-3 test fails |
| #1365 | R1342-6, R1342-7 | change-route mixed test; tokens contrast + rule scan | per-thread wording; `--verdict-*` | single-phrase branch forced: mixed test fails; two verdicts share a colour: tokens test fails |

## Verification
- `npm test`: 8440 tests, 8436 pass, 3 skipped, 1 fail. The failure is `test/retired-test-paths.e2e.test.mjs` #1076 (regeneration from published tags) and fails identically on main at the same commit; not caused by this change.
- `npm run brain:repo:check`, `npm run brain:nav`: clean.
- `test/publish-allowlist.e2e.test.mjs`: 10/10; tarball 4.00 MB, 362 files, canary 4.4 MB (not raised).

## Deviations
None from design. No change dir named in #1342's comment was archived; all were edited in place.
