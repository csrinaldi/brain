# Checkpoint Report — CP-C0

> **Change:** `issue-201-memory-format` · **Slice:** C0 (design-only) · **Branch:** `feat/issue-201-memory-format` (base `feature/v2.0.0` @ `fc20405`)
> **Issue:** #201 (`status:approved`). **Depends on:** nothing (§10: C0 anytime).
> **Status: CP-C0 APPROVED — 4 mandatory pins applied before the MR** (contract additions, no redesign; verified in the MR + CP-C1). Closing the slice: `memory:share` → commit → PR (`Part of #201`). See §11.
> **CP-C0 verdict:** APPROVE. The crux (union + content-hash + dedup-at-reindex, with the honest dedup scope), the derived-index-vs-authoritative-manifest inversion, and the evidence-based loss list were approved as-is.

---

## 1. What was designed (no code)

The brain-owned `.memory/` durable format as a normative spec draft (`memory-format.md`, final home `brain/core/methodology/`) + an ADR draft (`adr-0017`, final home `brain/project/decisions/`), plus the SDD artifacts. Records live at `.memory/records/<yyyy-mm>.jsonl` (append-only, plaintext) + `.memory/index.json` (committed, regenerable). No library/validator/migration — those are C1–C4.

## 2. The central design decision (the CP-C0 crux)

**Union merge driver (`.gitattributes` `merge=union`, scoped to `records/*.jsonl`) + content-hash `id` + dedup-at-reindex.**
- Concurrent appends from two branches concatenate conflict-free; each JSONL line is a complete record so union never splits one.
- `id = "rec-" + sha256(canonicalJson({type,actor,actorKind,ts,project,issue?,supersedes?,content}))[:16]`, canonicalized per **RFC 8785 (JCS)** — sorted keys, no insignificant whitespace, minimal number encoding, JCS string escaping, UTF-8 — so the hash is deterministic across implementations. `source` excluded (incidental).
- Union's only failure mode (a duplicate line when two branches write the same record) is collapsed at reindex because the index is keyed by `id`.
- **Dedup scope (honest):** the collapse holds for *engram re-import* records that share an upstream `ts`; records authored fresh on two branches get different wall-clock `ts` → different `id` → correctly kept as distinct. A **hard determinism requirement** pins engram's timezone-less timestamps to **UTC** so identical sources yield identical `ts`.
- **`index.json` is NOT union-merged** (it is a single JSON object; union would corrupt it). The `.gitattributes` glob covers `records/*.jsonl` only; an `index.json` conflict is resolved by **discarding both sides and running `memory:reindex`** — never hand-merged, never union-merged. The index is derived/regenerable, so its conflict is throwaway, not data loss.

Rejected: **sharding** (`records/<yyyy-mm>-<actor>.jsonl`) — fragments layout, leaks actor identity into filenames, still collides same-actor-two-branches. **Manual resolution** — reintroduces the ADR-0002 pain on a machine-generated log; doesn't scale to parallel agents.

**Why strictly better than ADR-0002's manifest:** brain's index is *derived and regenerable*, not authoritative — an index conflict is throwaway; the JSONL records are the truth.

## 3. CP-C0 evidence — what engram export loses (mandatory; no list, no verdict)

The real chunk is a **gzip of a single JSON object `{sessions, observations, prompts}`** (not plaintext JSONL). Observation fields: `id (local int), sync_id, session_id, type, title, content, project, scope, topic_key, revision_count, duplicate_count, last_seen_at, created_at, updated_at`; timestamps `"2026-06-26 22:29:51"` (**no `T`, no timezone**).

