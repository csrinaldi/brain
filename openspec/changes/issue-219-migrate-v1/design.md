# Design — migrate-v1 real-run CODE (slice C2-migrate, #219)

Builds on the dry-run code already present (`collectChunkObservations`, `buildMigrationReport`,
`memory:migrate-v1 --dry-run`). Adds the **real-run code**, fixture-tested. Per the human ruling
(CP-C2a follow-up), the real EXECUTION against the true store does NOT run here — that is the C2b
cutover. See Engram `sdd/memory-format/c2-migrate-c2b-boundary`.

## Decision 1 — the real run is CODE here, EXECUTION is C2b's cutover
This slice ships `runMigration()` and wires it to `memory:migrate-v1` (no `--dry-run`). It is proven
correct against a synthetic **fixture store** (a temp dir the test builds), never against the live
`.memory/`. Rationale (the argument that kills running it here): real run here + dual-write only in
C2b ⇒ every intermediate `share` materializes chunks ONLY ⇒ a delta of observations the one-shot
(abort-if-populated) can never migrate; plus chunks in `legacy/` break the old cross-machine
`memory:pull` for the whole window. Ordering is owned by the C2b cutover runbook.

## Decision 2 — idempotency abort is FIRST, and its message points at the runbook
`runMigration()` checks `records/` BEFORE any work: if it already has content → throw, message
**MUST** contain `run the cutover runbook` and name the records dir. Why the exact wording: a
dual-write `share` (C2b) that populated `records/` before the migration would trip this abort; the
operator who trips it must be routed to the runbook, not left guessing. The re-run abort is tested.

## Decision 3 — no silent loss: rejection report persisted, chunks moved not deleted
- Accepted records → `appendRecord(record, { recordsDir })` (bucketed `records/<record.ts.slice(0,7)>.jsonl`).
- Rejected observations (non-enum `type`, `validateRecord` failures) + `scope:personal` skips →
  a **persisted** artifact under `.memory/legacy/` (id/title/type/reason each). Named, never dropped.
- Original chunks **moved** to `.memory/legacy/` (never in-place deletion) — one release of retention.
- `rebuildIndex({ recordsDir, indexPath })` at the end.
- Deps injected (seams) like `engram.mjs`/`store.mjs` so the fixture test drives real FS in a temp dir.

## Decision 4 — evidence is dry-run-vs-real-chunks + real-run-vs-fixture
CP-C2-migrate evidence: (1) `--dry-run` over a temp COPY of the real `.memory/chunks/` →
`{recovered: 0, fallback: 275}`, 3 rejected named, 4 emptyObservations; (2) `runMigration()` over a
synthetic fixture store → records written, `legacy/` populated, report persisted, re-run aborts.
The real run over the TRUE store is CP-C2b evidence, never here.

## Decision 5 — the CLI REFUSES the real run; execution gating lives in the runbook order, not a bypass switch

The non-`--dry-run` CLI path does NOT execute `runMigration()` — it refuses with a message routing
the operator to the C2b cutover runbook. `runMigration()` ships as reachable, fixture-tested CODE
(that IS the re-scoped issue's "wire the real run" — reachable and proven, not ad-hoc fireable);
C2b wires its execution as an ordered step of the runbook.

**Rejected alternative (with doctrine): a CLI confirmation flag / env gate.** An adversarial review
floated gating the real run behind an explicit opt-in (`MIGRATE_V1_CONFIRM=…`). REJECTED. A
CLI bypass switch that turns a refusal into an execution is the same class of valve C1b already
prohibited when it refused a `--no-scrub` flag (the only sanctioned bypass there is an auditable
config allowlist, never a command switch). Execution gating for a destructive one-shot belongs in
the **sequencing of the cutover runbook** (migrate → immediately dual-write → scrub re-pointed),
where the ORDER is the safety property — not in a per-invocation switch a stray script or a hurried
operator can flip. A flag would also re-open the exact delta-loss window Decision 1 exists to close.
The abort-if-populated guard remains, but it protects only the *second* run; the *first* run's
safety is the runbook's ordering, which is why the CLI must not fire it at all here.

## Out of scope → C2b
Import (`renderProvenance`), scrub re-point `chunks/`→`records/`, dual-write pipeline, and THE
CUTOVER (execution + runbook). C4 round-trip = id-equality (`sdd/memory-format/c4-roundtrip-equality`).
