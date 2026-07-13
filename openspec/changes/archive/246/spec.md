# Spec Delta — The `plainfiles` memory backend (slice C3)

> Ships `plainfiles` as the second `MEMORY_BACKEND` inhabitant: `save`/`search` write and read
> `.memory/records/*.jsonl` directly (zero binary deps), `share`/`pull` stay validation/plumbing only
> (records already ARE the store), the `save`/deferred-op asymmetry is explicit, and a two-direction
> round-trip against `engram` proves the durability claim. See [design.md](design.md).

## REQ-C3-1: `plainfiles` is a real `MEMORY_BACKEND` (D1-D4)

`cli.mjs`'s `VALID_OPS` MUST gain `save` and `search`. With `MEMORY_BACKEND=plainfiles`, the existing
dynamic-import dispatch MUST route `save`, `search`, `share`, `pull`, and `setup` to
`backends/plainfiles.mjs`'s matching export. Every changed CLI string (help text, errors) MUST carry en +
es i18n entries per repo convention.

#### Scenario: dispatch resolves `save` to plainfiles

- GIVEN `MEMORY_BACKEND=plainfiles`
- WHEN `memory save <title> <content> --type ... --project ... --scope ... --topic ...` runs
- THEN `cli.mjs` dispatches to `plainfiles.mjs#save`, appending one validated record to
  `.memory/records/<yyyy-mm>.jsonl`

#### Scenario: dispatch resolves `search` to plainfiles

- GIVEN `MEMORY_BACKEND=plainfiles`
- WHEN `memory search <query>` runs
- THEN `cli.mjs` dispatches to `plainfiles.mjs#search` and returns matching records

## REQ-C3-2: `save` is scan-then-write, with MEASURED (never-flagged) provenance (D1, Q2)

`plainfiles.save(title, content, {type, project, scope, topic})` MUST run `scanTextForSecrets` over the
candidate content BEFORE any write — a hit MUST abort the save with nothing written (fail-closed),
mirroring `dualWriteRecords`'s scan-then-append order via the unchanged `secret-scrub.mjs`. `actor`,
`actorKind`, and `ts` MUST be MEASURED — derived the same way `featureCheckpoint` derives them
(`getBranch`/`getHostname`) — and MUST NOT be accepted as CLI flags or argument-object fields under any
name (declared provenance is spoofable and this store feeds actor-check/L5). `ts` MUST use the canonical
UTC-seconds format pinned at C2a, never an ad hoc `new Date()`.

#### Scenario: a secret hit rejects the write, fail-closed

- GIVEN content matching `scanTextForSecrets` with no `governance.memorySecretAllowPatterns` override
- WHEN `plainfiles.save(title, content, opts)` runs
- THEN it errors before any `appendRecord` call and `.memory/records/` is unchanged

#### Scenario: a successful save records measured provenance, not caller input

- GIVEN a `save` call whose argument shape exposes no `actor`/`actorKind`/`ts` fields
- WHEN `plainfiles.save(...)` succeeds
- THEN the appended record's `actor`/`actorKind` derive from `getBranch`/`getHostname`, its `ts` is the
  canonical UTC-seconds value (C2a format), and `rebuildIndex()` runs after the append

## REQ-C3-3: `search` is a zero-binary Node scan (D2)

`plainfiles.search(query, opts)` MUST read via `store.mjs#readRecordObservations` and filter in Node
(substring/regex over `content`/`title`/`type`) with no required external binary. `rg` MAY be shelled out
to IFF present (a `which rg` check) purely as an optional accelerant — it MUST NOT appear in
`package.json` or `install-tools.sh` as a dependency.

#### Scenario: search works with no `rg` installed

- GIVEN a machine with no `rg` binary on `PATH`
- WHEN `plainfiles.search(query)` runs
- THEN it falls back to the pure-Node scan and returns matching records with no error

#### Scenario: `rg` is used only as an accelerant when present

- GIVEN `rg` IS present on `PATH`
- WHEN `plainfiles.search(query)` runs
- THEN it MAY shell out to `rg` for speed, but results MUST match the pure-Node scan, and `rg`'s absence
  never breaks search

## REQ-C3-4: `share`/`pull` are validation/plumbing only; no auto-discard (D3, Q3)

