---
status: draft
issue: 533
---

# Design

## Where each piece lives, and why not somewhere else

**`normalizeAssignees` in `vcs/lib/normalize.mjs`.** The only provider-specific input is
whether a user object keys its name `login` or `username`; everything else — prefer the plural
array, fall back to the legacy singular, answer `null` when neither key exists — is one rule.
Written twice it is the #340 defect, and the half that would rot first is the `null` branch,
which is the one that matters.

**`issueRelations` and `issueUpdate` on the providers, not in `epic-map.mjs`.** Reaching the
API from a status script would bypass the adapter boundary (ADR-0008) and the credential
binding at the port (#501/#479) — the exact residual #479 found in `ci-context.mjs`, where a
direct provider import authenticated by accident.

**The union in `buildGraph`, not in the CLI.** `buildGraph` was already the one place edges are
collected, and slice 1's own header predicted this: *"when the relations land, they become a
second source feeding the same builder"*. `edgeSet` became `edgeSources` — a map from edge to
the set of sources asserting it — which makes the divergence a projection of the data
structure rather than a second traversal that can disagree with it.

**`outsideRegion` in `epic-render.mjs`, next to `replaceMapRegion`.** The guard and the thing it
guards share the markers; splitting them across files is how the two drift apart.

## The one structural decision worth stating

`edgeSources` records the SOURCE SET per edge rather than keeping two edge lists and diffing
them at the end. A diff-at-the-end version has to re-derive which edges "should" have been in
each list, and gets the `null` case wrong the first time — it cannot tell an edge missing
because the source disagreed from an edge missing because the source could not be read. The
source set makes the second case impossible to express: an unread issue contributes to no set,
and the divergence projection filters on issues whose native side actually resolved.

## Uncomputable, three ways, on purpose

| value | means | who must not collapse it |
|---|---|---|
| `assignees: null` | the payload had no assignee field | `buildGraph` (`?? []`), the renderer, `epic-map`'s two-source fallback |
| `relations: null` | the native read FAILED | `buildGraph` (would manufacture divergences) |
| `relations: undefined` | the native side was never asked (`--no-relations`, or a provider without the verb) | the summary (would print an "unreadable" line about a source nobody consulted) |

The third is the one an implementation gets wrong by having two states instead of three, and it
is why `--no-relations` is tested for calling nothing rather than for producing a smaller graph.

## Red-proof

Ten mutations, each a plausible implementation rather than a strawman. Nine RED.

| | mutation | why a reviewer might have written it |
|---|---|---|
| M1 | `normalizeAssignees` returns `[]` instead of `null` | "an array return type should return an array" |
| M2 | `epic-map` defaults the assignee chain to `[]` | the same instinct, one layer up — **survived the first pass; the CLI-level fallback had no coverage** |
| M3 | divergences computed without the unread-source filter | the obvious set difference |
| M4 | `issueRelations` needs BOTH sides to fail before answering `null` | "salvage what resolved" |
| M5 | `relates_to` read as a blocker | it is a link, and links look like edges |
| M6 | the containment refusal removed | the composer is marker-bounded already |
| M7 | classification keyed on `declared` instead of `sources` | the field slice 1 used |
| M8 | cross-repo relations drawn as local edges | the API returned them, so they must be relevant |
| M9 | `who()` renders `null` as "sin asignar" | two states feel like enough |
| M10 | `outsideRegion` normalises all whitespace | "be tolerant about formatting" |

**M2 survived and was closed** with three CLI-level guards: neither-source-carries-assignees
must render nothing, an empty list from `issueList` must not fall through to `issueView`, and
`issueView` must be the fallback when the list cannot carry the field.

**One mutation is EQUIVALENT, not a gap.** Replacing `??` with `||` in `epic-map`'s assignee
chain survives every test — because `[]` is truthy in JavaScript, so `||` keeps an empty list
exactly as `??` does. The comment above that line claimed `??` was what protected the empty
case; the surviving mutation is how the claim was found wrong, and the comment now says so.
