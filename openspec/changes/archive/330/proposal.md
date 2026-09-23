---
status: proposed
issue: 330
epic: 313
artifact_store: openspec
topic_key: sdd/issue-330-memory-index-merge-strategy/proposal
---

# Proposal: a one-command resolution for a conflicted `.memory/index.jsonl` (issue 330)

Issue #330. Epic #313. Change folder: `openspec/changes/issue-330-memory-index-merge-strategy/`.

> **This proposal was rewritten after the first delivery was blocked.** The original framing —
> "assign `merge=union` to `/.memory/index.jsonl`" — shipped as commit `ff4ee8a` / PR #360 and was
> found to **reverse two normative documents**. The rewrite keeps the real problem (#330's
> ergonomics complaint) and replaces the mechanism. See *What the first attempt got wrong*, below.

## Intent

`.gitattributes` assigns a merge strategy to every committed file under `.memory/` **except**
`index.jsonl`:

- `/.memory/manifest.json` → `merge=engram-manifest` (custom driver, registered by `brain:env:init`)
- `/.memory/records/*.jsonl` → `merge=union` (git built-in, no per-clone registration)
- `/.memory/index.jsonl` → **nothing, deliberately** (`memory-format.md:145-153`)

The absence is not the bug. Doctrine excludes the index from the union driver on purpose and fixes
the resolution: *"a git merge conflict on `index.jsonl` is resolved by **discarding both sides and
running `memory:reindex`** — it is NEVER hand-merged and NEVER union-merged"*
(`brain/core/methodology/memory-format.md:145-153`, ADR-0017:121-129).

What is genuinely missing is the **ergonomics** that same doctrine explicitly sanctions: *"The
conflict ergonomics MAY be a helper or a post-merge hook, but MUST NOT require a custom merge
driver for `index.jsonl`"* (`memory-format.md:140-144`, ADR-0017:143-147). Today the operator has
to know that `git checkout --theirs` is wrong, that hand-merging is wrong, that the remedy is
`memory:reindex`, and that the path still has to be `git add`-ed to finish the merge. Four pieces
of tribal knowledge for a machine-generated file. That is the gap #330 was actually filed about.

## Scope

In scope — the two layers the owner ruled (both, layered, not one or the other):

1. **`memory:resolve-index`, the unit of truth.** An invokable verb on `memory/cli.mjs` that
   performs the doctrine-fixed resolution with no operator judgment: discard whatever the merge
   left in the working tree, regenerate `index.jsonl` from `records/`, and `git add` it **only if**
   git still considers the path unmerged. It works in every clone with zero installation.
2. **The `post-merge` hook as a thin caller.** The existing hook gains one non-blocking
   `resolve-index` call after its `import` call. No logic is duplicated between the two paths — the
   hook has none.
3. **A repo tripwire asserting the index has NO declared strategy**, so a future change cannot
   silently re-introduce the union line this change removes.
4. **`brain/core/methodology/memory-format.md`** — name the helper that fulfils the already-
   sanctioned "MAY be a helper or a post-merge hook". Tier 2: drafted here, promoted by the human.

Out of scope — recorded, not silently dropped:

- **Changing `share()` to reindex unconditionally.** The issue's "consider also". `plainfiles`
  already does; `engram`'s `share()` reindexes only when it appended a record
  (`engram.mjs:315-318`) and its `pull()` never reindexes (`engram.mjs:589-619`). **Filed as #361**
  with that asymmetry as its evidence.
- **Un-committing the index** (gitignore it, since nothing reads it). Contradicts
  `memory-format.md:26`'s deliberate "committed for zero-tool querying" — an ADR-0017-level
  decision, not a bug fix.
- **A custom merge driver.** Forbidden by name for this path (`memory-format.md:140-144`).

## What the first attempt got wrong

The union line passed all eight governance jobs, a negative control, and a repo tripwire — and was
still wrong, because **no gate reads doctrine**. A cold external review caught it. Recorded here
rather than quietly rewritten, because the failure mode is the reusable lesson:

1. **The mechanism reversed doctrine.** `merge=union` on `index.jsonl` is excluded by name in
   `memory-format.md:145-153` and ADR-0017:121-129. The original design argued union was safe from
   three verified code properties (nothing reads the index, line integrity holds, reindex repairs
   it) — all three true, and all three irrelevant: the exclusion is not justified by *danger*, it is
   justified by **shape**. A reindex REPLACES and REORDERS every line, so a line-based union of two
   independently regenerated indexes concatenates both sides' now-superseded snapshots. Union does
   not merge two rewrites; it stacks them.
2. **The tests were green and inert against the real question.** The tripwire asserted the union
   line was *present*. It could not detect that its presence was itself the defect. A test pinned to
   a mechanism cannot question the mechanism.
3. **The premise was never measured.** #330 asserts the conflict is intolerable. Measured on the
   real index shape at brain's actual store size (n=1575): **0–4.5%** for a typical share, and the
   rate is a function of store size — frequent only for young stores. So the resolution path needs
   to be **cheap and correct**, not automatic and permanent. That measurement is what makes a
   two-layer helper the right size of answer and an always-on merge attribute the wrong one.

## Why now

Every open parallel branch still hits the conflict, and this repo currently has 25+ live worktrees.
The exposure is real; it is just smaller and more repairable than #330 assumed. Epic #313 promotes
#330 to be done next.

## Risk

Low. One new backend-agnostic verb over the existing deterministic `rebuildIndex()`, one
non-blocking hook line, one removed `.gitattributes` declaration, and a documentation draft. The
verb fails **closed**: it refuses to regenerate from a `records/` log that is itself conflicted,
rather than baking conflict markers into the index and reporting success.
