---
status: draft
issue: 601
---

# Proposal — REFUSE protects a path on the release that first ships it (issue 601)

## What

A `STRATEGY.REFUSE` path that brain is shipping for the FIRST time, and that
already has a file in the consumer's tree, is now NAMED and refused instead of
overwritten.

## Why

`managed-paths.mjs` says REFUSE means *"if the CONSUMER modified it, abort and
name it"*. On the release that introduces a path it did none of that.

`copyManaged` only classified a path as `consumerModified` when
`outgoing.has(rel)` — the bytes the PREVIOUSLY installed package shipped. A
brand-new path is in no prior release, so it was never consumerModified, the
REFUSE loop never saw it, and it fell through to a plain collision.
`--abort-on-collision` is opt-in, so the default run printed "Proceeding" and
copied over the consumer's file.

The classification that exists to prevent exactly this was inert **once**, on
the release where the risk is highest.

## The evidence is stronger than "modified"

If brain never shipped a path and a file is sitting there, those bytes cannot be
brain's — nothing of brain's was ever there. They are the consumer's, entirely.
The old code turned the stronger claim into the weaker outcome.

Measured in #596 against a GitLab consumer's own
`.gitlab/merge_request_templates/Default.md` — the single most likely file for
them to own, since it is the one GitLab auto-applies.

## Direction chosen

Candidate 1 from the ticket: *fail closed, name it, let `--force-managed`
through*. It costs one prompt per new REFUSE path per consumer, and only for
consumers who already own that file.
