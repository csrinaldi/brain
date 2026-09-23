---
status: draft
issue: 635
---

# Design

## Decision 1 — drafts, not edits, and the reason is not procedural

The ticket names two files under `brain/`. AGENTS.md Tier 3 forbids an agent from committing
there *"even if explicitly asked"*, and `brain-writes-reviewed` fails agent authorship
**unconditionally, at every tier**, explicitly not bypassable by `adminOverride`, because
*"if an agent can write to `brain/core/**` unreviewed, 'the human always leads' is void"*.

The uncomfortable part, stated because leaving it out would make this look like mere compliance:
this session pushes with credentials that make its PRs read as maintainer-authored, so the gate
would very likely **not** have caught a direct edit. The rule held because it is the rule, not
because it was enforced here. `brain/core/anti-patterns/ia-escribe-brain-sin-gate.md` exists for
precisely this shape.

## Decision 2 — two drafts, promoted together, and the draft says so

ADR-0017 decides; `memory-format.md` specifies. The false premise is stated in both, so promoting
one and not the other leaves the contradiction in place with the appearance of a fix. Each draft
names the other and asks for the same sitting.

They are separate files rather than one because `brain:promote` takes one target per run — a
constraint of the verb, not a choice.

## Decision 3 — validate with the promoter's parser, never by reading the fences

The drafts were driven through `parseAmendmentDraft`, `assessEdit`, `applyEdits`, `extractBody`,
`applyStatusAct` and `amendHomeLine` — the real functions `brain:promote` calls.

This caught a defect that reading would not have: the first ADR draft omitted `amendment: N`, and
the parser refused it with *"an ADR target requires `amendment: N` (§1c act 1 numbers the
amendment)"*. Ships as Amendment **1** because ADR-0017 carries no numbered amendment yet — its
Status line is a bare `**Status**: Accepted`, which `amendStatusLine` reads as `previous = 0`.

`assessEdit` returning `{state:'pending', free:1}` is the precondition `applyEdits` enforces;
anything else refuses rather than editing something adjacent. Verified per act rather than
inferred from the overall result.

## Decision 4 — anchors verified for uniqueness first

Each `amend-find` was `grep -Fc`'d against its target before being written into a draft. A
non-unique anchor is refused by the verb, but discovering that during a promotion wastes the
maintainer's typed confirmation — and the confirmation is the scarce thing in this flow.

## Decision 5 — the caveat is framed as a corpus property, not a rule property

The obvious phrasing is *"no cross-file duplicate exists"*. It would rot: #636 has just taken the
corpus to zero groups, so the statement is true today and says nothing about tomorrow.

The draft instead says the proportionality **holds while groups are intra-file**, names what a
cross-file group would do to the `file` field, and states that zero-groups-today is a property of
the corpus rather than of the rule. A reader meeting it in the ADR learns the mechanism, not the
snapshot.

## What was measured rather than copied

The round-trip divergence is quoted from a run of in-tree production code, not from the ticket.
Same values — which is the point of re-running it: the ticket's evidence held, and now the draft
cites something this branch executed.

`memory:reindex` on the live corpus was also re-run: **2050 records, no duplicate warning**. That
number is what turned the caveat's tense from "holds only because all 49 groups are intra-file"
into "there are no groups at all, and that is a fact about the corpus".
