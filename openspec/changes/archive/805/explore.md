---
status: draft
issue: 805
---

# Explore: a writer for `supersedes`

## Answer up front

The `supersedes` field is fully specified, hashed, indexed, and read by the migration
importer — everything except the two in-tree producers that could put it on a fresh record.
`memory:save` (both the CLI parser and the `plainfiles` backend) drops it silently; `engram`'s
`save` is `unsupportedOp` entirely. This ticket adds `--supersedes <id>` to `memory:save`,
threads it to `buildRecord` (already accepts it), and adds one refusal: an id not present in
"the store". No reader/index change is required — `supersedes` already round-trips through
`buildIndexEntry` and the hash. Scope should stay WRITER + validation; a `resolveSupersedes`
reader helper is explicitly optional and better deferred (see Approaches).

## Current state — measured

| Layer | File:line | State |
|---|---|---|
| Field declared | `brain/scripts/memory/lib/format.mjs:40` | `OPTIONAL_FIELDS = ['issue', 'supersedes', 'source']` |
| Part of identity | `format.mjs:92-98` (`computeRecordId`) | folded into `hashInput` when present |
| `buildRecord` accepts it | `format.mjs:115-123` | forwards to `hashInput` and to the record, R3-omitted when absent |
| Index carries it | `format.mjs:252-258` (`buildIndexEntry`) | copied into the index entry when present |
| Read-shape validation | `format.mjs:133-157` (`validateRecord`) | only the null-vs-omitted check (R3); no `rec-<16hex>` shape check, no existence check |
| Write-shape validation | `format.mjs:188-202` (`validateWritableRecord`) | W1 (`source`), W2 (`issue`) only — **no W3 for `supersedes`** |
| CLI save parser | `cli.mjs:771-819` | flags: `type/project/issue/scope/topic`. **No `--supersedes`.** `opts` object (line 791) omits it |
| `plainfiles.save` | `backends/plainfiles.mjs:69-192` | destructures `{ type, project, issue, scope, topic }` (line 76) — **no `supersedes`**; `buildRecord` call (line 124) omits it |
| `engram.save` | `backends/engram.mjs:1108-1110` | `unsupportedOp("save", "engram", …)` — no save path exists at all |
| Index/reader resolution | `lib/store.mjs` (`rebuildIndex`, `readRecords`, `readRecordIds`) | dedup is keyed by `id` only; **no code anywhere resolves a `supersedes` chain** — a superseded record still appears in every read, indexed and returned like any other |
| Audit already counts it | `lib/audit.mjs:76-83` (`coverage`) | `supersedes: records.filter(r => typeof r.supersedes === 'string' && r.supersedes !== '').length` — the epic 6.1 target metric; today's baseline is 0 because nothing writes it |
| Import (read direction) reads it | `lib/engram-import.mjs:64-74` | recovers `supersedes` from `**Supersede:**` prose (engram export → record) — the *other* direction already works |
| Provenance round-trip | `lib/provenance.mjs:108,218-230` | `parseProvenance`/`renderProvenance` already carry `supersedes` through the `**Supersede:**` marker; pinned by `plainfiles-roundtrip.integration.test.mjs` (a full supersede-chain fixture already exists) |
| Cold-review poster | `brain/scripts/review/poster.mjs` | **no `buildRecord`/`appendRecord`/save call at all** — it posts PR/issue comments only. The "second producer" row in `memory-backend-contract.md` (writes a record whose `supersedes` = the previous round) is aspirational, gated on #851 slice 1 / consumed by #880 — not present in the tree today |

**"The store" is already defined**, in `openspec/changes/issue-864-memory-2-0/spec.md`
Vocabulary (line 24-27): *local `.memory/records/` of the worktree, plus the records at
`origin/main`*. A record only on another host's unmerged worktree is not in the store, by
definition — the refusal check must not try to reach across worktrees.

Both halves already have a reusable primitive:
- **local** — `store.mjs#readRecordIds({recordsDir})` → `Set<string>` of every id already on
  disk (no `fs` surprises — same file used by dedup today).
- **origin/main** — `lib/upstream-records.mjs#upstreamRecordEntries({root, ...})` → on
  `ok:true`, `byId: Map<string,string>` built from `git ls-tree -r origin/main -- .memory/records`
  (#701's own scoping helper). On `ok:false` it reports *why* (no ref resolved, unreadable
  config) rather than silently treating "couldn't check" as "not in the store" —
  `evidence-reader-empty-on-failure` is the exact trap the refusal must not fall into.

Neither of those is new code to write; the writer path composes them.

