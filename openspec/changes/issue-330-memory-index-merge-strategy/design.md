---
status: designed
issue: 330
epic: 313
artifact_store: openspec
topic_key: sdd/issue-330-memory-index-merge-strategy/design
---

# Design — one-command resolution for a conflicted `.memory/index.jsonl` (issue 330)

> **Rewritten after the first delivery was blocked.** The superseded D1 argued for
> `merge=union` on the index. It is retained below as D0, because *why a well-evidenced design was
> still wrong* is the durable part of this change.

## D0 — why `merge=union` was wrong, and why three true premises did not save it

The original design justified union on three properties, each verified in the tree and each still
true today:

1. nothing reads `index.jsonl` — every `indexPath` site in `brain/scripts/**` is a write through
   `rebuildIndex` (`cli.mjs:88,126`, `engram.mjs:297`, `plainfiles.mjs:99,172,192,205`), and
   write-time dedup reads `records/`, saying so explicitly (`store.mjs:97-99`);
2. line integrity survives union — a half-line requires a record spanning multiple physical lines,
   which the format forbids and the validator rejects (`memory-format.md:30-35`);
3. repair is one deterministic command — `rebuildIndex()` is idempotent (`store.mjs:46-48`).

All three answer *"is union dangerous?"*. **The exclusion is not about danger, it is about shape.**
`serializeIndex()` emits the entire file sorted by `id` (`format.mjs:207-211`) and `rebuildIndex()`
writes it in a single `writeFileSync` (`store.mjs:91`). A reindex therefore **replaces and reorders
every line**. A line-based union of two independently regenerated indexes does not merge two
rewrites — it **concatenates both sides' now-superseded snapshots**, producing duplicate and stale
entries. `memory-format.md:145-153` states exactly this, and ADR-0017:121-129 records the decision.

Two structural lessons, both worth more than the line of config:

- **A test pinned to a mechanism cannot question the mechanism.** The original tripwire asserted
  the union line was *present*. Green, wired, and blind to the only question that mattered.
  REQ-330-1's replacement asserts **absence** — a shape a wrong value cannot satisfy.
