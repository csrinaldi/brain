# Draft: reconcile `MANAGED_SCRIPT_KEYS` against doctrine (issue #922)

**Target**: `brain/core/managed-paths.mjs` (lines 17-40, the `MANAGED_SCRIPT_KEYS`
export and its docstring)

## Why this is NOT a `brain-amendment/1` fenced block

The task brief for this change assumed the fix would ship as a
` ```brain-amendment/1 ` fenced block for `brain:promote` to apply. **That is
incorrect for this target, verified by simulation, not assumed:**

```
$ node -e '...'  # imports the real parseAmendmentDraft from
                 # brain/scripts/lib/amendment-draft.mjs
{
  "ok": false,
  "error": "target 'brain/core/managed-paths.mjs' is not a brain/** Markdown path.\n  This verb amends signed artefacts under brain/ and nothing else."
}
```

`amendment-draft.mjs:116` hard-refuses any target that does not end in `.md`.
The `brain-amendment/1` contract (and its sibling `brain-migration/1`, which is
narrower still — JSON-only, scoped to `config-migrations.mjs`) exists for
amending **signed prose artefacts** (ADRs, methodology docs). There is no
`brain:promote`-automated contract for an arbitrary `.mjs` code file today.

This draft instead follows the **generic Tier-2 path**
(`consolidation-protocol.md` §2 / `agent-authorities.md` Tier 2): the agent
drafts the artifact here, a human reviews it and moves the change into
`brain/core/managed-paths.mjs` by hand, in a commit they author.

## Anchor uniqueness (verified by simulation)

The block below occurs **exactly once** in `brain/core/managed-paths.mjs`,
checked with the real `countOccurrences` from `amendment-draft.mjs` (the same
function `assessEdit` uses to gate a promotion at `free === 1`):

```
$ node -e '...'  # countOccurrences(managedPathsSource, anchorBlock)
anchor occurrences in managed-paths.mjs: 1
anchor length (bytes): 284
```

## Current text (lines 29-40, byte-for-byte)

```js
export const MANAGED_SCRIPT_KEYS = [
  'brain:env:init',
  'brain:day:start',
  'brain:session:start',
  'brain:ticket:start',
  'brain:project:feature',
  'brain:project:status',
  'brain:tracker:board',
  'brain:repo:check',
  'brain:change:verify',
  'brain:memory:session-end',
];
```

## Proposed text

```js
export const MANAGED_SCRIPT_KEYS = [
  'brain:env:init',
  'brain:day:start',
  'brain:session:start',
  'brain:ticket:start',
  'brain:project:feature',
  'brain:project:status',
  'brain:tracker:board',
  'brain:repo:check',
  'brain:change:verify',
  'brain:memory:session-end',
  // issue #922: reconciled against every doctrine `npm run …` mention across
  // brain/core/**, brain/project/**, AGENTS.md, docs/** (excluding
  // docs/inbox/**, an ungoverned capture zone) — measured by
  // brain/scripts/lib/managed-script-keys-doctrine.test.mjs, which fails on
  // future drift. `memory:save`/`memory:ship`/`memory:audit`/`brain:config`
  // are the ticket's named minimum; the rest is the full reconciliation the
  // acceptance criteria also require. `memory:ship` and `brain:config` are
  // referenced by verb name in ADR prose (adr-0002, adr-0034, adr-0023)
  // rather than a literal `npm run` mention, so the automated drift test
  // cannot detect them by itself — they are added here from the manual
  // measurement in proposal.md and stay covered by the sanity test's other
  // direction (every managed key names a real script).
  'memory:save',
  'memory:ship',
  'memory:audit',
  'brain:config',
  'brain:adopt',
  'brain:change:archive',
  'brain:check',
  'brain:governance-status',
  'brain:metrics',
  'brain:nav',
  'brain:next',
  'brain:promote',
  'brain:protect',
  'brain:review',
  'brain:review:board',
  'brain:save',
  'brain:ship',
  'brain:start',
  'brain:upgrade',
  'memory:index',
  'memory:pull',
  'memory:resolve-index',
  'memory:share',
];
```

## Docstring update (lines 17-28)

The comment above the array currently says "The 10 `brain:*` verb keys...".
Once promoted, that stops being true on two axes: it is 34 keys, and it is no
longer `brain:*`-only. Suggested rewrite (human should adjust wording to
taste, this is prose not code):

```js
// The brain:*/memory:* verb keys that brain:upgrade injects into consumer
// package.json — reconciled against every doctrine `npm run …` mention
// (issue #922). Single source of truth — imported by installer.mjs
// mergePackageJson, and drift-guarded by
// brain/scripts/lib/managed-script-keys-doctrine.test.mjs.
//
// brain:memory:session-end (#906 A5, measured): [... existing paragraph
// unchanged ...]
```

## Companion test change (already applied directly, brain/scripts/** is Tier 1 code)

`brain/scripts/lib/managed-paths.test.mjs` line ~139-146 currently pins:

```js
test('MANAGED_SCRIPT_KEYS has exactly 10 entries, all prefixed brain: (S5, #906 A5)', () => {
  assert.equal(MANAGED_SCRIPT_KEYS.length, 10, ...);
  for (const key of MANAGED_SCRIPT_KEYS) {
    assert.ok(key.startsWith('brain:'), ...);
  }
});
```

This assertion is now FALSE ON PURPOSE once this draft promotes (34 entries,
some `memory:*`). The human promoting this draft should update that test in
the same commit — it was left untouched by this PR (not a Tier-2 file, but
editing it ahead of the promotion would make `npm test` fail against the
*current*, un-promoted catalog, which is still correct today).

## Verification after promotion

Run:
```
GIT_CONFIG_GLOBAL=/dev/null node --test brain/scripts/lib/managed-script-keys-doctrine.test.mjs
GIT_CONFIG_GLOBAL=/dev/null node --test brain/scripts/lib/managed-paths.test.mjs
```
Both should be green once `managed-paths.mjs` carries the proposed array and
`managed-paths.test.mjs`'s length/prefix assertion is updated to match.
