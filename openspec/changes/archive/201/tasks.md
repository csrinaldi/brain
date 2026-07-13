# Tasks: Brain-Owned Durable Memory Record Format (design-only, slice C0)

> **Status:** Design-only · Stops at checkpoint **CP-C0** for external review.
> This slice authors DOCS ONLY — no format library, no validator, no `.gitattributes`, no
> migration, no `brain/scripts/**` edit (slices C1–C4).

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | Docs only (~well under 400) |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Delivery strategy | single design MR, stops at CP-C0 |

Decision needed before apply: No

---

## Phase 1: Format design (design.md)

- [x] 1.1 Author `design.md` — the record schema and the durable/derived architectural shape
      (`records/<yyyy-mm>.jsonl` source of truth + derived `index.json`)
- [x] 1.2 **CP-C0 crux** — evaluate all three concurrent-append merge policies (union driver,
      per-actor sharding, manual resolution) and **choose one with rationale**
- [x] 1.3 Pin the `id` semantics — content-hash generation, determinism across machines,
      uniqueness = semantic identity, dedup-at-reindex policy
- [x] 1.4 Note (a) — public-repo exposure stance (handle-not-PII, project-scope only, no
      secrets/clinical data; secret-scrub hook is C1, stance is here)
- [x] 1.5 Note (b) — `index.json` churn discipline (reindex touches only changed entries, per
      the ADR-0002 manifest-churn lesson)
- [x] 1.6 **CP-C0 evidence** — enumerate what engram export loses, grounded in the real
      chunk/manifest inspection (mandatory for the verdict)

## Phase 2: Delta spec (spec.md)

- [x] 2.1 REQ-MF-1 record schema and required fields (append-only, enum `type`, UTC `ts`)
- [x] 2.2 REQ-MF-2 content-hash `id` identity + determinism
- [x] 2.3 REQ-MF-3 concurrent-append merge policy (union + dedup) with GIVEN/WHEN/THEN scenarios
- [x] 2.4 REQ-MF-4 `index.json` derived, regenerable, low-churn
- [x] 2.5 REQ-MF-5 public-repo exposure constraints
- [x] 2.6 REQ-MF-6 engram export → record migration losses enumerated and handled

## Phase 3: Promotion-bound drafts

- [x] 3.1 Draft `brain-drafts/memory-format.md` (normative format; final home
      `brain/core/methodology/`) — STATUS: DRAFT banner; links valid for the final location
- [x] 3.2 Draft `brain-drafts/adr-0017-memory-format-owned-by-brain.md` (final home
      `brain/project/decisions/`) — STATUS: DRAFT banner; sibling-ADR links valid for the final
      location; do NOT write to `brain/` (Tier-2 human gate)
- [x] 3.3 **Co-promotion gate (documented).** The co-promotion commit carries **THREE files**:
      `adr-0017`, `memory-format.md`, **and `brain/HOME.md`** (the `decision`-label MR requires an
      ADR-index entry, and `brain:nav` would flag `memory-format.md` as an orphan without a HOME
      link). They cross-link at their FINAL `brain/` paths, so they MUST be promoted **together, in
      the same commit** — a lone promotion leaves a dangling link and breaks `brain:nav` (the
      #197→#199 lesson). Documented in `design.md` Note (c); the actual co-promotion is the
      deferred human gate below.

## Deferred to later slices (NOT this MR)

- [ ] C1 — format library (reader/writer) + `.gitattributes` `.memory/records/*.jsonl merge=union`
      + pre-commit secret-scrubbing hook
- [ ] C2/C3 — schema validator + `memory:reindex` (derives/regenerates `index.json`, low-churn)
- [ ] C4 — engram export → record migration honoring the REQ-MF-6 loss contract
- [ ] Follow-up — wire `memory:share` / `memory:import` onto the record format (ADR-0002 flow)
- [ ] Promotion (Tier-2 human gate) — promote **three files together in the same commit**:
      `memory-format.md` → `brain/core/methodology/`, `adr-0017` → `brain/project/decisions/`, and
      the `brain/HOME.md` change (ADR-index entry for the new ADR + methodology-doc link so
      `memory-format.md` is not an orphan); then run `npm run brain:nav` to verify all cross-links
      resolve (co-promotion gate, task 3.3)

---

## Closure Checklist (CP-C0)

- [x] C.1 All artifacts authored: `proposal.md`, `design.md`, `spec.md`, `tasks.md`,
      `brain-drafts/memory-format.md`, `brain-drafts/adr-0017-*.md`
- [x] C.2 `design.md` chooses a merge policy with rationale and pins `id` semantics
- [x] C.3 `design.md` carries both required notes + the engram-export-loss enumeration
- [x] C.4 `spec.md` reflects the merge choice with GIVEN/WHEN/THEN scenarios
- [x] C.5 Both drafts carry the DRAFT banner and use final-location relative links; no writes to
      `brain/`
- [x] C.6 `tasks.md` has ≥1 checked item (L4 phase-order requirement)
- [x] C.7 No code written this slice; format + policy only — ready for CP-C0 external review
