---
status: draft
issue: 874
---

# Proposal: #874 — record first, backend after (epic #864 task 3.2)

## Intent

Under `MEMORY_BACKEND=engram` an agent capture has no durable path: `memory:save` is pinned to
`plainfiles` (`package.json:65`), `engram.save()` is `unsupportedOp` (`engram.mjs:1121`), and the
only door into the backend is the MCP `mem_save` tool, which writes past `.memory/records/`
entirely. `share()` then runs the pipe backwards — `engram sync --export` → read the chunks it just
wrote → scrub them → dual-write records — so the backend is the producer and the durable layer is
the derivative. That inverts rule 2 of `brain/core/methodology/memory-backend-contract.md`.

This change makes a capture a record first and the backend a projection of it: `engram.save()`
writes a record exactly as `plainfiles.save()` does, then hydrates the active backend from that one
record; `share()` becomes "commit what is already true". The chunk export/read/scrub subsystem
(ledger rows 1–5) dies with it.

## Rulings (for ratification)

| # | Ruling | Why |
|---|--------|-----|
| R1 | `engram.save()` **duplicates** `plainfiles.save()`'s body (explore approach A). No shared-core extraction. | The correctness-critical logic already lives in shared libs (`capture-provenance.mjs`, `supersedes.mjs`, `buildRecord`/`appendRecord`/`rebuildIndex`, `secret-scrub`); only the gate *ordering* is duplicated, and reshaping the heavily-tested `plainfiles.save()` is the scope creep the ticket forbids. |
| R2 | Drift is pinned by a **cross-backend parity test**, not by a refactor: both backends refuse the same inputs in the same order and emit the same record shape. | Makes the duplication observable at test time instead of silent at review time. |
| R3 | `hydrate({root, recordId})` is **one `_defaultEngramSave` call** with `topic = <record id>`, exposed as an injectable `_engramSave` seam. `importMemory` stays the bulk fallback, unchanged. | The primitive exists and is already in production (`featureResume`); the bulk path pays a whole-store read back (`_defaultExistingTopicKeys`, 0.67 s / 2248 obs) for one record. |
| R4 | `hydrate({recordId})` **does take** the #820 hydration guard, non-blocking. | The race is not hydrate-vs-hydrate (upsert by topic is convergent) but hydrate-vs-bulk-`importMemory`: `engram import` INSERTS from a snapshot, so a record hydrated inside that window becomes a second row — the exact #820 class 1.2a is healing. Contention is a skip, never a wait. |
| R5 | Engram binary absent, non-zero exit, or guard contended during hydrate ⇒ `save` returns `{id, file, written: true, hydrated: false, deferred: true, reason}`, says it on stderr, **exits 0**. The `rebuildIndex` failure path keeps #637's annotated rethrow. | The record is already durable before hydrate runs; a backend failure must never read as a lost capture (contract, Failure discipline). Index failure is a different situation and stays fail-loud. |
| R6 | `topic_key` is **always the record's own content-addressed id**. Re-hydrating one record upserts that one row (idempotence). Two sessions on one topic ⇒ two records ⇒ two rows; the later carries `--supersedes` declared by its writer (#805, unchanged). Hydrating a superseding record does **not** replace or delete the superseded row. | Rows are a derived index; records are never deleted (contract, Deletion). A 1:1 record↔row mapping is what `memory:audit` measures and what makes hydrate idempotent. |
| R7 | The atomicity of `engram save --topic` is **not assumed**: unit tests drive the seam, and split A records a one-off probe against the installed binary (v1.20.0) in `design.md`. | Worst case is a duplicated row — detectable by `memory:audit` (`rec-` rows vs distinct keys) and reconcilable adapter-side, which the contract's Deletion section already permits. A guard-free design leaning on an unverified CLI promise is not. |
| R8 | The `package.json:65` unpin lands **inside split A, as its last commit** — not as its own PR ahead of A. | A standalone unpin would route `memory:save` under the repo default straight into `unsupportedOp`; the unpin is what makes A reachable and provable end-to-end, so it follows the code it depends on. |
| R9 | `scrubRecordsFile()` (`secret-scrub.mjs:137`) is **neither wired into `save` nor deleted** here; its disposition is handed to 2.4, which owns `secret-scrub.mjs`. | `save`'s guarantee is refusal *before* `appendRecord`; inserting a post-write file redactor would downgrade fail-closed into scrub-after-write. It is a remediation reader for an already-written store (1.2a/2.4 territory), not a capture chokepoint. |
| R10 | The #469 re-proof is two tests in **split A**: (i) a secret in `content` makes `engram.save()` throw with `_appendRecord`, `_rebuildIndex` and `_engramSave` never called; (ii) a call-order assertion that scan → append → hydrate holds. Invariant stated verbatim: **a secret in `content` never reaches disk — neither `.memory/records/*.jsonl` nor the engram store.** | #469 guarded chunks materialized by an export; under record-first nothing is materialized, and the single producer path is scanned before it writes. Row 4 may only be deleted once that invariant is proved somewhere else — so A proves it and B deletes it. |
| R11 | `share()` under engram becomes the `plainfiles.share()` mirror: `rebuildIndex` self-check returning `{indexCount, duplicates}`. No `_export`, no `_readObservations`, no `dualWriteRecords` — **and no `requireEngram()`**. | Rule 3: `share` must complete when the backend's binary and private files are absent. Keeping `requireEngram` would make the record-first `share` fail on exactly the machines rule 3 is about. |
| R12 | The `_ensureSymlink(root)` call inside `share()` is **retained** in B even though its stated precondition (`engram.mjs:210-221`: "BEFORE the export") is gone. | Confining the symlink to `setup()` is ledger row 6 and 2.4's named deliverable; D3's boundary beats tidiness. Alternative in Risks. |
| R13 | The conformance flip ships as **two `brain-amendment` drafts** under `brain-drafts/`: A's flips the `save` column and the `save`/`hydrate` "Today:" notes; B's flips rule 2 `not yet` → `yes`. Rule 3 stays `not yet` (2.4). | **Correction to the launch brief**: the contract is already promoted at `brain/core/methodology/memory-backend-contract.md` (conformance table at :99–105), so the drafts amend a live Tier-2 file via `brain:promote`, not an unpromoted draft. Rule 2 is only true once `share` stops exporting, so it cannot flip in A. |
| R14 | PR shape: **A then B, stacked to main**. A = a new sub-ticket (`Part of #874`); B `Closes #874`. A aims at ≤400 changed lines and takes `size:exception` only if the tests push it over; B carries `size:exception` justified as pure deletion (≈ −1150). | Different risk profiles want separate reviews: A is new logic under strict TDD, B is mechanical deletion. Each PR commits exactly one new record + one index line via `memory:save`; no `.memory/` hydration is ever staged. |

