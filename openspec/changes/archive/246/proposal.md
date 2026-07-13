# Proposal — The `plainfiles` memory backend (slice C3)

> **Status:** planned · **Issue:** #246 (awaiting `status:approved`)
> **Depends on:** #229 C4 (records-only cutover — export/import legs, both seam-injected, merged into
> `feature/v2.0.0`). C4 already built BOTH round-trip legs; C3 reuses them, it does not rebuild them.
> **Contract:** [spec.md](spec.md) · [design.md](design.md) · [tasks.md](tasks.md).

## Context

Track C set out to make `.memory/` a **brain-owned, backend-agnostic, human-readable** durable format —
the durability guarantee made executable. But today that claim is `n=1`: `engram` is the ONLY
`MEMORY_BACKEND` inhabitant. "Backend-agnostic" and "a `git clone` + `grep` can answer *what did we decide
about X*" are ASSERTED, not PROVEN — there is no second consumer to interchange with, and DoD §11.4
(every abstraction has ≥2 real consumers or is rejected at a checkpoint — no new `n=1` ports) is not met
for the memory-backend adapter (ADR-0004).

C3 ships the second inhabitant: `plainfiles`, a backend where `.memory/records/*.jsonl` +
`.memory/index.jsonl` are SIMULTANEOUSLY the live store and the durable git-committed store — no external
DB, no binary, zero dependencies. It makes the durability claim testable: with `MEMORY_BACKEND=plainfiles`
you can `save` and `search` clinical/decision memory with nothing installed but Node, and a bare
`git clone` + `grep` genuinely answers questions about past decisions.