- **(A) Brain fields engram cannot supply** (exist only as consolidation-protocol §4 prose inside `content`): `actor`, `actorKind`, `issue`, `supersedes`, `source`; plus `id` (engram's is a non-portable local int; `sync_id` is engram's own shape) and `ts` (timezone lost → C4 assumes UTC).
- **(B) Engram fields with no brain home:** `title`, `scope: personal` (**never exported** — no public-repo home), `session_id` / `sessions[]` / `prompts`, `sync_id` / `revision_count` / `duplicate_count` / `last_seen_at` / `updated_at`, non-enum `type: manual`, and **`topic_key`** (engram's internal upsert key, e.g. `sdd/x/proposal` — C4 drops it, may optionally inform `supersedes`, never coerces).

**Conclusion:** a C4 migration **cannot be a field copy** — it reconstructs provenance and drops engram-internal fields.

## 4. The two required notes (design.md)
- **(a) Public-repo exposure:** `.memory/records/*` plaintext is deliberately readable. Stance: only `scope: project` durable knowledge becomes a record; engram `scope: personal` is **never** exported; `actor` is a coarse handle (no legal name); `actorKind` is `human|agent` only. Enforcement is **convention-backed + a partial email heuristic** — the enforcing gate is the **C1 secret-scrub hook**, not the validator.
- **(b) `index.json` churn:** reindex updates **only** entries for newly appended records and leaves the rest byte-identical, so `git diff index.json` is proportional to the *new* records, not the store size — small, localized diffs.

## 5. Co-promotion requirement (the #197→#199 lesson, applied preventively)
`memory-format.md` and `adr-0017` **cross-link each other at their final `brain/` paths** — both resolve only if promoted **together, in the same commit**. A lone promotion breaks `brain:nav`. Recorded as design.md Note (c) + `tasks.md` task 3.3 + the deferred Tier-2 human-gate task. **Verify both cross-links resolve post-promotion (`brain:nav`).** (All other draft cross-links already resolve today; verified.)

## 6. Adversarial review (fresh context) — run before this checkpoint
Verdict was **"needs fixes."** Found & fixed (all cheap doc fixes on the CP-C0 crux):
- **BLOCKER** — design.md falsely claimed `merge=union` applies to `index.json` (it corrupts JSON; contradicts the `records/*.jsonl` glob). Fixed: exclusion rule + reindex-on-conflict REQ-MF-4 scenario.
- **MAJOR** — dedup silently depended on an unpinned `ts` (→ UTC determinism REQ) and an unpinned `canonicalJson` (→ RFC 8785); the export-loss list missed `topic_key` (→ added); co-promotion was implied not stated (→ explicit gate).
- **MINOR/NIT** — one-physical-line-per-record now a REQ; PII claim made realistic; source-collision index note added.

## 7. Substrate — CP-C0 evidence (rung-1 debut)
`brain:governance-status` reports **`RUNG 1 — merge is blocked until governance checks pass (branch protection armed with required contexts)`** + `platform available`. Rung 1 is now **mechanically active** on the chain; the C0 PR is the first to merge under it — the 5 REQUIRED checks must be green to merge without a bypass. `substrate.mjs` reports rung 1 correctly (no stale-detection finding).

## 8. Baseline & scope
- `npm test` → **871 pass, 0 fail** · `brain:repo:check` → clean · `brain:nav` → green.
- **No code**, no `.gitattributes` file, **`brain/` untouched** (drafts quarantined in `brain-drafts/`). Budget-counted diff = **0** (all under `openspec/changes/**`, in `ignoreList`).
- `tasks.md`: 21 checked (L4 satisfied). `docs/inbox/PLAN-adapters-v3.md` stays untracked.

## 9. Open questions (for the reviewer / C1–C4)
- **`ts` → UTC** is now a hard REQ (was an open question) — C4 applies it.
- **`type: manual` (non-enum)** — C4 recommended to *reject/surface for reclassification*, not coerce.
- **`index.json` commit vs gitignore+reindex-on-clone** — C0 commits it for zero-tool query; flagged to revisit if diffs prove noisy.
- **`.gitattributes merge=union`** — core git driver since 1.6; flagged so C1 doesn't treat it as novel.

## 10. Next slice — C1
Format library + validator (`memory:reindex` rebuilds `index.json` from records alone; property test: delete index → reindex → identical) + the secret-scrubbing hook (fails closed on a hit) + the `.gitattributes merge=union` entry. Depends on this C0 contract.

---

## 11. CP-C0 APPROVE — 4 mandatory pins applied (contract additions, no redesign)
- **R1 — `index.json` serialization is normative.** One entry per physical line, sorted by `id`, deterministic. Because ids are content-hashes, parallel inserts distribute uniformly → git's normal 3-way merge auto-resolves **most** parallel appends; a real conflict is only the *occasional adjacent-line insertion* → discard + `reindex` (rare, not routine). C1 constraint: conflict ergonomics = helper / post-merge hook, **not** a custom merge driver for the index (a per-clone `.git/config` registration is the engram friction this design eliminates). New REQ-MF-4 scenario.
- **R2 — `title` fold pinned** (resolves the drop-vs-fold contradiction): `content = "**"+title+"**\n\n"+content` when non-empty — deterministic, feeds the hash.
- **R3 — absent optionals OMITTED, never `null`** (RFC 8785 hashes `{}` ≠ `{"issue":null}`): omitted from record + hashInput; the validator rejects a `null` optional.
- **R4 — co-promotion is THREE files:** `adr-0017` + `memory-format.md` + `brain/HOME.md` (the `decision`-labeled promotion MR needs the HOME ADR-index entry for `adrPresence`, and the HOME methodology link so `brain:nav` doesn't orphan `memory-format.md`).
- **Note:** record physical order in a `.jsonl` is not semantically significant — chronology = sort by `ts`, never file position.

Baseline stays green (871 pass, repo:check clean, nav green); `brain/` untouched.

---

**CP-C0 CLOSED (APPROVE). Slice closing → MR (`Part of #201`) for the human to merge — the first merge under mechanical rung 1.**