## Scope

### In scope (split A — sub-ticket)
- `engram.save()` — mirror of `plainfiles.save()` (provenance #738, `--supersedes` #805, secret scan before append, `appendRecord`, `rebuildIndex`), then `hydrate({recordId})`.
- `hydrate({root, recordId})` on the engram adapter — single-record upsert under the #820 guard, `deferred`/`contended` return shape per the contract.
- `package.json:65` unpin (last commit of A).
- Tests: new `engram.save.test.mjs`, `engram.hydrate.test.mjs`, cross-backend parity test; rewritten `engram.save-search-unsupported.test.mjs` (`search` stays unsupported); extended `cli.save-search.test.mjs`.
- `brain-drafts/memory-backend-contract.draft.md` — `save` column flip.

### In scope (split B — closes #874)
- `share()` reshaped to the plainfiles mirror; ledger rows 1–3 deleted, then row 5 (`engram.share.test.mjs`, 1069 lines), then **row 4 last** (`_defaultChangedChunkFiles`, `assertExportDestinationIsRead`, `scrubMaterializedChunks`) citing R10's tests.
- `chunk-boundary.test.mjs` allowlist: the `engram.mjs:61` row only — `cli.mjs:615` and `migrate-v1.test.mjs:13` stay (they die at 2.4).
- `brain-drafts/` — rule 2 conformance flip.

### Out of scope
- `mem_save` / the MCP plugin — #863 D2(a) declared it non-conforming working memory and left it untouched. No wrapper, no bridge, no server change.
- Ledger rows 6–7 (manifest untracking, `.gitattributes` merge driver, `bootstrap.sh` driver registration, the `.engram` symlink's confinement, `.memory/legacy/*.gz`, `secret-scrub.mjs`'s gunzip path, `.gitignore` chunk block) — 2.4, sequenced after this by D3.
- 1.2a's one-time heal of stranded MCP observations.
- Any refactor of `plainfiles.save()`; `importMemory`, `pullMemory` and the hydration guard's own behaviour.
- `session-start/spec.md` REQ-3 (manifest restore) — 2.4 amends it.

## Capabilities

### New capabilities
- `record-first-capture`: the producer path on every backend — a capture becomes a record, then the backend is hydrated from that record; `share` exports nothing. Delivered as this change's `openspec/changes/issue-874-record-first/spec.md` (repo convention: one `spec.md` per change, cf. `issue-864-memory-2-0/spec.md`).

### Modified capabilities
- None in `openspec/specs/`. The behavioural contract being changed lives in `brain/core/methodology/memory-backend-contract.md` and is amended by R13's drafts.

## Approach

`engram.save()` reproduces `plainfiles.save()`'s gate order — caller-mistake refusals (`type`,
`--issue` shape) → actor/provenance (#738) → `classifySupersedes` (#805) → `buildRecord` →
`scanTextForSecrets` over the serialized candidate → `appendRecord` → `rebuildIndex` — and then adds
the one new step: `hydrate({root, recordId: candidate.id})`. Hydration shells out through the
existing `_defaultEngramSave` primitive with `--topic <record id>`, wrapped in the #820 guard, and
reports `deferred` instead of throwing. `share()` loses its export/read/scrub body and keeps only
the `rebuildIndex` self-check it already falls back to at `engram.mjs:250-257`. All seams
(`_appendRecord`, `_rebuildIndex`, `_engramSave`, the guard) stay injectable so no unit test touches
a real binary — the pattern `engram.mjs`'s existing tests already use. Strict TDD is active: tests
first, per slice.

## Affected areas

| Area | Impact | Description |
|------|--------|-------------|
| `brain/scripts/memory/backends/engram.mjs` | Modified | `save()` implemented; `hydrate()` added; `share()` reshaped; rows 1–4 removed (B) |
| `package.json:65` | Modified | `MEMORY_BACKEND=plainfiles` pin removed (A, last commit) |
| `brain/scripts/memory/backends/engram.share.test.mjs` | Removed | 1069 lines mocking the deleted seam (B) |
| `brain/scripts/memory/backends/engram.save*.test.mjs`, `engram.hydrate.test.mjs` | New/Modified | Record-first proof + #469 re-proof (A) |
| `brain/scripts/memory/cli.save-search.test.mjs` | Modified | `save` reachable under `MEMORY_BACKEND=engram` (A) |
| `brain/scripts/memory/chunk-boundary.test.mjs` | Modified | One allowlist row removed (B) |
| `openspec/changes/issue-874-record-first/brain-drafts/` | New | Two contract amendment drafts (R13) |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| `engram save --topic` inserts instead of upserting on some version | Med | R4's guard + R7's probe; a duplicate row is visible to `memory:audit` and reconcilable adapter-side |
| R12 leaves `share` creating a `.engram` symlink for no reason | High (cosmetic) | Documented as 2.4's line; maintainer may override and fold it into B |
| A exceeds the 400-line budget | Med | Production code ≈150–200 lines; `size:exception` on test volume rather than a split that ships a half-producer |
| An older checkout still runs `engram sync --export` after this merges | Med | Harmless — it writes local chunks nobody reads back; stated in the PR body |
| B lands without A (ordering slip) | Low | Stacked PRs; B's body names A's merge commit and R10's tests |

## Rollback

Each split is a single squash merge and reverts independently: reverting B restores the export/scrub
subsystem and its 1069-line test file; reverting A restores `unsupportedOp` and the `plainfiles` pin.
Records already written are unaffected either way — they are append-only and backend-independent, and
a reverted hydrate leaves rows that the next `memory:pull` reconciles. The contract drafts are not
promoted until the matching PR merges, so a revert leaves no doctrine claiming a capability that
regressed.

## Dependencies

- #805 (`--supersedes` writer) and #738 (provenance at capture) — both shipped; `engram.save()` must reuse those exact helpers, never a second path.
- #820's hydration guard — consumed, not modified.
- 2.3 (#247) landed the read-back boundary and the ledger; 2.4 is blocked on this change (D3).

## Success criteria

- [ ] `MEMORY_BACKEND=engram npm run memory:save -- …` writes a record to `.memory/records/`, reindexes, and the record is present in the engram store afterwards.
- [ ] A secret in `content` is refused before `appendRecord`, with no record file and no engram row — proved by R10's two tests.
- [ ] Hydrating the same record twice yields one row; two records on one topic yield two rows, the later carrying `supersedes`.
- [ ] With the engram binary absent, `save` exits 0, the record is on disk, and the output says `deferred`.
- [ ] `share()` under engram runs `rebuildIndex` only: no `engram sync --export`, no chunk read, no `requireEngram`.
- [ ] `chunk-boundary.test.mjs` passes with the `engram.mjs:61` allowlist row removed; the other two rows intact.
- [ ] Full suite green under both backends; two contract drafts staged for the maintainer's promotion.

## Proposal question round

Three points need the maintainer's word before spec/design freeze:

1. **R12** — retain `_ensureSymlink` in `share()` (D3-clean, leaves a purposeless artifact write) or remove it in B (tidy, borrows one line from 2.4)?
2. **R6** — confirm the backend keeps a row per record and never replaces a superseded row, i.e. "current truth" in the backend is a reader concern, not a hydration concern.
3. **R14** — confirm the sub-ticket for split A (title, `Part of #874`) rather than shipping both slices under #874 with a `size:exception`.
