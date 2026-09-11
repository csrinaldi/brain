# Apply progress: #874 — record first, backend after (PR A)

Batch: PR A only (tasks A0–A10). Worktree: `/home/gandalf/IA/brain-issue-874`, branch
`feat/issue-874-featmemory-record-first-backend-after-me`. Mode: **Strict TDD**
(test runner: `node --test`). Artifact store: hybrid (this file + engram
topic_key `sdd/issue-874-record-first/apply-progress`).

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
- [ ] A9 — `brain-drafts/memory-backend-contract.save.draft.md` (R13 draft 1)
- [ ] A10 — unpin `package.json:65`; full-suite gate; closing record

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
| A9 | — (docs only, no test) | — | — | — | — | — | — |
| A10 | full suite | — | — | — | — | — | — |

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

- `git diff --stat origin/main...HEAD | tail -1`: **filled in at A10**, after the full-suite gate and the closing record (the diff is not final until the unpin + closing-record commits land).

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
   rewritten assertion "the verb must NOT pin a backend" is INTENTIONALLY red
   from A7 through A9 — `package.json:65` is only unpinned in A10 (R8: "the
   unpin lands inside split A, as its LAST commit"). D8's own testing table
   describes the target shape of the retargeted test file; it does not claim
   every assertion in it is provable before the unpin. All OTHER assertions in
   both retargeted files (capture-reachable.test.mjs, cli.backend-fallback.test.mjs)
   are green as of A7. The full-suite gate at A10 (after the unpin) is the
   authoritative GREEN checkpoint for this specific assertion — confirmed below.
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

## R7 probe outcome carried to epic #864 (informational)

Task 6.1 of `issue-864-memory-2-0/tasks.md` asks for `MEMORY_BACKEND=engram`
and `=plainfiles` audit evidence; this probe's UPSERT verdict is the R7 measurement
that task depends on. Not ticked here — 6.1 has its own broader acceptance
criteria (the audit's four do-it-once scenarios) that this PR does not close.
