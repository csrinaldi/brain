# Exploration: issue-1061 — one-time heal of the engram store's pre-guard duplicate rows (#864 task 1.2a)

> Source analysis by the sdd-explore sub-agent (read-only, `main` ba514344). The live-store
> measurements in "Store facts" were taken by the orchestrator, because the sub-agent had no
> shell.

## Summary

`memory:audit` reports the engram backend at `rows 2450 · distinct 2447 · duplicated 3`: the
three pre-guard rows task 1.2a names. Each pair is byte-identical in content, title and type,
created in the same second, with consecutive ids — one import ran twice before the #820 guard.
The contract licenses the fix (adapter deletes its own rows for a duplicated key; records are
never deleted). The path the task text allowed (`engram.mjs#dualWriteRecords`) was deleted by
#955/PR #977. Recommended: a small tested module that finds duplicate `topic_key`s in an
`engram export` and deletes all but the lowest id, dry-run by default, run once by the
maintainer.

## How the audit counts

- `cli.mjs:185-208` `audit` → `lib/audit-io.mjs:67-99` `readBackendKeys`: runs
  `engram export <tmp file>`, cross-checks the `Observations: N` stdout line, keeps
  `topic_key`s starting with `rec-`.
- `lib/audit.mjs:91-102`: `rows` = all keys, `distinct` = unique keys, `duplicated` = keys seen
  more than once. Distinct is by `topic_key`, which this adapter always sets to the record id
  (`engram.mjs:363`, `:619`, `:883`).
- The `records` line (`excess 2`) is a separate, backend-agnostic count over
  `.memory/records/` (`audit-io.mjs:21-33`, `audit.mjs:76-84`).

## Store facts (orchestrator, 2026-09-18, engram 1.20.0, read-only)

`~/.engram/engram.db` (SQLite, ~230 MB). `engram export` rows for the three keys:

| topic_key | kept (lower id) | duplicate | created_at | content length |
|---|---|---|---|---|
| `rec-35e09fc539447742` | 3089 `obs-9229525d73068f1b` | 3092 `obs-41d07c12dfe03bd1` | 2026-09-01 16:22:40 | 3327 |
| `rec-4d99842973ef6c5b` | 3090 `obs-9ed0ba42b887011f` | 3093 `obs-93acd79f338334ba` | 2026-09-01 16:39:26 | 2567 |
| `rec-d2ded214bc5d66c1` | 3091 `obs-24accc8cd4b8356c` | 3094 `obs-13a6bb5c7e7c3431` | 2026-09-01 12:59:28 | 2261 |

- Each pair: content + title + type identical (sha256 prefixes `2256bb71389d`,
  `9c10f322270a`, `3de168879005`). No row has `deleted_at`.
- The export contains zero rows with `deleted_at` set, so it probably omits soft-deleted
  rows; a soft delete may be enough for the audit. Must be proven on a temp store before the
  real run.
- `engram doctor --json`: the only blocked sync mutations are `obs-b878fbfe33dac7cb`
  (project `synergy`) and `prompt-eb19a623ac54cc6c`; none touches the six rows.
- `engram delete <obs_id> [--hard]` exists (soft by default). engram 2.0.0 is available;
  this machine runs 1.20.0.

## Contract

`brain/core/methodology/memory-backend-contract.md:90-102` (Deletion): "The adapter MAY delete
its own rows for reconciliation (a duplicated key …). Records are never deleted." The
conformance table (`:109`) already points at this task. Tier 2: quote, do not edit.

## Options

| Option | Verdict |
|---|---|
| (a) tested module: export → group by `topic_key` → delete all but the lowest id; dry-run default; refuse if copies differ | **Recommended** |
| (b) `brain:memory:reindex` | Does not apply: it never touches engram (`cli.mjs:161-175`); `import` inserts and never self-heals (`engram.mjs:415-426`) |
| (c) permanent `engram.mjs#heal()` verb | Viable, heavier; the task says one-time |
| (d) by hand | Not repeatable by a consumer; the audit exists so nothing is a hand query |

Upserting with `engram save --topic` is not a fix: with two rows already matching, which one it
updates is undefined.

## Record-layer excess (`rec-4a22e13fd3c3aebd`, `rec-95740755792f0f1c`)

Two physical lines each inside their own per-id file, identical except `source` (one carries an
`issue #N / ` prefix). This is the divergent-duplicate mechanism `lib/duplicates.mjs:56-96`
documents: an export round-trip widens `source`, `id` excludes `source`, and `merge=union`
kept both lines. The read path resolves first-wins, so every consumer sees one row. The
contract says records are never deleted and `duplicates.mjs` rejects rewriting the JSONL.
Recommendation: out of scope for #1061. Task 6.1's criterion "`rec-` distinct = rows" must say
which layer it means; if it means records, 6.1 has to accept `excess 2` as documented noise or
a ruling must reopen ADR-0017.

## Tests

Seam pattern from `audit-io.test.mjs:77-114` (`_probe`, `_exec`): fixture export with a
duplicated key → exactly one delete of the higher id; second run is a no-op; refuses when the
copies differ or a key has more than two rows. One integration test against a temp engram store
(`ENGRAM_DATA_DIR`) to prove whether a soft delete removes the row from `engram export`.

## Risks

- Soft vs hard delete: unproven which one the export honors.
- Mutating the shared store is confirm-before-executing (AGENTS.md Tier 2): the real run is the
  maintainer's, with before/after audit lines pasted on #1061.
- Cloud sync: none of the six rows has a pending mutation today; re-check with `doctor` right
  before the run.

## Open product questions

1. One-off script, or a reusable heal consumers can run too?
2. Soft or hard delete?
3. Who runs it, and where is the evidence recorded?
4. Record-layer excess: confirm out of scope, and how 6.1 reads "distinct = rows"?

## Slices

One PR, ~250 lines including tests; the real run happens after merge.
