# Proposal — issue-1032-epic-clustering

## The problem

`lane-model.mjs` said a truth that had expired:

```
epicGrouping: { ok: false, reason: 'kind and parent are not data yet (#967)' },
```

#967 shipped. A node carries `kind`, `parent`, `parentSource` and `tracker`,
the verb resolves a slice's base from its epic's declaration, and the
`base-branch` gate refuses a slice aimed past its tracker. The board still
grouped only by `track`, so it answered "which lane" and not "which epic, and
which of its slices are left" — the question #878's exit criteria put first.

The design already drew the control: an "epic clusters" button, disabled, with
a tooltip naming this ticket.

## Measured, on this repository

Two issues declare `kind: epic` — #878 and #884 — and twelve declare a
`parent`. **No epic declares a tracker.** And #884 is BOTH an epic and a child
of #878: nested epics are real in this data, not hypothetical.

## The approach

`epicGrouping` groups nodes under the epic their `parent` names. The epic's own
row leads its slices. A node with no parent is untouched and stays in its
track lane, exactly as before.

Three absences are stated rather than hidden, because each is a different
fact and a reader has to tell them apart:

- an epic that declares no tracker says `epic-declares-no-tracker`, the
  resolver's own word for it;
- a node whose parent resolves to something that is not an epic carries the
  reason the graph already reported, rather than being quietly reparented;
- a node whose parent number this graph holds no node for is an outage-shaped
  absence, never read as "not an epic".

**Nested epics stay flat.** `roadmap-model.mjs` set that precedent under
#882's own cold review, and a second, deeper vocabulary here would be exactly
the "second grouping vocabulary" this ticket forbids. The dropped relation is
SAID on the child epic's row.

The model also states who it did NOT claim. The page draws clusters above and
lanes below, and a claimed node must not appear in both; deciding who is
claimed is the model's job, and a renderer working it out again from `kind`
and `parent` would be a second answer that can disagree with the first.

## What is not built here

The ticket also asks that a node whose open PR targets a base other than its
epic's tracker be marked. That needs the PR list, which this model is not
given. Each grouped child carries an explicitly failed `baseCheck` naming the
reason, rather than a silent empty field.

## Removed

`canvas-model.mjs` and its test. It has had no importer since PR 3 of #998 and
survived only to be tested, which #998's apply record named as a follow-up.
