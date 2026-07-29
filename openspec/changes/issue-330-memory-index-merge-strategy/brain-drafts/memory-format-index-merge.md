# Draft — `memory-format.md`: document the index's merge strategy (issue #330)

> **Tier 2 draft.** `brain/core/**` is human-promoted (`agent-authorities.md` → Tier 2:
> "the agent drafts the artifact in `openspec/changes/{iid}/brain-drafts/`; the human moves it
> to `brain/`"). This file is the proposed edit, not the edit itself.
>
> **Target:** `brain/core/methodology/memory-format.md`, section
> *"Concurrent-append merge policy"* (currently lines 97–127).
> Satisfies REQ-330-3.

---

## Edit 1 — retitle the section

The section is no longer only about concurrent *appends*: the index is a full rewrite, and it now
has a declared strategy too. Retitle so a reader hitting an `index.jsonl` conflict finds it.

```diff
-## Concurrent-append merge policy
+## Concurrent-write merge policy
```

---

## Edit 2 — insert after item 3 (current line 112), before the `>` blockquote

Insert this as a new numbered item **4**:

```markdown
4. **The derived index merges by union too, for a different reason.** `index.jsonl` is declared
   `merge=union` in `.gitattributes` as well (issue #330) — without a declared strategy it fell
   through to git's default text merge and conflicted on every parallel branch that had run
   `memory:share`, while the records beside it merged silently.

   The records' rationale does **not** transfer unchanged. `records/*.jsonl` is append-only, so
   union concatenates two tail appends. `index.jsonl` is the opposite shape: `serializeIndex()`
   emits the **whole file, sorted by `id`**, and `rebuildIndex()` writes it in a single
   `writeFileSync` — a deterministic **full rewrite**. Two branches therefore hand git two
   complete rewrites whose insertions land at arbitrary sort positions, so a union merge may
   leave the index **unsorted**, not merely carrying a duplicate line.

   That is safe, on three properties rather than by analogy with the records:

   - **Line integrity holds.** Union's only structural hazard is a half-line, which requires a
     record spanning multiple physical lines — forbidden by the format and rejected by the
     validator (see *Layout*, above).
   - **No reader depends on the file.** Every `index.jsonl` access in `brain/scripts/**` is a
     write through `rebuildIndex()`. Write-time dedup reads `records/`, not the index
     (`store.mjs#readRecordIds`).
   - **Repair is one command with no operator judgment.** `rebuildIndex()` is deterministic and
     idempotent, so `npm run memory:reindex` restores the canonical sorted file byte-for-byte.

   The index remains **derived, regenerable, and never authoritative** (see *Layout*). A merged
   index that is unsorted or duplicated is a transient cosmetic state, not corruption.
```

---

## Edit 3 — extend the closing blockquote (current lines 114–117)

The existing note covers only the records' duplicate line. Append one sentence:

```markdown
> The same applies to `index.jsonl`, more loosely: because it is a full rewrite rather than an
> append, a union merge can leave it unsorted as well as duplicated. Both are erased by the next
> reindex, and nothing reads the file in between.
```

---

## Notes for the human reviewer — NOT part of the proposed edit

Two drift observations surfaced while grounding this change. Neither is fixed here; both are
recorded so the decision is yours rather than silently made.

1. **Line 112 reads more absolutely than the code supports.** *"The index, not the log, is the
   dedup authority"* is true for the *query* question (collapsing duplicate physical lines on
   read), but `store.mjs:97-99` states the opposite for the *write* question, in as many words:
   `records/` is the "AUTHORITATIVE dedup source — not the derived `index.jsonl`". Two different
   dedup questions, one flat sentence covering both. Suggest narrowing it to "the index is the
   dedup authority **for queries**; `records/` is authoritative for write-time dedup" — but that
   is a wording change to a line issue #330 did not touch, so it is proposed, not applied.

2. **"queries read through the index (deduped)" has no implementation yet.** No code path in
   `brain/scripts/**` reads `index.jsonl`; `plainfiles.search()` scans `records/` directly. The
   sentence describes the intended contract, not current behaviour. Worth either marking as
   intent or filing a gap issue — out of scope for a merge-strategy fix.
