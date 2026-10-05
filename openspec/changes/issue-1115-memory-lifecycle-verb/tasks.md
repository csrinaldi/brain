# Tasks — #1115 (folds #1189)

Strict TDD: in every pair, the RED test is written and seen failing before the GREEN code.
Run the touched tests with `node --test <file>`, and the whole suite with `npm test` at T8.

## T0 Pre-apply
- [ ] 0.1 Maintainer answers design Q1-Q4 (or confirms the defaults written in design.md).
- [ ] 0.2 File the follow-ups (proposal §Follow-ups 1-4) and record their numbers here; D9 needs the 4b issue number as the allowlist `owner`.

## T1 Adapters — bulk `hydrate`
- [ ] 1.1 RED `engram.hydrate.test.mjs`: bulk delegates to `_importMemory({root})` once and normalizes (`skipped` defaults to 0).
- [ ] 1.2 RED same file: probe false → deferred, reason contains `gentle-ai install`, import not called; probe null → deferred; import throws → resolves deferred; contended passes through.
- [ ] 1.3 GREEN `engram.mjs`: `hydrateAll` branch in `hydrate` (D1); the D4 `recordNotFound` test still passes.
- [ ] 1.4 RED `plainfiles.hydrate.test.mjs`: shape `{written:0, skipped:N, indexCount:N, duplicates}`, paths under `root`, no git; two runs leave `index.jsonl` byte-identical.
- [ ] 1.5 GREEN `plainfiles.mjs`: `hydrate` export (D2).
- [ ] 1.6 i18n: `memory.hydrate.deferred` in en and es (RED key-existence assertion first in `coverage.test.mjs`).

## T2 Dispatcher
- [ ] 2.1 RED `memory/cli.hydrate.test.mjs`: plainfiles `hydrate` exits 0 with no `does not implement`; `import` exits 0 with one deprecation notice naming `hydrate`; engram declared with the binary absent exits 6, stderr has `gentle-ai install`, no `plainfiles`; undeclared exits 3 for both spellings; `FALLBACK_OPS` deep-equals `["pull"]`.
- [ ] 2.2 GREEN `backend-resolve.mjs`: `EXIT_DEFERRED = 6`.
- [ ] 2.3 GREEN `cli.mjs` (D3, D4): `requestedOp`/`op` rewrite, `VALID_OPS` + `hydrate`, deprecation notice, delete `VERB_TO_EXPORT`, `ROOTED_OPS`, shape-keyed duplicate surface, `exitCode = EXIT_DEFERRED`, comment at `:146`.
- [ ] 2.4 i18n: `memory.import.deprecated` in en and es.
- [ ] 2.5 Update pins: `cli.backend-fallback.test.mjs:303-315`, `cli.backend-declaration.test.mjs:119,181`, `lib/backend-selection.test.mjs:179,202-203`.

## T3 post-merge
- [ ] 3.1 RED `hooks/post-merge.op.test.mjs`: the stub `node` records `hydrate` as argv[2] and never `import`.
- [ ] 3.2 GREEN `hooks/post-merge` (D5); update `post-merge.undeclared.test.mjs:25` to "memory hydration skipped".

## T4 session-start
- [ ] 4.1 RED `session-start.test.mjs`: the step spawns `hydrate`; `assertLocalArgv` rejects `import`; the import-graph allowlist includes `./memory/lib/backend-resolve.mjs` (update the pin).
- [ ] 4.2 RED: the banner names the `_resolveBackend` backend (`plainfiles hydrated`, no `engram` substring); exit 6 → deferred line; 3/4 → the not-declared line is unchanged.
- [ ] 4.3 GREEN `session-start.mjs` (D6): allowlist, `step2Hydrate`, backend name, model key `hydration`, render.
- [ ] 4.4 RED `step4cMemoryRecords`: dedupe by id, title extraction and truncation, ≤5 scoped newest first, unreadable → `count:null`, ambiguous change → no issue line.
- [ ] 4.5 GREEN `session-start.mjs` (D7): reader, wiring in `runSessionStart`, render order (REQ-7).
- [ ] 4.6 i18n: `session.memory.*` changes and new keys (D6 table) in en and es; update `coverage.test.mjs:446-447`; add the new keys to `SESSION_I18N_KEYS`.
- [ ] 4.7 Update the remaining pins `session-start.test.mjs:163-284, 920-933`; `no-artifact.parity.test.mjs:82-97`.

## T5 day-start
- [ ] 5.1 RED `day-start.test.mjs` source guard: no `'sync', '--export'`; `cli.mjs', 'hydrate'` appears before `capture('engram'`; no `cli.mjs', 'import'`.
- [ ] 5.2 GREEN `day-start.mjs` (D8): 4a outside the probe, delete 4c.
- [ ] 5.3 i18n: add `day.memory.hydrating`; remove `day.memory.importing/exporting/exported/exportFailed` from en and es; `coverage.test.mjs:58` pin → `day.memory.hydrating`; RED assertion that the removed keys are absent.

