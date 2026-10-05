# Spec — #1115 (folds #1189): backend-owned `hydrate` for every memory entrypoint

Delta requirements for this change. Section A is the change's own acceptance (REQ-1115-*).
Sections B and C are deltas to the living specs. `sdd-archive` merges them into
`openspec/specs/session-start/spec.md` and `openspec/specs/memory-backend/spec.md`.

## A. Change requirements

### REQ-1115-1 Bulk `hydrate` exists on every backend
Every adapter under `brain/scripts/axes/memory/adapters/` MUST export `hydrate`. Called with no
`recordId` and no `record`, it MUST project the whole of `.memory/records/` into the backend and
return `{ written, skipped, deferred?, contended? }`. It MAY also return the shared accounting
`indexCount` and `duplicates` (#574). It MUST NOT return any other backend-specific field.

#### Scenario: engram bulk hydrate delegates to the guarded import
- GIVEN `MEMORY_BACKEND=engram`, the binary present, and records on disk
- WHEN `hydrate({ root })` runs
- THEN it runs `importMemory({ root })` once, under the #820 guard
- AND it returns `written`/`skipped` as numbers, with `skipped` defaulting to `0`, never `undefined`

#### Scenario: plainfiles bulk hydrate rebuilds the index
- GIVEN `MEMORY_BACKEND=plainfiles` and N unique records
- WHEN `hydrate({ root })` runs
- THEN `rebuildIndex` runs over `<root>/.memory/records` → `<root>/.memory/index.jsonl`
- AND it returns `{ written: 0, skipped: N, indexCount: N, duplicates }`
- AND no git command runs

### REQ-1115-1b A read-only `verify` form of bulk `hydrate` (ruling Q1)
`hydrate({ root, verify: true })` on plainfiles MUST NOT write or create any file under `.memory/`.
It reports whether `.memory/index.jsonl` matches what `rebuildIndex` would write, returning
`{ written: 0, skipped: N, indexCount: N, duplicates, verified: true, stale }`. On engram the flag is
ignored: the import projects into the engram store, outside the tracked tree, as `session:start`
already did.

#### Scenario: verify on a stale plainfiles index
- GIVEN plainfiles, N records and an `index.jsonl` that differs from the canonical bytes
- WHEN `hydrate({ root, verify: true })` runs
- THEN it returns `stale: true` and `verified: true`
- AND `index.jsonl` is byte-identical and `git status --porcelain .memory` is unchanged

#### Scenario: the single-record form is unchanged
- GIVEN `hydrate({ root, recordId: 'rec-unknown' })` on engram with no such record
- WHEN it runs
- THEN it still throws `recordNotFound` (D4 of #874). Only the bulk form is new

### REQ-1115-2 A hydration that cannot run defers, never throws
When the engram binary is absent or unresolvable, or the import throws, or the guard is contended
or engram's state is unreadable, bulk `hydrate` MUST return `deferred: true` and say why on
stderr. When the binary is absent, the reason MUST name the install fix (`gentle-ai install`).
The dispatcher MUST exit with `EXIT_DEFERRED` (6) for a deferred `hydrate`, so the result can
never read as "done" (contract failure discipline). **Condition (ruling Q4):** `post-merge` and
`session-start` MUST treat 6 as non-fatal: the hook still exits 0, session-start still exits 0.

#### Scenario: engram declared, binary absent
- GIVEN `memory.default: engram` and no `engram` on PATH
- WHEN `node brain/scripts/memory/cli.mjs hydrate` runs
- THEN stderr says hydration into engram was deferred, naming `gentle-ai install`
- AND the exit status is 6
- AND nothing names `plainfiles`, and no substitution is claimed

#### Scenario: import throws mid-run
- GIVEN the engram import seam throws
- WHEN bulk `hydrate` runs
- THEN it resolves `{ written: 0, skipped: 0, deferred: true, reason }` and does not reject

### REQ-1115-3 The dispatcher: `hydrate` is an op; `import` is a deprecated alias
`cli.mjs` MUST accept `hydrate`. `import` MUST keep working for one release as an alias. It
dispatches exactly what `hydrate` dispatches, and it first prints ONE stderr notice that names
`hydrate` and says the alias goes away in the next release. `FALLBACK_OPS` MUST stay `["pull"]`.
Both spellings MUST refuse with exit 3 or 4 when the backend is undeclared or invalid.

#### Scenario: the alias on plainfiles ends the noise
- GIVEN `MEMORY_BACKEND=plainfiles`
- WHEN `cli.mjs import` runs
- THEN the exit status is 0, stderr contains the deprecation notice naming `hydrate`, and stderr
  does NOT contain `does not implement op`

#### Scenario: FALLBACK_OPS is unchanged
- WHEN `FALLBACK_OPS` is read
- THEN it deep-equals `["pull"]`

### REQ-1115-4 Every entrypoint calls only `hydrate`
`session-start.mjs`, `day-start.mjs` and `brain/scripts/hooks/post-merge` MUST invoke
`memory/cli.mjs hydrate` and MUST NOT invoke `memory/cli.mjs import`. `session-start.mjs` MUST pass
`--verify` (ruling Q1), so it never writes the tracked tree. Renaming the step alone
does not satisfy this.

#### Scenario: source scan
- GIVEN the three files' source
- WHEN scanned for a `cli.mjs` invocation
- THEN each names `hydrate`, and none names `import` as the op

### REQ-1115-5 day-start step 4c is gone; 4b's projection is unchanged, its skip line is honest
`day-start.mjs` MUST NOT spawn `engram sync --export` and MUST NOT print the
`day.memory.exporting/exported/exportFailed` lines. Those keys are removed from `en` and `es`.
Step 4a (`hydrate`) MUST run whatever the backend is, before and outside the engram probe. Step 4b
(`brain-to-engram.mjs`) stays behind the `engram --version` probe, and its projection is unchanged.
**[Amended 2026-10-05, maintainer ruling B on the cold review of #1354:]** when the probe fails, step 4
prints ONE neutral line, `day.memory.reprojectSkipped` ("engram not available — skipping the doctrine
projection (step 4b, #1349)"), and no install hint. The former `day.memory.notAvailable` ("skipping
shared memory") and `day.memory.install` lines are removed: after this change 4a has already hydrated
the backend, so "skipping shared memory" was false, and on plainfiles the engram install hint was wrong.
An engram-declared checkout without the binary still gets the `gentle-ai install` hint, once, from the
adapter's deferral (exit 6, which day-start's `run` keeps quiet).

#### Scenario: plainfiles day:start
- GIVEN a plainfiles consumer without the engram binary
- WHEN `brain:day:start` runs
- THEN step 4 prints the hydrating line, `hydrate` exits 0, and nothing is exported into `.memory/`
- AND it prints the neutral 4b skip line with no `engram` install hint and no "skipping shared memory"

### REQ-1115-6 session-start names the active backend
The session-start memory line MUST name the backend that the one resolver
(`memory/lib/backend-resolve.mjs`) reports as declared. It MUST NOT contain the word `engram`
unless that backend is engram. It distinguishes four outcomes: hydrated, deferred (exit 6),
skipped (any other non-zero exit, with the reason), and not declared (exit 3 or 4, unchanged).

#### Scenario: plainfiles banner
- GIVEN a plainfiles consumer with a canonical index
- WHEN `brain:session:start` runs
- THEN the memory line reads `memory:   plainfiles verified — index current (read-only)`, the output
  contains no `engram`, and `git status --porcelain` is unchanged by the run

#### Scenario: plainfiles with a stale index
- GIVEN a plainfiles consumer whose `index.jsonl` drifted
- WHEN `brain:session:start` runs
- THEN the memory line says the index is stale and names `npm run brain:memory:share`, and the
  index file is NOT rewritten

#### Scenario: engram without its binary
- GIVEN engram declared and the binary absent
- WHEN `brain:session:start` runs
- THEN the memory line reads `memory:   engram hydration deferred — <reason>`, and session-start
  still exits 0

### REQ-1115-7 session-start delivers the durable records context, backend-free
session-start MUST read `.memory/records/*.jsonl` directly, with no backend call. Records are
deduplicated by `id`. It MUST print the number of records, the newest record (its date and its
title, which is the first non-empty line of `content` with the `**` markers stripped and the text
truncated to 80 characters), and, when the active change resolves to issue N, the count and the
up-to-5 newest titles of records whose `issue === N`. An unreadable or empty store says
"unknown", never zero (`evidence-reader-empty-on-failure`). The contract is not changed.

#### Scenario: an active change with scoped records
- GIVEN branch `fix/issue-1115-x`, change dir `issue-1115-…`, 12 records of which 2 carry `issue: 1115`
- WHEN `brain:session:start` runs
- THEN it prints `records:  12 durable, newest <date> — <title>` and `issue #1115: 2 record(s)`
  followed by their two titles, newest first

#### Scenario: no change folder
- GIVEN no change resolves
- WHEN `brain:session:start` runs
- THEN the records line prints and no issue line prints

### REQ-1115-8 i18n parity
Every new or changed user-facing string MUST come from a key present in `en.mjs` and translated
in `es.mjs`. Removed keys MUST be absent from both catalogs.

### REQ-1115-9 Axis-port allowlist shrinks
After the change, `axis-port.guard.test.mjs` MUST pass with the entry `day-start.mjs
spawn-concrete:engram` at `max: 1`: the probe that gates 4b. Its reason names the probe. Its
owner is the 4b follow-up issue. No new hit appears in `session-start.mjs`, `memory/cli.mjs` or
`hooks/`. In particular, no `=== 'plainfiles'` or `=== 'engram'` branch is added outside adapters.

### REQ-1115-10 Doctrine changes are drafts only
The PR MUST NOT modify any `*.md` under `brain/`. The doctrine is carried by
`brain-drafts/*.draft.md`. Each draft passes `planAmendment()` against its target on the PR's
base, with every act `pending`.

### REQ-1115-11 #1189's three callers, verified vs not verified
- **Verified (code + #1185 evidence):** `post-merge` calls `import`
  (`hooks/post-merge:53`, evidence `-22`). `session:start` calls `import` (`session-start.mjs:290`,
  evidence `-42` line 40). `brain:memory:pull` does NOT call `import`. It runs `cli.mjs pull`
  (`package.json:84`, `plainfiles.mjs:410`), and its `git pull` fires `post-merge`, which does
  (evidence `-43` lines 9-18).
- **Not verified:** a consumer whose `post-merge` is NOT the managed `brain/scripts/hooks` copy (for
  example an older `.git/hooks` install). The alias (REQ-1115-3) covers it either way.

#### Scenario: memory:pull on plainfiles after the fix
- GIVEN a plainfiles consumer with `core.hooksPath=brain/scripts/hooks` and new upstream records
- WHEN `npm run brain:memory:pull` runs
- THEN no output line contains `does not implement op`

## B. Delta — `openspec/specs/session-start/spec.md`

### MODIFIED Requirement: REQ-2 Local-Only / No-Network Invariant
The system MUST perform ZERO network calls on the `session:start` hot path.
`memory/cli.mjs pull` MUST NEVER be invoked from this path. Only local operations from the
allowlist (`memory/cli.mjs hydrate` and `feature-resume`-class reads) are permitted. `import` is
NOT on the allowlist (it is a deprecated alias, never called from here).
(Scenarios unchanged. "pull is never invoked" now also asserts that `import` is never invoked.)

### MODIFIED Requirement: REQ-4 Local Backend Hydration (was "Local Engram Hydration")
The system MUST hydrate the ACTIVE memory backend from `.memory/records/` by invoking
`memory/cli.mjs hydrate --verify`, a local-only operation that the backend implements and that
writes nothing in the tracked tree (the rebuild belongs to `post-merge`, `memory:pull` and the
other callers that already write). It MUST NOT name or
call a backend-specific op.

#### Scenario: engram hydrated from records
- GIVEN engram declared, its binary present, and records on disk
- WHEN `session:start` runs
- THEN engram is populated through `hydrate`, with no network call, and the line reads `engram hydrated`

#### Scenario: plainfiles verified from records
- GIVEN plainfiles declared
- WHEN `session:start` runs
- THEN `hydrate --verify` only checks the derived index (no write), the line reads
  `plainfiles verified …`, and no "does not implement" text appears

#### Scenario: hydration deferred
- GIVEN `hydrate` exits 6
- WHEN `session:start` renders
- THEN the line reads `<backend> hydration deferred — <reason>` and the exit status is 0

### MODIFIED Requirement: REQ-7 Deterministic Context Output
The block MUST contain, in this order: the branch, the change(s) or "none", the memory line
(naming the active backend), the durable-records line (REQ-10), the issue-scoped records when an
issue resolves, the recency warning when stale or unknown, and the ticket resume summary or "none".

### ADDED Requirement: REQ-10 Durable Records Context
`session:start` MUST summarize `.memory/records/` directly, with no backend call: unique record
count, newest record date and title, and records scoped to the active change's issue (count plus
up to 5 newest titles). Unknown is never rendered as zero.
(Scenarios: as REQ-1115-7.)

### MODIFIED Requirement: REQ-9 day:start Non-Regression
`day:start` MUST preserve its observable behavior except for these intentional #1115 changes:
step 4a runs `memory/cli.mjs hydrate` for every backend, and step 4c (`engram sync --export`)
and its three output lines are removed. It MUST NOT reintroduce a manifest-restore call site or
any export from a backend into `.memory/`.

#### Scenario: day:start still reaches 6/6
- GIVEN the bootstrap smoke consumer
- WHEN `brain:day:start` runs
- THEN it exits 0 and prints `6/6` (`test/bootstrap-smoke/smoke.mjs:328-338`)

## C. Delta — `openspec/specs/memory-backend/spec.md`

The Purpose paragraph gains: "…and the bulk `hydrate` verb every backend implements
(`memory-backend-contract.md`, Required verbs)."

### ADDED Requirement: REQ-MB-6: Bulk Hydrate On engram
`engram.hydrate({root})` with no `recordId` MUST hydrate through `importMemory` under the #820
guard and return the normalized shape. It defers on an absent binary, a contended guard,
unreadable state, or a thrown import.

### ADDED Requirement: REQ-MB-7: Bulk Hydrate On plainfiles
`plainfiles.hydrate({root})` MUST run `rebuildIndex` only (no git) and report
`skipped = indexCount`, because the records ARE the backend (rule 1 by construction). With
`verify: true` it MUST write nothing and report `stale` (REQ-1115-1b).

### ADDED Requirement: REQ-MB-8: `import` Is A Deprecated Alias Of `hydrate`
For one release, `cli.mjs import` MUST dispatch `hydrate` after a single stderr notice naming
`hydrate`. It is never added to `FALLBACK_OPS`.

### ADDED Requirement: REQ-MB-9: Two Hydrations, One Snapshot, Through `hydrate`
Running `cli.mjs hydrate` twice against one snapshot MUST yield exactly one backend row per
record id on engram (scenario of `openspec/changes/issue-864-memory-2-0/spec.md`, rule 1), and a
byte-identical `index.jsonl` on plainfiles.

#### Scenario: plainfiles twice
- GIVEN records and a canonical `index.jsonl`
- WHEN `hydrate` runs twice
- THEN `index.jsonl` is byte-identical after each run, and `git status --porcelain .memory` is empty
