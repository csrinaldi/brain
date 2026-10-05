# Design — #1115 (folds #1189)

Line numbers are from `main` at `60b46d31`.

## D1 — Bulk `hydrate` on engram is a branch of the existing export
`engram.mjs:826` `hydrate({root, recordId, record}, seams)` gains this check first: when
`recordId === undefined && record === undefined`, return `hydrateAll({root}, seams)`. The
single-record path, including D4's `recordNotFound` throw (`:839-841`), is untouched.
`hydrateAll` (not exported):
1. `_probe()` (the default is `probeBinary(ENGRAM_BIN)`, the same expression `requireEngram`
   `:146-153` and the dispatcher read). When the result is not `available === true`, emit
   `memory.hydrate.deferred` with the reason (`"engram binary not found. Install via: gentle-ai
   install"` or `"engram binary could not be resolved — <reason>"`) and return
   `{written:0, skipped:0, deferred:true, reason}`.
2. `try { r = await _importMemory({ root }) } catch (err) { warn deferred; return {…, deferred:true, reason: explainEngramFailure(err)} }`.
   `importMemory` keeps its own guard and its `stateUnreadable`/`contended` handling (`:459-500`).
3. Normalize: `{ written: r.written ?? 0, skipped: r.skipped ?? 0, ...(r.deferred && {deferred:true}), ...(r.contended && {contended:true}), duplicates: r.duplicates }`.
   `importMemory`'s empty-store return has no `skipped`; that is why the default is there.
New seam: `_importMemory = importMemory`. `importMemory` stays exported, because `pullMemory`
(`:548`) and the existing tests use it.

## D2 — plainfiles `hydrate` = `share`'s body, renamed
New export in `plainfiles.mjs`, next to `share` (`:390`):
`hydrate({root = repoRoot, recordId} = {}, {_rebuildIndex = rebuildIndex} = {})`. It runs
`rebuildIndex` over `<root>/.memory/{records,index.jsonl}` and returns
`{written: 0, skipped: count, indexCount: count, duplicates}`. A `recordId` is accepted and
ignored, because the record is already in the only store plainfiles has (contract rule 1 by
construction, `memory-backend-contract.md:111`). No git.
**Consequence to be aware of:** on plainfiles, `session:start` now regenerates
`.memory/index.jsonl`. `rebuildIndex` is deterministic from records, so a canonical index stays
byte-identical, and a stale one is corrected. That correction is a working-tree write on a path
that `harness-contract.md:30` calls "read-only" (see Open question Q1).

## D3 — Dispatcher: the alias is a rewrite of `op`, before validation
`cli.mjs:178` `const op = process.argv[2]` becomes:
```js
const requestedOp = process.argv[2];
const op = requestedOp === "import" ? "hydrate" : requestedOp;
```
`VALID_OPS` (`:161`) gains `"hydrate"` and keeps `"import"` (validation reads `requestedOp`).
After the backend-agnostic ops and before backend selection, when `requestedOp === "import"`,
print `memory.import.deprecated` to stderr once. `VERB_TO_EXPORT` (`:939`) is deleted: no op maps
to `importMemory` any more, and `fn` is `camelCase(op)`. `ROOTED_OPS` (`:1206`) gains `"hydrate"`
(`import` is rewritten before the lookup, so it becomes dead and is removed). The duplicate-surface
switch (`:1228-1231`) is keyed on the result shape, not on an op or backend name:
`surface: result?.indexCount === undefined ? "the records read" : undefined`. That gives engram's
wording without an `axis-branch` hit. The comment at `:146` names `hydrate`.
Because the alias is a rewrite, selection sees `op === "hydrate"`. `FALLBACK_OPS` stays `["pull"]`
(`lib/backend-selection.mjs:96`), so engram-declared with no binary yields `OP_NOT_COVERED`, the
engram adapter runs, and D1 step 1 defers. No substitution happens, and plainfiles is never named.

## D4 — A deferred hydration has its own exit status
`memory/lib/backend-resolve.mjs` holds the memory CLI's exit vocabulary (`:32-35`: 3, 4, 5). It
gains `export const EXIT_DEFERRED = 6`. After `backend[fn]` resolves, when
`op === "hydrate" && result?.deferred === true`, set `process.exitCode = EXIT_DEFERRED`. The
reason was already printed by the adapter. The contract says a deferral "never returns a zero that
a reader could mistake for done", and at the process boundary the exit status is that zero.
Callers: `session-start` maps 6 to "deferred" (D6). `post-merge` lets the stderr reason through
and treats 6 like any other non-zero status (`|| _pm_rc=$?`). `day-start`'s `run()` prints its
generic `day.run.exitCode` line under the reason, so it stays non-blocking.