`plainfiles.share()` MUST be a self-check `rebuildIndex()` call only — no data movement, since records
already ARE the store. `plainfiles.pull()` MUST be `git pull` followed by `rebuildIndex()`, records-only,
with NO engram-import step. A dirty `.memory/` tree at pull time MUST delegate to git's own
conflict/dirty-tree behavior and report it honestly; `plainfiles.pull()` MUST NOT auto-discard local
changes — `pullMemory()`'s manifest-dirty-discard skeleton is engram-materialization-specific and does
not apply here, since git is the only writer for plainfiles.

#### Scenario: share revalidates the index with no data movement

- GIVEN a populated `.memory/records/` tree
- WHEN `plainfiles.share()` runs
- THEN it calls `rebuildIndex()` and performs no export or write beyond the index refresh

#### Scenario: pull with a dirty tree reports honestly instead of discarding

- GIVEN a working tree with uncommitted changes under `.memory/`
- WHEN `plainfiles.pull()` runs
- THEN git's own dirty-tree/conflict behavior surfaces to the caller unmodified, no records are silently
  discarded, and `rebuildIndex()` only runs after a clean pull

## REQ-C3-5: the `save`/deferred-op asymmetry is explicit, never cryptic (Q1)

Under `MEMORY_BACKEND=engram`, `save` MUST return an explicit, documented error pointing the caller to
engram's native `mem_save` — a second CLI-mediated save door is NOT created for engram, since agents
already call `mem_save` directly. Under `MEMORY_BACKEND=plainfiles`, `index()`, `featureCheckpoint()`,
and `featureResume()` MUST each return an explicit, documented "unsupported" error (never a silent no-op).

#### Scenario: `save` under engram points to the native tool

- GIVEN `MEMORY_BACKEND=engram`
- WHEN `memory save ...` runs
- THEN it exits non-zero with a message directing the caller to engram's native `mem_save`, and no record
  is written via this path

#### Scenario: each plainfiles deferral errors loudly

- GIVEN `MEMORY_BACKEND=plainfiles`
- WHEN `index`, `feature-checkpoint`, or `feature-resume` is invoked
- THEN each exits non-zero with an explicit "unsupported" message naming the op, never a silent no-op

## REQ-C3-6: the two-direction round-trip is the CP-C3 evidence (D6)

A hermetic, seam-injected suite MUST prove BOTH directions record-level-equal for N records covering
every `RECORD_TYPES` member plus a `supersedes` chain: engram→plainfiles via
`dualWriteRecords(tmpRoot, {_readObservations: fixture})` then `plainfiles.search()` surfacing the
content; and plainfiles→engram via `plainfiles.save()` into a temp root then
`importMemory({_engramSave: captureCalls})` surfacing the same record. Neither leg may touch a live
engram binary or live git in `npm test`.

#### Scenario: engram-to-plainfiles direction round-trips

- GIVEN N fixture observations covering every `RECORD_TYPES` member and a `supersedes` chain
- WHEN `dualWriteRecords` writes them into a temp root and `plainfiles.search()` queries that root
- THEN every fixture's content surfaces with record-level equality, with no live engram/git process
  spawned

#### Scenario: plainfiles-to-engram direction round-trips

- GIVEN records written via `plainfiles.save()` into a temp root
- WHEN `importMemory()` runs against that root with an injected `_engramSave` capture
- THEN every saved record appears in the captured engram-save calls with record-level equality, with no
  live engram/git process spawned

#### Scenario: durability is executable, not asserted

- GIVEN a bare `git clone` of the repo with only Node installed
- WHEN a reviewer greps `.memory/records/*.jsonl` for a decision topic
- THEN the answer is retrievable with no engram/rg dependency, proving the "git clone + grep answers what
  we decided about X" claim

## Out of scope (non-goals)

- The C4 chunk-migration completion (`brain-audit.mjs`/`brain-check.mjs`/`release.yml` still reading via
  `readChunkObservations`) — filed as its own follow-up issue.
- MCP server over `.memory/`.
- Removing the engram symlink (upstream, ADR-0002).
- Changing the record format (C0/C1 territory).
- Any plainfiles-native `index`/`featureCheckpoint`/`featureResume` behavior — deferred to an
  "unsupported" error per REQ-C3-5.

## Gate

`npm test`, `brain:repo:check`, and `brain:nav` MUST stay green with no new `brain:audit` failure. Docs
MUST be in English (ADR-0009).
