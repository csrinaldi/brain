---
status: applying
issue: 863
---

# Proposal: #863 — the backend contract, and the direction of capture

Parent: #864 (memory 2.0), task 1.2 (Wave 1). This is a **ruling ticket**: it asks the
maintainer to decide six things, records each decision as doctrine, and files the slices
that implement them. It implements nothing itself beyond the documents.

## What

1. A **memory backend contract** — `brain/core/methodology/memory-backend-contract.md`,
   beside `vcs-contract.md` and in its shape: the verbs, which are required, normalized
   returns, failure discipline, the three rules (idempotent hydration; never the first home
   of a capture; no artifact the durable layer needs), and the agnosticism test verbatim.
2. **ADR-0002 Amendment 1** and **ADR-0004 Amendment 1** — the manifest is no longer required;
   symlink, driver and manifest are the engram adapter's private business; the interface is
   the contract above.
3. The **capture-door ruling** and the **record-first direction** (task 3.2's ticket).
4. Doctrine rewritten in records vocabulary: `harness-contract.md:27,32-34,89-93`,
   `agent-authorities.md` Tier 1, `consolidation-protocol.md §3`, `.gitignore`'s memory block.

## Decisions requested

### D1 — Idempotent hydration: how the engram adapter satisfies the rule

| option | what it means | cost |
|---|---|---|
| **(a) declare the delta-under-guard compliant** | #820's guard + `buildImportPayload`'s delta ARE the adapter's idempotence; the contract's test ("two hydrations, one snapshot → one row per id") is the arbiter | the guard stays load-bearing, and the "mitigation" wording on #820 becomes "the adapter's implementation of rule 1" |
| (b) require upstream upsert | file a feature request to engram for `import --upsert topic_key`; until it lands, (a) | depends on a project brain does not own |
| (c) brain-side reconcile after every import | read back, delete duplicate rows | a write path into the live index that the layer does not otherwise have |

**Recommendation: (a), and file (b) as an upstream request without depending on it.** Plus a
**one-time heal** of the three pre-guard rows — a `memory:reconcile-backend` op or a
documented manual step; this needs the deletion ruling in D5 because it deletes live rows.

### D2 — Capture is a PRODUCER contract, not a door (revised 2026-09-08)

**Input from #851 / PR #873 RFC §3.1 (maintainer ruling, 2026-09-08)**: each posted cold-review
round becomes a `.memory/records` entry with `type: review`, emitted by
`brain/scripts/review/poster.mjs` at post time and riding the #862 lane — never the PR head,
because a verdict pins `head_sha` (ADR-0026 Amendment 5). The comment on this ticket asks
one thing: **do not close the producer set to "the memory CLI only".**

So rule 2 is not "which door" but **what any producer must do**: build the record through the
format library (`buildRecord`, provenance included), append it through the store
(`appendRecord` + reindex), and then either call the active backend's `hydrate` or leave it to
the next hydration. Producers are enumerated and the set is **open**: the memory CLI
(`memory:save`), the review poster (#851 slice 1), and whatever comes next. Each producer
declares four things in the contract: its trigger, where its provenance comes from, **which
tree it writes to**, and which lane carries its records. The `type` enum stays owned by
`memory-format.md` — the contract cites it, never copies it (`review` is a Tier 2 promotion
owned by #851, and until it lands `validateRecord` refuses the poster's records — a sequencing
fact for #851, not for this ticket).

The `mem_save` question is then the special case of "a writer that is not a producer":

| option | what it means | cost |
|---|---|---|
| **(a) wrap** | brain owns the capture verb: an agent captures through `memory:save` (record first, provenance from #738), and the adapter hydrates from the record. `mem_save` stays for the **working** namespace only (`brain-feature-*`, `featureResume`'s projection) and is declared **non-durable** — never exported by `share` | doctrine rewrite in three files; agents' habit changes; the MCP plugin is untouched |
| (b) retire `mem_save` from doctrine | engram's MCP is read-only for agents (search/context); all writes go through brain | loses the working-memory namespace unless re-homed |
| (c) keep `mem_save` as the door and make `share` export only "this session" | rejected in #864's frame: a session is a backend concept, provenance belongs in the record | — |

**Recommendation: (a).** It is what the memory 2.0 slices already did in practice, and the
review poster is the second producer that proves the shape — it never touches the backend at
all. The 3.2 ticket then owns: `memory:save` reachable from an agent session under `engram` (today it is
pinned to plainfiles — `MEMORY_BACKEND=plainfiles` in the npm script), hydration of the live
index from the new record, and `share` becoming "commit what is already true".

### D2b — The write target of a producer (new, from #873)

The RFC does not say **which tree** the poster writes into. `brain:review` cold-boots the PR
head into an ephemeral `/tmp/brain-review-<sha>` tree and posts from the invoking checkout —
in practice a feature worktree. A record appended there is untracked in a worktree until the
lane collector (#862 task 3.1a) sweeps it: **the #795 shape, for every review round, until
3.1a exists.**

| option | what it means | cost |
|---|---|---|
| **(a) invoking checkout + collector sweep** | the producer writes into the tree it runs from — never the cold `/tmp` tree — and the lane collector gathers every worktree of the clone | #851 slice 1 is gated on 3.1a; the RFC already says "depends on #862" and this makes the dependency specific |
| (b) a designated memory worktree | producers append into the collector's own tree | a second tree every producer must locate; the same coupling the epic just removed from features |
| (c) the main checkout | always durable, always the same place | writes into a tree another agent may be reading; `pre-commit` refuses it and the record still needs the lane |

**Recommendation: (a), written into the contract as the fourth thing a producer declares.**
For the poster specifically: write target = the invoking checkout's `.memory/records/`, never
the review worktree; lane = #862; ships after 3.1a. This is the one blocker-shaped fact the
comment does not mention, and it belongs on #851 before slice 1 starts.

### D3 — Artifact retirement: sequence

Record-first makes it trivial: manifest, chunks and symlink exist only because `share` calls
`engram sync --export`. Once `share` no longer exports the backend, all three lose their only
writer at once.

**Recommendation:** order **2.3 (#247, chunk read-back) → 3.2 (record-first `share`) → 2.4
(artifact retirement)**, not 2.4 before 3.2 as the epic's tasks list it today. Retiring the
manifest while `share` still writes it would re-create #803's churn on every push.
2.4's inventory (explore §4): untrack `manifest.json`; delete `.memory/legacy/*` (48 files,
zero readers) with the reader story stated; remove `.gitattributes:5`, the driver script and
its `bootstrap.sh` registration; confine the symlink to `engram.mjs#setup` with a retirement
note; rewrite `.gitignore:60-68`; remove `session-start` step 1's `git restore`.

### D4 — The contract's shape

Mirror `vcs-contract.md`: a verbs table (`setup`, `share`, `hydrate` — today `pull`/`import`,
`index`, `save`, `search`, `featureCheckpoint`, `featureResume`) with **required** vs
**optional** columns, normalized returns, and the failure discipline already practised
(`unsupportedOp` for optional verbs — never silent; `{measured:false, reason}` /
`deferred` for a hydration that could not run). Then the three rules and the agnosticism
test. Each backend gets a conformance row: engram, plainfiles.

**Recommendation:** required = `setup`, `share`, `hydrate`, `save`; optional = `index`,
`search`, `featureCheckpoint`, `featureResume`. That makes `save` required on engram — which
D2(a) needs anyway. **Revised 2026-09-08:** the contract gains a **Producers** section (D2) —
name, trigger, provenance source, write target, lane, hydration mode — with two rows at
signing (memory CLI, review poster) and the sentence that the set is open; and `hydrate`'s
signature admits a single record id, so a producer can hydrate what it just wrote without a
full import (#820's guard makes that safe; a full import stays the fallback).

### D5 — Deletion in the live index

Rows in the backend are a derived index; deleting one is not deleting memory. **Recommendation:**
permitted for the adapter's own reconciliation (D1 heal) and for `featureResume`'s working
namespace; records are never deleted — `supersedes` (#805) is the only correction. Written into
the contract so #805's own deletion ruling can cite it.

### D6 — Where the ADR amendments land

ADR-0002 Amendment 1: the manifest note is superseded — records are the truth (ADR-0017), the
manifest was the chunk transport's index and the chunk transport is retired (#247); symlink,
driver and manifest are the engram adapter's. ADR-0004 Amendment 1: *"no formal interface
today"* is closed by `memory-backend-contract.md`; the *"manifest required for all backends"*
consequence is withdrawn — plainfiles is the proof.

## Scope

- Includes: the contract document (with the Producers section); the two amendments; the doctrine
  rewrites in explore §5; the 3.2 ticket filed with D2's ruling; the tasks list of the epic
  re-sequenced per D3; a note on #851 stating the poster's write target and its 3.1a dependency.
- Does not include: the record-first implementation (3.2), the artifact retirement (2.4), the
  chunk retirement (2.3), the heal of the three rows (D1's slice) — each its own ticket/PR.

## Non-goals

- Replacing engram, or changing the MCP plugin.
- Backfilling provenance.
- Any gate on feature PRs.