## D5 — post-merge
`hooks/post-merge:53` becomes `cli.mjs hydrate >/dev/null || _pm_rc=$?`. The header comment
(`:2-13`, `:44-51`) says "hydrate the active memory backend" in place of "engram re-import". The
3/4 message (`:57`) reads `post-merge: memory hydration skipped — memory backend not declared or
invalid (…)`. It stays a literal: hooks are POSIX sh with no i18n, which is existing practice. The
stream discipline is unchanged: stdout is discarded, stderr is kept
(`hooks.stream-discipline.test.mjs`).

## D6 — session-start: hydrate, name the backend, render neutral strings
- `MEMORY_CLI_ALLOWED_OPS` (`:89`) becomes `new Set(['hydrate', 'feature-resume'])`, and the
  docblock (`:100-117`) is updated to match. `FORBIDDEN_ARGV_TOKEN` is unchanged.
- `step2HydrateEngram` is renamed `step2Hydrate(cwd, deps)` and spawns `['…/cli.mjs', 'hydrate']`.
  It returns `{ ok, backend, deferred?, undeclared?, reason? }`:
  - The backend name comes from `deps._resolveBackend ?? (() => resolveMemoryBackend({ root: cwd }))`,
    read before the spawn. When the status is not `declared`, the name is `null` and the existing
    3/4 path renders.
  - status 0 gives `{ok:true}`. Status `EXIT_DEFERRED` gives `{ok:false, deferred:true, reason: stderr}`.
    Statuses 3 and 4 behave as today. Anything else becomes `{ok:false, reason}`.
- New import: `./memory/lib/backend-resolve.mjs` (`resolveMemoryBackend`, `EXIT_DEFERRED`). It
  reads local files only: the config, `.env`, and the user layer. It is added to
  `ALLOWED_IMPORT_SPECIFIERS` (`session-start.test.mjs:658`). `auto-resume.mjs` already imports
  it, so the reachable graph is unchanged.
- In the `renderContextBlock` model, the key `engram` is renamed `hydration`. The memory line:
  ok → `fill(s.memoryOk, {backend})`. deferred → `memoryDeferred`. undeclared → unchanged.
  reason → `memorySkipReason`. Otherwise → `memorySkip`. `{backend}` is filled from
  `hydration.backend ?? s.backendUnknown`.
- There is no `=== 'plainfiles'` branch anywhere, which satisfies REQ-1115-9 and the axis-port
  guard. Every backend renders the same way.

i18n (`en` / `es`). A ✎ marks a changed value:

| key | en |
|---|---|
| `session.memory.ok` ✎ | `memory:   {backend} hydrated` |
| `session.memory.skip` ✎ | `memory:   {backend} hydration skipped` |
| `session.memory.skip.reason` ✎ | `memory:   {backend} hydration skipped — {reason}` |
| `session.memory.deferred` (new) | `memory:   {backend} hydration deferred — {reason}` |
| `session.memory.backend.unknown` (new) | `(unknown backend)` |
| `session.memory.records` (new) | `records:  {count} durable, newest {date} — {title}` |
| `session.memory.records.unknown` (new) | `records:  durable store unreadable or empty — count unknown` |
| `session.memory.issue` (new) | `issue #{issue}: {count} record(s)` |
| `session.memory.issue.item` (new) | `  - {date} {title}` |
| `session.memory.issue.none` (new) | `issue #{issue}: no record yet` |
| `memory.import.deprecated` (new) | `memory/cli: 'import' is deprecated and is removed in the next release — it now runs 'hydrate'. Call 'hydrate'.` |
| `memory.hydrate.deferred` (new) | `⚠ hydrating .memory/records/ into {backend} was deferred — {reason}. The records are durable; the next hydration retries.` |
| `day.memory.hydrating` (new, replaces `day.memory.importing`) | `Hydrating the memory backend from .memory/records/...` |
| removed | `day.memory.importing`, `day.memory.exporting`, `day.memory.exported`, `day.memory.exportFailed` |

`es` values are neutral professional Spanish, for example `memoria:  {backend} hidratado`.
`SESSION_I18N_KEYS` (`session-start.mjs:478`) gains the new fields.

