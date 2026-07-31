# Draft — `memory-format.md`: name the index-conflict helper (issue #330)

> **Tier 2 draft.** `brain/core/**` is human-promoted (`agent-authorities.md` → Tier 2:
> "the agent drafts the artifact in `openspec/changes/{iid}/brain-drafts/`; the human moves it
> to `brain/`"). This file is the proposed edit, not the edit itself.
>
> **Target:** `brain/core/methodology/memory-format.md`, section
> *"`index.jsonl` — derived, regenerable, low-churn"* (currently lines 127–159).
> Satisfies REQ-330-5.
>
> **This draft replaces an earlier version of itself.** The superseded draft documented
> `/.memory/index.jsonl merge=union` — a mechanism this same document excludes by name. That draft
> shipped in `ff4ee8a` and was blocked on review. Nothing below weakens an exclusion; the edits
> **name the helper the document already sanctions** and add nothing else.

---

## What is NOT changing (stated so the promoter can verify it at a glance)

- The union driver stays scoped to `records/*.jsonl` **only**.
- `index.jsonl` stays excluded: **never** union-merged, **never** hand-merged.
- No custom merge driver for `index.jsonl` — still forbidden.
- The resolution stays *discard both sides and regenerate from `records/`*.

The document already sanctions the ergonomics ("MAY be a helper or a post-merge hook") but names
neither, so the operator who hits the conflict has to reconstruct four separate facts. These edits
close that and nothing more.

---

## Edit 1 — name the helper in the ergonomics clause

Section *"`index.jsonl` — derived, regenerable, low-churn"*, second bullet
(**"Serialized one entry per physical line, sorted by `id`, deterministically"**), final sentence,
currently lines 140–144.

Only the last line of the bullet changes; the three preceding lines are quoted for anchoring.

```diff
   MAY be a helper or a post-merge hook, but MUST NOT require a **custom merge driver for
   `index.jsonl`** (a per-clone `.git/config` registration — the engram-driver friction this format
   eliminates); `records/*.jsonl` keeps the built-in `merge=union`, which needs no per-clone
-  registration.
+  registration. That helper is **`npm run memory:resolve-index`** (issue #330), and it is layered
+  in exactly that order: the command is the unit of truth and works in every clone with **zero
+  installation**, while the `post-merge` hook is a thin, non-blocking caller of the same command
+  and holds no resolution logic of its own.
```

---

## Edit 2 — point the exclusion bullet at the one-command form

Same section, third bullet (**"Excluded from the union driver"**, currently lines 145–153), final
sentence at lines 151–153. The wording change is `running memory:reindex` →
`regenerating from records/`, because the one-command form now names itself in the sentence that
follows; `memory:reindex` remains the underlying regeneration and is named as such.

```diff
-  duplicate and stale entries, not a clean merge. The index is fully regenerable from
-  `records/`, so a git merge conflict on `index.jsonl` is resolved by **discarding both sides and
-  running `memory:reindex`** — it is NEVER hand-merged and NEVER union-merged.
+  duplicate and stale entries, not a clean merge. The index is fully regenerable from
+  `records/`, so a git merge conflict on `index.jsonl` is resolved by **discarding both sides and
+  regenerating from `records/`** — it is NEVER hand-merged and NEVER union-merged.
+  `npm run memory:resolve-index` is that resolution as one command: it discards the conflicted
+  working-tree file, regenerates the index (the same `rebuildIndex()` that `memory:reindex` runs),
+  and `git add`s the path **only if git still reports it unmerged** — so the operator finishes the
+  merge with `git commit` and no judgment call, and a hook-triggered call on an already-clean tree
+  normalizes the file while staging nothing.
+
+  It fails **closed**: if any `records/*.jsonl` carries conflict markers it refuses and leaves the
+  index untouched, because the index is derived from that log and regenerating over a conflicted
+  one would bake the markers in and report success.
```

---

## Notes for the human reviewer — NOT part of the proposed edit

Three observations surfaced while grounding this change. None is fixed here; all three are recorded
so the decision is yours rather than silently made.

1. **Measured: the conflict is rare, and the rate depends on store size.** Issue #330 asserts the
   index "conflicts on every parallel branch". Measured on the normative serialization with this
   repo's real index as merge base: **0–4.5% at n=1575**, high only for young stores. This
   *confirms* lines 135–140's prediction (content-hash ids distribute insertions uniformly, so
   git's ordinary 3-way merge auto-resolves most parallel appends). Consider stating the measured
   figure in that bullet — it is currently an unquantified "not the common case", and the number is
   what justifies a cheap on-demand helper over an always-on merge attribute.

2. **Line 112 reads more absolutely than the code supports.** *"The index, not the log, is the dedup
   authority"* is true for the *query* question (collapsing duplicate physical lines on read), but
   `store.mjs:97-99` states the opposite for the *write* question, in as many words: `records/` is
   the "AUTHORITATIVE dedup source — not the derived `index.jsonl`". Two different dedup questions
   under one flat sentence. Suggested narrowing: "the index is the dedup authority **for queries**;
   `records/` is authoritative for write-time dedup." Proposed, not applied — it is a wording change
   to a line issue #330 did not touch.

3. **"queries read through the index (deduped)" has no implementation yet.** No code path in
   `brain/scripts/**` reads `index.jsonl`; `plainfiles.search()` scans `records/` directly. The
   sentence describes the intended contract, not current behaviour. Worth either marking as intent
   or filing a gap issue — out of scope here.
