# Draft: config migration 1.4.0 — `sdd.engines`

**Target**: `brain/core/config-migrations.mjs` — Tier 3 for an agent; a human
moves this entry in. Drafted under #823 (PR1 of #814's ruled chain).
**Numbering**: #806 — the migration number IS the package version. `1.4.0`
follows the 1.2.0 (#456) and 1.3.0 (#312) drafts; renumber at land time if the
package moved (the #456 precedent: 0.11.0 → 1.2.0).

## The entry

```js
{
  version: '1.4.0',
  description:
    'Add sdd.engines: the record of what each SDD_ENGINE framework declared ' +
    'when brain:engines --record last interrogated it (issue #824, written ' +
    'ONLY through brain:config — Compuerta 4). Empty by default: an engine ' +
    'nobody recorded is honestly absent, and absence is distinguishable from ' +
    '"interrogated and declared nothing".',
  defaults: {
    sdd: {
      engines: {},
    },
  },
},
```

## Why an OPEN family

`sdd.engines: {}` follows `sdd.map: {}`'s shape (0.10.0): the migration
declares the container, the consumer names the members. Under #823's
`deriveKnownPaths`, an empty-object default is an open family — so
`sdd.engines.<name>` becomes settable in the same commit that lands this
entry, with no second schema to update.

## Sequencing consequence, stated

#824's `--record` cannot write until this entry is PROMOTED — the verb fails
closed on `sdd.engines.*` while the shipped list ends at 0.10.0. That is the
gate working, not a bug: a path becomes settable in the migration that
declares it.

## Readers of the recorded key

The verb's own next run (drift line), and #323's router later. Named here so
the key is not the unread-field defect.

## The contract block (issue #809 — what `brain:promote` reads)

The prose and `js` blocks above are for the human; THIS block is the machine
contract. The `version` field is the draft's own number — the verb renumbers
per #806 at promote time, in the open, under the typed confirmation.

```brain-migration/1
{
  "version": "1.4.0",
  "description": "Add sdd.engines: the record of what each SDD_ENGINE framework declared when brain:engines --record last interrogated it (issue #824, written ONLY through brain:config — Compuerta 4). Empty by default: an engine nobody recorded is honestly absent, and absence is distinguishable from 'interrogated and declared nothing'.",
  "defaults": {
    "sdd": {
      "engines": {}
    }
  }
}
```