## T6 Allowlist and parity
- [ ] 6.1 Run `node --test brain/scripts/axes/axis-port.guard.test.mjs` and see `SHRANK day-start.mjs spawn-concrete:engram`.
- [ ] 6.2 GREEN `axis-port.allowlist.mjs` (D9): max 1, the new reason, owner = the 4b follow-up; re-point the residual #1115 owners to follow-up 4.
- [ ] 6.3 `no-artifact.parity.test.mjs:153-181`: the plainfiles leg asserts `hydrate` (and `import`) exit 0 and the tree is byte-identical; update the header comment (`:11-15`).

## T7 Docs (code half) and comments
- [ ] 7.1 `docs/KNOWN-LIMITATIONS.md`: delete the #1115 and #1189 entries.
- [ ] 7.2 `docs/adoption.md:193`: the op list names `hydrate`, with `import` deprecated.
- [ ] 7.3 `engram.mjs:280-282, :537` comments name `hydrate`.

## T8 Gates
- [ ] 8.1 `npm test` green.
- [ ] 8.2 `npm run brain:repo:check` green.
- [ ] 8.3 Re-run `planAmendment()` for all six drafts against the branch's base and confirm every act is `pending` (REQ-1115-10); `git diff --name-only origin/main -- brain/ | rg '\.md$'` is empty.
- [ ] 8.4 Measure the gated diff: `git diff --numstat origin/main...HEAD` minus the ignoreList; confirm ≤ 1000.

## T9 e2e (evidence to `openspec/changes/issue-1115-memory-lifecycle-verb/evidence/`)
`engram` is on this machine (`/home/gandalf/.local/bin/engram`, 2.0.0, checked 2026-10-05).
- [ ] 9.1 Scratch plainfiles consumer (under the scratchpad, `BRAIN_HOME` sandboxed, installed from `npm pack` of this worktree, `memory.default plainfiles`, `core.hooksPath` set): `brain:session:start` shows `plainfiles hydrated` and the records lines, with no `engram`; `git pull` of a new record shows no `does not implement`; `brain:memory:pull` likewise (#1189, REQ-1115-11); `brain:day:start` reaches 6/6 and prints no export line.
- [ ] 9.2 Scratch engram consumer, `ENGRAM_DATA_DIR` + `HOME` sandboxed (the #874/#1061 isolation; the real `~/.engram` stays byte-unchanged): `session:start` shows `engram hydrated`; two `cli.mjs hydrate` runs leave one row per record id (REQ-MB-9); with PATH stripped of engram, `hydrate` exits 6 and session-start shows `engram hydration deferred`.
- [ ] 9.3 `cli.mjs import` on both consumers: deprecation notice, same result as `hydrate`.

## T10 Close-out
- [ ] 10.1 Save a memory record (`npm run brain:memory:save -- --issue 1115`) with the decision and its gotchas (D3 alias rewrite, D4 exit 6).
- [ ] 10.2 Fresh-context review before push (PR rule). The PR body says `Closes #1115`, `Closes #1189`, and lists the six drafts for the maintainer to promote after merge, in README order.

## Review Workload Forecast

Estimated changed lines (added + deleted) **excluding** the ignoreList (`**/*.test.mjs`,
`.memory/**`, `AGENTS.md`, `openspec/changes/**`, `openspec/specs/**`, lockfiles):

| file | est. |
|---|---|
| `axes/memory/adapters/engram.mjs` | ~45 |
| `axes/memory/adapters/plainfiles.mjs` | ~20 |
| `memory/cli.mjs` | ~35 |
| `memory/lib/backend-resolve.mjs` | ~4 |
| `session-start.mjs` | ~140 |
| `day-start.mjs` | ~25 |
| `hooks/post-merge` | ~15 |
| `i18n/en.mjs` + `es.mjs` | ~45 |
| `axes/axis-port.allowlist.mjs` | ~16 (owner re-points) |
| `docs/KNOWN-LIMITATIONS.md`, `docs/adoption.md` | ~20 |
| **total** | **~365** |

- Above 400 (`standard` budget): **No** (~365, with roughly ±20% uncertainty, so it could reach about 440).
- Above 1000 (the tier in force here is `lite`, `brain.config.json` `governance.tier`): **No**.
- Chained PRs recommended: **No**. Ruling 7 asks for one PR, and the change fits `lite` with a
  wide margin. Tests (~600-800 lines) and drafts are outside the gated count.
- Decision needed before apply: **Yes**, but only for design Q1-Q4. Not for size.
