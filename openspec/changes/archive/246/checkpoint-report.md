# Checkpoint Report — CP-C3 (Slice C3, issue #246)

> **The tranche that makes the memory port n=2.** Track C's "backend-agnostic, durable `.memory/`" claim
> was asserted (one backend, engram) — C3 proves it with a second real inhabitant. **Hand this report to the
> external reviewer.** Work pauses for the verdict.

## What C3 delivered
`brain/scripts/memory/backends/plainfiles.mjs` — a **zero-dependency** second `MEMORY_BACKEND` where the
committed `.memory/records/*.jsonl` ARE the store. Ops:

| Op | Behavior |
|----|----------|
| `save` | scan-then-write (secret-scrub fail-closed BEFORE append) with **measured, spoof-resistant provenance** |
| `search` | **zero-binary** Node scan over the records; `rg` is an optional accelerant, never a dependency |
| `share` | self-check `rebuildIndex()` |
| `pull` | `git pull` + `rebuildIndex()`, records-only; a dirty tree delegates to git, **never auto-discards** |
| `setup` | mkdir `records/` + reindex self-check (no engram symlink, no merge-driver) |
| `index` / `featureCheckpoint` / `featureResume` | explicit `unsupportedOp` error (loud, documented — MVP deferral) |

Asymmetry by design: `engram`'s `save`/`search` via the cli also refuse via `unsupportedOp`, pointing to the
native `mem_save`/`mem_search` — **never cryptic, both backends** (Q1 corollary).

## CP-C3 evidence — n=2 is demonstrated, not asserted
- **Two-direction round-trip** (`plainfiles-roundtrip.integration.test.mjs`) drives C4's REAL production legs
  — `dualWriteRecords` (engram→records) and `importMemory` (records→engram) — via seams, both directions,
  with record identity asserted by the real `computeRecordId`. No live engram/git in `npm test`.
- **Durability is executable:** a plain Node `readFileSync`/`.includes()` over `.memory/records/*.jsonl`
  answers "what decisions were made about X" — no engram, no `rg`. The PLAN's durability guarantee, now real.
- **Provenance is genuinely spoof-resistant** (fresh review verified at three layers): the cli parser never
  reads `--actor`/`--actor-kind`/`--ts` into the record; the `save` signature destructures only `type`/
  `project` (defense in depth); and a live test spawns the real cli with `--actor spoofed --actor-kind human`
  and confirms the written record is still `actorKind:'agent'` with a measured `ts`. This matters because the
  store feeds actor-check (L5).

## Provenance doctrine (the A4 structural principle, applied to memory)
`actor` ← measured (`git branch`); `ts` ← measured (`nowUtcSeconds()`, the C2a UTC-seconds format, never a raw
`new Date()`); `actorKind` ← the constant `'agent'` — **door-typed**: it records the entry DOOR (the plainfiles
`memory save` cli door is agent-by-construction), NOT the executor's identity. A constant is not spoofable.
Two hardenings landed: a consistency check that neither cli door accepts caller-supplied provenance, and a
**doc-scan tripwire** (event-detectable, not memory-based) that fails if a tracked doc ever instructs a human
to run `memory save` without carrying the actorKind decision — broadened in review to cover imperative verbs
(en+es) and bare fenced code blocks, exempting the `openspec/changes/**` SDD artifacts.

## Evidence
- `npm test`: **1269/1269** · `brain:repo:check` · `brain:nav` green
- Non-test counted diff: **373/400** (recomputed via the real gate; `ignoreList` untouched). A first draft hit
  573 and was brought under budget honestly — inlining the tripwire guard + trimming `plainfiles.mjs` JSDoc to
  design.md pointers — NOT via `size:exception` and NOT via a C3a/C3b split.
- Fresh-context adversarial review: no blockers; two MINORs (tripwire breadth, silent scope/topic drop) fixed
  before this checkpoint — both to honor the project's own never-cryptic / real-teeth ethos.

## Honest disclosures
- `brain:audit` exits 1 with the **2 PRE-EXISTING** `adrPresence` FAILs (`04ae992`/`8d60661`, PRs #198/#199) —
  verified unchanged; C3 introduced no new failure.
- The exploration surfaced that **C4's chunk→records migration is incomplete** (`brain-audit`/`brain-check`/
  `release` still read via `readChunkObservations`), so `memory:share` still materializes `.memory/chunks/`.
  OUT of C3 scope — filed as its own issue **#247**.

## Acceptance
- `MEMORY_BACKEND=plainfiles` save/search zero-dep; git-clone+grep answers a decision question; the
  two-direction round-trip passes; suite green; no new audit failure. ✅

## Deferred (MVP boundary)
`index()`/`featureCheckpoint()`/`featureResume()` for plainfiles → explicit `unsupportedOp` (loud seam), and
originating a `supersedes` chain through either cli save door (faithfully mirrors `_defaultEngramSave`'s
existing asymmetry — not a new gap).

## Next
**Track B becomes the priority** — the SDD harness port is still n=1 (`gentle-ai` only; no `sdd-layout.md`/
`plain`/`openspec-fission`). Also open: #247 (chunk-migration completion), and the endpoint-gated SCIT bundle
from Track A.
