---
status: spec
issue: 330
epic: 313
artifact_store: openspec
topic_key: sdd/issue-330-memory-index-merge-strategy/spec
---

# Spec — one-command resolution for a conflicted `.memory/index.jsonl` (issue 330)

Delta requirements introduced by issue #330. Extends the ADR-0017 record-format contract
(`brain/core/methodology/memory-format.md`), which already **fixes** the resolution for an
`index.jsonl` conflict (discard both sides, reindex) and already **sanctions** a helper or a
post-merge hook for its ergonomics — but names neither.

> **Rewritten after the first delivery was blocked.** The superseded REQ-330-1 required
> `/.memory/index.jsonl merge=union`; that requirement reversed `memory-format.md:145-153` and
> ADR-0017:121-129. REQ-330-1 below is its **inverse**, and is what the shipped tripwire asserts.

---

## REQ-330-1 — the index declares NO merge strategy

`.gitattributes` MUST NOT assign any merge strategy to `/.memory/index.jsonl`. The index falls
through to git's default text merge, so a parallel-write collision surfaces as an ordinary,
visible conflict — which REQ-330-2 then resolves in one command.

Doctrine forbids the alternatives by name: the index is *"NEVER hand-merged and NEVER
union-merged"* (`memory-format.md:145-153`), and the ergonomics *"MUST NOT require a custom merge
driver for `index.jsonl`"* (`memory-format.md:140-144`, ADR-0017:143-147). Union is excluded not
because it is dangerous but because of **shape**: a reindex replaces and reorders every line, so a
line-based union of two independently regenerated indexes concatenates both sides' superseded
snapshots rather than merging them.

### Scenario 1 — repo tripwire: the shipped `.gitattributes` carries no index rule

```
GIVEN this repository's own committed .gitattributes
WHEN its non-comment lines are filtered for a rule matching /.memory/index.jsonl
THEN the matching set is empty
```

Asserting **absence** is what makes this tripwire load-bearing: a check that merely required "some
`merge=` attribute" would be satisfied by the forbidden value. This scenario is the guard against
re-introducing the union line a future change might reach for.

---

## REQ-330-2 — `memory:resolve-index` performs the doctrine-fixed resolution

A backend-agnostic verb `resolve-index` MUST exist on `brain/scripts/memory/cli.mjs`, exposed as
`npm run memory:resolve-index`, and MUST require no per-clone installation of any kind. Invoked in
a repository whose `.memory/index.jsonl` is unmerged, it MUST:

1. **discard** whatever the merge left in the working-tree file — the resolution is a
   regeneration, never a repair of the conflicted text;
2. **regenerate** the index from `.memory/records/` via the existing deterministic
   `rebuildIndex()`;
3. **stage** the path, so the merge is committable with no further operator action;
4. report the record count and the fact that it staged.

### Scenario 2 — a conflicted index is regenerated and the merge becomes committable

```
GIVEN two branches that each appended a distinct record and rebuilt the index
  AND a merge between them that git left with .memory/index.jsonl unmerged
  AND records/*.jsonl merged cleanly under its own union attribute
WHEN resolveIndex() runs
THEN .memory/index.jsonl contains no conflict markers
  AND it is byte-identical to a fresh rebuildIndex() over the merged record set
  AND both branches' record ids are present
  AND the entries are sorted by id
  AND git reports no unmerged paths
  AND the result reports staged: true
  AND `git commit --no-edit` completes the merge
```

---

## REQ-330-3 — the resolution fails CLOSED on a conflicted record log

The index is derived **from** `records/`. If any `records/*.jsonl` file carries conflict markers,
`resolve-index` MUST refuse: it MUST throw an error naming `records/`, MUST NOT write the index,
and MUST exit non-zero from the CLI. Regenerating over a conflicted log would bake the markers
into the index and report success — a silent corruption dressed as a resolution.

### Scenario 3 — refusal leaves the index untouched

```
GIVEN a repository with a conflicted .memory/index.jsonl
  AND a .memory/records/<yyyy-mm>.jsonl file carrying conflict markers
WHEN resolveIndex() runs
THEN it throws an error whose message names records/
  AND .memory/index.jsonl is byte-identical to its pre-call content
```

---

## REQ-330-4 — the `post-merge` hook is a thin caller, never a second implementation

`brain/scripts/hooks/post-merge` MUST invoke the same `resolve-index` verb after its existing
`import` call, and MUST contain no resolution logic of its own. The call MUST be non-blocking
(`|| true`): index hygiene is informational and MUST NEVER abort a merge or pull.

The hook is ergonomics **on top of** the command, not a substitute for it. An operator whose hooks
are not installed is never stranded, and there is no logic duplicated across the two paths.

Note the boundary honestly: git does **not** fire `post-merge` when a merge fails, so the hook can
never rescue a conflict. Its job is to keep the index canonical after a merge git resolved on its
own. The conflict case is always the operator (or a future caller) running the command.

### Scenario 4 — a hook-triggered call on a clean tree stages nothing

```
GIVEN a repository with no unmerged paths
WHEN resolveIndex() runs
THEN it normalizes the index
  AND it reports staged: false
  AND `git diff --cached --name-only` is empty
```

Staging behind the operator's back on every pull would be a worse defect than the conflict this
change exists to make cheap.

---

## REQ-330-5 — the format contract names the helper it already sanctions

`brain/core/methodology/memory-format.md` MUST name `memory:resolve-index` as the concrete
realization of its own *"MAY be a helper or a post-merge hook"* clause, so the operator who hits an
index conflict finds the remedy where the exclusion is stated. The text MUST NOT weaken the
existing exclusions: no union, no hand-merge, no custom merge driver for this path.

`memory-format.md` lives in `brain/core/**` → English (ADR-0009) and is a **Tier 2 write**: the
agent drafts into `brain-drafts/`, the human promotes.

### Scenario 5 — the doc points at the command

```
GIVEN brain/core/methodology/memory-format.md
WHEN the index.jsonl merge-policy passage is read
THEN it names `npm run memory:resolve-index` as the resolution path
  AND it still states that the index is never union-merged and never hand-merged
```

---

## Non-requirements (explicitly out of this delta)

- Changing when `share()` rebuilds the index on the `engram` backend — **filed as #361**.
- Removing `index.jsonl` from version control.
- Any change to `records/*.jsonl` or `manifest.json` merge behaviour.
- Installing or enforcing the `post-merge` hook. Hook installation is `core.hooksPath`'s existing
  concern; REQ-330-2's zero-installation guarantee is what makes that irrelevant to correctness.