## Acceptance, as testable statements (from spec.md, epic tasks.md:30, ADR-0034)

1. `memory:save --supersedes <id> ...` produces a record whose `supersedes` field equals
   `<id>`, on both `plainfiles` (today) — the CLI parser change is backend-agnostic, so
   engram's `save` gains the same flag shape even while it stays `unsupportedOp` overall.
2. `<id>` is checked against **the store** (local `records/` ∪ `origin/main`, spec.md
   Vocabulary) *before* the record is written; an id absent from both is **refused**, not
   silently accepted (spec.md: *"the store refuses a `supersedes` that names no record in it"*).
3. The link is **declared by the writer**, never inferred — no topic-key or content-similarity
   guess (spec.md, design.md §6 — a `topic` field was explicitly rejected as an ADR-0017
   amendment).
4. The four-step correction sequence (issue body: correct-in-engram → `memory:share` →
   remove-the-stale-file → `memory:reindex`) is written down somewhere a reader meets it — the
   issue names this as owned by the ticket, separate from the writer itself.
5. A ruling on deletion is recorded (legitimate only pre-push/pre-read, or prohibited
   outright) — currently undocumented and unenforced.
6. `npm run memory:audit`'s `coverage.supersedes` moves off 0 once this ships and a record
   uses the flag (epic task 6.1's exit number).
7. ADR-0034's auto-merge enablement precondition: *"undo"* for a lane merge means **a new
   `supersedes` record shipped on the next lane** — never a force-push, never a revert of a
   record (ADR-0034 line 84-86; `memory-backend-contract.md` Deletion section, line 90-95).
   This slice does not implement auto-merge; it only has to make that undo *expressible*.

## What is explicitly NOT required by this slice

- Reader-side "resolve to latest" (hiding a superseded record from `search`/`readRecords`) —
  #874 and #880 are the named future consumers; spec.md's scenarios test that `supersedes`
  is *written and refusable*, not that readers hide anything yet.
- `engram.save` becoming a real capture path — it stays `unsupportedOp`; only its flag
  *acceptance shape* needs to match `plainfiles` if the CLI parser is shared (it already is:
  `cli.mjs`'s parser is backend-agnostic and forwards the same `opts` object to whichever
  backend is selected).
- Chain resolution (a supersedes-a-supersedes walk) or fan-in (two records both superseding
  the same id) — name these as open questions for the proposal, do not resolve them here.

## Approaches (for the proposal to choose between)

**A — Writer + validation only (minimal).** Add `--supersedes` to the CLI parser
(`cli.mjs:791`), forward it through `plainfiles.save`'s opts (`plainfiles.mjs:76,124`), add a
new `validateWritableRecord` rule (W3) or a store-level check using `readRecordIds` +
`upstreamRecordEntries` for the "absent from the store" refusal. No reader changes.
- *Tradeoff:* fastest, smallest diff, satisfies every spec.md scenario literally. Leaves chain/
  fan-in and reader resolution to #874/#880 as designed.

**B — A + a cheap `resolveSupersedes` reader helper.** Same as A, plus a pure function in
`store.mjs` or a new module that, given a record list, returns "latest per chain" — offered
to `search`/`audit` but not wired in by default.
- *Tradeoff:* front-loads work #880 will need anyway (review rounds as records chained by
  `supersedes`), but risks scope creep on a ticket the epic explicitly scoped to "a writer".
  Decide only if it is genuinely cheap; the ticket's own framing ("decide in the proposal")
  suggests this is the swing vote for size.

**C — Where does refusal live?** Candidate chokepoints: (1) `validateWritableRecord` in
`format.mjs` (pure, but it has no filesystem access — cannot check "the store" without a
signature change / injected id-set); (2) a new pre-write check in `plainfiles.save` itself,
composing `readRecordIds` (local) + `upstreamRecordEntries` (origin/main) before calling
`appendRecord`. (2) matches the existing architecture better — `format.mjs`'s own header
states pure-function-only, no fs, no child process — and mirrors how `upstream-records.mjs`
is already consumed by `share`'s scoping logic, not by `format.mjs`.

## Open questions for the proposal

1. **Chain vs fan-in**: does refusal need to check that the superseded record is not *itself*
   already superseded (discouraging a chain that skips a link), or is any id present in the
   store sufficient? Spec.md only requires "names no record in it" — silent on chains.
