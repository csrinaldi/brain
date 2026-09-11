# Apply progress: #874 — record first, backend after (PR A + PR B)

Batch: PR A (tasks A0–A10) then PR B (tasks B1–B7). PR A's worktree:
`/home/gandalf/IA/brain-issue-874`, branch
`feat/issue-874-featmemory-record-first-backend-after-me`. PR B's worktree:
`/home/gandalf/IA/brain-issue-874-b`, branch `feat/issue-874-split-b`, base =
PR A's head `414c41b8` (PR #925, stacked, still under cold review at the time
PR B applied). Mode: **Strict TDD** (test runner: `node --test`). Artifact
store: hybrid (this file + engram topic_key
`sdd/issue-874-record-first/apply-progress`).

PR A's own section (tasks A0–A10, its TDD evidence, R7 probe, fresh-review and
cold-review fix batches) is preserved below, UNCHANGED. PR B's section starts
after it.

## Tasks

- [x] A0 — commit epic tracker's existing uncommitted edits (docs only)
- [x] A1 — RED: `backends/save-parity.test.mjs` (cross-backend refusal + record-id parity, R2)
- [x] A2 — GREEN: `engram.mjs#save()` mirrors `plainfiles.save()` gate order (no hydrate wiring yet)
- [x] A3 — RED→GREEN: R10 pair (secret-scan refusal + scan→append→hydrate call order)
- [x] A4 — RED→GREEN: `engram.mjs#hydrate({recordId})` (R3/R4/D1/D2/D9)
- [x] A5 — RED→GREEN: CLI-level engram save reachability; wire `save()` → `hydrate()`; i18n keys; backend-selection.mjs comment
- [x] A6 — retire `memory.save.engramUnsupported` (D7)
- [x] A7 — D8: retarget `capture-reachable.test.mjs` and `cli.backend-fallback.test.mjs:131-145`
- [x] A8 — R7 probe (isolated temp store, one-off) — see below
- [x] A9 — `brain-drafts/memory-backend-contract.save.draft.md` (R13 draft 1)
- [x] A10 — unpin `package.json:65`; full-suite gate; closing record

**All 11 tasks (A0–A10) complete.**

