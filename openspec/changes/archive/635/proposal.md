---
status: draft
issue: 635
---

# Proposal — doctrine catches up to code, through the door that exists for it

## The ruling that came first: this PR cannot do what the ticket literally asks

#635 asks for edits to `brain/project/decisions/adr-0017-*.md` and
`brain/core/methodology/memory-format.md`. Both are the knowledge half, and AGENTS.md Tier 3 is
unambiguous:

> **The agent must never do this, even if explicitly asked:**
> - Commit directly to `brain/core/**` or `brain/project/**` — the knowledge half

The gate agrees and does not tier. `brain-writes-reviewed.mjs` carries
`BRAIN_MANAGED_PREFIXES = ['brain/core/', 'brain/project/']` and fails agent authorship
**unconditionally, at every tier, and an `override:*` label cannot admit it** — *"if an agent can
write to `brain/core/**` unreviewed, 'the human always leads' is void"*.

So this PR ships **drafts the maintainer promotes**, which is the sanctioned path and the one
#671 used two days ago for ADR-0031. `brain:promote` renders the draft, shows the plan, requires
a typed word, then **stages and stops**; running the printed `git commit` is the human signature.

Worth stating plainly: the credentials this session pushes with make its PRs read as
maintainer-authored, so the gate would very likely not have caught an edit made directly. That is
an argument for following the rule, not against it.

## Measured before writing anything

**The premise is false, and brain disproves it.** Re-executed with in-tree production code only
(`buildRecord` → `importRecord` → `exportObservation`), not copied from the ticket:

```
original      : {"issue":405,"source":"PR #405"}
round-tripped : {"issue":405,"source":"issue #405 / PR #405"}
same id?       true   bytes differ? true
```

`store.duplicates.test.mjs::roundtrip-divergence` pins it on `main` and passes today. So the
normative schema doc contradicts a green test — which is worse than vagueness, because it reads
as verified.

**Anchor uniqueness**, checked before drafting rather than discovered by a failed promotion:

```
adr-0017 · dedup point   ×1
adr-0017 · churn MUST NOT ×1
memory-format · dedup    ×1
```

**The drafts are consumable**, verified by driving the promoter's own parser rather than
eyeballing the fences:

```
adr-0017-amendment-1.draft.md → parses | target matches | 2 acts | amendment: 1
  act 1 → {"state":"pending","f":1,"free":1}
  act 2 → {"state":"pending","f":1,"free":1}
  applyEdits → OK | body → 85 lines | Status line → **Status**: Accepted · **amended … (Amendment 1 — see below)**
  HOME.md marker → applicable
memory-format.draft.md        → parses | target matches | 1 act
  act 1 → {"state":"pending","f":1,"free":1}
  applyEdits → OK
```

`state: pending` with `free: 1` is exactly what `applyEdits` requires; anything else refuses
rather than editing something adjacent.

## What the amendment says

**Act 1 — the dedup rule describes what the code does.** Repeated lines are deduplicated *and
reported*, first-wins (the earliest line of the earliest month file — what the read path already
resolved to). They are **not necessarily byte-identical**: `id` excludes `source`, `renderFuente`
widens it on round-trip, so a divergent pair is counted on its own channel and **never refused**.
Refusal stays reserved for a line whose bytes do not hash to its own `id`.

This is not cosmetic. An earlier draft of #598 *refused* such a pair on the strength of the old
premise, which would have bricked six verbs on a store brain cannot migrate, for one
`--issue`-carrying record round-tripped on a second machine.

**Act 2 — the churn MUST NOT, restated at the right altitude.** `rebuildIndex` has always written
the whole file, so the literal reading was never satisfied by any implementation this ADR has
had; only the spirit — the *diff* stays proportional — was ever alive. Reinterpreting a normative
MUST NOT in a code comment is the wrong altitude in a repo that landed formal amendments to
ADR-0006 and ADR-0026 for smaller premise changes.

## The caveat, and a measurement that changed its tense

The churn reading holds **only because duplicate groups are intra-file**: a cross-file duplicate
moves the winning entry's `file` field, producing exactly the whole-file churn the rule forbids
on a `share` that appended nothing.

Measured while drafting: #636 has since reconciled this corpus to **zero** duplicate groups
(`memory:reindex` → `2050 record(s) indexed`, no warning). So the cross-file case is not merely
absent by luck — there are no groups at all. That does not retire the caveat, it sharpens why it
belongs in the ADR: it is a property of the corpus, not of the rule, and the next union merge can
reintroduce one. The draft says so in those terms.

## Deliberately not done

The ticket says *"do not re-litigate the decision"*. Nothing here reopens it: the format stays
brain-owned, the log stays append-only, union stays the merge policy, the index stays the dedup
authority. Both drafts open with a "what this does NOT change" paragraph so the next reader meets
that boundary before the correction.

## Acceptance

- [x] The ADR draft describes the rule the code implements, including the divergent case and its
      first-wins resolution.
- [x] The `memory-format.md` draft no longer asserts byte-identity.
- [x] The cross-file caveat is written where the next reader of the ADR meets it.
- [x] `brain/HOME.md` is handled by the promoter's cascade — verified applicable, not assumed.
- [ ] **Requires the maintainer**: `npm run brain:promote` on both drafts, in the same sitting.
      The verb needs a TTY and a typed confirmation; an agent cannot and must not run it.

## Links

- #574 / #598 — the rule, and the file claim that deferred this · ADR-0017 · ADR-0028 (promote:
  read-confirm-stage) · `duplicates.mjs` · `store.duplicates.test.mjs::roundtrip-divergence`