## D7 — The records-context reader (ruling 5)
`step4bMemoryRecency` (`:373`) is pinned and is left as is. A new
`step4cMemoryRecords(cwd, { issue }, deps)` reads `.memory/records/*.jsonl` with the same
tolerant loop: it skips bad lines, dedupes by `id`, and on failure returns `{count: null}`.
It returns `{ count, newest: {ts, title}|null, scoped: [{ts, title}] (≤5, newest first), scopedCount }`.
The title is the first non-empty line of `content`, with `**` stripped, cut at 80 characters
with `…`. The issue comes from step 3: `parseChangeId(change.matches[0])` when exactly one change
matches. `parseChangeId` is already imported (`:37`). With zero or several matches, no issue line
renders. This reader is pure local file I/O with no backend and no spawn, so REQ-2 holds. It does
not use `memory/lib/store.mjs#readRecords`, because that would widen session-start's import
graph further for a 20-line loop. The duplication with step4b's loop is accepted, and the
follow-up (proposal follow-up 2) replaces both with the backend's context payload.
`runSessionStart` (`:456`) calls it after step 3. `renderContextBlock` renders the records line
after the memory line, the issue lines after it, then the existing recency line.

## D8 — day-start: 4a moves out of the probe, 4c is deleted
`day-start.mjs:347-372` becomes:
```js
// 4a. Hydrate the active memory backend from .memory/records/ (backend-owned verb, #1115).
console.log(`  ${C.dim}${await t('day.memory.hydrating')}${C.reset}`);
await run(NODE, ['brain/scripts/memory/cli.mjs', 'hydrate']);

const engram = capture('engram', ['--version']);
if (engram.status === 0) {
  // 4b. Re-project brain/ → ~/.engram — unchanged; routing it through `index` is follow-up #<4b>.
  …brain-to-engram.mjs…
} else { info(notAvailable); install line }
```
The `sync --export` capture is deleted along with its three keys. The `else` branch's
`day.memory.notAvailable` / `install` lines are left as is (ruling 3: 4b unchanged; see Q2).

## D9 — Axis-port allowlist: exact expected state
After D8, `day-start.mjs` has exactly ONE `spawn-concrete:engram` hit, the
`capture('engram', ['--version'])` probe. The guard reports `SHRANK … lower max to 1`
(`axis-port.guard.test.mjs:276`) until the entry reads:
```js
{ file: 'day-start.mjs', rule: 'spawn-concrete:engram', max: 1, owner: '#<4b follow-up>',
  reason: 'Probes `engram --version` to gate the brain-to-engram doctrine projection (step 4b) instead of asking the backend for its `index` verb.' },
```
`session-start.mjs`, `memory/cli.mjs` and `hooks/post-merge` gain no hits. `hooks/` is not
`.mjs`, so it is not scanned. The `memory/cli.mjs` adapter-import and axis-branch entries
(heal-duplicates) are unchanged in count. Only their owner moves to the follow-up that owns them
(proposal follow-up 4), because #1115 closes. The `owner` must match `^#\d+$`, so the follow-up
issues are filed BEFORE apply finishes.

