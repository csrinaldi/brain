# ADR-0029 — Two sources feed one graph: the union is taken, the divergence is reported

**Status**: Accepted
**Date**: 2026-08-11 — Cristian Rinaldi

## Context

`brain:epic:map` (#459, slice 1) derives an execution graph from issue bodies: a declared
`brain-graph/1` block carries `track`, `needs`, `blocks` and `files`, and the map renders
what is startable, what is blocked, and which ready tickets cannot run in parallel. It was
sliced deliberately, and #533 names the three things it left out. All three are changes to
the VCS port, which is why none of them was smuggled in.

**1. The map cannot say who is executing anything.** `issueList` normalised assignees away
(`.map(r => ({ number, title, labels }))`) and `issueView` never carried them. Slice 1 did
not paper over it — reporting an empty assignee list would read as *"nobody is on this"*
when the truth is *"brain cannot see"*, the substitution of absence for emptiness that
`evidence-reader-empty-on-failure` names and that #518 recorded on the audit side. So the
map said so in prose instead. Prose is not a board.

**2. The providers carry a native dependency graph and brain does not read it.** GitHub has
issue dependencies (`blocking` / `blocked_by`); GitLab has issue links
(`blocks` / `is_blocked_by` / `relates_to`). Slice 1 chose the declared block over these for
a slicing reason rather than a preference: reading them means new port verbs, and widening
the port is a `decision`-labelled change by ADR-0020's own rule.

**3. The port has no verb that writes an issue body.** So the map printed its region for an
operator to paste. A derived artefact that depends on a human copy-paste step is a habit,
not a mechanism — the same gap #530 closed on the memory side.

Two facts were measured on 2026-08-11 before any of this was designed, because the failure
mode being avoided is a feature that is green in test and inert in production (#335):

| | |
|---|---|
| `GET /repos/csrinaldi/brain/issues/533/dependencies/{blocking,blocked_by}` | **200**, both, empty arrays |
| `GET /repos/csrinaldi/brain/issues/533/sub_issues` | **200**, empty |
| live `assignees` on the issues endpoint | present on **every** entry (list and single) |
| open issues carrying a `brain-graph/1` block | **0 of 47** |

That last row is the one that decides the shape of this ADR: today the declared source is
empty and the native source is empty. Whatever rule is written here, it will be exercised for
the first time by whoever declares the first edge — so it must be a rule that survives one
source being silent.

## Decision

### 1 — `assignees` widens the return contract of `issueView` and `issueList`, as `string[] | null`

`string[]` means the payload carried an assignee field; `[]` inside it means the fetch
succeeded and nobody is assigned. **`null` means brain could not see**, and the two are never
the same value. Normalisation lives in one shared helper (`normalizeAssignees`) that prefers
the plural array and falls back to the legacy singular, so the only provider-specific input is
whether a user object keys its name as `login` or `username`.

The renderer carries the distinction all the way to the reader: a name renders as the name,
`[]` renders as *"sin asignar"*, and `null` renders as **nothing at all** in the diagram and
as `(?)` in the summary. A reader must be able to tell "nobody took this" from "brain does not
know", because those two prompt opposite actions.

### 2 — Native relations are a SECOND SOURCE. The union is taken, and every disagreement is reported.

This is the question #533 asked to settle: *when the two disagree, which wins, and is the
disagreement reported?*

**Neither wins. Precedence is a way of discarding an assertion, and there is no ground on
which to discard either one** — both are human-authored claims about the same relation, and
neither is derived from the other. What the graph is for is answering *can this start now*,
and for that question an edge either source knows about is a real constraint. Dropping it
because the other source is silent makes the map say *"there is no dependency"* — the
stronger and falser statement this module already refuses three times over (the out-of-scope
stub in `renderMermaid`, the pagination fix behind `issueList`, #518's unenumerated commits).

Union is also the safe direction, and the asymmetry is not close: **an extra blocker delays
one ticket; a missing one licenses two agents onto colliding work.**

**The union is only honest with the divergence reported.** Every edge present in one source and
absent from the other is listed, by endpoints and by which source has it. That is what answers
the ticket's own worry — *"a repo that declares a block should not have it overridden by a
relation someone clicked by accident"*. A wrong click lands in a list a human can act on; a
silently overridden edge never surfaces at all. **A silent merge of two sources is how a
derived artefact starts lying again**, and the report is the whole difference between a merge
and a merge somebody can audit.

Three consequences follow, and each is a refusal:

- **A node placed by a native relation alone is classified.** A repo that never declares a
  block still gets a graph, which is what the ticket asked for. A node that *no* source places
  stays unclassified rather than becoming a silent free-standing leaf.
- **An unreadable native side is not "no relations".** `issueRelations` answers `null` on any
  fetch failure — including a partial one, where only one of GitHub's two endpoints resolved,
  because half a graph reports absent edges and says nothing about it. `null` is carried
  through to a reported count, and it **manufactures no divergences**: "the declared edge is
  missing from native" is not a fact about the data when native could not be read at all.
- **Cross-repo relations are counted, never drawn.** Issue numbers are per-repository, so a
  foreign `#12` rendered as a node asserts an edge to *this* repo's `#12` — a fabricated
  dependency, which is worse than an omitted one. The count is what keeps the omission audible.

Two relations are deliberately **not** read, and the reasons are the same reason:

- **GitHub sub-issues.** Containment is not ordering. A slice is *part of* its epic, not a
  blocker on it; feeding sub-issues into a blocking graph would make every slice of #313
  appear to block #313.
- **GitLab `relates_to`.** A "see also" is not a start-order constraint. Reading it as one
  turns every cross-reference a human ever clicked into a blocker, and a graph that blocks
  work it should not is abandoned faster than one that says too little.

### 3 — `issueUpdate` writes `body`, and only `body`

The port gains its **first verb that can overwrite human prose**. Every other write on it
appends: `issueComment` adds a comment, `labelAdd` adds a label, `prReviewComment` posts a
review. This one replaces, and there is no undo behind it that the port can reach.

Three limits, and the first is a precondition rather than a feature:

- **The containment is proven before the verb is called.** `replaceMapRegion` is
  marker-bounded by construction; `outsideRegion` asserts byte-equality of everything around
  the markers, and `brain:epic:map` refuses to write when it differs. `issueUpdate` receives an
  opaque string and cannot check this itself, which is exactly why the proof had to exist
  first — #533 states it as the precondition, not as a nicety to be discovered afterwards.
- **`body` is the only writable field.** A payload that could also carry `state` /
  `state_event` would make this the verb that closes a ticket, and closing is a governance act:
  `issue-link` reads the closing keyword. Widening the field set is a `decision`, not a patch.
- **`brain:epic:map` stays read-only reporting** (`brain:metrics`' character, M9). Nothing it
  emits can block a merge. Slice 2 adds a write to an issue body and no gate anywhere.

## Consequences

**Two extra requests per issue**, on GitHub, when relations are read — and they are read by
default, because a second source behind an opt-in flag is a source nobody turns on (#335).
`--no-relations` exists for the cost, not for the feature: it turns the source **off**, and it
can never be the thing that turns it on.

**Every consumer of `issueView`/`issueList` sees a widened shape.** The widening is additive —
`tracker-board.mjs`, `project-status.mjs` and the reviewer read fields they already read — and
the contract suite pins the exact key set on both providers, so a future narrowing fails rather
than quietly dropping the field.

**The divergence report can be noisy the first time someone adopts native relations**, because
every pre-existing declared edge will be declared-only. That is the correct output: it is a
true statement about a repository that has just acquired a second source, and it stops being
noisy exactly when the two are reconciled — which is the work the report exists to prompt.

**GitLab `relates_to` and GitHub sub-issues remain unread.** If a consumer wants containment in
the graph it is a new decision with a new shape (a containment edge is not a blocking edge and
must not be drawn as one), not a widening of this one.

**What is NOT decided here**: whether the declared block should eventually be *generated* from
native relations, or vice versa. Today both are hand-authored and the map reads both. A
generator would make one of them derived, which changes the answer to "which wins" — a derived
source has no independent claim — and is a separate ADR when there is demand for it.

## Alternatives considered

**Declared block wins; native relations are a fallback.** Rejected: it makes the native source
inert in exactly the repositories that use it most, and it discards a real constraint on the
grounds that another human wrote a different one. Nothing about a YAML block in a body makes it
more authoritative than a link in the tracker.

**Native relations win; the declared block is a shim until they land.** Rejected for the mirror
reason, plus one worse property: the block carries `track` and `files`, which no provider
relation can express, so "native wins" would mean a graph that knows the edges and cannot
compute parallelisability.

**Union with no report.** This is the one that looks reasonable and is not. It produces exactly
the same graph as the decision above and gives a reader no way to notice that the two sources
say different things — the accidental click and the deliberate declaration become
indistinguishable the moment they are merged. The report is not a nicety on top of the union;
without it the union is unauditable.

**Defer #533 until one source is chosen.** Rejected on the measurement: `0 of 47` open issues
declare a block and `0` carry a native relation. There is no evidence to choose on, and waiting
for it means the map stays unable to say who is executing anything — which is the half that
makes it a board rather than a diagram.
