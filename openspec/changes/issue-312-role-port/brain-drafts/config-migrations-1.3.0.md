# DRAFT — Migration `1.3.0` (issue #312 slice A, Unit 1 — design.md D6)

**Status: DRAFT, NOT APPLIED.** `config-migrations.mjs` lives at
`brain/core/config-migrations.mjs` — a Tier 3 path this apply run is
prohibited from writing to directly (repo doctrine, `AGENTS.md`). This file
records the exact content and target locations for a human to promote in a
follow-up commit. The rest of this slice (`lib/stage-config.mjs` and its
tests, Units 2-3) is implemented and green WITHOUT this migration landing —
see `tasks.md` and the apply report.

Design reference: `openspec/changes/issue-312-role-port/design.md` §D6.

---

## ORDERING CONSTRAINT — read this before promoting either draft

`1.2.0` is claimed by `openspec/changes/issue-456-stage-set/brain-drafts/config-migrations-1.2.0.md`
(issue #456's `sdd.stages` migration), which is **also still unpromoted** —
confirmed at the time this draft was written: `brain/core/config-migrations.mjs`'s
last entry is `'0.10.0'` (`sdd.map`), and
`brain/scripts/lib/brain-config.test.mjs`'s `schemaVersion` assertion still
reads `'0.10.0'`, not `'1.2.0'`.

**`1.3.0` is correct ONLY IF #456's `1.2.0` promotes in an earlier release.**
If this change's `sdd.configs` migration ships FIRST, it must renumber to
`1.2.0`, and #456's draft renumbers to `1.3.0` instead — the number is the
release it ships in, never a queue position (#806's ruling, signed
2026-08-31). Do not promote both drafts' Edit 1 in the same commit without
first re-checking which one is landing in the earlier release; do not reuse
either number if a third migration lands between the writing of this draft
and its promotion.

The dependency is not merely administrative: `resolveStageConfigs`'s refusal 1
(`brain/scripts/lib/stage-config.mjs`) refuses any `sdd.configs` entry for a
stage outside `resolveStageSet(config).stages` — so a consumer configuring a
custom stage's `sdd.configs` entry needs `sdd.stages` (#456) to exist first. A
dependency in code is best mirrored by a dependency in release order.

**Both drafts rewrite the SAME LINE** of `brain-config.test.mjs`'s
`schemaVersion` assertion (Edit 2 below in each draft) — named here so the
second promoter reads this before the merge does, not after.

---

## Edit 1 — `brain/core/config-migrations.mjs`

Append this entry to the `migrations` array, after whichever of `'0.10.0'`
(if #456's `1.2.0` has not yet promoted) or `'1.2.0'` (if it has) is currently
last, and before the closing `];`:

```js
  {
    version: '1.3.0',
    description:
      'Add sdd.configs: per-stage configuration general to all stages — agent ' +
      'and enabled state (issue #312 slice A, design D3). Empty by default: a ' +
      'stage absent from sdd.configs takes the inhabitant\'s declared defaults, ' +
      'so an upgrade cannot silently disable or reassign a stage nobody configured.',
    defaults: { sdd: { configs: {} } },
  },
```

**RENUMBERS TO `1.2.0` if this migration ships before #456's** — see the
ordering constraint above. The package is at `1.1.0` at the time of writing.

No other changes to this file.

---

## Edit 2 — `brain/scripts/lib/brain-config.test.mjs` (around line 162)

This file IS editable by this apply run (not `brain/core/**` or
`brain/project/**`), but the assertion below only becomes true once Edit 1
above is promoted — applying it now would turn a currently-green test RED
against the real migrations array. Apply both edits together, and apply them
IN THE ORDER the two drafts (`1.2.0` and `1.3.0`) actually land.

If this migration is `1.3.0` (i.e. #456's `1.2.0` promoted first), change:

```js
assert.equal(cfg.schemaVersion, '1.2.0', 'sdd.stages (1.2.0, issue #456 slice A) is now the latest — additive-only, empty by default');
assert.deepEqual(cfg.sdd.map, {}, 'sdd.map ships EMPTY: a routed cold-review would spawn an engine no consumer asked for');
assert.deepEqual(cfg.sdd.stages, {}, 'sdd.stages ships EMPTY: the four lifecycle stages live in sdd-layout.mjs LIFECYCLE_STAGES, never duplicated into JSON');
```

to:

```js
assert.equal(cfg.schemaVersion, '1.3.0', 'sdd.configs (1.3.0, issue #312 slice A) is now the latest — per-stage config, empty by default');
assert.deepEqual(cfg.sdd.map, {}, 'sdd.map ships EMPTY: a routed cold-review would spawn an engine no consumer asked for');
assert.deepEqual(cfg.sdd.stages, {}, 'sdd.stages ships EMPTY: the four lifecycle stages live in sdd-layout.mjs LIFECYCLE_STAGES, never duplicated into JSON');
assert.deepEqual(cfg.sdd.configs, {}, 'sdd.configs ships EMPTY: a stage absent from it takes the inhabitant\'s declared defaults, never an invented override');
```

If instead this migration ships FIRST as `1.2.0`, adapt the version literal
and description text symmetrically, and let #456's draft add the
`cfg.sdd.stages` assertion on top of this one's `cfg.sdd.configs` assertion.

---

## Edit 3 — `brain/scripts/lib/stage-engine.test.mjs` (around line 87, mirror pattern)

Also editable by this apply run, also deferred for the same reason (asserts
against the real `migrations` array imported from `config-migrations.mjs`).
Add a new test alongside the existing uniqueness/uniqueness-adjacent tests,
mirroring #456's draft's Edit 3 shape:

```js
test('#312: sdd.configs ships EMPTY — a stage absent from it takes the inhabitant\'s declared defaults, never an invented override', () => {
  const entry = migrations.find((m) => m.version === '1.3.0'); // or '1.2.0' — whichever this migration lands as
  assert.ok(entry, 'the migration must exist — sdd.configs is new schema surface');
  assert.deepEqual(entry.defaults.sdd.configs, {},
    'a shipped non-empty default would silently disable or reassign a stage nobody configured');
});
```

---

## RED-first note for the human promoting this draft

Apply Edit 1 first and confirm it alone leaves `npm test` green (idempotent,
additive — same shape as every prior migration). Then apply Edits 2 and 3,
which should already pass once Edit 1 exists (they are not RED against the
draft content above — they were written to describe the POST-promotion state
directly, since this apply run cannot execute a real RED/GREEN cycle against
a file it is not permitted to write). Run `npm test` after all three edits
and confirm the count grows by exactly 1 test with 0 failures — and confirm
`stage-engine.test.mjs:87`'s uniqueness check does not fire against whichever
version number(s) #456's draft is using at promotion time.

## The contract block (issue #809 — what `brain:promote` reads)

The prose and `js` blocks above are for the human; THIS block is the machine
contract. The `version` field is the draft's own number — the verb renumbers
per #806 at promote time, in the open, under the typed confirmation.

```brain-migration/1
{
  "version": "1.3.0",
  "description": "Add sdd.configs: per-stage configuration general to all stages — agent and enabled state (issue #312 slice A, design D3). Empty by default: a stage absent from sdd.configs takes the inhabitant's declared defaults, so an upgrade cannot silently disable or reassign a stage nobody configured.",
  "defaults": {
    "sdd": {
      "configs": {}
    }
  }
}
```
