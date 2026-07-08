# Tasks — Engram ↔ Brain Record Migration (slice C2a)

> **Re-split (CP-C2 budget, human ruling).** After the adversarial-review fixes, the original C2a
> (pair + export + `migrate-v1 --dry-run`) counted **476/400**. Per plan §10 (split, never
> `size:exception`) it was re-split: **C2a (this MR, #217) = the `provenance` pair + `engram-export`
> lib only** (251 counted). The `migrate-v1` report + CLI op + real-data dry-run move to
> **C2-migrate** (a new approved issue); **C2b** (import + scrub re-point + real run + dual-write)
> is unchanged and follows C2-migrate. See design.md §"What C2a explicitly does NOT touch".

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines (C2a) | 251 (code) + tests + this openspec change (excluded) |
| 400-line budget risk | Low — 251/400 after the re-split |
| Chained PRs recommended | Yes (C2a → C2-migrate → C2b, separate approved issues) |
| Delivery strategy | C2a lands standalone; C2-migrate + C2b are follow-up slices |

Decision needed before apply: resolved — the re-split was applied per the human ruling; C2a ships
the pair + export, migrate machinery is held on `wip/c2-migrate` for its own approved issue.

---

## Phase 1: Provenance parser/renderer pair (RED → GREEN)

- [x] 1.1 `provenance.test.mjs` — RED: canonical §4 fixtures (Actor humano/agente, Fuente,
      Supersede), the mandatory `parse(render(record))` property test
- [x] 1.2 `provenance.mjs` — GREEN: `parseProvenance`/`renderProvenance` sharing ONE set of
      marker constants (`ACTOR_MARKER`, `FUENTE_MARKER`, `SUPERSEDE_MARKER`)
- [x] 1.3 Ruling 3b — malformed/partial §4 prose negatives: Actor is an all-or-nothing anchor
      (kind-less Actor, unknown-kind Actor → no block; valid Actor + malformed Fuente → partial,
      optionals best-effort). Pinned in design.md Decision 6.

## Phase 2: Export transform (RED → GREEN)

- [x] 2.1 `engram-export.test.mjs` — RED: fallback convention, R2 title fold, UTC ts conversion,
      §4 recovery, `scope:personal` filter, non-enum type rejection (`manual`, `preference`)
- [x] 2.2 `engram-export.mjs` — GREEN: `exportObservation()` implementing REQ-MIG-2; output
      passes `validateRecord()` or is itself rejected
- [x] 2.3 Ruling 3b (export level) — malformed leading §4 prose → `@legacy` fallback AND the
      malformed prose preserved verbatim in the record content (never dropped)

## Phase 3: Baseline + budget (C2a)

- [x] 3.1 `npm test` green on this branch (982 pass, 0 fail; the ~12 migrate-v1 tests are parked
      on `wip/c2-migrate` — pre-split combined suite was 994)
- [x] 3.2 `brain:repo:check` green · `brain:nav` green
- [x] 3.3 Counted diff (excl. `*.test.mjs`, `openspec/changes/**`) = 251 lines — under 400 after
      the re-split (provenance.mjs 140 + engram-export.mjs 111)

---

## Moved to C2-migrate (implemented, ships in the follow-up approved issue)

> The code below is written + tested (part of the 994-test baseline) but is held on the
> `wip/c2-migrate` branch — it is NOT in this C2a MR. It gets its own `status:approved` issue per
> plan §0.1 (one approved issue per slice, no exception for a split), and is reviewed against the
> 278 real observations (an *application* verdict, distinct from C2a's *contract* verdict).

- [~] `migrate-v1.test.mjs` / `migrate-v1.mjs` — `collectChunkObservations` (unparseable vs
      `emptyObservations` buckets) + `buildMigrationReport` (types + provenance histograms,
      rejection report, `unparseableNote`)
- [~] `memory:migrate-v1 --dry-run` CLI op in `cli.mjs` (require `--dry-run`; real run is C2b) +
      i18n keys (en + es) + `package.json` script
- [~] Dry-run against the REAL `.memory/chunks/` via a temp copy → `{recovered: 0, fallback: 275}`,
      3 rejected, 4 emptyObservations — the CP-C2-migrate evidence

## Deferred to C2b (NOT this MR)

- [ ] Import direction: brain record → engram observation, using `renderProvenance()` (the round
      trip C4 asserts)
- [ ] Re-point `secret-scrub.mjs`'s scrub target from `.memory/chunks/` to `.memory/records/`
      (`scanTextForSecrets` contract unchanged — only the input changes)
- [ ] The REAL (persisting) `memory:migrate-v1` run: write `records/<yyyy-mm>.jsonl`, move old
      chunks to `.memory/legacy/`, abort if `records/` already has content (idempotency), reindex
- [ ] Wire the full post-C2 `share`/`pull` pipeline (`export → transform → append → reindex →
      scrub`) with the dual-write transitional chunk policy (design.md Decision 5)
