---
status: spec
issue: 330
epic: 313
artifact_store: openspec
topic_key: sdd/issue-330-memory-index-merge-strategy/spec
---

# Spec — `.memory/index.jsonl` merge strategy (issue 330)

Delta requirements introduced by issue #330. Extends the ADR-0017 record-format contract
(`brain/core/methodology/memory-format.md`), which already specifies the merge policy for
`records/*.jsonl` but is silent on the derived index.

---

## REQ-330-1 — the index declares a merge strategy

`.gitattributes` MUST assign a merge strategy to `/.memory/index.jsonl`. The strategy is git's
**built-in `union`** driver, so no per-clone `git config` registration is required (unlike
`merge=engram-manifest`, which `brain:env:init` must install).

Every committed path under `.memory/` MUST carry a merge strategy — no committed memory file may
fall through to git's default text merge.

### Scenario 1 — two branches that both shared memory merge cleanly

```
GIVEN a repository whose .gitattributes declares `/.memory/index.jsonl merge=union`
  AND a base commit containing .memory/records/ and a rebuilt .memory/index.jsonl
  AND branch X appends record A and rebuilds the index
  AND branch Y, from the same base, appends a distinct record B and rebuilds the index
WHEN branch X is merged into branch Y
THEN git merge exits 0
  AND .memory/index.jsonl contains no conflict markers (`<<<<<<<`, `=======`, `>>>>>>>`)
  AND every physical line of .memory/index.jsonl parses as a complete JSON object
  AND the index entries for record A and record B are both present
```

### Scenario 2 — negative control: without the attribute, the same merge conflicts

```
GIVEN the identical two-branch scenario
  BUT .gitattributes declares NO strategy for /.memory/index.jsonl
WHEN branch X is merged into branch Y
THEN git merge exits non-zero
  AND .memory/index.jsonl contains conflict markers
```

This scenario is what proves REQ-330-1's line is the cause of Scenario 1's clean merge, rather
than an incidental property of the fixture.

### Scenario 3 — repo tripwire: the shipped `.gitattributes` really carries the rule

```
GIVEN this repository's own committed .gitattributes
WHEN it is read
THEN it contains a merge strategy declaration for /.memory/index.jsonl
```

Scenarios 1 and 2 construct their own fixture `.gitattributes`, so they would stay green even if
the repo's real file lost the line. Scenario 3 is the guard against exactly that
"green in test, inert in production" defect class (epic #335, M10).

---

## REQ-330-2 — a merged index is repairable to its canonical form

Because `index.jsonl` is a deterministic full rewrite sorted by `id`
(`format.mjs#serializeIndex`), not an append-only log, a union merge MAY leave it unsorted or
carrying duplicate physical lines. That state MUST be transient and repairable with no operator
judgment: `memory:reindex` (`rebuildIndex()`) MUST restore the canonical file.

### Scenario 4 — reindex restores the canonical index after a union merge

```
GIVEN the merged working tree from Scenario 1
WHEN rebuildIndex() runs over .memory/records/
THEN .memory/index.jsonl is byte-identical to serializeIndex() over the merged record set
  AND it contains exactly one entry per distinct record id
  AND the entries are sorted by id
```

---

## REQ-330-3 — the format contract documents the index's merge policy

`brain/core/methodology/memory-format.md` MUST state the index's merge strategy alongside the
records', so the next reader does not rediscover the gap from a conflict. The text MUST NOT
describe the index as append-only: it MUST state that the index is a full rewrite, that union may
therefore leave it unsorted or duplicated, and that `memory:reindex` is the remedy.

### Scenario 5 — the doc names the strategy

```
GIVEN brain/core/methodology/memory-format.md
WHEN the concurrent-append merge policy section is read
THEN it names the merge strategy applied to index.jsonl
  AND it states the union-on-a-rewritten-file consequence and the reindex remedy
```

---

## Non-requirements (explicitly out of this delta)

- Changing when `share()` rebuilds the index on the `engram` backend (see proposal, Out of scope).
- Removing `index.jsonl` from version control.
- Any change to `records/*.jsonl` or `manifest.json` merge behaviour.