The genuinely new machinery is small because C4 already did the heavy lifting. C4 (#229) built and
seam-tested BOTH round-trip legs: the export leg (engram→records via `share()`/`dualWriteRecords()`) and
the import leg (records→engram via `pull()`/`importMemory()`). What is NET-NEW here is only the direct
records read/write path plus its CLI surface.

## What this slice ships (CODE + artifacts)

1. **D1 — `plainfiles.save()`.** Direct write INTO `.memory/records/`: build (or accept) a record, run
   `scanTextForSecrets` over the candidate BEFORE any write (scan-then-write, mirroring
   `dualWriteRecords`'s exact order — reuse `secret-scrub.mjs`), then `appendRecord` + `rebuildIndex`
   (reuse `store.mjs`). Records ARE the store; there is no separate persistence step.

2. **D2 — `plainfiles.search()`.** Direct read FROM `.memory/records/`: reuse
   `store.mjs#readRecordObservations` and filter in Node (substring/regex over `content`/`title`/`type`).
   **ZERO binary dependencies.** `rg` may be shelled to IFF present (`which rg` idiom) purely as an
   optional accelerant — NEVER a hard dependency, NEVER in `package.json`/`install-tools.sh`.

3. **D3 — `plainfiles.share()` / `plainfiles.pull()`.** No data movement (records are the store):
   `share()` is a self-check `rebuildIndex()` (`index.jsonl` is already the live name); `pull()` is
   `git pull` + `rebuildIndex()`, records-only, with NO engram import step. Semantics WRITTEN in design.md.

4. **D4 — `cli.mjs` wiring for the NET-NEW `save`/`search` verbs.** `VALID_OPS` has neither `save` nor
   `search` today — these are new dispatcher verbs. Add them plus argv/flag parsing for `save`'s
   structured fields, plus en + es i18n entries (repo convention, drift-tested).

5. **D5 — `plainfiles.setup()`.** Minimal: ensure `.memory/records/` is present/well-formed. No engram
   symlink, no engram-specific merge-driver registration beyond what is backend-agnostic.

6. **D6 — the two-direction round-trip test (the CP-C3 evidence).** See below. Excluded from the diff
   budget (`.memory/**` and `**/*.test.mjs` are budget-excluded), so it does not threaten the 400 line.

## Scope boundary — MVP vs full (the budget rationale)

`plainfiles` MVP implements **`save`, `search`, `share`, `pull`, `setup`**. It returns an explicit
**"unsupported" error** (NOT a silent no-op) for **`index()`, `featureCheckpoint()`, `featureResume()`**.

Rationale: `.memory/**` and `**/*.test.mjs` are excluded from the 400-line budget, and both round-trip
legs already exist and are reusable, so the NEW production code (plainfiles.mjs save/search/share/pull/
setup + cli.mjs `save`/`search` wiring + i18n) plausibly fits ONE reviewable slice under 400. The REAL
scope-creep risk to the budget is fully implementing `index()`/`featureCheckpoint()`/`featureResume()` for
plainfiles — `index()` has no plainfiles target (it projects `brain/` docs into engram), and
`featureCheckpoint`/`featureResume` would need a plainfiles-native projection. Deferring those three
behind a clear "unsupported" error (loud, documented, not a silent trap) keeps C3 to one slice while
leaving an honest, discoverable seam for a follow-up.

## The round-trip IS the CP-C3 evidence (both directions, in-scope)

N records covering every `RECORD_TYPES` member + a `supersedes` chain → backend A write →
`memory:share` → wipe → `memory:pull` backend B → **record-level equality**, driven both ways
(engram↔plainfiles). It stays cheap and hermetic by reusing C4's proven injection pattern — NO live
engram binary, NO live git in `npm test`:

- **engram→plainfiles:** `dualWriteRecords(tmpRoot, {_readObservations: () => fixtureObservations})`
  populates a temp `.memory/records/`, then `plainfiles.search(query, {root: tmpRoot})` asserts the
  content surfaces.
- **plainfiles→engram:** `plainfiles.save(...)` appends to a temp root, then
  `importMemory({root: tmpRoot, _requireEngram: () => 'engram', _engramSave: captureCalls})` asserts the
  record surfaces in the captured `engram save` calls.

**Anti-fold note.** C3 is its OWN slice, not folded into C4 — C4 (#229) is CLOSED/MERGED and cannot
receive scope, and C4 explicitly ruled "plainfiles is C3's job; folding would blow C4's budget past one
reviewable slice." If (against the exploration's read) `save + search + cli-wiring + share/pull` cannot
hold under 400, split into C3a (save/search/cli) + C3b (share/pull + round-trip). The exploration's line
estimate says it fits one slice; no split is planned.

## Out of scope (non-goals)

- **The C4 chunk-migration completion.** `memory:share` still materializes `.memory/chunks/*.jsonl.gz`
  because `brain-audit.mjs` (post-merge audit gate), `brain-check.mjs` (`test:fresh-install`), and
  `release.yml` still read via `readChunkObservations` — only `run-check.mjs` was migrated to
  `readRecordObservations` by C4/D4. This is a real latent drift bug (post-merge/release gates diverge
  from the pre-merge gate's records-only migration) but is OUT of C3 scope. **It will be filed as its own
  follow-up issue.**
- MCP server over `.memory/` (PLAN §9).
- Removing the engram symlink (upstream, ADR-0002).
- Changing the record format (C0/C1 territory).
- Any plainfiles-native `index`/`featureCheckpoint`/`featureResume` behavior (deferred → unsupported
  error, per the scope boundary above).

## Acceptance criteria (CP-C3 — hard stop, PR-as-review, Part of #246)

- [ ] D1: `MEMORY_BACKEND=plainfiles memory:save` scan-then-writes a record into `.memory/records/`
      (secret scan BEFORE append, mirroring `dualWriteRecords`) + `rebuildIndex`; ZERO non-Node deps.
- [ ] D2: `MEMORY_BACKEND=plainfiles memory:search` returns matches via a Node scan of
      `readRecordObservations`; `rg` used only if present, never required, never in `package.json`.
- [ ] D3: `share()` = self-check `rebuildIndex()`; `pull()` = `git pull` + `rebuildIndex()`, records-only,
      no engram import; both semantics written in design.md.
- [ ] D4: `save`/`search` are new `VALID_OPS` in `cli.mjs`, argv/flags parsed; every changed CLI string
      has en + es i18n.
- [ ] Deferrals: `index()`/`featureCheckpoint()`/`featureResume()` return an explicit, documented
      "unsupported" error (not a silent no-op).
- [ ] D6: the two-direction round-trip (engram→plainfiles AND plainfiles→engram) passes with record-level
      equality, seam-injected — no live engram/git in `npm test`.
- [ ] Durability, made executable: a bare `git clone` + `grep` answers "what decisions about X"; verified
      as CP-C3 evidence.
- [ ] `npm test`, `brain:repo:check`, `brain:nav` green. No new `brain:audit` failure. Docs English
      (ADR-0009). ≤400 changed lines, no `size:exception`. Strict TDD.

## Relates to

- **PLAN §4 C3** (`docs/inbox/PLAN-adapters-v3.md:288-292`) + DoD §11.3 (`plainfiles` round-trips
  losslessly; chunks migrated) and §11.4 (≥2 real consumers or rejected — no new `n=1` ports).
- **ADR-0004** — memory-backend adapter (documents the informal `index/share/pull/setup` convention;
  plainfiles is its second inhabitant).
- **Siblings:** C0 #201, C1 #205, C2 #217, C4 #229. **This issue:** #246.

## Open questions for design.md to resolve

1. **engram save/search symmetry** — do `save`/`search` apply to BOTH backends (does `engram.mjs` grow
   thin `save`/`search` wrappers over the `engram` binary for interface symmetry), or is plainfiles the
   only backend that needs cli.mjs-mediated `save`/`search` (asymmetric-by-design, since agents call
   `engram save`/`mem_save` directly, bypassing cli.mjs)? Real architectural fork.
2. **`save`'s argument shape** — mirror `_defaultEngramSave`'s `(title, content, {type, project, scope,
   topic})` positional+flags shape, or accept a full record object? Where do `actor`/`actorKind`/`ts`
   come from — CLI flags, or auto-derived like `featureCheckpoint`'s `getHostname`/`getBranch`?
3. **`pull()`'s git mechanics** — reuse `pullMemory()`'s manifest-dirty-discard + git-pull skeleton
   (extract the backend-agnostic half), or a minimal `git pull` + `rebuildIndex()`? Is `manifest.json`
   churn-resilience even relevant to a plainfiles-only setup (no engram export ever runs), or is the
   manifest purely an engram sync artifact a plainfiles consumer never touches?
