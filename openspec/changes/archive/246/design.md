# Design — The `plainfiles` memory backend (slice C3)

Ship the second `MEMORY_BACKEND` inhabitant so the durability claim stops being `n=1`. `plainfiles`
writes and reads `.memory/records/*.jsonl` DIRECTLY — records ARE the store, git is the only writer, zero
non-Node binaries. The net-new machinery is small because C4 (#229) already built and seam-tested BOTH
round-trip legs (`share`/`dualWriteRecords` export, `pull`/`importMemory` import); C3 REUSES them, it does
not rebuild them. This design honors the Q1-Q3 ruling ([[sdd/issue-246-c3/constraints]], obs #578):
asymmetric backends, MEASURED (never-flagged) provenance, minimal pull. All artifacts English (ADR-0009).

## Decision 1 — `plainfiles.mjs` module shape (D1-D5)

`backends/plainfiles.mjs` mirrors `engram.mjs`'s conventions verbatim: every op is `async`, every external
dependency (git, os, filesystem, the lib surface) is a `_`-prefixed injectable seam defaulting to the real
implementation, so the whole module is unit-testable with zero real git/engram/rg subprocess. Exported ops
and their signatures:

| Export | Signature | Returns | Notes |
| --- | --- | --- | --- |
| `save` | `save(title, content, {type, project, scope, topic} = {}, seams = {})` | `Promise<{id, file, written: boolean}>` | scan-then-write; measured provenance (Decision 2) |
| `search` | `search(query, {root, mode} = {}, seams = {})` | `Promise<{matches: object[]}>` | zero-binary Node scan (Decision 3) |
| `share` | `share({root} = {}, seams = {})` | `Promise<{indexCount: number}>` | self-check `rebuildIndex()` only (Decision 4) |
| `pull` | `pull({root} = {}, seams = {})` | `Promise<{indexCount: number}>` | `git pull` + `rebuildIndex()` (Decision 4) |
| `setup` | `setup({root} = {}, seams = {})` | `Promise<void>` | ensure `.memory/records/` exists + well-formed |
| `index` | `index()` | throws | deferred → `unsupportedOp` (Decision 5) |
| `featureCheckpoint` | `featureCheckpoint()` | throws | deferred → `unsupportedOp` (Decision 5) |
| `featureResume` | `featureResume()` | throws | deferred → `unsupportedOp` (Decision 5) |

The three deferred exports exist so `cli.mjs`'s dispatch resolves them to a FRIENDLY, documented error
(Decision 5), never the generic `backend 'plainfiles' does not implement op '<op>'` cryptic branch
(cli.mjs:232-235). `setup()` for plainfiles is deliberately minimal: no `.engram` symlink (ADR-0002 is an
engram-only concern), no engram-manifest merge driver. It only guarantees `.memory/records/` exists
(`mkdirSync(recursive)`) and, as a cheap well-formedness self-check, runs `rebuildIndex()` — the same
idempotent lib call `share()` uses. The union-merge `.gitattributes` on `.memory/records/*.jsonl` is
backend-agnostic (registered by the record format, C0/C1, not by any backend `setup`) and needs no
plainfiles action.

Lib reuse (all imported AS-IS — no new format/store logic):
`store.mjs#{appendRecord, rebuildIndex, readRecordObservations}`, `format.mjs#buildRecord`,
`secret-scrub.mjs#{resolveSecretConfig, compilePatterns, scanTextForSecrets}`, and the reused provenance
derivers (Decision 2). `computeRecordId`/`validateRecord` are reached transitively via `buildRecord` +
`appendRecord`'s fail-closed validate — plainfiles never re-hashes or re-validates itself.

## Decision 2 — `save` provenance is MEASURED, never flagged (D1, Q2 — load-bearing)

`save(title, content, {type, project, scope, topic})` mirrors `_defaultEngramSave`'s argument shape
(engram.mjs:997) EXACTLY — same positional `title`/`content`, same `{type, project, scope, topic}` option
bag. The argument surface exposes NO `actor`, `actorKind`, or `ts` field under any name, and `cli.mjs`'s
save-arg parser (Decision 7) recognizes NO `--actor`/`--actor-kind`/`--ts` flag. These three fields are
derived by MEASUREMENT only:

- **`actor` ← `getBranch(root)`** — the reused `engram.mjs#_getGitBranch` deriver (itself a thin wrapper
  over `lib/git-branch.mjs#currentBranch`, `git rev-parse --abbrev-ref HEAD`), returning the branch name
  or the literal `'unknown'` on detached HEAD / git-absent. The branch is the measured working-context
  handle: it cannot be set by a CLI flag, so it cannot be forged for convenience.
- **`actorKind` ← the constant `'agent'`** — a STRUCTURAL constant of the entry point, not a caller input.
  Rationale: by the Q1 asymmetry (Decision 5), the `cli.mjs`-mediated `save` door is the agent/automation
  write path; humans use engram-native `mem_save`. `'agent'` is the honest structural default for the only
  door plainfiles exposes, and — critically — it is NOT caller-supplied, which is the spoof-resistance
  property the ruling demands. `actorKind` is validated against the `human|agent` enum by
  `validateRecord`, so the constant is schema-legal.
- **`ts` ← `getTimestamp()`**, defaulting to a new pure helper `nowUtcSeconds()` (Decision 2a). NOT
  `new Date().toISOString()` — that emits millisecond precision (`…:SS.mmmZ`) which `format.mjs`'s
  `UTC_TS_RE` (format.mjs:27) REJECTS.
- **`getHostname()`** (reused `os.hostname`, as `featureCheckpoint` uses it) is folded into the non-hashed
  `source` field (`source: "plainfiles save on <hostname>"`), recording machine provenance without
  touching the content-addressed id (`source` is excluded from `computeRecordId`, format.mjs:76-77). This
  honors "reuse `getBranch`/`getHostname`" cleanly: branch→`actor`, hostname→`source`, clock→`ts`.

**Why measured, not flagged (the load-bearing rationale):** `.memory/records/` is the durable, git-committed
GOVERNANCE/decision log. A `--actor` flag would let any caller forge WHO decided what in that log — the
same class of authorship spoof the L5 no-self-approval gate (`vcs/actor-check.mjs`) exists to prevent
elsewhere. Declared provenance is spoofable-for-convenience; measured provenance is not. So provenance is
derived, never accepted.

**Scan-then-write order (mirrors `dualWriteRecords` exactly).** `save` runs, in this order:
1. Build the candidate record via `buildRecord({ts, actor, actorKind, type, project, content, title, source})`
   (folds `title` into `content` per R2, computes the id).
2. Resolve the secret config (`resolveSecretConfig(_loadConfig(root))` → `compilePatterns`) and run
   `scanTextForSecrets(serializeRecord(candidate), patterns, allowPatterns)` over the CANDIDATE line
   BEFORE any write. A hit throws (fail-closed) — nothing is appended. This is the identical
   scan-before-append order `dualWriteRecords` uses (engram.mjs:283-292), reusing the unchanged
   `secret-scrub.mjs`. The only bypass is `governance.memorySecretAllowPatterns` — there is no
   `--no-scrub` flag.
3. Only if clean: `appendRecord(candidate, {recordsDir})` then `rebuildIndex({recordsDir, indexPath})`.

### Decision 2a — `ts` uses the C2a canonical helper, not `new Date()`

Add ONE pure helper to `format.mjs` (which already owns `UTC_TS_RE` and the canonical UTC rule, and whose
contract is "pure functions only"):

```js
// format.mjs — seam-injected clock for hermetic tests; produces the C2a canonical
// UTC-seconds ts (YYYY-MM-DDTHH:MM:SSZ) that UTC_TS_RE accepts.
export function nowUtcSeconds(getNow = () => new Date()) {
  return getNow().toISOString().replace(/\.\d{3}Z$/, 'Z');
}
```

The `.replace(/\.\d{3}Z$/, 'Z')` stripping IS the exact C2a seconds-precision rule already used by
`engram-export.mjs#toUtcSeconds` (engram-export.mjs:31) — the same canonical format fixed by REQ-MF-2 and
enforced by `UTC_TS_RE` (format.mjs:27, `/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/`). `save` injects it as
`getTimestamp`, so tests pin `ts` to a fixed instant with zero real-clock dependency.

## Decision 3 — `search` is a zero-binary Node scan, `rg` optional (D2)

`search(query, {root, mode})` reads via `store.mjs#readRecordObservations({recordsDir})` (best-effort,
never throws) and filters in Node: a case-insensitive substring match (default) or a regex match (`mode:
'regex'`) over each record's `content`, `title`-folded-into-content, and `type`. ZERO required binaries.

`rg` is used ONLY as an optional accelerant, gated on `which rg` succeeding (the exact idiom
`engram.mjs#_defaultCheckEngram`/`requireEngram` use, engram.mjs:104-110, 986-989). CRITICAL invariant:
the `rg` path and the pure-Node path MUST return IDENTICAL results — `rg` narrows candidate files, but the
final match set is produced by the same Node predicate either way, so `rg`'s presence changes speed, never
output. `rg` never appears in `package.json` or `install-tools.sh`. The `which rg` probe and the `rg`
subprocess are injectable seams (`_which`, `_rg`) so tests exercise both branches without a real `rg`.

## Decision 4 — `share`/`pull` are validation/plumbing only; NO auto-discard (D3, Q3)

Records ARE the store; there is no external live DB to sync to or from. So:

- **`share()` = a self-check `rebuildIndex()`** and nothing else. No `engram sync --export`, no chunk
  materialization, no data movement. `index.jsonl` is already the live name; rebuilding it is an
  idempotent well-formedness check that also keeps the derived index consistent with any hand-appended
  records.
- **`pull()` = `_gitPull(root)` then `rebuildIndex()`**, records-only, with NO engram-import step
  (`importMemory` is engram's hydrate path; plainfiles has nothing to hydrate INTO).

**Why `pullMemory()`'s manifest-dirty-discard skeleton does NOT apply (the required rationale, Q3):**
`pullMemory()` (engram.mjs:587-607) discards uncommitted `.memory/manifest.json` churn before `git pull`
because `engram sync --export` REWRITES the manifest on every run, leaving a derived, regenerable file
dirty in the working tree that would otherwise block the merge. That discard is safe there precisely and
ONLY because the manifest is an engram MATERIALIZATION artifact — a rebuildable index engram owns and
re-emits. **plainfiles never materializes anything**: it never runs `engram sync`, never writes a
manifest, and `.memory/records/*.jsonl` are COMMITTED source-of-truth records, not a regenerable cache.
git is the only writer. Therefore a dirty `.memory/` at pull time is real, un-pushed work — NEVER
regenerable churn. `plainfiles.pull()` MUST delegate to git's own dirty-tree / conflict behavior and
report it honestly to the caller; it MUST NOT auto-discard. Auto-discarding committed records would be
silent data loss. `rebuildIndex()` runs only AFTER a clean `git pull` returns. `_gitPull` is injectable
(throws on non-zero exit, like `_defaultGitPull`) so the round-trip and error tests never spawn real git.

## Decision 5 — the Q1 asymmetry + the shared `unsupportedOp` helper

Per the ruling (Q1 ASYMMETRIC): "a backend implements the ops for which it is the natural interface; the
cli does NOT equalize surfaces for aesthetics." engram already has a native `mem_save`/`engram save`;
duplicating it as a cli verb would create a second door to keep in parity forever. So `save`/`search` are
plainfiles' natural interface, and engram REFUSES them with a friendly pointer. Symmetrically, `plainfiles`
has no natural interface for `index`/`featureCheckpoint`/`featureResume` (no docs-projection target, no
engram to project into), so it defers them with a loud, documented "unsupported" error. Both refusals use
ONE shared helper — never a cryptic failure, never a silent no-op.

New tiny module `brain/scripts/memory/lib/unsupported-op.mjs`:

```js
import { t } from "../../i18n/t.mjs";
// Always throws — the caller's op stays async so `await unsupportedOp(...)` rejects,
// and cli.mjs's dispatch catch prints the message + exits 1 (loud, documented).
export async function unsupportedOp(op, backend, { key = "memory.op.unsupported", params = {} } = {}) {
  throw new Error(await t(key, { op, backend, ...params }));
}
```

Call sites (both directions of the asymmetry):

- `engram.mjs` grows `export async function save() { await unsupportedOp("save", "engram", { key: "memory.save.engramUnsupported" }); }`
  and, for consistency, a matching `search` refusal (same key family) — so the engram cli surface is never
  cryptic on either verb. The MINIMUM the ruling requires is `save`; `search` is added at ~4 lines for a
  uniform surface (flagged for tasks — see open item).
- `plainfiles.mjs`'s `index`/`featureCheckpoint`/`featureResume` each call
  `await unsupportedOp("<op>", "plainfiles")` (the generic `memory.op.unsupported` key).

i18n keys (en + es, drift-tested):
- `memory.op.unsupported`: `"op '{op}' is not supported by the '{backend}' memory backend (deferred — see openspec/changes/issue-246-c3)."`
- `memory.save.engramUnsupported`: `"'{op}' is not a cli verb for the '{backend}' backend — use engram's native mem_save / 'engram save' instead."`

## Decision 6 — the two-direction round-trip test (CP-C3 evidence, D6)

The round-trip suite is the executable proof of the durability claim and DoD §11.4 (≥2 real consumers). It
reuses C4's already-proven injection pattern (`engram.share.test.mjs` / `engram.import.test.mjs`), so NO
live engram binary and NO live git run in `npm test`. It lives under `*.test.mjs` and writes into a temp
`.memory/`, so it is fully budget-excluded. Fixture: N observations covering every one of the 7
`RECORD_TYPES` members plus a `supersedes` chain.

- **engram → plainfiles (drives C4's export leg):**
  `dualWriteRecords(tmpRoot, {_readObservations: () => fixtureObservations})` populates a temp
  `.memory/records/` (no real engram/chunks), then `plainfiles.search(query, {root: tmpRoot})` asserts
  every fixture's content surfaces, with record-level (`id` / hashInput) equality.
- **plainfiles → engram (drives C4's import leg):**
  `plainfiles.save(title, content, opts, {getBranch, getTimestamp, getHostname})` (pinned seams for a
  deterministic id) appends to a temp root, then
  `importMemory({root: tmpRoot, _requireEngram: () => 'engram', _engramSave: captureCalls})` asserts each
  saved record surfaces in the captured `engram save` calls (topic = `record.id`), record-level-equal.

Record-level equality is the same `computeRecordId(...) === record.id` identity the C4
`real-store-roundtrip.integration.test.mjs` already pins — the two directions simply drive it through the
live `save`/`search` path instead of the pure format functions. A third assertion covers the
"durability-is-executable" scenario: a plain Node read/grep of `.memory/records/*.jsonl` for a decision
topic returns the answer with no engram/rg dependency.

## Decision 7 — `cli.mjs` wiring for the net-new `save`/`search` verbs (D4)

`VALID_OPS` (cli.mjs:53-63) gains `"save"` and `"search"`. Both camelCase-map to themselves, so the
existing dynamic-import dispatch (cli.mjs:216-239) routes them to `backends/<backend>.mjs` unchanged. Two
wiring additions:

- **`search`** needs no special parsing — its single positional `query` forwards through the existing
  `backend[fn](...process.argv.slice(3))` path, and `plainfiles.search` prints its matches.
- **`save`** carries structured flags (`--type`/`--project`/`--scope`/`--topic`) that the generic
  positional-forward would mis-pass as extra positionals. So `cli.mjs` special-cases `save` (a small block
  like the existing `reindex`/`migrate-v1` special-cases): a minimal arg parser extracts the two
  positionals (`title`, `content`) and the four flags into `{type, project, scope, topic}`, then calls
  `backend.save(title, content, opts)`. This keeps the parser backend-agnostic; engram's `save` still
  receives the same shape and refuses it (Decision 5). NO `--actor`/`--actor-kind`/`--ts` flag is
  recognized (Decision 2 — spoof resistance enforced at the parser).

Every changed/new CLI string (save success, search summary/empty, the two unsupported messages) carries
en + es i18n entries per repo convention (drift-tested).

## Resolved open questions (from the proposal / exploration)

- **Q1 — engram save/search symmetry → RESOLVED ASYMMETRIC.** engram does NOT grow real `save`/`search`
  cli wrappers; it grows friendly-refusal stubs pointing to native `mem_save`/`mem_search`. plainfiles is
  the only backend with cli-mediated `save`/`search`, because it is the only one without an external tool
  of its own. (Decision 5.)
- **Q2 — `save` arg shape → RESOLVED MIRROR + MEASURED.** `(title, content, {type, project, scope,
  topic})` mirrors `_defaultEngramSave`; `actor`/`actorKind`/`ts` are derived (`getBranch` / structural
  `'agent'` / `nowUtcSeconds`), never flags. (Decision 2.)
- **Q3 — `pull` manifest applicability → RESOLVED MINIMAL.** `git pull` + `rebuildIndex()`; the
  `pullMemory()` manifest-dirty-discard does NOT apply because it is engram-materialization semantics and
  plainfiles never materializes — git is the only writer, so a dirty tree is real work, never regenerable
  churn, and is reported honestly, never auto-discarded. (Decision 4.)

## Budget estimate (non-test, non-`.memory/**` counted diff)

| Artifact | Est. counted lines |
| --- | --- |
| `backends/plainfiles.mjs` (save/search/share/pull/setup + 3 deferral stubs, JSDoc-heavy) | ~190-240 |
| `lib/unsupported-op.mjs` (new shared helper) | ~12 |
| `format.mjs` `nowUtcSeconds()` helper + export | ~6 |
| `engram.mjs` `save`/`search` friendly-refusal stubs | ~10 |
| `cli.mjs` `VALID_OPS` + `save` arg-parse special-case + dispatch | ~40-50 |
| `i18n/en.mjs` + `i18n/es.mjs` (save/search/unsupported keys, both locales) | ~20-28 |
| **Total** | **~280-345** |

Comfortably ≤400 as a SINGLE slice — no `size:exception`, no C3a/C3b split (the exploration's read that it
fits one slice is confirmed). The tightest variable is `plainfiles.mjs`'s JSDoc weight; if it overruns
toward ~300 the total approaches ~400 but stays under. The round-trip test and any fixture records are
`*.test.mjs` / `.memory/**` — budget-excluded — so they never threaten the line. If (against this
estimate) the count trends over 400 during apply, the documented fallback is the C3a (save/search/cli) +
C3b (share/pull + round-trip) split from the proposal — NOT planned.

## Open item for tasks.md

- Confirm the `engram.search` friendly-refusal stub is IN scope (the ruling's Q1 corollary names only
  `save`; adding `search` for a uniform, never-cryptic engram cli surface is a ~4-line consistency call
  recommended here). If tasks/owner scope it out, engram `search` under the cli falls to the generic
  "does not implement op 'search'" branch — functional but cryptic; the recommendation is to include it.
- Sequencing note for tasks: land `format.mjs#nowUtcSeconds` and `lib/unsupported-op.mjs` (shared
  primitives) FIRST, then `plainfiles.mjs`, then `cli.mjs`/i18n wiring, then the round-trip test — so each
  test-first step has its dependency in place.