## D10 — Docs in the code half
`docs/KNOWN-LIMITATIONS.md:54-68`: both entries (#1115, #1189) are deleted. `docs/adoption.md:193`:
the op list reads `` `pull`, `hydrate` (and its deprecated alias `import`), `index`, … ``.
`engram.mjs:280-282` and `:537` (comments naming `import` callers) name `hydrate`.

## D11 — Doctrine drafts (ruling 6)
There are six `brain-amendment/1` drafts, one per target file, so no two drafts share an anchor.
In-place edits annotate rather than silently rewrite, following the ADR-0004 bracket convention.

| # | draft | target | shape |
|---|---|---|---|
| 1 | `memory-backend-contract-amendment-3.draft.md` | `brain/core/methodology/memory-backend-contract.md` | 2 edits (hydrate row, rule 3) + signed `## Amendment 3 …` |
| 2 | `adr-0004-amendment-5.draft.md` | ADR-0004 | Status + 2 edits (Dispatcher line, Amendment 3 op list) + body + HOME.md marker |
| 3 | `harness-contract-hydrate.draft.md` | `harness-contract.md` | 1 edit (`memory:save` row) + signed section |
| 4 | `consolidation-protocol-hydrate.draft.md` | `consolidation-protocol.md` | 1 edit (§5 item 1) + signed section |
| 5 | `agent-authorities-hydrate.draft.md` | `agent-authorities.md` | 1 edit (Tier 1 capture row) + signed section |
| 6 | `memory-format-hydrate.draft.md` | `memory-format.md` | 1 edit (§ Relationship to the live layer) + signed section |

`AGENTS.md` repeats the agent-authorities and harness-contract text (`AGENTS.md:136,338`). It is
regenerated by `brain:promote` and is never hand-edited.

## D12 — Test plan

**Pinned tests that change, and why**

| test | lines | change |
|---|---|---|
| `session-start.test.mjs` | 163-170, 184-284 | expected memory lines become `{backend}` strings; model key `engram` → `hydration` |
| same | 424-430, 543, 593, 616-620 | argv op `import` → `hydrate`; keep a NEW assertion that `import` is rejected by `assertLocalArgv` |
| same | 658-665 | `ALLOWED_IMPORT_SPECIFIERS` + `./memory/lib/backend-resolve.mjs` |
| same | 920-933 | the undeclared render reads `hydration.undeclared` |
| `i18n/coverage.test.mjs` | 58 | `day.memory.exported` pin → `day.memory.hydrating` |
| same | 446-447 | `session.memory.ok/skip` new values |
| `memory/cli.backend-fallback.test.mjs` | 303-315 | `import` on engram-absent: exit 6 (not just ≠0), stderr has the deprecation notice and `gentle-ai install`, no `'plainfiles'`, no substitution |
| `memory/cli.backend-declaration.test.mjs` | 119, 181 | add `['hydrate']` to both refusal lists (keep `import`) |
| `memory/lib/backend-selection.test.mjs` | 179, 202-203 | drop the `import: 'importMemory'` map; assert `!FALLBACK_OPS.includes('hydrate')` too |
| `axes/memory/no-artifact.parity.test.mjs` | 82-97 | session:start spawns `hydrate` |
| same | 153-181 | plainfiles leg: `hydrate` (and the `import` alias) EXIT 0, tree byte-identical; the "named refusal" vacuity (D5 of #955) retires |
| `hooks/post-merge.undeclared.test.mjs` | 25 | message `memory hydration skipped` |
| `axes/axis-port.allowlist.mjs` | 23-24 | max 2 → 1, reason, owner |

**New red-first tests**
- `engram.hydrate.test.mjs`: bulk → `_importMemory` called once with `{root}`. Normalization fills
  `skipped` with `0`. Probe `available:false` → deferred, reason includes `gentle-ai install`, and
  `_importMemory` is not called. Probe `null` → deferred. `_importMemory` throws → resolves
  deferred. Contended passes through.
- `plainfiles.hydrate.test.mjs` (new): shape and `_rebuildIndex` paths. No `_gitPull` seam is
  even accepted. Two runs leave `index.jsonl` byte-identical (REQ-MB-9).
- `memory/cli.hydrate.test.mjs` (new, spawns the CLI against a `BRAIN_MEMORY_TEST_ROOT` fixture
  with a `BRAIN_HOME` sandbox): plainfiles `hydrate` exits 0. `import` exits 0, prints the
  deprecation notice once, and prints no `does not implement`. engram with the binary absent
  (PATH without engram) exits 6. Undeclared exits 3 for both spellings. `FALLBACK_OPS` deep-equals
  `["pull"]`.
- `session-start.test.mjs`: the banner names `plainfiles` with no `engram` substring; the
  deferred line on exit 6; `step4cMemoryRecords` (dedupe, title extraction, ≤5 scoped,
  unreadable → `count:null` → unknown line); no issue line when the change is ambiguous.
- `day-start.test.mjs`: a source guard. No `'sync', '--export'`. The `cli.mjs', 'hydrate'` call
  appears BEFORE `capture('engram'`. No `cli.mjs', 'import'`.
- `hooks/post-merge.op.test.mjs` (new): a stub `node` records argv, and the hook passes `hydrate`.
- `i18n/coverage.test.mjs`: new keys exist in en and es, and the es values differ from en. Removed
  keys are absent from both.

**e2e (manual, evidence under `evidence/`)** is in tasks T9.

## Open questions (product forks the rulings do not settle; not decided here)
- **Q1.** On plainfiles, `hydrate` = `rebuildIndex` writes `.memory/index.jsonl` during
  `session:start`, which `harness-contract.md:30` calls "read-only". Should that doctrine phrase be
  touched (for example "read-only toward the records; may regenerate the derived index"), or
  should plainfiles' hydrate verify instead of rebuild when it is called from session-start?
- **Q2.** On a plainfiles consumer without the engram binary, day-start's 4b `else` still prints
  "engram not available — skipping shared memory" and an install line. Ruling 3 keeps 4b as is.
  Should that `else` output stay (noise naming engram on plainfiles), or move with the 4b follow-up?
- **Q3.** Ruling 5 says "plainfiles context". The design renders the records context for EVERY
  backend, because branching on the backend name in session-start is exactly the leak the
  axis-port guard flags. Is it acceptable for engram consumers to see the records lines too?
- **Q4.** Exit status 6 for a deferred `hydrate` (D4) is new CLI vocabulary. It also changes
  `import`'s exit on a contended or unreadable engram from 0 to 6. Accept, or keep exit 0 and
  have session-start parse stderr?
