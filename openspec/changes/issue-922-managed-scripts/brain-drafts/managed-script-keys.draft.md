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

Revised after #961 (PR #966 renamed the memory scripts, PR #972 promoted the doctrine): every managed
key is `brain:`-namespaced (#961 R2), so the seven memory verbs ship as `brain:memory:*`. The first
version of this draft also missed `brain:audit`, which the drift test found. Final catalog, 34 keys:

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
  'brain:adopt',
  'brain:audit',
  'brain:change:archive',
  'brain:check',
  'brain:config',
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
  'brain:memory:audit',
  'brain:memory:index',
  'brain:memory:pull',
  'brain:memory:ship',
  'brain:memory:resolve-index',
  'brain:memory:save',
  'brain:memory:share',
];
```

`brain:memory:ship` and `brain:config` are named in ADR prose (adr-0002, adr-0034, adr-0023) rather
than as a literal `npm run` mention, so the drift test cannot find them by itself. They come from the
manual measurement in proposal.md and stay covered by the sanity test's other direction: every managed
key names a real script.

## Docstring update

The comment above the array said "The 10 `brain:*` verb keys...". It now names no count, cites the
drift test, and states the namespace rule: every key is `brain:`, and the bare `memory:*` names are
repo-only aliases, never managed.

## Companion test changes (brain/scripts/** is Tier 1)

- `brain/scripts/lib/managed-paths.test.mjs`: the exact-count assertion (`length === 10`) is replaced
  by invariants: keys are unique, and every key matches `^brain:[a-z]`. A count added nothing the
  drift test does not already pin, and it broke on every legitimate addition.
- `brain/scripts/lib/managed-script-keys-doctrine.test.mjs`: its "EXPECTED RED until promotion" header
  is retired. A bare `npm run memory:<verb>` in doctrine still fails it, because the aliases are real
  scripts but never managed keys. That is the tripwire for doctrine that forgot the prefix.

## Verification after promotion

Run:
```
GIT_CONFIG_GLOBAL=/dev/null node --test brain/scripts/lib/managed-script-keys-doctrine.test.mjs
GIT_CONFIG_GLOBAL=/dev/null node --test brain/scripts/lib/managed-paths.test.mjs
```
Both should be green once `managed-paths.mjs` carries the proposed array and
`managed-paths.test.mjs`'s length/prefix assertion is updated to match.