2. **Self-supersede** (`--supersedes` equal to the record's own about-to-be-computed id):
   structurally near-impossible since `id` is a hash of the content including `supersedes`
   itself (a record cannot know its own id before `supersedes` is chosen) — worth a one-line
   note in validation rather than a real risk.
3. **Cross-project ids**: `supersedes` has no project-scoping in the schema — should a
   `brain` record be refusable from superseding a foreign-project id, or is that the writer's
   problem (same trust model as `issue`, which is also unscoped)?
4. **Approach B decision** (reader helper) — see above; recommend deferring unless proposal's
   author finds it near-zero-cost.
5. **The four-step correction sequence and the deletion ruling** — these are documentation
   tasks, not code. Candidate homes: `memory-format.md` (sequence) and
   `memory-backend-contract.md`'s existing "Deletion" section (line 90-95, already states
   "records are never deleted" — the ruling may already BE written there; the proposal should
   check whether this is a doc gap or already closed by that paragraph and #805 only needs a
   cross-reference).
6. **`engram.save`'s flag parity**: does it need to *accept and reject* `--supersedes`
   explicitly (so `unsupportedOp`'s message can say so), or does today's blanket
   `unsupportedOp("save", ...)` already cover it with no change needed?

## Split candidates (size/risk)

- **Slice 1 (recommended minimal, Approach A):** CLI flag + `plainfiles.save` forwarding +
  refusal check (local + origin/main) + validation tests. Touches `cli.mjs`,
  `backends/plainfiles.mjs`, possibly one new small helper module or an addition to
  `format.mjs`/`store.mjs`. Estimated: small (~80-150 changed lines across 3-4 files + tests).
- **Slice 2 (optional, if B is chosen):** `resolveSupersedes` reader helper + its tests —
  can ship as a follow-on ticket instead, feeding #880 directly, without blocking this one.
- **Doc slice (small, can ride with Slice 1):** the four-step sequence + deletion ruling,
  landing in `memory-format.md` / `memory-backend-contract.md`.

## Risks

- **`upstreamRecordEntries` can report `ok:false`** (no upstream ref resolves, e.g. a shallow
  clone or no `origin` remote) — the refusal check must degrade the same way `share`'s scoping
  does today (state the reason, do not silently treat "couldn't check" as either "refuse
  everything" or "allow everything" without saying which). This is the same
  `evidence-reader-empty-on-failure` class #574/#701 already had to solve once; reuse the
  pattern, don't re-derive it.
- **A `supersedes` pointing at a record only on another host's unmerged worktree** — by
  spec.md's own Vocabulary this is *correctly* refused (not "in the store"), but the error
  message needs to say why, or an agent mid-session will read a correct refusal as a bug.
- **Union merge of two records both superseding the same id** — no ordering/fan-in rule
  exists; not this ticket's job to resolve (see open question 1), but the proposal should say
  out loud that it is deferred, not silently unhandled.
- **The auto-merge enablement precondition (ADR-0034)** — this ticket is a hard prerequisite
  for *enabling* `mrAutoMerge`, not for building it (2.5 already exists and can be refused
  before #805 lands). Scope discipline: do not let this ticket grow to include any lane/tier
  work — that is #862/#887/#889 territory, already shipped or in flight per recent commits
  (`ec117141`, `ffe038a0`, `2d97cf61`, `16493771`).

## Files with tests first (STRICT TDD)

- `brain/scripts/memory/lib/format.test.mjs` (311 lines) — extend near the existing
  `supersedes`-adjacent tests (line 84 `R3 absent … OMITTED`, line 257 `buildIndexEntry …
  carries issue/supersedes`) with a write-gate test if a W3 rule is added.
- `brain/scripts/memory/lib/store.test.mjs` (296 lines) — if refusal logic lands here, or a
  new sibling `store.supersedes.test.mjs` if it is a new module (matches the repo's own
  convention of `store.duplicates.test.mjs` as a focused sibling file).
- `brain/scripts/memory/cli.save-search.test.mjs` (83 lines) — CLI-level test extending the
  existing `runCli(['save', ...])` pattern (line 26-40) with `--supersedes`, both the happy
  path and the refusal path (needs a `BRAIN_MEMORY_TEST_ROOT` fixture with a pre-existing
  record id to supersede, and a case with an unknown id to refuse).
- `brain/scripts/memory/lib/audit.test.mjs` (174 lines) — already has `coverage()` tests
  parametrized on `supersedes` (lines 89-96, 136-156); a new record-with-supersedes fixture
  through the real writer is an integration check worth adding, not just the pure-function one
  that already exists.
- No changes expected in `format.mjs`'s pure hash/serialize tests beyond the write-gate case —
  the read/hash/index path already works and is pinned.
