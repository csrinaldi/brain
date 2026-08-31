# DRAFT — Migration `0.11.0` (issue #456 slice A, Phase 4)

**Status: DRAFT, NOT APPLIED.** `config-migrations.mjs` lives at
`brain/core/config-migrations.mjs` — a Tier 3 path this apply run is prohibited
from writing to directly (repo doctrine, `AGENTS.md`). This file records the
exact content and target locations for a human to promote in a follow-up
commit. The rest of slice A (Phases 1-3, 5-6) is implemented and green
WITHOUT this migration landing — see the tasks.md note and the apply report.

Design reference: `openspec/changes/issue-456-stage-set/design.md` §2 D4.

---

## Edit 1 — `brain/core/config-migrations.mjs`

Append this entry to the `migrations` array, immediately after the `'0.10.0'`
entry (the `sdd.map` migration) and before the closing `];`:

```js
  {
    version: '0.11.0',
    description:
      'Add sdd.stages: the declared stage set (issue #456 slice A). Empty by ' +
      'default — the four lifecycle stages live in code (sdd-layout.mjs ' +
      'LIFECYCLE_STAGES), never in a consumer config, so an upgrade cannot ' +
      'introduce a fourth declaration of them in a file no test can guard. ' +
      'ADDITIVE-ONLY: a declared set omitting one of the four is REFUSED ' +
      '(maintainer ruling 2026-08-29; ADR-0019 Amendment 1 condition 4).',
    defaults: { sdd: { stages: {} } },
  },
```

No other changes to this file. `0.11.0` is the next version number in
sequence; per this file's own doctrine (the `0.6.0` note near the bottom),
version numbers are content-identifiers and are never reused even if this
draft sits unpromoted for a while — do not renumber it to `0.11.0` a second
time if another migration lands first; take the next free slot instead.

---

## Edit 2 — `brain/scripts/lib/brain-config.test.mjs` (around line 162)

This file IS editable by this apply run (not `brain/core/**` or
`brain/project/**`), but the assertion below only becomes true once Edit 1
above is promoted — applying it now would turn a currently-green test RED
against the real migrations array. Apply both edits together.

Change:

```js
assert.equal(cfg.schemaVersion, '0.10.0', 'sdd.map (0.10.0, issues #323/#682) is now the latest — the 0.6.0 memory.dualWrite gap (D3/C4, issue #229) is a deliberate, never-reused retirement mark');
assert.deepEqual(cfg.sdd.map, {}, 'sdd.map ships EMPTY: a routed cold-review would spawn an engine no consumer asked for');
```

to:

```js
assert.equal(cfg.schemaVersion, '0.11.0', 'sdd.stages (0.11.0, issue #456 slice A) is now the latest — additive-only, empty by default');
assert.deepEqual(cfg.sdd.map, {}, 'sdd.map ships EMPTY: a routed cold-review would spawn an engine no consumer asked for');
assert.deepEqual(cfg.sdd.stages, {}, 'sdd.stages ships EMPTY: the four lifecycle stages live in sdd-layout.mjs LIFECYCLE_STAGES, never duplicated into JSON');
```

---

## Edit 3 — `brain/scripts/lib/stage-engine.test.mjs` (around line 78, mirror pattern)

Also editable by this apply run, also deferred for the same reason (asserts
against the real `migrations` array imported from `config-migrations.mjs`).
Add a new test alongside the existing `'#323: sdd.map ships EMPTY...'` test
(same file, same import), mirroring its shape exactly:

```js
test('#456: sdd.stages ships EMPTY — the four lifecycle stages live in code, never duplicated into a consumer config', () => {
  const entry = migrations.find((m) => m.version === '0.11.0');
  assert.ok(entry, 'the migration must exist — sdd.stages is new schema surface');
  assert.deepEqual(entry.defaults.sdd.stages, {},
    'a shipped non-empty default would be a FOURTH declaration of the set, in JSON the drift guard cannot scan');
});
```

---

## RED-first note for the human promoting this draft

Apply Edit 1 first and confirm it alone leaves `npm test` green (idempotent,
additive — same shape as every prior migration). Then apply Edits 2 and 3,
which should already pass once Edit 1 exists (they are not RED against the
draft content above — they were written to describe the POST-promotion
state directly, since this apply run cannot execute a real RED/GREEN cycle
against a file it is not permitted to write). Run `npm test` after all three
edits and confirm the count grows by exactly 1 test with 0 failures.
