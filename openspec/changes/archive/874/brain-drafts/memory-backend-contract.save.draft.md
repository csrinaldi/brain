# Memory Backend Contract Amendment 1 — `save` column flip (issue #874, split A)

> **Tier 2 draft. Not yet promoted.** `memory-backend-contract.md` is a promoted
> Tier-2 file (`brain/core/methodology/`), so this is an in-place amendment, not
> a new file. The maintainer promotes it AFTER split A's PR merges — never
> before, and never by this agent (agents never edit `brain/core/**`):
>
> ```
> npm run brain:promote -- openspec/changes/archive/874/brain-drafts/memory-backend-contract.save.draft.md
> ```
>
> This amendment does NOT change the contract's rules. It records that
> `engram.save()` now SATISFIES the `save` verb's requirement (rule row) that
> was previously `unsupportedOp`, and that the single-record `hydrate({recordId})`
> form now exists on `engram` too. Rule 2 (durable-before-backend) stays
> `not yet` for `engram` — `share()` still exports until split B (#874, closes
> the epic ticket) reshapes it. **This draft touches ONLY the `save` column and
> the `save`/`hydrate` verb-row notes — never rule 2 or rule 3.**

```brain-amendment/1
target: brain/core/methodology/memory-backend-contract.md
issue: 874
body: ## Amendment 1 — `save` column flip: engram.save() is a record-first producer (issue #874, split A)
body-end: ### Notes for the promoter
```

> `memory-backend-contract.md` is a "doctrine document" target (no `**Status**:`
> line, not under `brain/project/decisions/`), so `amendment:`/`home-summary:`
> are omitted per `amendment-draft.mjs`'s own rule — those two keys apply to
> ADR targets only. `body:`/`body-end:` here name this draft's commit-subject
> heading; the four `amend-find`/`amend-replace` pairs below are what actually
> lands in the target.

```amend-find
| `hydrate` | `({ root, recordId? }) -> { written, skipped, deferred?, contended? }` | Projects `.memory/records/` into the backend, idempotently (rule 1). With `recordId`, projects that one record — a producer's fast path after its own write. `deferred: true` when hydration could not run (store unreadable, guard contended) with the reason on stderr — never a throw, never a zero that reads as "nothing to do". Today spelled `pull` (with `git pull`) and `cli.mjs import` (without); the contract names the operation, the verbs keep their names until #862 settles the lane. | **yes** |
```

```amend-replace
| `hydrate` | `({ root, recordId? }) -> { written, skipped, deferred?, contended? }` | Projects `.memory/records/` into the backend, idempotently (rule 1). With `recordId`, projects that one record — a producer's fast path after its own write. `deferred: true` when hydration could not run (store unreadable, guard contended) with the reason on stderr — never a throw, never a zero that reads as "nothing to do". The single-record form, `hydrate({recordId})`, exists on `engram` as of #874 (3.2); the bulk form is still spelled `pull` (with `git pull`) and `cli.mjs import` (without) — the contract names the operation, those verbs keep their names until #862 settles the lane. | **yes** |
```

```amend-find
| `save` | `(title, content, { type, project, issue?, supersedes? }) -> { id, file, written }` | The producer path: a record on disk, then `hydrate({recordId})`. **Required on every backend** — a backend without `save` has no record-first capture (D2). **Today**: `memory:save` is pinned to `plainfiles` (`package.json`), engram's `save` is `unsupportedOp`, no `hydrate({recordId})` exists and `supersedes` is not forwarded by the CLI — #874 (3.2) and #805 close those; until then the record is picked up by the next hydration. | **yes** |
```

```amend-replace
| `save` | `(title, content, { type, project, issue?, supersedes? }) -> { id, file, written }` | The producer path: a record on disk, then `hydrate({recordId})`. **Required on every backend** — a backend without `save` has no record-first capture (D2). **Today**: `engram.save()` mirrors `plainfiles.save()` (provenance #738, `--supersedes` #805) and calls `hydrate({recordId})` as its terminal step, deferring rather than throwing when the backend cannot be reached (#874, 3.2); `memory:save`'s `package.json` pin is removed. `search` stays `unsupportedOp` (R14 scope, unchanged). | **yes** |
```

