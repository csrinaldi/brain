---
status: draft
issue: 701
artifact_store: hybrid
topic_key: sdd/issue-701-memory-export-scope/proposal
---

# Proposal — the export writes into a worktree it did not come from (issue 701)

> **The ticket's comment supersedes its body, and the body is not merely stale — it is
> doctrinally refused.** The body asks for a `merge` rule on `/.memory/index.jsonl`. That
> exclusion is deliberate and named twice (`memory-format.md:238-246`, ADR-0017:174-182);
> it was already attempted once as `merge=union` (PR #360) and rewritten out. The remedy
> the body wants already shipped: `memory:resolve-index` (#330). This change follows the
> comment.

## What

One root cause, measured. `memory:share` materializes **every** project-scoped observation
the host-global engram DB holds into **whichever worktree ran it**.

`dualWriteRecords` (`backends/engram.mjs:329-347`) filters candidates on exactly three
things: `scope:personal`, a non-enum `type`, and a throwing transform. There is **no**
worktree, branch, or authorship filter. Its one dedup is against the worktree's *own*
`records/` — a stale snapshot of the branch base — so every record that landed on `main`
after the branch point is re-materialized as an untracked file.

## The evidence, and what would falsify it

Across 8 worktrees, counting only what the export **wrote** (untracked or modified against
each worktree's own HEAD — the tracked corpus is git's, not the exporter's):

| | n | |
|---|---|---|
| written | 23 | |
| re-export | 20 | byte-identical to a record already on `origin/main` |
| divergent | 2 | same id, widened `source` |
| genuinely new | 1 | `rec-48df1fba48cdaaa0`, `issue=545`, in the issue-545 worktree |
| **not authored here** | **22 / 23 = 95.7%** | |

**Falsifier**: a worktree with n>0 written files where every id is *absent* from
`origin/main` refutes the claim. So would finding these files **tracked** rather than
untracked — that would make them git's doing, not the exporter's, and is precisely the
error the first cut of the measurement made.

Scale, not over-claimed: **1 divergent duplicate in 2089 records on `main`**, and `issue`
survives on both copies. This is friction and `source` loss, not corruption.

## Decision 1 — do not define "authored here"

Every candidate definition fails: the record's `issue` (15 725 records repo-wide carry
none), the branch's issue (worktrees exist on issueless branches), the change-dir or the
worktree path (a session summary legitimately spans tickets).

**We do not need it.** The 22 are characterised by a purely mechanical property: *the id
is already present at the upstream base*. So widen the existing dedup from "already in my
working `records/`" to "already in `records/` at `origin/main` (or the merge-base), or in
my working tree". Content-addressed, no semantics, no failure mode on records lacking
`issue`, and it correctly keeps the one new record.

**What it gets wrong, named**: a record authored in a *sibling* worktree and not yet on
`main` is in the same host-global DB and still leaks in. Unobserved in this measurement,
unmeasured in general. That residual is where an authorship definition would be needed —
and it is deferred, not solved. If one is ever forced, the least-wrong is record-`issue` vs
branch-issue, and what it gets wrong is excluding every record with no `issue`.

## Decision 2 — which symptoms the root fix actually closes

| Symptom | After the root fix |
|---|---|
| 2. Untracked records block `git merge` from starting (exit 2, empty conflict list) | **Closed.** 22 of 23 writes stop happening. |
| 1. `index.jsonl` conflicts on every merge | **Reduced, not closed.** The index diff falls from ~21 lines to ~1; #330 measured conflict rate as a function of insertion count. Two branches each authoring one record still each append one line. **No code here** — the resolution exists (`memory:resolve-index`); what this change owes symptom 1 is a retraction of the body's premise. |
| 3. `source` prefix divergence | **Occasion removed, defect not fixed.** Filed separately. |

## Decision 3 — the `source` fix is filed, not taken

The brief's causal story (`--issue N` adds the prefix, export drops it) is not what the
code does. `parseProvenance` assigns the **whole** rendered Fuente text back to `source`
(`provenance.mjs:100-102`), so one `pull → share` round trip widens `source` once and then
stabilises. That is ADR-0017 **Amendment 1's documented, explicitly accepted, never-refused
case** — not a new defect, and not fixable by "make every write path carry the ticket",
because no ticket is missing. The real fix is on the parse side and is **not** one line:
stripping `issue #N / ` unconditionally destroys ADR-0017's canonical `"issue #201 / PR
#204"` shape. It is the on-the-wire ambiguity class #461 already tracks. **Out of scope.**

## Decision 4 — the process half is a gate, or it is nothing

`git add .memory/` in a worktree commits records that worktree did not write — observed
three times today on the same record file. A prose rule here would reproduce, exactly, what
this repo already names about `memory-gate`: *"a promise the checklist makes and no gate
keeps"* (`AGENTS.md:402-408`).

**In scope**: a pre-commit/pre-push refusal when a staged `.memory/records/` path's blob is
byte-identical to `origin/main`'s — the **same predicate** as the exporter fix, one
mechanism at two call sites. **Out of scope**: any agent-facing prose rule.

## Scope

**In**: (1) scope the export dedup to the upstream base; (2) the staged-record gate reusing
that predicate; (3) retract the body's `index.jsonl` premise in the change record.

**Out**: the `source` round-trip fix (filed); any `.gitattributes` change for
`index.jsonl` (doctrinally refused); any authorship semantics; `manifest.json`.

## What must NOT break

`resolve-index`'s duplicate and divergence reporting is what surfaced all of this. Success
is **fewer writes**, never fewer reports. `store.duplicates.test.mjs::roundtrip-divergence`
— Amendment 1's executable disproof — must stay green, and a divergent pair must still be
named after the fix.

## Doctrine

**No ADR-0017 amendment is required.** Scoping *which* records an export writes is not a
format, id, merge or index change; the records written are format-valid either way. If a
note in `memory-format.md` (Tier 3) is wanted, it goes to `brain-drafts/` for a human.

## Success criteria

- [ ] Re-running `measure-701b.mjs` after a `memory:share` in a stale worktree reports
      `re-export: 0`.
- [ ] `git merge origin/main` in a freshly-shared worktree does not exit 2.
- [ ] The duplicate/divergence report still names any divergent pair.
- [ ] A genuinely new record (the `issue=545` case) is still written.

## Rollback

Both changes are additive filters over existing code paths. Revert the commit; the exporter
returns to writing unconditionally and the gate stops refusing. No stored data is migrated,
rewritten, or deleted by this change, so rollback has nothing to undo on disk.
