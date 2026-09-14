# Memory Backend Contract Amendment 3 — rule 3 flip for engram (issue #955)

> **Tier 2 draft. Not yet promoted.** `memory-backend-contract.md` is a promoted Tier-2 file
> (`brain/core/methodology/`), so this is an in-place amendment. The maintainer promotes it
> AFTER slice A's PR merges (the conformance flip depends only on A: manifest, driver,
> symlink). Never before, and never by an agent:
>
> ```
> npm run brain:promote -- openspec/changes/artifact-retirement/brain-drafts/memory-backend-contract.rule3.draft.md
> ```
>
> Edit 6 describes slice B's deletion of `dualWriteRecords()`. If B has not merged when this
> draft is promoted, drop edit 6 and the matching "What landed" bullet, and promote them
> with B instead.

```brain-amendment/1
target: brain/core/methodology/memory-backend-contract.md
issue: 955
body: ## Amendment 3 — rule 3 flip: engram owns no load-bearing artifact (issue #955)
body-end: ### Notes for the promoter
```

```amend-find
(engram's manifest, chunks, symlink and driver: ADR-0002
   Amendment 1; retirement #864 task 2.4.)
```

```amend-replace
(engram's symlink: created by its `setup`, ADR-0002
   Amendment 1; its manifest and merge driver were retired, and its chunk directory has no writer, #955.)
```

```amend-find
| `setup` | `({ root }) -> void` | Prepares whatever the backend privately needs (engram: the `.engram → .memory` symlink, the merge driver — both retiring). Idempotent, non-clobbering. Never throws on an already-set-up tree. | **yes** |
```

```amend-replace
| `setup` | `({ root }) -> void` | Prepares whatever the backend privately needs (engram: the `.engram → .memory` symlink; the merge driver was retired by #955). Idempotent, non-clobbering. Never throws on an already-set-up tree. | **yes** |
```

```amend-find
| `engram` | delta under guard (#820) — three pre-guard rows await the one-time heal (#864 task 1.2a) | yes — `share()` no longer exports; closed by #864 task 3.2 (#874, split B) | **not yet** — manifest, chunks, symlink, driver; closes with #864 tasks 2.3/2.4 | yes |
```

```amend-replace
| `engram` | delta under guard (#820) — three pre-guard rows await the one-time heal (#864 task 1.2a) | yes — `share()` no longer exports; closed by #864 task 3.2 (#874, split B) | yes — no manifest, no driver; the symlink is `setup()`-only and no reader of records needs it; closed by #864 task 2.4 (#955) | yes |
```

```amend-find
their retirement is epic task 2.4, not this
change.
```

```amend-replace
their retirement is epic task 2.4, not this
change (superseded by Amendment 3, #955: rule 3 is now `yes` for `engram`).
```

```amend-find
`_ensureSymlink(root)` → `rebuildIndex()` →
  `{indexCount, duplicates}`.
```

```amend-replace
`_ensureSymlink(root)` → `rebuildIndex()` →
  `{indexCount, duplicates}` (Amendment 3, #955, dropped the `_ensureSymlink` step: the symlink
  is `setup()`-only).
```

```amend-find
unless task 1.2a claims it first as its one-shot heal tool.
```

```amend-replace
unless task 1.2a claims it first as its one-shot heal tool
  (it did not: Amendment 3, #955, deleted it — 1.2a deletes engram rows, a different operation).
```

## Amendment 3 — rule 3 flip: engram owns no load-bearing artifact (issue #955)

**Signed**: DD/MM/YYYY — <Name>

### What this does NOT change

Rules 1 and 2 and the `save` column are untouched. The chunk directory stays gitignored, and
forward `migrate-v1` still reads a consumer's own `.memory/chunks/` once, to produce records.
That is a one-shot migration input, not something a reader of records depends on.

### What landed (#955)

- Slice A: `.memory/manifest.json` is untracked and gitignored. Its restores are gone from
  `session:start`, `day:start` and `pullMemory`, and `lib/memory-manifest.mjs` is deleted. The
  `merge=engram-manifest` attribute, `merge-engram-manifest.mjs` and `setup()`'s driver
  registration are deleted. `share()` no longer ensures the `.engram` symlink; only `setup()`
  does. A cross-backend test proves `session:start`, `memory:share`, `memory:pull` and
  `cli.mjs import` complete on a fixture holding records alone.
- Slice B: `dualWriteRecords()` and its seams, `rollbackMigration()` with
  `migrate-v1 --rollback`, `scrubChunkFile()` and the tracked `.memory/legacy/` archive are
  deleted.

### Notes for the promoter

Six in-place edits. Each `amend-find` was verified against `origin/main` 32b70db9 to occur
exactly once in the target, and none occurs inside its own replacement (`k === 0`, so
`assessEdit` reads `free === 1` → pending). Edits 4-6 annotate Amendment 2's signed body per
§1c act 2 ("a reader who never scrolls to the amendment must not be left with the superseded
rule"). Edit 5 (`_ensureSymlink`) goes one passage beyond R10's line list for the same reason.
No other draft in flight anchors this target: the #738, #805 and #874 drafts are archived and
already promoted.
