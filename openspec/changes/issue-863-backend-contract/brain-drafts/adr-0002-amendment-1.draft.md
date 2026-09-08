# ADR-0002 Amendment 1 — draft (issue #863)

> **Tier 3 draft. Not yet promoted.** ADR-0002 is signed, so this is an in-place
> amendment, not a new ADR file.
>
> ```
> npm run brain:promote -- openspec/changes/issue-863-backend-contract/brain-drafts/adr-0002-amendment-1.draft.md
> ```
>
> Promote it in the same sitting as `adr-0004-amendment-1.draft.md` and the new
> `memory-backend-contract.md` from this folder: this amendment withdraws the
> manifest note, ADR-0004's withdraws "no formal interface", and the contract is
> what both now point at.

```brain-amendment/1
target: brain/project/decisions/adr-0002-memoria-git-based-dos-capas.md
amendment: 1
issue: 863
home-summary: the manifest note is withdrawn — records are the truth (ADR-0017), the manifest was the chunk transport's index and that transport is retired; manifest, symlink and merge driver are the engram adapter's private artifacts, governed by memory-backend-contract.md rule 3, #863
body: ## Amendment 1 — the manifest was the transport's index, and the transport is gone (issue #863)
body-end: ### Notes for the promoter
```

## Act 1 — the durable layer is records, not chunks plus a manifest

The Decision's first bullet still describes the durable layer as chunks and a manifest.
ADR-0017 (2026-07) made the durable format brain's own, and Amendment 2 to it (#677) made
it one record per file. The bullet is corrected to what a `git clone` actually recovers.

```amend-find
1. **`.memory/` (durable)**: directory versioned in git. Contains content-addressed chunks (`.memory/chunks/`) and a manifest (`.memory/manifest.json`). This is the recoverable source of truth. The merge driver (`scripts/merge-engram-manifest.mjs`) resolves conflicts in the manifest.
```

```amend-replace
1. **`.memory/` (durable)**: directory versioned in git. Contains the record log
   `.memory/records/<yyyy-mm>-<id>.jsonl` — one content-addressed record per file — and the
   derived, regenerable `index.jsonl` (ADR-0017; Amendment 1 to this ADR, #863). This is the
   recoverable source of truth. The chunk directory and the manifest that Amendment 1
   withdraws were the engram transport's private artifacts, never the durable layer's.
```

## Act 2 — the note that made the manifest mandatory is superseded, with its evidence kept

The note's spike was true: a chunk-based `engram sync --import` needs the manifest. The
premise it rested on — that the chunks are how memory reaches a fresh machine — stopped
being true when hydration became records-only (C4, #229; batched `engram import`, #433).
The note stays as history and is marked superseded rather than deleted, so the next reader
sees why the manifest ever mattered.

```amend-find
## Note — the manifest MUST stay committed (do not gitignore it)
```

```amend-replace
## Note — the manifest MUST stay committed (do not gitignore it) — SUPERSEDED by Amendment 1 (#863)

> **Superseded.** This note was written for the chunk transport, and the measurement below
> is still accurate for it. Hydration is records-only since C4 (#229, #433): a fresh machine
> reads `.memory/records/` and never a chunk, so the manifest is no longer load-bearing for
> anyone but the engram adapter's own export. It is untracked, its merge driver removed and
> the `.engram` symlink confined to the adapter by #864 task 2.4, under
> `memory-backend-contract.md` rule 3. Kept for the record; do not act on it.
```

## Act 3 — the Consequences say what is now true

```amend-find
- **Negative**: the manifest is a conflict point in concurrent merges — the merge driver is mandatory.
- **Negative**: the symlink `.engram → .memory` is a workaround for the engram CLI's limitation; if engram implements `--dir`, the symlink can be removed.
```

```amend-replace
- **Negative (withdrawn by Amendment 1, #863)**: the manifest is a conflict point in concurrent merges — the merge driver is mandatory. *Withdrawn: the manifest is the adapter's private artifact and leaves the tree (#864 task 2.4).*
- **Negative (narrowed by Amendment 1, #863)**: the symlink `.engram → .memory` is a workaround for the engram CLI's limitation. *It is created and owned by the adapter's `setup` alone (`memory-backend-contract.md` rule 3); no reader of `.memory/records/` depends on it.*
```

## Amendment 1 — the manifest was the transport's index, and the transport is gone (issue #863)

**Signed**: DD/MM/YYYY — <Name>

### What this changes

The Decision's durable layer was described as chunks plus a manifest, and the Note below
made the manifest mandatory on the strength of a measured spike. The spike was right for the
chunk transport. Since C4 (#229) hydration is records-only and batched (#433): a fresh machine
reads `.memory/records/` and never a chunk. The manifest is therefore the engram adapter's
private index of its own export, not a property of the layer — and `plainfiles` (#246) uses
the durable layer with no manifest, no chunks, no symlink and no driver, which is the
existence proof. The durable-layer bullet is corrected to records (ADR-0017), the Note is
marked superseded with its evidence kept, and the two Consequences are withdrawn or narrowed.

### What this does NOT change

The two-layer decision stands: durable in git, live in a backend, the live layer a derived
index. The canonical flow's verbs keep their names until #862 settles the lane. Retiring the
manifest, the driver and the symlink from the tree is #864 task 2.4, under the rule that
governs it — `brain/core/methodology/memory-backend-contract.md` rule 3 (ruling #863).

### Notes for the promoter

All three `amend-find` anchors were verified to occur exactly once in the target before this
draft was written. The measured spike in the note is preserved on purpose: the amendment
withdraws the conclusion, not the evidence.
