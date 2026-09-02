# Design: #809 — the migration arm of brain:promote

Tier `lite`. Implements `specs/promote-migration/spec.md` under D1–D4.

## T1 — `brain/scripts/lib/migration-draft.mjs` (mirrors amendment-draft.mjs)

- `MIGRATION_CONTRACT_TAG = 'brain-migration/1'`;
  `MIGRATION_DRAFT_BASENAME_RE = /^config-migrations-(\d+\.\d+\.\d+)\.md$/`.
- `parseMigrationDraft(text)` → `{entry, refusal}` — exactly one fenced block,
  `JSON.parse` only, refuses `migrate` keys, non-object `defaults`, missing
  `description`. Every refusal is a sentence naming the rule.
- `proposeVersion({draftVersion, packageVersion, tailVersion, asOverride})` →
  `{version, renumbered, refusal}` — next-minor above max(package, tail);
  refusal on ≤ tail (monotonic-forever, citing the file's own #231 note).
- `spliceMigrationEntry(fileText, entry, version)` → `{next, refusal}` — pure
  textual append before the final `];` of `export const migrations = [`,
  serializing the entry as source with the version FIRST and description
  second (the shipped entries' key order). Anchor missing → refusal, never a
  guess.

## T2 — the dispatch arm in `brain-promote.mjs`

Detection FIRST by basename (`MIGRATION_DRAFT_BASENAME_RE`), before the
ADR/amendment split — a migration draft is never a `destinationFor` candidate.
`planMigrationPromotion(ctx)` renders: the draft, the parsed entry, the
number line ("draft says X → promoting as Y"), the target file, the proof
step's result. Confirmation word and staging reuse the existing flow
verbatim. The candidate-proof (D3) runs BEFORE the plan is shown: a plan the
proof already failed is never offered for signing.

Proof mechanics: candidate text → `mkdtemp` file → `import(file://…)` →
`migrateConfig({}, mod.migrations, proposedVersion)` must not throw AND must
report the new version among `applied`.

## T3 — the three conversions

Each pending draft gains its `brain-migration/1` block (content lifted from
its ```js block, as JSON), prose kept above it. Version fields keep their
draft numbers — D2 renumbers at promote time, which is the point.

## Notes

- No new config surface (Compuerta 4): the verb is `brain:promote`, unchanged.
- No cascade: migrations touch no doctrine index; `brain:config`'s
  KNOWN_PATHS derives from the migrations list automatically.
- `promote-guards.mjs` shipped-content guards run unchanged over the write.
