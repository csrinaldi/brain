# Tasks — The `plainfiles` memory backend (C3, #246)

> `plainfiles` becomes the second real `MEMORY_BACKEND`: `save`/`search`/`share`/`pull`/`setup` over
> `.memory/records/*.jsonl` directly, zero non-Node binaries; `index`/`featureCheckpoint`/`featureResume`
> defer loudly via a shared `unsupportedOp` helper; `engram`'s `save`/`search` cli doors refuse loudly too
> (never-cryptic on both backends). Strict TDD (RED → GREEN) per code task. Reuses C4's `dualWriteRecords`/
> `importMemory` seams for the two-direction round-trip (CP-C3 evidence). Locked by the Q1-Q3 ruling +
> actorKind ruling ([[sdd/issue-246-c3/constraints]], obs #578) — do not reopen.

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~280–345 non-test counted (design budget table) |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR into `feature/v2.0.0`, Part of #246 |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending (not needed — single PR) |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Full C3 slice (Phases 1–6 below) | PR 1 (single) | `*.test.mjs` / `.memory/**` fixtures are budget-excluded; only source + i18n count toward ~280–345 |

Round-trip tests, fixture records, and JSDoc weight on `plainfiles.mjs` are the only variables that could
push toward ~400 (design's own ceiling note) — still under budget. If actual counted diff trends over 400
during apply, fall back to the documented (not planned) C3a (save/search/cli) / C3b (share/pull +
round-trip) split from the proposal.

## Phase 1: Foundation — shared primitives (RED → GREEN)
> Land first: both `plainfiles.mjs` and `engram.mjs` depend on these.
- [x] 1.1 Test (RED) `brain/scripts/memory/lib/format.test.mjs`: `nowUtcSeconds(getNow)` returns the C2a
      canonical UTC-seconds string (strips `.mmmZ` → `Z`) for an injected fixed `getNow`; matches
      `UTC_TS_RE`.
- [x] 1.2 GREEN: add `export function nowUtcSeconds(getNow = () => new Date())` to
      `brain/scripts/memory/lib/format.mjs` — identical stripping rule to
      `engram-export.mjs#toUtcSeconds:31` (design Decision 2a). Pure function, no I/O.
- [x] 1.3 Test (RED) new `brain/scripts/memory/lib/unsupported-op.test.mjs`: `unsupportedOp(op, backend,
      opts)` rejects with a message built via `t(key, {op, backend, ...params})`; default key is
      `memory.op.unsupported`.
- [x] 1.4 GREEN: create `brain/scripts/memory/lib/unsupported-op.mjs` exporting `async function
      unsupportedOp(op, backend, {key = "memory.op.unsupported", params = {}} = {})` — always throws
      (design Decision 5 code block).
- [x] 1.5 i18n (en + es): add `memory.op.unsupported` and `memory.save.engramUnsupported` keys to
      `brain/scripts/i18n/en.mjs` / `es.mjs` (drift-tested — run `i18n/coverage.test.mjs`).

## Phase 2: `backends/plainfiles.mjs` — core ops (RED → GREEN, one op at a time)
> REQ-C3-1 through REQ-C3-4. Mirrors `engram.mjs`'s injectable-seam convention (every external dep
> `_`-prefixed, defaulting to the real impl) so the whole module is unit-testable with zero real
> git/rg/engram subprocess.

### 2a. `save` (REQ-C3-2)
- [x] 2.1 Test (RED) `backends/plainfiles.save.test.mjs`: a secret hit (`scanTextForSecrets` match, no
      `governance.memorySecretAllowPatterns` override) aborts BEFORE `appendRecord` — no write, no index
      change.
- [x] 2.2 Test (RED): a successful `save(title, content, {type, project, scope, topic})` call — whose
      argument shape exposes NO `actor`/`actorKind`/`ts` field — appends a record whose `actor` comes from
      an injected `getBranch` seam, whose `actorKind` is the constant `'agent'`, and whose `ts` is the
      injected `getTimestamp` (defaulting to `nowUtcSeconds`) value; `rebuildIndex()` runs after the append.
- [x] 2.3 GREEN: implement `save` in new `brain/scripts/memory/backends/plainfiles.mjs` — scan-then-write
      order (build candidate via `buildRecord`, `resolveSecretConfig`/`compilePatterns`/
      `scanTextForSecrets` over the serialized candidate BEFORE any write, then `appendRecord` +
      `rebuildIndex`), per design Decision 2's exact 3-step order. `actorKind` derivation is a NAMED export
      (e.g. `export const PLAINFILES_ACTOR_KIND = 'agent'` or a named `deriveActorKind()`) carrying a
      rationale comment: door-typed constant, NOT a caller input (per obs #578 — records the DOOR, not the
      executor's identity). `getHostname()` folds into the non-hashed `source` field
      (`"plainfiles save on <hostname>"`). NO `--actor`/`--actorKind`/`--ts` accepted anywhere in the
      signature.
- [x] 2.4 Test (RED) + GREEN: `save`'s injected seams (`getBranch`, `getTimestamp`, `getHostname`) default
      to the real `_getGitBranch`-equivalent / `nowUtcSeconds` / `os.hostname` when not provided (parity
      with `engram.mjs`'s seam-default convention).

### 2b. `search` (REQ-C3-3)
- [x] 2.5 Test (RED) `backends/plainfiles.search.test.mjs`: with no `rg` on `PATH` (`_which` seam returns
      false), `search(query, {root})` falls back to the pure-Node scan over
      `store.mjs#readRecordObservations` and returns matching records — no error, no throw.
- [x] 2.6 Test (RED): with `rg` present (`_which` seam returns true), the `rg`-accelerated path and the
      pure-Node path return IDENTICAL match sets for the same fixture — pin the CLI arg shape: `search(query,
      {root, mode} = {}, seams = {})` where `mode` is `'substring'` (default, case-insensitive) or `'regex'`;
      no other flags.
- [x] 2.7 GREEN: implement `search` — filters in Node over `content`/title-folded-into-content/`type`; `rg`
      is ONLY an optional accelerant behind an injectable `_which`/`_rg` seam (mirrors
      `engram.mjs#_defaultCheckEngram`, `:986-989`); never appears in `package.json`/`install-tools.sh`.

### 2c. `share` / `pull` (REQ-C3-4)
- [x] 2.8 Test (RED) `backends/plainfiles.share.test.mjs`: `share({root})` calls `rebuildIndex()` only — no
      export, no data movement, no git call.
- [x] 2.9 GREEN: implement `share` as a one-line `rebuildIndex()` self-check.
- [x] 2.10 Test (RED) `backends/plainfiles.pull.test.mjs`: `pull({root}, {_gitPull})` on a clean tree runs
      `_gitPull(root)` then `rebuildIndex()`, records-only, no `importMemory` call.
- [x] 2.11 Test (RED): `pull` on a dirty tree — injected `_gitPull` throwing/rejecting with git's own
      dirty-tree error — propagates that error UNMODIFIED to the caller (message + exit path); asserts NO
      record under `.memory/records/` is discarded and `rebuildIndex()` is NOT called. Pin the reporting
      mechanic: `pull` rejects with the underlying git error (same message), letting `cli.mjs`'s existing
      catch-and-exit-1 path surface it — no separate stderr passthrough machinery needed since the error
      propagates through the normal async-throw path already wired in `cli.mjs:237-243`.
- [x] 2.12 GREEN: implement `pull({root}, seams)` — `_gitPull` injectable (throws on non-zero exit, like
      `_defaultGitPull`), NO manifest-dirty-discard logic (Decision 4's rationale: plainfiles never
      materializes; git is the only writer), `rebuildIndex()` only after a clean pull.

### 2d. `setup` (design Decision 1)
- [x] 2.13 Test (RED) `backends/plainfiles.setup.test.mjs`: `setup({root})` on a repo with no
      `.memory/records/` directory creates it (`mkdirSync(recursive)`) and runs `rebuildIndex()` as a
      well-formedness self-check; on a repo that already has `.memory/records/`, it is idempotent (no error,
      re-runs `rebuildIndex()`).
- [x] 2.14 GREEN: implement `setup` — deliberately minimal per design: NO `.engram` symlink (ADR-0002 is
      engram-only), NO merge-driver registration (the `.gitattributes` union-merge rule is backend-agnostic,
      registered by the record format C0/C1, not by any backend's `setup`).

### 2e. Deferred ops (REQ-C3-5)
- [x] 2.15 Test (RED) `backends/plainfiles.unsupported.test.mjs`: `index()`, `featureCheckpoint()`,
      `featureResume()` each reject with an explicit "unsupported" message naming the op — never a silent
      no-op, never a generic cryptic string.
- [x] 2.16 GREEN: each of the three exports is a one-liner calling `await unsupportedOp("<op>",
      "plainfiles")` (Phase 1's helper).

## Phase 3: Hardenings (owner ruling, obs #578 — both mandatory)
- [x] 3.1 Test (RED) `backends/plainfiles.actorkind-consistency.test.mjs`: asserts `plainfiles.save`'s
      option bag and `engram.mjs#featureCheckpoint`'s option bag share the SAME measured-provenance
      convention — neither accepts a caller-supplied `actor`/`actorKind` override, and both derive `actor`
      via a `getBranch`-shaped seam (structural/signature assertion, e.g. call each with an `actor`/
      `actorKind` field present in the passed options object and assert it is IGNORED / has no effect on the
      resulting record vs. the seam-derived value). This is Hardening 1 — "two cli doors, one convention."
- [x] 3.2 GREEN (if needed): adjust `plainfiles.save`'s signature/derivation so 3.1 passes without weakening
      Phase 2's behavior — expected to already pass given 2.3's implementation; this task exists to close
      the loop, not to add new logic.
- [x] 3.3 Test (RED) new `brain/scripts/memory/lib/plainfiles-actorkind-doc-tripwire.test.mjs`: an
      injectable-file-list guard function (seam over the tracked-doc list, e.g. `git ls-files '*.md'`)
      scans each doc's text for a pattern matching a human-directed instruction to run `memory save` or
      `MEMORY_BACKEND=plainfiles memory save` (e.g. imperative phrasing near that literal). Feed the guard
      an INJECTED fixture file list containing one violating doc with no adjacent actorKind-decision
      reference — assert the guard reports a violation (fails). Feed it a fixture with the same instruction
      PLUS an adjacent reference to the actorKind decision (e.g. a link to
      `sdd/issue-246-c3/constraints` or obs #578) — assert it reports clean.
- [x] 3.4 GREEN: implement the guard function (`lib/plainfiles-actorkind-doc-tripwire.mjs` or inline in the
      test file's companion lib) and wire a second assertion in the same test running the guard against the
      REAL tracked `*.md` docs (default `git ls-files` seam) — MUST currently report clean, since no doc
      today instructs a human to run `memory save` under plainfiles. This is Hardening 2 — the concrete,
      event-detectable tripwire (not a "remember to" comment): the moment a future doc adds that
      instruction without also referencing the actorKind decision, this test starts failing.

## Phase 4: `cli.mjs` + `engram.mjs` wiring (REQ-C3-1, REQ-C3-5)
- [x] 4.1 Test (RED) `cli.migrate-v1.test.mjs`-style addition or new `cli.save-search.test.mjs`:
      `MEMORY_BACKEND=plainfiles` + `memory save <title> <content> --type T --project P --scope S --topic
      Top` dispatches to `plainfiles.mjs#save` with `{type, project, scope, topic}` parsed out of flags and
      `title`/`content` as positionals; `memory search <query>` dispatches to `plainfiles.mjs#search`.
- [x] 4.2 GREEN: `VALID_OPS` (`cli.mjs:53-63`) gains `"save"` and `"search"`. Add a `save`-specific
      arg-parse special-case (mirrors the existing `reindex`/`migrate-v1` blocks) extracting the two
      positionals + four flags into `backend.save(title, content, {type, project, scope, topic})`; NO
      `--actor`/`--actor-kind`/`--ts` flag recognized anywhere in the parser (spoof-resistance enforced at
      the parser per Decision 2). `search` needs no special-casing — forwards its single positional through
      the existing `backend[fn](...process.argv.slice(3))` path.
- [x] 4.3 Test (RED) `backends/engram.save-search-unsupported.test.mjs`: `MEMORY_BACKEND=engram` + `memory
      save ...` rejects with a message pointing to native `mem_save`; `memory search ...` rejects with a
      message pointing to native `mem_search` — neither writes/reads anything, both exit non-zero via
      `cli.mjs`'s existing catch.
- [x] 4.4 GREEN: add to `engram.mjs`: `export async function save() { await unsupportedOp("save", "engram",
      {key: "memory.save.engramUnsupported"}); }` and a matching `search` refusal (same key family, per obs
      #578's "engram.search stub: YES" ruling — never-cryptic applies to BOTH backends).
- [x] 4.5 i18n (en + es): confirm `memory.op.unsupported` / `memory.save.engramUnsupported` cover the
      `search` message too (reuse `memory.op.unsupported` with `op:'search'` for the generic plainfiles
      deferrals; reuse `memory.save.engramUnsupported`'s key FAMILY — i.e., a second key
      `memory.search.engramUnsupported` if the message text must name `mem_search` specifically instead of
      `mem_save`). Pin this choice: two distinct keys (`memory.save.engramUnsupported` /
      `memory.search.engramUnsupported`), each with its own en/es string naming the correct native tool —
      avoids a templated tool-name param muddying a user-facing message. Run `i18n/coverage.test.mjs`.

## Phase 5: Two-direction round-trip (REQ-C3-6, CP-C3 evidence)
- [x] 5.1 Test (RED → GREEN) new `brain/scripts/memory/lib/plainfiles-roundtrip.integration.test.mjs`:
      **engram → plainfiles leg** — `dualWriteRecords(tmpRoot, {_readObservations: () =>
      fixtureObservations})` populates a temp `.memory/records/` from N fixture observations covering every
      `RECORD_TYPES` member plus a `supersedes` chain; `plainfiles.search(query, {root: tmpRoot})` surfaces
      every fixture's content with `computeRecordId(...) === record.id` equality. No live engram/git.
- [x] 5.2 Same file, same test run: **plainfiles → engram leg** — `plainfiles.save(title, content, opts,
      {getBranch, getTimestamp, getHostname})` (pinned seams for deterministic ids) appends to a temp root;
      `importMemory({root: tmpRoot, _requireEngram: () => 'engram', _engramSave: captureCalls})` asserts
      every saved record appears in the captured `engram save` calls (topic = `record.id`),
      record-level-equal. No live engram/git.
- [x] 5.3 Same file: **durability-is-executable** assertion — a plain Node `readFileSync`/regex grep of
      `.memory/records/*.jsonl` in the temp root (no `rg`, no engram) retrieves a known decision topic's
      content, proving the "git clone + grep answers what we decided about X" claim end to end.

## Phase 6: Baseline + gate
- [x] 6.1 `npm test` green (0 new failures) · `brain:repo:check` · `brain:nav` · confirm no new
      `brain:audit` failure introduced by this slice.
- [x] 6.2 Docs check: any new/changed doc under this change is English (ADR-0009); `i18n/coverage.test.mjs`
      confirms en/es parity for all new keys.
- [x] 6.3 STOP at CP-C3 — declare in the PR body that this is the fixture-tested, hermetic round-trip
      (Phase 5), and that `memory:share`/the push itself are the ORCHESTRATOR's responsibility, not this
      apply run's (same posture as A3's CP-A3a boundary). Do not run `memory:share` or push from inside this
      task list.

## Open items resolved here (do not leave to apply-time guessing)
- **`setup` contract** — pinned at 2.13/2.14: `mkdir .memory/records/ recursive` + `rebuildIndex()`
  self-check only; explicitly NO engram symlink, NO merge-driver registration.
- **`search` flag surface** — pinned at 2.6: `search(query, {root, mode} = {}, seams = {})`, `mode ∈
  {'substring' (default), 'regex'}`, no other CLI flags.
- **C2a `ts` helper** — pinned at 1.1/1.2: resolved as `format.mjs#nowUtcSeconds(getNow)`, the
  `toUtcSeconds` stripping rule, wired as `save`'s default `getTimestamp`.
- **`pull` dirty-tree reporting mechanics** — pinned at 2.11: the underlying git error propagates unmodified
  through `pull`'s rejection and `cli.mjs`'s existing catch-and-exit-1 path; no bespoke stderr passthrough.
- **`engram.search` refusal key** — pinned at 4.5: two distinct i18n keys
  (`memory.save.engramUnsupported`/`memory.search.engramUnsupported`), each naming its correct native tool.

## Out of scope (unchanged from spec.md)
C4 chunk-migration completion (`brain-audit.mjs`/`brain-check.mjs`/`release.yml`), MCP server over
`.memory/`, removing the engram symlink (ADR-0002), changing the record format (C0/C1), any
plainfiles-native `index`/`featureCheckpoint`/`featureResume` behavior.

## Apply-time notes (deviations, both explicitly sanctioned by this file)
- **Doc-tripwire guard inlined into its test file** (task 3.4's own "or inline in the test file's
  companion lib" alternative): `plainfiles-actorkind-doc-tripwire.mjs` was NOT created as a separate
  `lib/` module — `scanDocsForActorKindTripwire` lives directly in
  `plainfiles-actorkind-doc-tripwire.test.mjs`. It is pure CI/coverage tooling with no production call
  site, so keeping it in the (budget-excluded) test file removed ~84 counted lines with zero behavior
  change — all 4 RED→GREEN assertions (violation / clean-with-reference / unrelated-doc / real-tracked-docs)
  still hold.
- **JSDoc trimmed for budget**: `plainfiles.mjs`'s first draft (343 non-test lines) carried the full
  design-doc rationale inline; that rationale already lives in `design.md` (openspec/changes/**,
  budget-excluded), so JSDoc was condensed to load-bearing one-liners + design.md pointers, bringing
  `plainfiles.mjs` to 218 lines. Final authoritative non-test counted diff (git diff --numstat, governance
  ignoreList: `**/*.test.mjs`, `.memory/**`, `openspec/changes/**`, lockfiles) = **364 lines**, under the
  400 budget — no C3a/C3b split needed.

## Post-review fixes (fresh-context review, no blockers — 2 MINOR findings closed)
- **MINOR 1 (test-only)**: broadened the doc-scan tripwire's `INSTRUCTION_RE` (en+es: invoke/type/use/
  paste/corré/usá/pegá, past run/execute/ejecutar) and added a `FENCE_RE` for a bare fenced code block
  containing the literal save command with no imperative prose nearby. Added an `openspec/changes/**`
  path exemption so SDD planning artifacts (spec.md/design.md/tasks.md/proposal.md) never trip the
  tripwire for legitimately discussing `memory save` while specifying the feature — mirrors the existing
  governance diff-size `openspec/changes/**` ignoreList convention. RED→GREEN: 13/13 in
  `plainfiles-actorkind-doc-tripwire.test.mjs`, live assertion over real tracked docs stays green.
- **MINOR 2**: `plainfiles.mjs#save` now `console.warn`s (new i18n key `memory.save.plainfilesIgnoredOpts`,
  en+es) when `scope`/`topic` are passed, naming them and explaining why they're ignored — never a silent
  drop, matching the never-cryptic ethos, without breaking `_defaultEngramSave` arg-shape parity (no error)
  and without blocking the write. RED→GREEN: 2 new tests in `plainfiles.save.test.mjs`.
- Final counted diff after both fixes: **373 lines** (still comfortably under 400). `npm test`: 1269/1269.
