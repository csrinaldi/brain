---
status: spec
issue: 397
epic: 313
artifact_store: openspec
topic_key: sdd/issue-397-clobber-asymmetry/spec
---

# Spec — Per-path upgrade strategy (#397)

> **Provisional.** Every REQ below depends on the classification in
> `brain-drafts/managed-path-strategy.md`, which is unsigned. If the signer changes a
> row, the matching REQ changes with it.

## REQ-397-1 — a consumer's modification is distinguished from brain's change

Modification detection MUST be three-way: destination against the OUTGOING package
(did the consumer edit it) and outgoing against incoming (did brain change it). A
single dest-vs-incoming comparison MUST NOT be treated as evidence of consumer intent.

### Scenario 1 — brain changed it, the consumer did not

```
GIVEN dest is byte-identical to the outgoing package's copy
  AND the incoming package's copy differs
WHEN the upgrade runs
THEN the path is written without prompting
```

### Scenario 2 — the consumer changed it

```
GIVEN dest differs from the outgoing package's copy
WHEN the upgrade runs over a REFUSE-classified path
THEN it refuses, naming the path and showing what differs
  AND nothing is written
```

### Scenario 3 — degraded mode is stated, not discovered

```
GIVEN --no-install, so outgoing and incoming are the same tree
WHEN the upgrade runs
THEN modification detection cannot distinguish the two cases
  AND the run says so rather than implying it checked
```

## REQ-397-2 — a REFUSE-classified path is never silently overwritten

A modified REFUSE path MUST abort the run, name every such path, and require
`--force-managed <path>` per path to proceed. A forced path is OVERWRITTEN; a refused
path is LEFT ALONE. Neither may silently become the other — that swap is what #399's
`--skip-merge` had to be corrected for.

## REQ-397-3 — `.gemini/settings.json` is merged, not copied

It MUST use the same deterministic merge as `.claude/settings.json`: consumer keys
survive, brain's block is applied underneath.

## REQ-397-4 — `AGENTS.md` is regenerated, never copied

`AGENTS.md` MUST NOT be a plain-copy target. After a successful upgrade it MUST be
regenerated from the consumer's own `brain/HOME.md` plus the managed methodology docs,
and the run MUST say it did.

### Scenario 1 — the consumer's HOME drives their AGENTS

```
GIVEN a consumer whose brain/HOME.md differs from brain's
WHEN the upgrade completes
THEN AGENTS.md reflects THEIR HOME.md, not brain's
```

## REQ-397-5 — the classification lives in one place

The per-path strategy MUST be data in `brain/core/managed-paths.mjs`, not a literal
spread across the CLI. A strategy readable in one place is auditable; one inferred from
three call sites is not.
