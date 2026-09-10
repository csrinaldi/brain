# Apply progress — #805 a writer for `supersedes`

Batch 1 of 1 (no previous apply-progress). Worktree `/home/gandalf/IA/brain-issue-805`, branch
`fix/issue-805-fixmemory-corrections-must-carry-superse`, base `51ff915f` (origin/main).
STRICT TDD MODE, `npm test` (node:test). All local commits, no push, no PR.

## Section 0 — live measurements (recorded before any code)

| # | measurement | result |
|---|---|---|
| 0.1 | refusal shape (`--issue abc` under `BRAIN_MEMORY_TEST_ROOT`) | stderr: `memory/cli: plainfiles.save() failed — --issue must be an issue NUMBER; got NaN. ...`; exit 1. Confirms A7's shape (`memory/cli: <backend>.save() failed — <message>`, exit 1) that every `--supersedes` refusal also produces. |
| 0.2 | `upstreamRecordEntries({root})` on a non-git temp dir | `{ok:false, ref:null, stated:false, reason:"no upstream ref resolved (tried origin/HEAD, origin/main)"}` — byte-identical to design.md's quote. |
| 0.3 | `SUPERSEDES_ID_RE` against `buildRecord(...).id` | `buildRecord({...}).id` → `"rec-6b75c50c032ba137"`, matches `/^rec-[0-9a-f]{16}$/` → `true`. |
| 0.4 | `planAmendment` against the Unit 6 draft | `ok:true`; one act, `state:"pending"`, `counts:{f:1,r:0,k:1}` — anchor occurs exactly once in `memory-backend-contract.md:94-95`, confirmed via `countOccurrences` too. |
| 0.5 | real counted diff (`parseDiffNumstat` against `brain.config.json`'s `governance.ignoreList`, `git diff --numstat 51ff915f..HEAD`) | **133** counted lines (vs. the ~106 forecast). Still Low risk, well under the 400-line budget; single PR holds. |
| 0.6 | `npm test` baseline | 5139 tests, 5139 pass, 0 fail (both `i18n/coverage.test.mjs` and `capture-reachable.test.mjs` green in that baseline). Final run after all units: **5173/5173 pass, 0 fail**. |

## TDD Cycle Evidence

| Unit | file(s) | RED | GREEN | REFACTOR |
|---|---|---|---|---|
| 1 | `lib/supersedes.mjs` + `.test.mjs` | confirmed — `ERR_MODULE_NOT_FOUND` before the module existed | 15/15 pass after `classifySupersedes`/`SUPERSEDES_ID_RE` written | none needed |
| 2 | `lib/format.test.mjs` (pin) | RED-as-absent (assertions target already-shipped `format.mjs` behaviour) | 38/38 pass, **no `format.mjs` edit** — confirmed pin-only | none |
| 3 | `backends/plainfiles.mjs` + `.save.test.mjs` | confirmed — 4/18 new assertions failed before the gate existed (malformed/not-in-store/could-not-verify refusals never fired) | 18/18 pass after the gate + two seams + i18n catalog entries | none needed |
| 4 | `cli.mjs` + `cli.save-search.test.mjs` + `engram.save-search-unsupported.test.mjs` | confirmed — 4/8 new CLI assertions failed (no arity guards, `--supersedes` unparsed) | 8/8 CLI pass, 2/2 engram pass, i18n coverage + capture-reachable tripwires stayed green | none needed |
| 5 | `lib/supersedes.integration.test.mjs` | task 5.2's own prediction — "no new production code expected" confirmed: 4/5 passed on first run against Units 1/3/4 as built; 1 failure was a **test-fixture** gap (`memory:audit` needs an existing `.memory/records/` dir), fixed by `mkdirSync` in the fixture, not production code | 5/5 pass | none |
| 6 | `brain-drafts/memory-backend-contract.draft.md` | N/A — doc draft, no test file (per spec/tasks) | verified via direct `planAmendment` call (0.4) — `ok:true`, `pending` | none |

## Completed tasks

- [x] 0.1–0.6 — all six live measurements (table above)
- [x] 1.1 RED, 1.2 GREEN — `lib/supersedes.mjs` + `lib/supersedes.test.mjs` (15 tests)
- [x] 2.1 RED→pin — `lib/format.test.mjs` extended (2 new tests), confirmed no `format.mjs` edit
- [x] 3.1 RED, 3.2 GREEN — `backends/plainfiles.mjs` gate + two seams (`_readRecordIds`, `_upstreamRecordEntries`), `backends/plainfiles.save.test.mjs` extended (6 new tests)
- [x] 4.1 RED, 4.2 RED, 4.3 pin, 4.4 GREEN, 4.5 GREEN — `cli.mjs` two arity guards, `engram.mjs`'s catalog message named via `en.mjs`/`es.mjs`, 6 new i18n keys both locales, `cli.save-search.test.mjs` extended (4 new tests), `engram.save-search-unsupported.test.mjs` extended (1 new test)
- [x] 5.1 RED, 5.2 GREEN — `lib/supersedes.integration.test.mjs` (new, 5 tests): upstream-only accepted, not-in-store refused, degraded-upstream (origin removed) refused, a 3-deep chain accepted and all readable/indexed, the epic's 6.1 scenario (`coverage.supersedes` 0→1, `supersedes` field survives `memory:reindex`)
- [x] 6.1, 6.2 — `brain-drafts/memory-backend-contract.draft.md` created and verified read-only via `planAmendment` (0.4)

### Not done in this batch (explicitly out of scope for apply, per tasks.md)

- [ ] W1–W6 (wrap-up) — full `npm test` before-commit already run per-commit (see below); the rest (`memory:save --issue 805`, ticking epic task 2.1, fresh-context review, opening the PR) is left for the orchestrator, as instructed.

## Deviations from design/tasks

1. **i18n catalog edits landed in Unit 3's commit, not Unit 4's.** `plainfiles.mjs`'s gate calls `t(key, detail)` with the three refusal keys and the `configError` warn key — writing the gate without those keys existing would leave the refusal message broken/untranslated. All 6 new keys plus the `engramUnsupported` clause were authored together with the gate so the commit is internally consistent; Unit 4's commit (`3a58b9aa`) therefore contains only the CLI-layer code (arity guards, `cli.mjs`, `cli.save-search.test.mjs`, `engram.save-search-unsupported.test.mjs`) and no further catalog diff. Functionally equivalent to the plan; only the commit boundary moved earlier.
2. **Unit 5's `memory:audit` fixture needed an explicit `mkdirSync('.memory/records')` before the baseline call.** `audit-io.mjs#readRecordLines` throws `records dir not found` on a fresh root with zero saves — not a production bug (a store that has never been written to has, correctly, never been audited), just a fixture-setup fact the task's Section 0 didn't anticipate. No production code changed.
3. **Measured correction to task 5.1's phrasing** — "B's `**Supersede:**` line survives a `memory:reindex` round trip". `**Supersede:**` is `provenance.mjs#SUPERSEDE_MARKER`, rendered only by `renderProvenance()` on the engram-import materialization path (`engram-import.mjs:70`) — a path design.md explicitly keeps UNCHANGED and out of scope for this writer (`plainfiles.mjs`/`cli.mjs` never call `renderProvenance`). The integration test instead asserts the raw `supersedes` field survives in both `.memory/records/*.jsonl` and the rebuilt `.memory/index.jsonl` after `npm run memory:reindex` — the durable fact this writer actually owns. Noted here rather than silently reinterpreted.

## Commits (local, no push)

| SHA | message |
|---|---|
| `91fbbccd` | `feat(memory): add classifySupersedes, the pure supersedes-id classifier (#805)` |
| `1f71df8c` | `feat(memory): refuse an unverifiable supersedes id before any write (#805)` |
| `3a58b9aa` | `feat(memory): enforce a single --supersedes id in the CLI and name it in engram's refusal (#805)` |
| `e60e5846` | `test(memory): integration-cover supersedes against a real bare origin, chains, and audit coverage (#805)` |
| `1a5f87c8` | `docs(brain-drafts): draft the record-first correction sequence for #805 promotion` |

No AI attribution trailers — the repo's `commit-msg` hook hard-refuses them (Tier 3, `agent-authorities.md`); confirmed live (first commit attempt with a trailer was rejected).

## Files changed

| File | Action | What |
|---|---|---|
| `brain/scripts/memory/lib/supersedes.mjs` | Created | `SUPERSEDES_ID_RE` + `classifySupersedes` — pure classifier |
| `brain/scripts/memory/lib/supersedes.test.mjs` | Created | 15 unit tests |
| `brain/scripts/memory/lib/format.test.mjs` | Modified | 2 pin tests (no `format.mjs` edit) |
| `brain/scripts/memory/backends/plainfiles.mjs` | Modified | `supersedes` in opts; two new seams; the gate; `recordsDir` hoisted |
| `brain/scripts/memory/backends/plainfiles.save.test.mjs` | Modified | 6 new tests |
| `brain/scripts/i18n/en.mjs`, `es.mjs` | Modified | 6 new keys + `engramUnsupported` clause, both locales |
| `brain/scripts/memory/cli.mjs` | Modified | two arity guards, `supersedes` forwarded unparsed |
| `brain/scripts/memory/cli.save-search.test.mjs` | Modified | 4 new tests |
| `brain/scripts/memory/backends/engram.save-search-unsupported.test.mjs` | Modified | 1 new test |
| `brain/scripts/memory/lib/supersedes.integration.test.mjs` | Created | 5 integration tests, real bare origin |
| `openspec/changes/issue-805-supersedes-writer/brain-drafts/memory-backend-contract.draft.md` | Created | doctrine draft, excluded from counted diff |

## Test results

- Focused commands (all green individually, see TDD table): `supersedes.test.mjs` (15), `format.test.mjs` (38), `plainfiles.save.test.mjs` (18), `cli.save-search.test.mjs` (8), `engram.save-search-unsupported.test.mjs` (2) + `i18n/coverage.test.mjs` (in the shared run) + `capture-reachable.test.mjs` (in the shared run), `supersedes.integration.test.mjs` (5).
- Full `npm test`: baseline **5139/5139**, final **5173/5173** (+34), 0 fail, run after every commit.

## Counted diff

**133** lines (additions + deletions, `brain.config.json`'s `governance.ignoreList` applied — excludes `**/*.test.mjs` and `openspec/changes/**`), vs. the design's ~106 forecast. Still single-PR, Low risk (400-line budget).

## Review Workload / delivery

Delivery strategy `ask-on-risk` resolved to single PR by `sdd-tasks` (forecast ~106, Low risk, `Decision needed before apply: No`). The real 133-line count confirms that decision still holds — no chaining needed.

## Next

Ready for wrap-up (W1–W6, orchestrator-owned per the launch prompt) and `sdd-verify`.
