# Memory Backend Contract Amendment 2 — rule 2 flip (issue #874, split B)

> **Tier 2 draft. Not yet promoted.** `memory-backend-contract.md` is a promoted
> Tier-2 file (`brain/core/methodology/`), so this is an in-place amendment, not
> a new file. The maintainer promotes it AFTER split B's PR merges — never
> before, and never by this agent (agents never edit `brain/core/**`):
>
> ```
> npm run brain:promote -- openspec/changes/issue-874-record-first/brain-drafts/memory-backend-contract.rule2.draft.md
> ```
>
> This amendment does NOT change the contract's rules. It records that
> `engram.share()` now SATISFIES rule 2 ("the backend is never the first home
> of a capture") — `share()` no longer runs `engram sync --export`, reads no
> chunk, and dual-writes nothing; it only reconciles the index against records
> already on disk. Rule 3 (the backend owns no artifact the durable layer
> needs) stays `not yet` for `engram` — the manifest, chunks, symlink and merge
> driver are untouched by this change and close with epic task 2.4.
> **This draft touches ONLY the `share` verb row and the conformance table's
> `engram` × rule 2 cell — never rule 1, rule 3, or the `save` column
> (Amendment 1 owns that one).**

```brain-amendment/2
target: brain/core/methodology/memory-backend-contract.md
issue: 874
body: ## Amendment 2 — rule 2 flip: engram.share() no longer produces (issue #874, split B)
body-end: ### Notes for the promoter
```

> `memory-backend-contract.md` is a "doctrine document" target (no `**Status**:`
> line, not under `brain/project/decisions/`), so `amendment:`/`home-summary:`
> are omitted per `amendment-draft.mjs`'s own rule — those two keys apply to
> ADR targets only. `body:`/`body-end:` here name this draft's commit-subject
> heading; the two `amend-find`/`amend-replace` pairs below are what actually
> lands in the target.

```amend-find
| `share` | `({ root }) -> { indexCount, duplicates, ... }` | Materializes what the durable layer does not yet hold and rebuilds `index.jsonl`; returns the accounting (#574) so the caller can say it. Under record-first (#864 task 3.2) this is "commit what is already true": it exports nothing from the backend. | **yes** |
```

```amend-replace
| `share` | `({ root }) -> { indexCount, duplicates, ... }` | Materializes what the durable layer does not yet hold and rebuilds `index.jsonl`; returns the accounting (#574) so the caller can say it. Under record-first (#864 task 3.2, `engram` since #874) this commits what is already true: it exports nothing from the backend. | **yes** |
```

```amend-find
| `engram` | delta under guard (#820) — three pre-guard rows await the one-time heal (#864 task 1.2a) | **not yet** — `mem_save` is the first home today; closes with #864 task 3.2 | **not yet** — manifest, chunks, symlink, driver; closes with #864 tasks 2.3/2.4 | yes |
```

```amend-replace
| `engram` | delta under guard (#820) — three pre-guard rows await the one-time heal (#864 task 1.2a) | yes — `share()` no longer exports; closed by #864 task 3.2 (#874, split B) | **not yet** — manifest, chunks, symlink, driver; closes with #864 tasks 2.3/2.4 | yes |
```

## Amendment 2 — rule 2 flip: engram.share() no longer produces (issue #874, split B)

**Signed**: DD/MM/YYYY — <Name>

### What this does NOT change

Rule 1 (hydration idempotent by record id) and rule 3 (no backend artifact is
load-bearing for the durable layer) are untouched by this amendment. Rule 3
stays `not yet` for `engram`: the `.engram → .memory` symlink, the manifest,
the chunk directory and the merge driver are all still present and still
matter to `setup()`/`pull()` — their retirement is epic task 2.4, not this
change. The `save` column (Amendment 1) is untouched here too.

### What landed (split B)

- `engram.share()` (`brain/scripts/memory/backends/engram.mjs`) is now the
  `plainfiles.share()` mirror: `_ensureSymlink(root)` → `rebuildIndex()` →
  `{indexCount, duplicates}`. It no longer calls `requireEngram()`, runs
  `engram sync --export`, reads observations from chunks, scans chunks for
  secrets, or dual-writes candidate records — every one of those surfaces
  (ledger rows 1, 2 and 4) is deleted.
- `dualWriteRecords()` — the function rule 2 used to route observations
  through — is UNCHANGED in shape and still exported (ratified O1,
  2026-09-11): `share()` simply no longer calls it. Its disposition (keep,
  reshape, or delete) is handed to epic task 2.4, alongside the rest of the
  chunk estate, unless task 1.2a claims it first as its one-shot heal tool.
- `engram.share.test.mjs` (ledger row 5) is replaced with a ~90-line suite
  modelled on `plainfiles.share.test.mjs`, including a source guard asserting
  `share()`'s own body names none of the retired seams
  (`requireEngram`/`_export`/`_readObservations`/`dualWriteRecords`).
- Completes with the `engram` binary ABSENT (rule 3's own "may be absent"
  clause, now also true of rule 2's producer path): there is nothing left in
  `share()` that touches the binary at all.

### Notes for the promoter

**Two in-place edits**, both inside the `## Required verbs` and
`## Conformance` sections: the `share` row's note (future tense → present),
and the conformance table's `engram` × rule 2 cell. The `save` column stays
exactly as Amendment 1 left it — this draft's second `amend-find` block
matches the row Amendment 1 already promoted, so promote Amendment 1 FIRST if
both are still pending; promoting this draft alone against the un-promoted
original (`save` cell still `unsupportedOp today; closes with 3.2`) will not
find a match.
