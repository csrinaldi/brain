---
status: draft
issue: 533
epic: 313
---

# Proposal — the executor half of the epic map

## What was wrong

Slice 1 (#459 / PR #532) made dependencies **declared data**, derived the graph, rendered it
as mermaid into a marker-bounded region, and computed parallelisability from `files` rather
than trusting a declaration. It left three things out, deliberately and in writing, because
all three are changes to the VCS port.

**The map could not say who is executing anything.** `issueList` normalised assignees away and
`issueView` never carried them. So a board that answers *what is startable* could not answer
*who is on it* — and slice 1 refused to fake it, because reporting an empty assignee list reads
as *"nobody is on this"* when the truth is *"brain cannot see"*.

**Both providers carry a native dependency graph and brain read neither.** GitHub has issue
dependencies, GitLab has issue links. Reading them means new port verbs.

**The port had no verb that writes an issue body**, so the map printed its region for an
operator to paste. A derived artefact behind a copy-paste step is a habit, not a mechanism —
the same shape #530 closed on the memory side.

## What lands

`assignees` on `issueView`/`issueList`, `issueRelations` and `issueUpdate` on both providers,
and `brain:epic:map` using all three. **ADR-0029** carries the decisions; it is a Tier-2 draft
under `brain-drafts/` awaiting the human's signature.

## The open question the ticket asked to settle

*When the declared block and the native relations disagree, which wins, and is the disagreement
reported?*

**Neither wins. The union is taken and every disagreement is reported.**

Precedence is a way of discarding an assertion, and there is no ground on which to discard
either: both are human-authored claims about the same relation, neither derived from the other.
The graph exists to answer *can this start now*, and for that an edge either source knows about
is a real constraint. It is also the safe direction, and not by a small margin — **an extra
blocker delays one ticket; a missing one licenses two agents onto colliding work.**

The report is not decoration. It is what answers the ticket's own worry that *"a relation
someone clicked by accident"* would override a declared block: a wrong click lands in a list a
human can act on, where a silently overridden edge never surfaces. **A silent merge of two
sources is how a derived artefact starts lying again.**

## Measured before designing, not after

The failure being avoided is #335 — green in test, inert in production — so the endpoints were
probed against the live repo on 2026-08-11 before a line was written:

| | |
|---|---|
| `issues/533/dependencies/blocking` and `/blocked_by` | **200**, both, `[]` |
| `issues/533/sub_issues` | **200**, `[]` |
| live `assignees` | present on **every** entry, list and single |
| open issues carrying a `brain-graph/1` block | **0 of 47** |

Both sources are empty today. Whatever rule this change writes will be exercised first by
whoever declares the first edge, so it had to be a rule that survives one source being silent —
which is what settled the union.

The whole thing was then run end to end against the real GitHub API (`brain:epic:map 313
--dry-run`, 47 issues): assignees render live, the relation endpoints answer for every issue,
and nothing reports as unreadable. The map's own output is what says `0 of 47` are placed.

## Three refusals inside the union

**An unreadable native side is not "no relations".** `issueRelations` answers `null` on any
failure — including a partial one where only one of GitHub's two endpoints resolved, because
half a graph reports absent edges and says nothing about it. It is counted and reported, and it
**manufactures no divergences**: "missing from native" is not a fact about the data when native
could not be read.

**Cross-repo relations are counted, never drawn.** Issue numbers are per-repository, so a
foreign `#12` drawn as a node asserts an edge to *this* repo's `#12` — a fabricated dependency,
worse than an omitted one. The count keeps the omission audible.

**Two relations are deliberately not read.** GitHub sub-issues are *containment*, not ordering —
reading them as blockers would make every slice of #313 appear to block #313. GitLab
`relates_to` is a "see also", and a graph that blocks work it should not is abandoned faster
than one that says too little.

## The write verb, and what had to be true first

`issueUpdate` is the port's **first verb that can overwrite human prose** — every other write on
it appends. #533 states the containment as a precondition rather than a nicety, so that is how
it shipped: `outsideRegion` proves byte-equality of everything around the markers, and
`brain:epic:map` **refuses to write** when it differs. The verb receives an opaque string and
cannot check this itself, which is exactly why the proof had to come first.

The refusal is not hypothetical. A body carrying a stray `BEGIN` with no `END` — half a pasted
region — makes the append leave the stray marker as the *first* one, so the next run would
swallow the prose between it and the real `END`. The map refuses that body and writes nothing.

`body` is the only writable field. A payload that could carry `state` would make this the verb
that closes a ticket, and closing is a governance act (`issue-link` reads the closing keyword).

## One thing slice 2 makes visible that slice 1 hid

A ready node with no `files` claim produces an empty `conflictsWith`, which reads as *proven
parallelisable*. It proved nothing. Native relations carry no `files` at all, so this stopped
being rare — and the summary now names those nodes instead of letting an empty result look like
a clean one.

## Not in scope

Anything that would let this verb block a merge. `brain:epic:map` stays read-only reporting
(`brain:metrics`' character, M9): slice 2 adds a write to an issue body and no gate anywhere.
