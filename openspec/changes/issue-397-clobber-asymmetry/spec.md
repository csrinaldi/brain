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

## REQ-397-6 — a consumer already clobbered by an earlier upgrade is told

Signed decision 2. Repos that took brain's `AGENTS.md` or `CODEOWNERS` before this landed
are carrying a silent loss today. The first run after this ships MUST detect that state and
report it. Protecting only from here on would leave the existing damage permanently
invisible — and those repos are exactly the adopters this milestone exists for.

Detection is the same three-way read as REQ-397-1, applied to history rather than to the
pending write: a managed path whose destination is byte-identical to a copy brain shipped,
where the consumer's own history shows they once had something else, was clobbered.

### Scenario 1 — a clobbered path is named, once

```
GIVEN a consumer whose AGENTS.md is byte-identical to brain's shipped copy
  AND whose git history shows a different AGENTS.md before an earlier upgrade
WHEN the upgrade runs
THEN it reports that this path was overwritten by a previous upgrade
  AND names how to recover it from their own history
```

### Scenario 2 — negative control: a consumer who never edited it is not nagged

```
GIVEN a consumer whose AGENTS.md has only ever been brain's
WHEN the upgrade runs
THEN nothing is reported for that path
```

A detector that fired for every consumer would be noise, and noise is how a real warning
gets ignored.

> **Implementer's note.** The detection mechanism is deliberately NOT specified here. Reading
> the consumer's git history is one option; a shipped manifest of past hashes is another.
> Scenario 2 is the constraint that matters — whatever mechanism is chosen must not fire for
> a consumer who never had anything of their own to lose.
