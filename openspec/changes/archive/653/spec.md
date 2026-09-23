---
status: draft
issue: 653
---

# Spec — ADR-0030 Amendment 2, the organisation scope (issue 653)

## REQ-653-1 — The scope is recorded as `@logikas`

The install line, the Context measurement, Decision 1's scope paragraph and
Alternatives considered all carry the change, so a reader who never scrolls to
the amendment is not left with the superseded scope (§1c).

## REQ-653-2 — The deferral is shown as satisfied, not overruled

The amendment opens by quoting ADR-0030's own *"Deferred, not rejected"* and
naming the condition that now holds. An amendment that changes a package name
reads as a reversal unless it says otherwise first.

## REQ-653-3 — The cost is measured, not asserted

`@logikas/brain` = 404, `@csrinaldi/brain` = 404 and never published, `brain` =
200. Nothing to unpublish; the change is one constant and five passages.

## REQ-653-4 — `access: public` is recorded as a requirement

A scoped package publishes `restricted` by default. The record states it belongs
in **both** `publishConfig.access` and the workflow flag, because the flag alone
leaves a manual publish doing the wrong thing — a failure that looks like
success.

## REQ-653-5 — The token requirement is recorded

Scoped to `@logikas/*`, not to a package: the package does not exist yet, so a
granular token limited to selected packages cannot cover its first publish.

## REQ-653-6 — Amendment 1 is preserved, and corrected in place

Reachability stays a named cost and the git-URL fallback stays supported. Only
the scope inside Amendment 1's sentence moves, with the original named in
parentheses rather than erased.

An amendment section is **current doctrine**, not an archived record — unlike
`openspec/changes/**`, which #648 deliberately leaves untouched. That is why one
edit lands inside a previously signed section.

## REQ-653-7 — It is a draft

Nothing under `brain/project/decisions/` or `brain/HOME.md` changes here.
`brain:promote` performs §1c's acts; the human's commit is the signature
(ADR-0028).

## REQ-653-8 — Every anchor resolves exactly once

Verified against the real target: five edits, each `f:1`, each `pending`;
`planAmendment` renders **8 acts**, all pending; the body cuts before the
promoter notes and the signature is stamped by the verb.
