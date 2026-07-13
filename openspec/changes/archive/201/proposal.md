# Proposal — Brain-Owned Durable Memory Record Format (design-only, slice C0)

> **Status:** Design-only · Stops at checkpoint **CP-C0** for external review · **Issue:** #201 ·
> **Relates to:** [ADR-0002](../../../brain/project/decisions/adr-0002-memoria-git-based-dos-capas.md)
> (two-layer durable/live memory + the manifest lesson),
> [ADR-0004](../../../brain/project/decisions/adr-0004-adapter-memoria-memory-backend.md)
> (memory-backend adapter),
> [ADR-0009](../../../brain/project/decisions/adr-0009-documentation-language-policy.md) (docs English),
> [consolidation-protocol.md](../../../brain/core/methodology/consolidation-protocol.md) §4
> (the provenance convention the record inherits). ADR draft:
> [adr-0017-memory-format-owned-by-brain.md](brain-drafts/adr-0017-memory-format-owned-by-brain.md)
> (DRAFT — human-promote later). Normative format:
> [memory-format.md](brain-drafts/memory-format.md).

> **Design-only invariant (load-bearing).** This slice writes **no code** — only the format
> spec, its design (with the merge-policy decision), and two promotion-bound drafts. No format
> library, no validator, no `.gitattributes`, no migration, no `brain/scripts/**` edit. Those
> are slices C1–C4.

## Context

[ADR-0002](../../../brain/project/decisions/adr-0002-memoria-git-based-dos-capas.md) promised a
**durable** memory layer recoverable with nothing but `git clone` — no engram, no CLI, no
network. In practice the durable layer *is engram's own gzip export*: content-addressed chunks
(`.memory/chunks/*.jsonl.gz`) plus an authoritative `.memory/manifest.json`. Inspecting the real
store (2026-07-04) confirms each chunk is a gzip of engram's internal observation shape, and
ADR-0002's own note proves the manifest is authoritative and non-regenerable (no manifest → a
fresh engram imports nothing, even with the chunks present).

That couples the *durable format* to *one implementation's transport* and undercuts ADR-0002 in
three ways: gzip is not readable with `git clone` alone; the manifest is a mandatory,
non-regenerable conflict point; and brain's own provenance model (who authored a memory, human
or agent, which issue, what it supersedes) is not a field in engram's export — it survives only
as prose inside `content` ([consolidation-protocol](../../../brain/core/methodology/consolidation-protocol.md) §4).

The "Adapter & Gap Completion Plan (v3)" answers this by making **brain own the durable record
format**, independent of engram's gzip transport: plaintext append-only JSONL records plus a
*derived, regenerable* index.

**C0 is the design slice.** It fixes the record schema, the layout, the content-hash identity,
and — the crux — the **concurrent-append merge policy** that resolves the ADR-0002 manifest
conflict at the record level. It stops at CP-C0 so the format can be reviewed before any library
depends on it.

## What to build (this slice)

1. **`design.md`** — the format design: the record schema, and the CP-C0 merge-policy decision
   (evaluate union driver vs. per-actor sharding vs. manual resolution; **choose** union +
   content-hash `id` + dedup-at-reindex, with rationale); the two required notes (public-repo
   exposure stance; `index.json` churn discipline); and the mandatory **"what engram export
   loses"** enumeration from inspecting the real chunk/manifest.
2. **`spec.md`** — the normative delta (REQ-MF-1..6): record schema, content-hash identity, the
   merge policy with GIVEN/WHEN/THEN scenarios, the derived/low-churn index, the public-repo
   constraints, and the migration-loss handling.
3. **`tasks.md`** — the design authoring tasks (checked, since done) plus the ADR-draft task.
4. **Two promotion-bound drafts** —
   [brain-drafts/memory-format.md](brain-drafts/memory-format.md) (normative format doc, final
   home `brain/core/methodology/`) and
   [brain-drafts/adr-0017-memory-format-owned-by-brain.md](brain-drafts/adr-0017-memory-format-owned-by-brain.md)
   (final home `brain/project/decisions/`). Both carry a **STATUS: DRAFT** banner and relative
   links valid for their **final** location. A human promotes them per the consolidation
   protocol (Tier-2 human gate).

## Out of scope (non-goals)

- **No format library / reader / writer.** Slice C1.
- **No `.gitattributes` `merge=union` file.** This slice **designs** the merge policy; C1
  creates the file.
- **No schema validator.** Slice C2/C3.
- **No `memory:reindex` implementation** and no engram↔record migration. Slices C3/C4.
- **No `brain/scripts/**` edit, no test.** Design docs only.
- **No writes to `brain/`.** The two drafts stay in `brain-drafts/` until a human promotes them.

## Acceptance criteria

This is a design slice; acceptance is **artifact completeness**, not passing tests.

- [x] `design.md` evaluates all three merge policies and **chooses one with rationale**, and
  pins the `id` semantics (content-hash generation, uniqueness, dedup).
- [x] `spec.md` reflects the chosen merge policy with GIVEN/WHEN/THEN scenarios.
- [x] `design.md` carries both required notes: the public-repo exposure stance and the
  `index.json` churn discipline.
- [x] `design.md` enumerates what engram's export does NOT map to a brain record (the mandatory
  CP-C0 evidence), grounded in the real chunk/manifest inspection.
- [x] Both promotion drafts carry the STATUS: DRAFT banner and use relative links valid for
  their **final** location (not the `brain-drafts/` path).
- [x] `tasks.md` has ≥1 checked item (required by L4 phase-order).
- [x] No code written; no writes to `brain/`.
- [x] This change is under the 400-line budget and links issue #201.

## Risks

- **Merge policy under-specified for C1.** If the union-driver decision or the dedup point is
  left ambiguous, C1 re-litigates it. Mitigated by pinning the full policy and the id semantics
  in `design.md` Decisions 2–3 and `spec.md` REQ-MF-3.
- **Migration losses discovered late.** If the engram-export-loss list is incomplete, C4 hits
  surprises. Mitigated by grounding the enumeration in the real chunk/manifest and carrying it
  into `spec.md` REQ-MF-6 as a testable contract.
- **Promotion-link rot.** Drafts with links valid for the `brain-drafts/` path would break on
  promotion (the #197→#199 lesson). Mitigated by writing links for the final location and
  banner-flagging the drafts.