- **No governance gate reads doctrine.** All eight jobs passed on the union commit. L1–L6 enforce
  observable outputs, not judgment (`workflow-governance.md`, "enforce-outputs / guide-judgment
  boundary"). Doctrine conformance is the cold reviewer's job, and it is the reviewer that caught
  this. That boundary is working as designed, not leaking.

## D1 — measured: the conflict is rare, and rarity chooses the mechanism

#330 asserts the conflict is intolerable. It was never measured. Measured on the real index shape
(one entry per line, sorted by the `rec-<16 hex>` content hash, the doctrine's normative
serialization) with the repo's actual index as merge base:

| Store size | 3-way-merge conflict rate for a typical share |
|---|---|
| young store (few entries) | high — insertions collide constantly |
| **n = 1575 (brain today)** | **0 – 4.5%** |

The rate is a **function of store size**, and it falls as the store grows: because `id`s are content
hashes, parallel insertions distribute uniformly across the sorted file, so git's ordinary 3-way
merge auto-resolves most of them and a true conflict reduces to the occasional adjacent-line
insertion. `memory-format.md:135-140` predicts precisely this, and the measurement confirms it.

This is what sizes the answer. A 0–4.5% event needs a resolution that is **cheap and correct on
demand**, not a permanent, always-on merge attribute that changes every clone's behaviour to
pre-empt something that mostly does not happen. It also means the honest cost of REQ-330-1 (the
index falls through to default merge) is small and bounded.

## D2 — two layers: the command is the unit of truth, the hook is a thin caller

The owner's ruling: *"el comando tiene que estar y el hook llama al comando, esto posibilita las
dos cosas."* Both, layered. The fork dissolves at no cost:

| Layer | What it gives | What it cannot give |
|---|---|---|
| `memory:resolve-index` | Works in **every clone with zero installation**. The operator needs no tribal knowledge — one command, no judgment call. | Nothing automatic. |
| `post-merge` hook | Pure ergonomics: keeps the index canonical after a merge git resolved itself. | Cannot rescue a conflict — git does not fire `post-merge` on a failed merge. |

Both rejected single-layer options fail on their own terms:

- **Hook-only** requires per-clone installation — the same friction class as the custom merge driver
  that ADR-0017 exists to avoid, and it silently does not apply in a fresh clone.
- **Command-only** leaves exactly the ergonomics gap #330 was filed about.

**No logic is duplicated**, because the hook has none: one `node .../cli.mjs resolve-index` line.
That is what makes "both" free rather than a maintenance tax.

## D3 — fail closed: never regenerate from a conflicted log

`resolveIndex` reads `records/*.jsonl` for conflict markers **before** touching the index and throws
if it finds any (`resolve-index.mjs:64-71`). The index is derived from that log; regenerating over a
conflicted one would **bake the markers into the index and report success** — a silent corruption
that looks like a resolution.

This mirrors the reviewer protocol's uncomputable-evidence rule and `run-check.mjs`: never emit a
PASS on evidence you could not compute. `records/*.jsonl` carries `merge=union`, so in practice it
merges cleanly and this branch is the unreachable-but-mandatory guard, not the common path.

Marker detection is a line-anchored `/^(?:<{7}|={7}|>{7})/`. It is exact rather than a substring
scan because a record is one complete JSON object per line: those bytes can appear in real content
only **escaped inside a string**, never opening a physical line.

## D4 — staged **iff** git says the path is unmerged

`resolveIndex` reads `git diff --name-only --diff-filter=U` **before** the rebuild and stages only
if `.memory/index.jsonl` is in that set (`resolve-index.mjs:73-90`).

- Operator path (conflict): the path *is* unmerged → regenerate **and** `git add` → the merge is
  committable with no second step.
- Hook path (clean merge): nothing is unmerged → regenerate, **stage nothing**.

The asymmetry is the whole safety property. A hook that staged on every pull would be silently
mutating the operator's index — a worse defect than the conflict this change makes cheap. The
unmerged set is read before the write so the decision cannot depend on a side effect of the write.

## D5 — the tripwire asserts absence

REQ-330-1's test filters `.gitattributes`'s non-comment lines for a rule matching
`/.memory/index.jsonl` and asserts the set is **empty**. Absence is unforgeable: a check that
required "some `merge=` attribute" would pass on the forbidden value. This is the direct correction
of D0's second lesson, applied to this change's own mechanism.

## D6 — doc placement

The helper belongs in the passage of `memory-format.md` that already states the exclusion and
already sanctions "a helper or a post-merge hook" (lines 140-153) — the operator who hits an index
conflict reads exactly there. The edit **names** the helper; it does not weaken an exclusion.
`brain/core/**` → English (ADR-0009), **Tier 2**: drafted in `brain-drafts/`, promoted by the human.

## Contract / API impact

One new backend-agnostic CLI verb (`resolve-index`) alongside `reindex`, dispatched before the
backend is resolved for the same reason `reindex` and `migrate-v1` are: the durable format is an
ADR-0017 concern, not a `MEMORY_BACKEND` one. Three i18n keys (en + es). No existing verb, return
shape, or production code path changes. `.gitattributes` loses a declaration added earlier in this
same branch, returning to `main`'s behaviour for that path.

## Rejected alternatives

- **`merge=union` on the index** — see D0. Reverses `memory-format.md:145-153` and
  ADR-0017:121-129.
- **A custom merge driver for the index** — forbidden by name (`memory-format.md:140-144`), and it
  requires per-clone `git config` registration, so it silently does not apply in a fresh clone.
- **`-merge` (always conflict)** — turns a 0–4.5% nuisance into a mandatory manual step on a
  machine-generated file. The ADR-0002 pain the record format escaped.
- **`merge=ours`** — silently discards the other side's entries; harmless only because reindex
  regenerates them, i.e. it leans on the same repair while being asymmetric and surprising.
- **Auto-running the resolution from `share()`/`pull()`** — hides the conflict instead of making it
  cheap, and collides with #361's backend asymmetry. The operator should see that a merge happened.
- **Stop committing the index** — genuinely tempting, since nothing reads it. Contradicts
  `memory-format.md:26`'s deliberate "committed for zero-tool querying": an ADR-0017-level
  decision, not a bug fix.
- **Make `share()` reindex unconditionally in this slice** — the issue's "consider also".
  `plainfiles` already does (`plainfiles.mjs:170-174`); `engram` reindexes only when it appended
  (`engram.mjs:315-318`) and its `pull()` never does (`engram.mjs:589-619`). Changing it
  contradicts a pinned test in `engram.share.test.mjs`. **Filed as #361.**