Fresh-review fix batch (sub-ticket #924) applied after an adversarial review
of PR A — see "Fresh-review fix batch" below for F1/F2/F4/F5 and the tasks.md
notes for F6/B1. PR A ready for verify.

## TDD Cycle Evidence

| Task | Test File | Layer | Safety Net | RED | GREEN | TRIANGULATE | REFACTOR |
|------|-----------|-------|------------|-----|-------|-------------|----------|
| A1 | `backends/save-parity.test.mjs` | Unit | N/A (new) | ✅ Written | ✅ 4/5 refusal+actor cases green on write, id-parity case RED (engram still `unsupportedOp`) | ✅ 5 cases (3 refusal table rows + actor + id-parity) | N/A — parity table, not a single behavior |
| A2 | `backends/engram.save.test.mjs` | Unit | N/A (new file); plainfiles.save.test.mjs untouched (baseline unaffected) | ✅ Written | ✅ 10/10 after `save()` implemented | ✅ 10 cases (happy path, type/issue/actor×3/derived-issue/supersedes/scope-topic/indexFailed) | ✅ extracted `deriveProject` verbatim from plainfiles.mjs (R1) |
| A3 | `backends/engram.save.test.mjs` (extended) | Unit | ✅ 10/10 (baseline from A2) | ✅ Written | ✅ 12/12 — passed with ZERO production diff (the invariant already held structurally from A2's `_hydrate` terminal-step wiring) | ✅ 2 cases (refusal + call-order) | ➖ None needed |
| A4 | `backends/engram.hydrate.test.mjs` | Unit | N/A (new file) | ✅ Written (import of `hydrate` fails — RED confirmed) | ✅ 6/6 after `hydrate()` implemented | ✅ 6 cases (payload shape, idempotence, binary-absent, save-throws, guard-contended, unknown-id) | ➖ None needed |
| A5 | `cli.save-search.test.mjs` (extended) | CLI (child-process) | ✅ 10/10 (baseline) | ✅ Written — RED confirmed (exit 1, actor-unset, because sandbox PATH lacked `git`; fixed the fixture, re-confirmed RED on the real subject: missing `deferred` stderr) | ✅ 11/11 after wiring `_hydrate` default → real `hydrate`, adding i18n keys, updating backend-selection.mjs comment | ➖ single CLI-level case is the full close-the-loop proof; unit-level triangulation already done in A2/A4 | ➖ None needed |
| A6 | `engram.search-unsupported.test.mjs` (renamed+trimmed) | Unit | ✅ 1/1 (search case, pre-existing) | N/A — trim-then-delete-key, not new behavior | ✅ 1/1 after key deletion; `unsupported-op.test.mjs` retargeted to `memory.search.engramUnsupported` (was pointing at the retiring key) | ➖ None needed | ➖ None needed |
| A7 | `capture-reachable.test.mjs`, `cli.backend-fallback.test.mjs` (retargeted) | Unit + CLI | ✅ prior cases in both files stayed green | ✅ Written | ⚠️ 4/5 in capture-reachable.test.mjs green immediately (the "must NOT pin" assertion is a KNOWN, INTENTIONAL red until A10 unpins `package.json:65` — see Deviations); cli.backend-fallback.test.mjs 11/11 green | ✅ D8's full case list (not-pinned, reachable-with-no-binary, search-key-retarget) | ➖ None needed |
| A9 | — (docs only, no test); validated via `parseAmendmentDraft()` (pure function, imported directly — not a test file) and a manual uniqueness check of all 4 `amend-find` blocks against the live target | — | — | — | — | — | — |
| A10 | full suite (`npm test`, both backends) | — | ✅ 5280/5280 green pre-unpin (engram default) | N/A — chore, no new test | ✅ 5280/5280 post-unpin under `MEMORY_BACKEND=engram` (ambient default) AND `MEMORY_BACKEND=plainfiles` (explicit) | N/A | N/A |

### Test Summary
- **Total tests written/modified this batch**: ~40 (5 new files: save-parity, engram.save, engram.hydrate, plus extensions to cli.save-search, capture-reachable, cli.backend-fallback, unsupported-op)
- **Layers used**: Unit (bulk), CLI/child-process (cli.save-search.test.mjs, cli.backend-fallback.test.mjs, capture-reachable.test.mjs)
- **Approval tests**: None — no refactor-of-existing-behavior tasks in this batch (A2/A4 are net-new exports; A1/A3/A5/A7 are additive/retargeted test assertions)
- **Pure functions created**: `deriveProject` (duplicated from plainfiles.mjs verbatim, R1) — no new pure functions beyond that; `hydrate()` and `save()` are I/O-shelling by nature (seam-injected)

## R7 probe (task A8)

Isolation mechanism used: `ENGRAM_DATA_DIR` (documented in `engram --help`'s
Environment section — "Override data directory (default: ~/.engram)"). No
`HOME` override was needed since this env var directly isolates the store
path. Binary: `engram 1.20.0` (installed at `/home/gandalf/.local/bin/engram`).

Isolation proof (real store untouched):

```
$ stat -c '%s %Y' "$HOME/.engram/engram.db"     # BEFORE
221995008 1789089664
$ stat -c '%s %Y' "$HOME/.engram/engram.db"     # AFTER
221995008 1789089664
```

Byte-identical size and mtime before and after — the probe never touched the real store.

Verbatim commands and stdout:

```
$ TMP=$(mktemp -d)

$ ENGRAM_DATA_DIR="$TMP" engram save "probe" "body-v1" --type discovery --project brain-probe-874 --topic rec-probe-0000000000000000
Memory saved: #1 "probe" (discovery)

$ ENGRAM_DATA_DIR="$TMP" engram save "probe" "body-v2" --type discovery --project brain-probe-874 --topic rec-probe-0000000000000000
Memory saved: #1 "probe" (discovery)

$ ENGRAM_DATA_DIR="$TMP" engram export "$TMP/state.json"
Exported to /tmp/.../state.json
  Sessions:     1
  Observations: 1
  Prompts:      0

$ # count rows whose topic_key is the probe topic
total observations in export: 1
rows matching probe topic: 1
{"id":1,"content":"body-v2","topic_key":"rec-probe-0000000000000000","created_at":"2026-09-11 02:13:46","updated_at":"2026-09-11 02:13:46"}

$ rm -rf "$TMP"   # temp tree removed
```

**Verdict: UPSERT.** One row, carrying `body-v2` (the second save's content) —
`engram save --topic <id>` upserts by `topic_key`, confirming the assumption
R3/R6/R4 are built on. The design's stated fallback (INSERT, reconcilable via
`memory:audit`) was NOT needed; no design change required by this measurement.
This verdict is carried into epic #864's task 6.1 exit as measured evidence.

## Line budget vs. origin/main

`git diff --stat origin/main...HEAD | tail -1`:

```
26 files changed, 1997 insertions(+), 102 deletions(-)
```

`size:exception` per R14/tasks.md's Review Workload Forecast (PR A was
pre-approved to exceed 400 lines on test volume). Breakdown by category:

| Category | Files | Approx. lines |
|---|---|---|
| Production code | `engram.mjs` (275), `cli.mjs` (6), `backend-selection.mjs` (13), `unsupported-op.mjs` (8), `i18n/en.mjs`+`es.mjs` (16), `package.json` (2) | **~320** |
| Tests (new + extended) | `engram.save.test.mjs` (285), `engram.hydrate.test.mjs` (148), `save-parity.test.mjs` (116), `capture-reachable.test.mjs` (Δ70), `cli.backend-fallback.test.mjs` (Δ45), `cli.save-search.test.mjs` (Δ59), `engram.search-unsupported.test.mjs` (24, net −18 after deleting the old file), `unsupported-op.test.mjs` (Δ9) | **~740** |
| SDD planning docs (this change's own trail) | `proposal.md` (136), `spec.md` (113), `design.md` (216), `explore.md` (177), `tasks.md` (59), `apply-progress.md` (143 initial) | **~845** |
| Other docs | epic tracker edits (9), R13 draft (122) | **~130** |
| Generated (record-first closing record) | `.memory/index.jsonl` (+3/−2, see Deviation 5), `.memory/records/2026-09-rec-0a1859a961ccbd96.jsonl` (+1) | **~4** |

Commits, in order (`git log --oneline origin/main..HEAD`, oldest first):

```
63e5dca9 docs(sdd): commit epic tracker edits (6.1, 4.3-4.10) (#924)
d3bf8f51 docs(sdd): add issue-874-record-first planning artifacts (#924)
2cf9af19 test(memory): add cross-backend save parity table (R2) (#924)
b6cab0cf feat(memory): mirror plainfiles.save() gate order in engram adapter (R1) (#924)
4518e08f test(memory): re-prove #469 on engram — secret never reaches disk (R10) (#924)
68736d8f feat(memory): add hydrate({recordId}) single-record upsert (R3/R4/D1/D2/D9) (#924)
f1a41ae1 feat(memory): call hydrate from save(); surface deferred/contended (R5/D3) (#924)
b3f052d1 refactor(memory): retire memory.save.engramUnsupported with its call site (D7) (#924)
0e7e481c test(memory): retarget capture-reachable & backend-fallback to deferred save (D8) (#924)
72f6be7e test(memory): use removeTempTree for cli.backend-fallback's git fixture (#802) (#924)
ef421c65 docs(sdd): record R7 probe verdict in apply-progress (#924)
a8bf66da docs(sdd): draft contract amendment — save column flip (R13) (#924)
24c318f9 chore(memory): unpin MEMORY_BACKEND=plainfiles default (R8) (#924)
6d3c7f6c docs(memory): record PR A of #874 (#924)
```

## Deviations from tasks.md / design.md

1. **A0 scope widened slightly**: A0's own diff (`git diff --stat`) covers only
   `openspec/changes/issue-864-memory-2-0/tasks.md`, exactly as specified. A
   SEPARATE, unlisted commit was added immediately after it —
   `docs(sdd): add issue-874-record-first planning artifacts (#924)` — to commit
   this change's own `proposal.md`/`spec.md`/`design.md`/`tasks.md`/`explore.md`,
   which were present in the worktree but untracked (written by prior SDD phases
   under the hybrid store, not yet committed). Reason: PR A ships this change's
   own planning trail; leaving those files uncommitted would mean the PR's own
   spec/design/tasks never reach review. Docs-only, zero production-code
   review-budget impact.
2. **A7's "confirm GREEN against A2–A5"**: `capture-reachable.test.mjs`'s
   rewritten assertion "the verb must NOT pin a backend" was INTENTIONALLY red
   from A7 through A9 — `package.json:65` is only unpinned in A10 (R8: "the
   unpin lands inside split A, as its LAST commit"). D8's own testing table
   describes the target shape of the retargeted test file; it does not claim
   every assertion in it is provable before the unpin. All OTHER assertions in
   both retargeted files (capture-reachable.test.mjs, cli.backend-fallback.test.mjs)
   were green as of A7. Confirmed GREEN at A10, after the unpin: `node --test
   brain/scripts/memory/capture-reachable.test.mjs` → 5/5 passing.
3. **Test-fixture gaps discovered while writing A5/A7's CLI-level tests**: the
   sandboxed `PATH` fixtures in `cli.backend-fallback.test.mjs`'s `world()`
   only ever needed `which` (+ optionally `engram`) before this batch, because
   no existing test drove `save` far enough to reach the #738 actor gate under
   that harness. Driving `save` to a real deferred-hydration outcome needed
   `git` on the sandbox PATH too (for `git config --get brain.actor`) and a
   local `initIdentity()` helper (mirrored from `cli.save-search.test.mjs`).
   Added both, scoped to the one retargeted test — no other test in that file
   was touched or needed the git isolation.
4. **`composeSource()` reuse (capture-provenance.mjs)**: `engram.save()` reuses
   `composeSource()` verbatim (R1's "duplicates plainfiles.save()'s body"), and
   that shared pure function hardcodes the string `"plainfiles save on {host}"`
   as the first element of every record's `source` field — REGARDLESS of which
   backend actually ran. This means an engram-backed capture's `source` field
   reads "plainfiles save on `<host>`", which is misleading (though harmless:
   `source` is excluded from `computeRecordId`'s hash, per format.mjs, so this
   does not affect record-id parity, R2's own acceptance test, or any spec
   scenario). Not fixed here: `capture-provenance.mjs` is not named in design's
   module map or scope, and editing a shared pure function used by BOTH
   backends' `save()` was not ratified by any ruling (R1–R14). Flagged for a
   follow-up ticket rather than silently patched or silently left undocumented.
5. **`#802` drift-guard regression, fixed same-batch**: adding `initIdentity()`
   (git init + `git config --local brain.actor`) to
   `cli.backend-fallback.test.mjs` for A7's retargeted `save` test made that
   file both spawn `git` AND recursively `rmSync` its fixture directory
   (`world()`'s pre-existing `t.after` cleanup) — exactly the shape
   `brain-repo-hygiene`'s `#802` guard (`__fixtures__/tmp-tree-adoption.test.mjs`)
   refuses, because a bare `rmSync` has no retry for a `.git/objects` ENOTEMPTY
   race. Fixed in the same batch (commit `72f6be7e`) by switching that one
   `t.after` to `removeTempTree` (`lib/tmp-tree.mjs`), the repo's own answer to
   this exact class. Not a tasks.md line item — discovered via the full-suite
   run before A9's commit, fixed immediately rather than left for A10 or
   `sdd-verify`.
6. **A10's closing-record index diff is `+3/−2`, not `+1`**: the harness's
   verify step for the record-first closing commit expects `git diff --cached
   --stat` to show the index growing by exactly one line, with a fallback of
   `git checkout -- .memory/index.jsonl` + retry if not. Measured: `HEAD~1`'s
   *committed* `.memory/index.jsonl` already carried two entries
   (`rec-3afb00eb127d31a6`, `rec-96965eb1cf95f9a0`) appended OUT OF SORTED
   ORDER at the file's tail — a pre-existing inconsistency in the repository,
   unrelated to this change and present before this worktree's branch was cut
   (confirmed via `git show HEAD~1:.memory/index.jsonl`). `rebuildIndex()` is
   deterministic and always emits a canonically SORTED index
   (`serializeIndex()`, `format.mjs`), so running it moved those two
   pre-existing lines into their sorted position as a side effect — `git diff
   --cached` reads that move as `-2/+2` (delete from the tail, insert in the
   middle) on top of the one genuinely new line (`+1`), for a net `+3/-2`.
   **The retry fallback was NOT taken**: this is a deterministic, structural
   property of the already-committed index, not a transient glitch — retrying
   would reproduce the identical `+3/-2` diff every time. Verified safe to
   proceed: `git status --short` showed exactly the two intended paths staged
   (`.memory/index.jsonl`, the one new record file), no `manifest.json`, no
   other record files, and the record/index CONTENT is correct — only the
   byte-diff SIZE differs from the task's `+1`-line expectation, for a reason
   predating this change.

## Fresh-review fix batch (sub-ticket #924, after adversarial review of PR A)

Batch scope: F1 (HIGH), F2 (MEDIUM), F4 (LOW), F5 (LOW) from the fresh review,
plus tasks.md notes for F1's PR-B retirement and F6's PR-B follow-up. Mode:
Strict TDD (`node --test`), one work-unit commit per finding. No edits to
`brain/core/**`/`brain/project/**`; no push/PR; `.memory/index.jsonl` and
`.memory/manifest.json` never staged this batch (this section is a docs-only
edit to an already-tracked file).

### TDD Cycle Evidence

| Finding | Test File | RED | GREEN | Notes |
|---|---|---|---|---|
| F1 | `backends/engram.dualwrite-hydrated-gate.test.mjs` (new, 3 cases) | ✅ 3/3 red (import + behavior — `skippedHydrated` did not exist) | ✅ 3/3 green after the `SUPERSEDES_ID_RE`/`topic_key` gate landed in `dualWriteRecords`; 3 pre-existing `engram.share.test.mjs` deepEqual assertions updated for the new `skippedHydrated: 0` field | Gate is grammar-only (no local-presence check) — records are additions-only, so a `rec-…` topic with no local match is still skipped (second test case). `cli.mjs` gained a `skippedHydrated` stdout line (`memory.share.skippedHydrated`, en+es). |
| F2 | `backends/engram.hydrate.test.mjs` (extended, +1 case) | ✅ red (`_engramSave` was called; no `deferred`) | ✅ green after `isEngramArgvUnsafe()` gate in `hydrate()` — a leading `-` in `observation.title`/`.content` now defers with `reason: 'engram-argv-unsafe'` before spawning | Upstream fix (a `--` escape in `engram save` itself) is out of this repo's scope — noted, not filed here. |
| F4 | `backends/engram.hydrate.test.mjs` (strengthened, existing case) | N/A — verified by TEMPORARY mutation, not by a new failing case: reverted `topic: recordId` → a constant string, re-ran, got 2/7 red (the new key-assertion + the pre-existing byte-equality case), then reverted the production line back (confirmed `git diff` empty on `engram.mjs`) | ✅ 7/7 green with the mutation reverted | The fake store now asserts its one key IS `CLEAN_RECORD.id`, not just that its size is 1 — closes the "constant topic still passes" gap named by the review. |
| F5 | `capture-reachable.test.mjs` (fixture teardown) | N/A — measured, not asserted: 14 stray `capture-reachable-engram-*` dirs found under `/tmp` before the fix (leaked by every prior run of this file); confirmed the fix stops the leak (0 new dirs after a run with the pre-existing stray dirs cleared) rather than inventing a directory-existence assertion | ✅ `t.after(() => removeTempTree(root))` added, consistent with this file's other git-spawning fixture (~line 101) | Stray `/tmp` dirs from before this fix were removed as housekeeping (outside the repo, not committed). |

### Test Summary
- New/modified test files: `engram.dualwrite-hydrated-gate.test.mjs` (new), `engram.share.test.mjs` (3 assertions updated), `engram.hydrate.test.mjs` (+2 cases: F2 new, F4 strengthened), `capture-reachable.test.mjs` (+1 import, +1 `t.after`).
- Focused suite (F1+F4 hydrate/duplicates/share + F5 capture-reachable + cli.backend-fallback + i18n coverage): **123/123 green**.
- Full suite: **5284/5284 green** under `MEMORY_BACKEND=engram` (ambient default) AND explicit `MEMORY_BACKEND=plainfiles`.

### Deviations from the review batch prompt
1. **F1's `reason`/message wording**: the review's parenthetical `(e.g. skippedHydrated: n ... and a line in --json/stderr)` was read as illustrative, not literal — `share` has no `--json` flag today (only `save`/`search`/`collect` do), so the new count is printed to **stdout** via `console.log`, mirroring the existing `dedupedUpstream` line (a correctly-working, non-warning count), not to stderr. `cli.mjs`'s comment states the reasoning inline.
2. **F2's `reason` string**: kept literally `'engram-argv-unsafe'` (a stable machine token) on `result.reason`, reusing the existing `memory.save.hydrateDeferred` i18n key (interpolating that token as `{reason}`) rather than adding a new catalog key — avoids widening the i18n coverage surface for a one-line message; the CLI's stderr line still names the reason verbatim.
3. **No production diff for F4**: the review's own instruction ("strengthen … so a mutation to a constant topic still fails") described a TEST-only fix; verified via a temporary, reverted mutation of `engram.mjs` rather than shipping a code change, exactly as the finding asked.
4. **B8 (F6) is planning-only this batch**: added to `tasks.md` as instructed, not implemented — `composeSource()` is out of scope for PR A (design.md's module map never named `capture-provenance.mjs`) and B already touches the engram adapter.

## Cold-review fix batch (sub-ticket #924, second round — C1/E1)

Answers the cold review's two remaining code findings, C1 (correction, HIGH)
and E1 (editorial). Mode: Strict TDD (`node --test`), one work-unit commit per
finding, same hard constraints as the earlier fresh-review batch (no edits to
`brain/core/**`/`brain/project/**`; no push/PR/`--force`/`--no-verify`;
`.memory/index.jsonl`/`.memory/manifest.json` never staged; temp dirs + fake
seams only; no real engram binary/store touched by any test).

This batch also retires task **B8** from `tasks.md` — C1 is the same defect
fresh-review finding F6 named, fixed here instead of deferred to PR B.

### TDD Cycle Evidence

| Finding | Test File | RED | GREEN | Notes |
|---|---|---|---|---|
| C1 | `lib/capture-provenance.test.mjs` (+1 case), `backends/engram.save.test.mjs` (+1 case) | ✅ both red — `composeSource()` had no `backend` param; engram's `save()` wrote `source` starting `"plainfiles save on "` | ✅ both green after `composeSource({ host, backend, actor, kind, issue })` names `${backend} save on ${host}` and both `save()` call sites (`plainfiles.mjs`, `engram.mjs`) pass their own literal (`"plainfiles"` / `"engram"` — the same strings each file already uses elsewhere, e.g. `unsupportedOp("search", "engram", ...)`; no new identity string invented) | The 5 pre-existing `composeSource()` calls in `capture-provenance.test.mjs` were also updated to pass `backend: 'plainfiles'` explicitly (previously implicit/hardcoded) — none of those assertions checked the prefix text, so this was a cleanliness update, not a behavior fix; confirmed `plainfiles.save.test.mjs:212`'s `record.source.startsWith('plainfiles save on ')` assertion is untouched and still passes (backend-of-record unchanged for that path). `source` stays outside `computeRecordId`'s hash (`format.mjs`), so no record id changed for either backend. |
| E1 | `backends/engram.hydrate.test.mjs` (+1 case) | ✅ red — `isEngramArgvUnsafe()` only checked `title`/`content`; a record with `project: '-repo'` still reached `_engramSave` | ✅ green after `hydrate()`'s guard also checks `observation.project`, same `deferred`/`reason: 'engram-argv-unsafe'` outcome, same "never spawn" contract as the F2 title/content case | `type` (fixed `RECORD_TYPES` enum), `scope` (always the constant `'project'` from `importRecord()`), and `topic` (always the record's own `rec-`-prefixed id) are NOT guarded — documented inline as to why each is safe. The scenario named in the review (`deriveProject()`'s checkout-basename fallback, `String(root).split('/').pop()`, producing a leading `-` for a worktree like `/path/to/-repo`) is captured as the test's own doc comment and record fixture (`project: '-repo'`), mirroring the file's existing `dashRecord` pattern for F2 rather than driving the scenario through `save()`'s own `deriveProject()` (which is unexported and would require an unstubbed real-`hydrate` call through `save()`, i.e. a PATH-isolated CLI-level test — out of proportion for this fix). |

### Test Summary
- New/modified test files: `lib/capture-provenance.test.mjs` (+1 case, 5 pre-existing calls updated), `backends/engram.save.test.mjs` (+1 case), `backends/engram.hydrate.test.mjs` (+1 case).
- Focused suite (`engram.hydrate.test.mjs`, `engram.save.test.mjs`, `save-parity.test.mjs`, `capture-provenance.test.mjs`, `plainfiles.save.test.mjs`, `cli.save-search.test.mjs`): **95/95 green**.
- Full suite: **5287/5287 green** (up from the prior batch's 5284 baseline + this batch's 3 new cases).

### Commits (this batch, oldest first)

```
fix(memory): composeSource() names the backend that ran (#924)
fix(memory): hydrate() argv guard also covers project (#924)
```

### Deviations
None — both fixes match the review's stated scope exactly; no design.md changes needed (design.md's D1/D3 aren't touched — `composeSource` and `isEngramArgvUnsafe` are both implementation detail below the design's module map, not named decisions).

## R7 probe outcome carried to epic #864 (informational)

Task 6.1 of `issue-864-memory-2-0/tasks.md` asks for `MEMORY_BACKEND=engram`
and `=plainfiles` audit evidence; this probe's UPSERT verdict is the R7 measurement
that task depends on. Not ticked here — 6.1 has its own broader acceptance
criteria (the audit's four do-it-once scenarios) that this PR does not close.

---

# PR B — `Closes #874` (base = PR A's merge commit `414c41b8`, stacked)

Worktree: `/home/gandalf/IA/brain-issue-874-b`, branch `feat/issue-874-split-b`.
Mode: **Strict TDD** (`node --test`). No edits to `brain/core/**`/`brain/project/**`
(R13 drafts only, under `brain-drafts/`); no push/PR/`--force`/`--no-verify`;
`.memory/index.jsonl`/`.memory/manifest.json` never staged except the one
closing-record line (B7); no test invokes the real `engram` binary against a
real store.

## Tasks

- [x] B1 — Reshape `share()` to the `plainfiles.share()` mirror (R11/D6); delete row 1 (`_defaultShareExport`); remove the F1 `skippedHydrated` gate from `dualWriteRecords()` together with the exporter it protected; retire `engram.dualwrite-hydrated-gate.test.mjs`
- [x] B2 — Delete row 2 (`_defaultReadObservations` + `collectChunkObservations` import); retire `chunk-boundary.test.mjs`'s `engram.mjs:61` allowlist row
- [x] B3 — Record O1 disposition (RATIFIED 2026-09-11, option (c)): `dualWriteRecords()` kept, unchanged, handed to epic task 2.4 — docs only, no production change
- [x] B4 — Row 5: replace `engram.share.test.mjs` (1074 → 108 lines) with the `plainfiles.share.test.mjs`-modelled suite, source guard included, `_ensureSymlink` retained (R12)
- [x] B5 — Row 4, LAST: re-run A's R10 pair as pre-flight proof, then delete `_defaultChangedChunkFiles`, `assertExportDestinationIsRead`, `scrubMaterializedChunks`; re-run the R10 pair again post-deletion
- [x] B6 — `brain-drafts/memory-backend-contract.rule2.draft.md` (R13 draft 2): rule 2 `not yet` → `yes`; rule 3 stays `not yet`
- [x] B7 — Full-suite gate under both backends; closing record `rec-7aa69f4daaaece68`

**All 7 tasks (B1–B7) complete.**

## TDD Cycle Evidence

| Task | Test File | Layer | RED | GREEN | Notes |
|------|-----------|-------|-----|-------|-------|
| B1 | `engram.share.test.mjs` (in-place edits), `cli.backend-fallback.test.mjs` (4 cases retargeted), `engram.duplicates.test.mjs`/`engram.upstream-scope.test.mjs` (1 obsolete share()-based test each removed) | Unit + CLI | ✅ reshaping `share()` first broke 12 tests across 4 files (measured, see "Collateral discovered" below) — each confirmed RED against the pre-fix assertion before editing | ✅ 44/44 → 33/33 (engram.share.test.mjs, net −11 tests removed with the exporter); 11/11 (cli.backend-fallback.test.mjs, all retargeted green); full suite 5265/5265 (plainfiles) and 5265/5265 (engram) | `engram.dualwrite-hydrated-gate.test.mjs` deleted outright (its 3 cases tested a gate that no longer exists — RED-by-deletion, the replacement is "the gate is gone," proven by `rg` finding zero references outside one explanatory comment) |
| B2 | `chunk-boundary.test.mjs` | Unit | ✅ RED first from the header-comment line-count edit alone (allowlist line-number drift, `61`→`60`), confirmed and fixed before the real B2 edit; RED again from the literal row-2 deletion until the allowlist row was removed in the same commit | ✅ 15/15; full suite 5264/5264 both backends (net −1 from B1's 5265, matching the one `_defaultReadObservations`-direct test removed) | `dualWriteRecords()`'s `_readObservations` default changed from `_defaultReadObservations` to an empty-read stub — every existing caller already injects its own, confirmed by grep before the change |
| B3 | `engram.upstream-scope.test.mjs`, `engram.duplicates.test.mjs:46-65` | Unit | N/A — docs-only, no code change | ✅ 17/17 (both files together), confirming O1's "stay green untouched" claim holds for these two — see Deviations for the one place it did NOT hold (`cli.upstream-config.test.mjs`) | design.md's Open Question O1 section updated to RESOLVED |
| B4 | `engram.share.test.mjs` (full replacement) | Unit | ✅ written RED-first against the still-old file (import path proves the shape); confirmed GREEN only after the full rewrite | ✅ 5/5 in the new file; full suite 5237/5237 both backends | Source-guard test (`share.toString()` matches none of the retired seam names) is new — not in `plainfiles.share.test.mjs`'s own suite, added because `share()`'s retired seams are a regression a behavioral test alone cannot catch (a re-added but never-called `_export` param would still pass every behavioral assertion) |
| B5 | `engram.save.test.mjs` (R10 pair), `save-parity.test.mjs` | Unit | N/A — pre-flight proof is a green-before-and-after measurement, not a RED-GREEN cycle (no new test; production-only deletion) | ✅ pre-flight: 2/2 (R10 pair) + 5/5 (save-parity) green BEFORE deletion; ✅ post-deletion: same 2/2 + 5/5 green AFTER; full suite 5237/5237 both backends (unchanged from B4 — no test file touched) | `_defaultResolveDir` deliberately left in place (orphaned, zero callers) — not named in tasks.md's row 4 list; `statSync` and `scrubChunkFile` imports removed as now-genuinely-unused |
| B6 | — (docs only, no test) | — | — | — | Draft 2 depends on Draft 1 (split A's `memory-backend-contract.save.draft.md`) promoting first — noted for the promoter; verified by manual diff against the live (unpromoted) `brain/core/methodology/memory-backend-contract.md:61,99-105` |
| B7 | full suite (`npm test`, both backends) | — | N/A | ✅ 5237/5237 green under `MEMORY_BACKEND=plainfiles` AND `MEMORY_BACKEND=engram` | Closing record `rec-7aa69f4daaaece68`, index diff `+1` net (verified via the uniq-diff check), no other `.memory/` path staged |

### Pre-flight and post-deletion R10 proof (B5)

Pre-flight (before deleting `_defaultChangedChunkFiles`/`assertExportDestinationIsRead`/`scrubMaterializedChunks`):

```
$ node --test brain/scripts/memory/backends/engram.save.test.mjs
# tests 13 / pass 13 / fail 0   (R10 i, R10 ii among them, both ok)
$ node --test brain/scripts/memory/backends/save-parity.test.mjs
# tests 5 / pass 5 / fail 0
```

Post-deletion (same two commands, re-run against the reduced `engram.mjs`):

```
$ node --test brain/scripts/memory/backends/engram.save.test.mjs brain/scripts/memory/backends/save-parity.test.mjs
# tests 18 / pass 18 / fail 0
```

### Full-suite gate (B7)

```
$ MEMORY_BACKEND=plainfiles npm test
# tests 5237 / pass 5237 / fail 0
$ MEMORY_BACKEND=engram npm test
# tests 5237 / pass 5237 / fail 0
```

### Closing record (B7)

```
$ npm run memory:save -- "PR B of #874: share() retires the exporter" "…" --type decision --issue 874
memory/cli: ✓ saved rec-7aa69f4daaaece68 → .memory/records/2026-09-rec-7aa69f4daaaece68.jsonl
```

`git diff --cached --stat -- .memory/index.jsonl` → `1 file changed, 1 insertion(+)`.
Uniq-diff check (`git diff --cached -- .memory/index.jsonl | rg '^[-+]\{' | cut -c2- | sort | uniq -u`)
showed exactly one line — the new `rec-7aa69f4daaaece68` entry — confirming the
+1 net is a genuine single addition, not a masked reorder. `git status --short`
showed exactly two paths staged (the index and the one new record file); no
`manifest.json`, no other record file. The share command also reported 2
PRE-EXISTING divergent duplicate ids (`rec-4a22e13fd3c3aebd`, `rec-95740755792f0f1c`)
in the store — unrelated to this write, a `merge=union` artifact per ADR-0017,
not touched by this batch.

### Line budget vs. PR A's head

`git diff --stat 414c41b8...HEAD | tail -1`:

```
14 files changed, 310 insertions(+), 1912 deletions(-)
```

`size:exception` per R14/tasks.md's Review Workload Forecast (pure deletion,
pre-approved). Net matches the design's forecast band (≈ −1250 to −1560,
O1-keep case): this run landed at **−1602 net**, inside the forecast (O1
kept the function, which is why it is closer to the "keep" end than the
"delete" end of the band).

Commits, in order (`git log --oneline 414c41b8..HEAD`, oldest first):

```
1990bdd5 feat(memory): reshape share() to plainfiles mirror; delete row 1 (R11/D6) (#874)
72497fb4 refactor(memory): delete row 2 — _defaultReadObservations; retire chunk-boundary allowlist row (#874)
7187ce65 docs(sdd): record O1 disposition — dualWriteRecords kept, handed to 2.4 (#874)
5154a3a2 test(memory): replace engram.share.test.mjs with plainfiles-mirror assertions (R11/R12, row 5) (#874)
50f83669 refactor(memory): delete row 4 — chunk scrub subsystem, citing A's #469 pair (R10) (#874)
fef2a229 docs(sdd): draft contract amendment — rule 2 flip (R13) (#874)
0b42a91e docs(memory): record PR B of #874 (#874)
ea4d34c7 docs(sdd): tick B1-B7 complete in tasks.md (#874)
```

Each commit is one work unit per tasks.md's B1–B7 breakdown; B7 itself produced
the closing-record commit, and one additional docs commit (`ea4d34c7`) ticks
the tasks.md checkboxes — not itself a numbered task, following the same
pattern PR A used for its own bookkeeping.

## Collateral discovered while applying B1 (necessary, not scope creep)

Reshaping `share()` per R11 ("completes with the engram binary ABSENT, no
`requireEngram()`") has a structural consequence tasks.md's B1 text does not
spell out: every test that relied on `share()` FAILING when the engram binary
is absent, broken, or stated-but-unreachable stops being true. Measured before
fixing anything (`node --test` on the affected files against the reshaped
`share()`, no other change): **12 failing tests across 4 files.**

1. **`engram.share.test.mjs`** (33 remaining after the file's own edit) —
   in scope, fixed as part of B1's own edit.
2. **`engram.duplicates.test.mjs`** — one test (`share: RETURNS the
   accounting`) asserted `result.unprovenanced` on `share()`'s return; removed
   (not named by B3's "stay green untouched" list, which only covers
   `:46-65`).
3. **`engram.upstream-scope.test.mjs`** — one test (`share: threads
   _upstreamRecordIds through to dualWriteRecords`) asserted `share()` calls
   `dualWriteRecords()`; removed (same reasoning — B3's audit list names this
   file but the removed test is not in its protected scope, which is about
   `dualWriteRecords()` staying, not about every test in files that import it).
4. **`cli.backend-fallback.test.mjs`** — 4 of its `#641` cases asserted
   `share` fails on an absent/broken/stated-but-absent engram binary; all 4
   retargeted to the new reality (share succeeds regardless, R11) rather than
   removed, since the substitution mechanism itself (`FALLBACK_OPS`,
   `selectBackend`) is untouched and the flagship "no engram, unstated: SUCCEEDS
   on the fallback" test (line 124) was NOT affected — substitution happens
   upstream of `share()`'s body and never even reaches the reshaped code on
   that path.
5. **`cli.upstream-config.test.mjs`** — ALL 8 of its cases drive the real
   `memory:share` CLI end to end and assert on `upstreamScope`/`configError`
   text that only ever reached `cli.mjs` through `share()`'s pre-#874 call
   into `dualWriteRecords()`. Once that call is gone, `share()`'s return value
   can never carry `upstreamScope` again — the entire file's subject is
   retired. Deleted, along with the three now-permanently-dead `cli.mjs` print
   blocks that fed off it (`unprovenanced`, `upstreamScope`, `dedupedUpstream`
   — `reportDuplicates`, fed by `indexCount`/`duplicates`, is untouched and
   still fires). This directly contradicts B3's own audit note ("stay green
   untouched") — recorded as a correction to that note in design.md's O1
   section, not silently overridden.

None of this touched `dualWriteRecords()` itself — its shape, its exports, and
its two protected direct-call test files (`engram.upstream-scope.test.mjs`,
`engram.duplicates.test.mjs:46-65`) are byte-identical to before B1, confirmed
green throughout. What changed is which OTHER tests could still observe
`dualWriteRecords()` THROUGH `share()` — none can, after R11.

## Orphaned i18n keys (left in place, not removed)

Per the hard constraint ("remove keys that become orphans ONLY if the i18n
coverage test demands it"): `brain/scripts/i18n/coverage.test.mjs` has no
unused-key check, so none of the following were removed, only noted:

- `memory.share.skippedHydrated` (en/es) — orphaned by B1 (the F1 gate's cli.mjs print site is gone)
- `memory.share.unprovenanced`, `memory.share.upstreamConfigUnreadable`, `memory.share.upstreamConfigUnreadableNoRef`, `memory.share.upstreamUnavailable`, `memory.share.upstreamUnnamed`, `memory.share.dedupedUpstream` (en/es) — orphaned by B1 (the three `cli.mjs` print blocks that read them are gone, `cli.upstream-config.test.mjs` — their only remaining reader — is gone)
- `memory.share.secretFound` (en/es) — orphaned by B5 (`scrubMaterializedChunks`, its only caller, is deleted)

## Deviations from tasks.md / design.md

1. **B1's blast radius exceeds "adjust `engram.share.test.mjs` assertions"**:
   see "Collateral discovered" above — 3 additional files needed fixes, 1 file
   was deleted outright, and 2 `cli.mjs` print blocks beyond `skippedHydrated`
   were removed as dead code. All necessary, unavoidable, structural
   consequences of R11 ("share() completes with the engram binary absent"),
   not independent scope decisions.
2. **`FALLBACK_OPS` (`backend-selection.mjs`) intentionally NOT touched**:
   `share` stays listed even though `engram.share()` no longer fails on an
   absent binary. Considered removing it (mirroring `save`'s precedent from
   split A) but rejected: the flagship #641 substitution test (unstated +
   absent binary → substitutes to `plainfiles.share()`, prints the notice) is
   the scenario the whole mechanism was built for, substituting is not
   incorrect (both backends now do effectively the same bare-reindex work in
   that case), and touching it would have widened B1 into a THIRD file
   (`backend-selection.mjs`) beyond what R11 strictly requires. Flagged here
   for the maintainer/2.4 rather than decided unilaterally.
3. **`_defaultResolveDir` left as a genuine orphan** (B5): not named in
   tasks.md's row-4 list (`_defaultChangedChunkFiles`,
   `assertExportDestinationIsRead`, `scrubMaterializedChunks` only); deleting
   it would have been correct cleanup but outside the ratified ledger's literal
   scope. Zero callers, zero tests, exported — flagged for 2.4.
4. **O1's own "stay green untouched" claim did not hold for
   `cli.upstream-config.test.mjs`** — see "Collateral discovered" item 5 and
   design.md's O1 section, which now carries the correction.
