---
status: draft
issue: 635
---

# Spec

## REQ-635-1 — the correction reaches `brain/` through the sanctioned door
Changes to `brain/core/**` and `brain/project/**` MUST NOT be authored as direct edits by an
agent (AGENTS.md Tier 3; `brain-writes-reviewed` fails agent authorship unconditionally and
un-overridably). They MUST ship as `brain-drafts/*.draft.md` consumed by `brain:promote`.

## REQ-635-2 — the byte-identical premise is removed from both artefacts
ADR-0017's "Dedup at reindex" point and `memory-format.md`'s equivalent MUST stop asserting that
duplicated lines are byte-identical. Both MUST state that `id` excludes `source`, so brain's own
round-trip produces the same `id` with different bytes.

## REQ-635-3 — the shipped rule is described
Both MUST state: repeated ids are deduplicated AND reported; resolution is first-wins (earliest
line of the earliest month file, matching the read path); a divergent pair is counted on its own
channel and never refused; refusal is reserved for a line whose bytes do not hash to its own `id`.

## REQ-635-4 — the churn MUST NOT is restated at the right altitude
ADR-0017 MUST state that the rule governs the DIFF, not the write — `rebuildIndex` has always
written the whole file — so the discipline is not re-scoped in an implementation comment.

## REQ-635-5 — the cross-file caveat is written down
The ADR MUST state that the churn proportionality holds while duplicate groups are intra-file,
and that a cross-file duplicate moves an entry's `file` field and produces the forbidden
whole-file churn. It MUST be framed as a property of the corpus, not of the rule.

## REQ-635-6 — the anchors are verified before the draft is written
Every `amend-find` block MUST occur EXACTLY ONCE in its target, checked before drafting rather
than discovered by a failed promotion.

## REQ-635-7 — the drafts are proved consumable
Each draft MUST parse with the promoter's OWN parser, its target MUST match the intended file,
every act MUST assess as `pending` with `free: 1`, and `applyEdits` MUST succeed. For the ADR,
the body, the Status-line act and the `brain/HOME.md` marker MUST also be verified applicable.
Reading the fences is not verification.

## REQ-635-8 — the decision is not reopened
Neither draft may alter the format decision. Both MUST open with an explicit statement of what
does not change, so an amendment is not misread as a reversal.

## REQ-635-9 — the citation-integrity checks stay green
`brain:repo:check` and `brain:nav` MUST pass. The drafts cite `duplicates.mjs` and
`store.duplicates.test.mjs::roundtrip-divergence`; both MUST exist and the test MUST pass on the
branch.
