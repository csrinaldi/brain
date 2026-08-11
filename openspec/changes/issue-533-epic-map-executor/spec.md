---
status: draft
issue: 533
---

# Spec

## REQ-533-1 — the port carries assignees
`issueView` and `issueList` MUST return `assignees` on both providers, normalized to bare
name strings.

## REQ-533-2 — absent is not empty
`assignees` MUST be `null` when the payload carried no assignee field and `[]` when it carried
one that was empty. The two MUST NOT be the same value at any layer: port, builder, or render.

## REQ-533-3 — the reader can tell them apart
The rendered map MUST distinguish "nobody is assigned" from "brain cannot see". It MUST NOT
print an "unassigned" marking for an issue whose assignees are `null`.

## REQ-533-4 — native relations are a source, not the source
`issueRelations({ project, number })` → `{ blocks, needs, foreign } | null` on both providers.
`buildGraph` MUST take the UNION of the declared block and the native relations. Neither source
may override the other.

## REQ-533-5 — every disagreement is reported
An edge asserted by exactly one source MUST be reported, by endpoints and by which source
asserts it.

## REQ-533-6 — an unreadable native side is uncomputable, not empty
`issueRelations` MUST return `null` on any fetch failure, including a partial one. `buildGraph`
MUST report those issues as unreadable and MUST NOT derive a divergence from an unread source.

## REQ-533-7 — a native relation places a node
An issue with no declared block but at least one native edge MUST be classified, not
unclassified. An issue no source places MUST remain unclassified.

## REQ-533-8 — cross-repo relations are counted, never drawn
A relation pointing outside the project MUST NOT become an edge, and MUST be counted and
surfaced.

## REQ-533-9 — containment is not ordering
GitHub sub-issues and GitLab `relates_to` MUST NOT be read as blocking edges.

## REQ-533-10 — the body-write verb writes only the body
`issueUpdate({ project, number, body })` MUST send no field other than the body. It MUST NOT be
able to change state, title or labels.

## REQ-533-11 — containment is proven before the write
`brain:epic:map` MUST verify that the text outside the map markers is byte-identical before
calling `issueUpdate`, and MUST refuse to write when it is not.

## REQ-533-12 — the second source is on by default
Native relations MUST be read without a flag. A flag MAY turn them off; no flag may be required
to turn them on.

## REQ-533-13 — still read-only reporting
Nothing in `brain:epic:map` may block a merge (`brain:metrics`' character, M9).