```amend-find
| memory CLI — `memory:save` | an agent or human, in session | flags (`--issue`; `--supersedes` with #805), `actor` per #738 (a handle, never a branch) | the invoking checkout's `.memory/records/` | #862 memory lane (until it exists: the slice PR, as today) | next hydration today; `hydrate({recordId})` with #874 |
```

```amend-replace
| memory CLI — `memory:save` | an agent or human, in session | flags (`--issue`; `--supersedes` with #805), `actor` per #738 (a handle, never a branch) | the invoking checkout's `.memory/records/` | #862 memory lane (until it exists: the slice PR, as today) | `hydrate({recordId})` (#874) |
```

```amend-find
| `engram` | delta under guard (#820) — three pre-guard rows await the one-time heal (#864 task 1.2a) | **not yet** — `mem_save` is the first home today; closes with #864 task 3.2 | **not yet** — manifest, chunks, symlink, driver; closes with #864 tasks 2.3/2.4 | `unsupportedOp` today; closes with 3.2 |
```

```amend-replace
| `engram` | delta under guard (#820) — three pre-guard rows await the one-time heal (#864 task 1.2a) | **not yet** — `mem_save` is the first home today; closes with #864 task 3.2 | **not yet** — manifest, chunks, symlink, driver; closes with #864 tasks 2.3/2.4 | yes |
```

## Amendment 1 — `save` column flip: engram.save() is a record-first producer (issue #874, split A)

**Signed**: DD/MM/YYYY — <Name>

### What this does NOT change

Rule 2 ("a capture becomes a durable record before the backend is touched")
stays `not yet` for `engram` — `share()` still runs `engram sync --export` →
read the chunks it just wrote → scrub → dual-write until split B (`#874`,
`Closes #874`) reshapes it into the `plainfiles.share()` mirror. Rule 3 (the
backend's binary/private files may be absent) is untouched by this amendment
too. This amendment closes exactly ONE cell: the `save` column's `unsupportedOp`
→ `yes`, because `save` is a standalone verb whose own requirement (D2: "a
backend without `save` has no record-first capture") is now satisfied on
`engram` independently of rule 2's `share()`-side gap.

### What landed (split A)

- `engram.save()` (`brain/scripts/memory/backends/engram.mjs`) is no longer
  `unsupportedOp` — it mirrors `plainfiles.save()`'s gate order (caller-mistake
  refusals → actor/provenance #738 → `--supersedes` #805 → `buildRecord` →
  secret scan → `appendRecord` → `rebuildIndex`) and adds ONE new terminal
  step: `hydrate({root, recordId, record})`.
- `hydrate({recordId})` (new export on `engram.mjs`) projects exactly one
  record into the active engram store via ONE `engram save --topic <id>` call,
  under the `#820` hydration guard, non-blocking. Binary absent, a non-zero
  exit, or a contended guard all **defer** (`{deferred: true, reason}`,
  reported on stderr) rather than throw — the record is already durable by the
  time `hydrate` runs, so a backend failure here can never read as a lost
  capture.
- `package.json`'s `memory:save` script no longer pins `MEMORY_BACKEND=plainfiles`
  — `save` is reachable, and durable, under every backend now.
- `search` is UNCHANGED — still `unsupportedOp` on `engram` (R14 scope; engram
  already has a native `mem_search`).

### Measured (R7 probe, split A)

`engram save --topic <id>` **upserts** by `topic_key` (measured against the
installed binary, v1.20.0, in an isolated temp store — see this change's
`apply-progress.md`). Re-hydrating one record therefore leaves exactly one row,
which is what makes `hydrate({recordId})`'s idempotence claim (rule 1) provable
rather than assumed.

### Notes for the promoter

**Four in-place edits**, all inside the `## Required verbs` and `## Conformance`
sections: the `hydrate` row's note, the `save` row's `**Today**:` note, the
`memory CLI — memory:save` producer row's `Hydration` cell, and the
conformance table's `engram` × `save` cell. The cold-review poster producer row
(`brain/scripts/review/poster.mjs`) is **deliberately untouched** — it is a
different producer, out of this change's scope, and still ships after `#864`
task 3.1a.

Split B (`#874`, `Closes #874`) carries a SECOND draft
(`memory-backend-contract.rule2.draft.md`) that flips rule 2 once `share()`
stops exporting. Promote this draft (Amendment 1) independently, when split
A's PR merges — do not wait for split B.
