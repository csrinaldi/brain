# Apply progress — #1115 (folds #1189)

Strict TDD. Single test files run with `node --import ./brain/scripts/lib/test-brain-home.mjs --test <file>`.
Rulings Q1-Q4 (2026-10-05) are folded into spec/design/tasks first (commit `docs(openspec): record the Q1-Q4 rulings…`).

## T0, T1b, T1 — read-only verify, store, adapters, i18n keys
| step | RED (before code) | GREEN |
|---|---|---|
| 1b.1-2 `store.verify-index.test.mjs` | `SyntaxError: The requested module './store.mjs' does not provide an export named 'verifyIndex'` (1 file failed) | 6/6 pass, plus `store.test.mjs` 26/26 (rebuildIndex refactor onto `buildIndex` is behaviour-neutral) |
| 1.1-1.3 `engram.hydrate.test.mjs` bulk | 6 of 16 failed (`not ok 10..15`, every bulk case) | 16/16; engram suite 114 tests, 0 fail |
| 1b.3-4, 1.4-1.5 `plainfiles.hydrate.test.mjs` | the file failed to load (no `hydrate` export) | 6/6; plainfiles suite 68/68 |
| 1.6 i18n (`coverage.test.mjs` new #1115 tests + re-pinned keys) | 5 of 52 failed | 52/52; `i18n/*.test.mjs` 75/75 |

## T2 — dispatcher
| step | RED | GREEN |
|---|---|---|
| 2.1 `cli.hydrate.test.mjs` | import error, then (with `EXIT_DEFERRED` added) 9 of 11 failed: hydrate/import/verify/exit 6/refusals | 11/11 |
| 2.5 pins (`backend-fallback` import → exit 6, `backend-declaration` lists + `hydrate`, `backend-selection` no `importMemory` map and `!FALLBACK_OPS.includes('hydrate')`) | n/a (pins updated with the behaviour) | `memory/*.test.mjs` + `backend-selection` 293/293 |
| `chunk-boundary.test.mjs` line-keyed allowlist | 1 failed (cli.mjs line 792 became 797) | re-keyed, 15/15 |

## T3 — post-merge
| step | RED | GREEN |
|---|---|---|
| 3.1 `hooks/post-merge.op.test.mjs` (stub `node` argv log; stub exiting 6) | 3 of 5 failed (`hydrate` never called; exit-6 case; undeclared message pin renamed to "memory hydration skipped") | `hooks/*.test.mjs` 70/70 after the hook change and the stream-discipline pin `import` → `hydrate` |
| Q4 | the hook exits 0 on 6, the reason reaches stderr, and `resolve-index` still runs (asserted) | green |

## T4 — session-start (verify-only hydration, backend named, records context)
| step | RED | GREEN |
|---|---|---|
| 4.1-4.2, 4.4 `session-start.test.mjs` (step2Hydrate, argv gate, banners, step4cMemoryRecords, exit-6 non-fatal) | `SyntaxError: ... does not provide an export named 'step2Hydrate'` (whole file failed to load) | 88/88 |
| deferred reason on stdout (`cli.hydrate.test.mjs`) | 1 of 11 failed (no `{"hydrate":"deferred","reason"}` line) | 11/11 |
| 4.7 `no-artifact.parity.test.mjs` | 2 of 12 failed (spawn argv `import` vs `hydrate --verify`; plainfiles leg) | 12/12 |

The Q4 condition is proven in session-start by `runSessionStart: a deferred hydration (exit 6) renders the deferred line and STILL resolves exitCode 0`.

## T5, T6, T7 — day-start, allowlist, docs
| step | RED | GREEN |
|---|---|---|
| 5.1 `day-start.test.mjs` source guards (hydrate not import, 4a before the probe, no `sync --export`, one probe) | 4 of 8 failed | 8/8 after 4a moved out of the probe and 4c was deleted; i18n suite 75/75 (removed keys absent) |
| 6.1 `axis-port.guard.test.mjs` | `SHRANK day-start.mjs spawn-concrete:engram: 1 hits < max 2 — lower max to 1` (1 failed) | 14/14 after max 1, owner #1349, brain-to-engram entries → #1349 |
| 7 docs | n/a | KNOWN-LIMITATIONS drops the #1115 and #1189 entries; adoption.md names `hydrate` and the deprecated `import` |

## T8 — gates
- `npm run brain:repo:check`: green.
- First `npm test` run: 3 failures, all introduced by this change and fixed (RED→GREEN): a bare `memory:pull` token in a `plainfiles.mjs` comment (memory-script-prefix guard), an unannotated `catch` in `verifyIndex` (swallow guard, now `swallow-ok` with the ENOENT reason), and three new test spawns missing from the spawn-hygiene allowlist (line-keyed).
- `npm test` normal: 8146 tests, 8143 pass, 0 fail, 3 skipped.
- `AGENT_PLATFORM=hostile SDD_ENGINE=hostile npm test`: 8146 tests, 8131 pass, 12 fail, 3 skipped. All 12 are in `lib/axis-user-layer.test.mjs` and `config/cli.test.mjs` (the known #1347 set); none touches memory, session-start, day-start or hooks.
- `planAmendment()` on the six drafts against the branch: every act `pending` (adr-0004: 5, agent-authorities: 2, consolidation-protocol: 2, harness-contract: 2, memory-backend-contract: 3, memory-format: 2). No `*.md` under `brain/` changed.
- Gated diff (`git diff --numstat origin/main...HEAD` minus `*.test.mjs`, `.memory/**`, `openspec/changes/**`): 462 added + 135 deleted = 597 lines (tier `lite`, budget 1000).

## T9 — e2e (scratch consumers under the scratchpad; BRAIN_HOME, HOME and ENGRAM_DATA_DIR sandboxed; the real `~/.engram/engram.db` md5 `40eea8d2...` is unchanged before and after)
Consumers are copies of this worktree's `brain/` in a scratch git repo with a bare origin and a teammate clone (not an `npm pack` install).

plainfiles:
- `session:start` on a canonical index: `memory:   plainfiles verified — index current (read-only)`, `records:  1 durable, newest 2026-10-05 — first record`, no `engram` anywhere, `git status` clean after.
- On branch `fix/issue-1115-x` with a change dir: `issue #1115: 1 record(s)` and `  - 2026-10-05 first record`.
- With a deliberately drifted index: `memory:   plainfiles index is stale — session:start does not write; run npm run brain:memory:share`; the index md5 is identical before and after, `git status` unchanged.
- `git pull` of a teammate record (post-merge fires) and `npm run brain:memory:pull`: exit 0, no `does not implement`; when upstream left the index stale the pull leaves a rebuilt index (`M .memory/index.jsonl`, 4 lines for 4 records).
- `day:start` (engram off PATH): step 5/6 prints `Hydrating the memory backend from .memory/records/...`, the 4b else line, no export line, exit 0, reaches 6/6.

engram (project name = repo name, isolated store):
- `session:start`: `memory:   engram hydrated`; records line present.
- Three more `cli.mjs hydrate` runs plus one `import` alias run: exit 0, `engram export --project` shows exactly 1 row for the record's `topic_key` (REQ-MB-9). The alias prints the deprecation notice naming `hydrate`.
- `git pull` of a teammate record: post-merge hydrates it, 2 rows for 2 ids.
- `hydrate` with engram off PATH: stderr `engram binary not found. Install via: gentle-ai install`, exit 6; `session:start` prints `memory:   engram hydration deferred — engram binary not found. Install via: gentle-ai install` and exits 0; the post-merge hook exits 0 on the same deferral.
- Finding outside this change: engram 2.0.0's `export` is scoped to the cwd-detected project, so when the detected name differs from brain's project name `importMemory` reads an empty key set and re-imports (4 rows for 1 record before the scratch consumer's names were aligned). `importMemory` is untouched here.
