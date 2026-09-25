---
status: draft
issue: 1123
---

# Design: ADR-0037 and the Tier 3 amendment

## Shape

One new ADR plus one amendment to a core methodology file.

- **New ADR, not an amendment to ADR-0026.** The mode is a separate declared axis. Folding it
  into the tier table would imply the tier determines who acts, which the ADR rejects (a solo
  `lite` maintainer may want A; a `standard` team may want B).
- **An amendment to `agent-authorities.md`,** because its Tier 3 line is the rule being reshaped
  and its Tier 2 line ("the human reviews the MR before merging") contradicts mode B. Leaving
  either would leave a reader with the superseded rule (§1c act 2). The draft is named
  `agent-authorities-tier3.draft.md` as requested; it also carries the one Tier 2 edit.

Both follow `brain/scripts/brain-promote.mjs`'s contracts: the ADR's H1 and blockquote-only
preamble for `transformDraft`; the amendment's `brain-amendment/1` block with `target`, `issue`,
`body` (non-ADR target: no `amendment:` or `home-summary:`), two verbatim `amend-find` anchors and
a signed body section, the shape `harness-contract.md`'s "Worktree default (issue #782)" carries.

## Decisions inside the ADR

- **D1: intent and merge are separate acts.** The human's signature is on the intent (the approval
  label, which `issueCreate` already refuses to apply); the merge is executed by the platform.
- **D2: "the platform" is defined by exclusion.** Not the producer's session, not the reviewer;
  the automation identity (#1107) through `mrMerge` (#1133), which refuses on a moved head or a
  red check. `mrAutoMerge` stays the lane's verb and is not the B path, so B does not depend on
  the forge's `allow_auto_merge` (off in this repository, ADR-0034 Amendment 4).
- **D3: four identities, pairwise distinct from the producer.** Producer (commit authors, PR
  author), reviewer (posting identity), merger, intent approver. Unresolvable is never distinct.
  Identities come from the forge, never from trailers (ADR-0031).
- **D4: the `lite` solo exception, bounded.** Mode A only, reported, refused above `lite`. Without
  it the invariant forbids the operation ADR-0026 already records as `lite`'s model. Flagged for
  ratification.
- **D5: B at `standard`/`regulated` still waits for a human approving review.** Lock 2 means the
  reviewer cannot supply it; ADR-0034 L2 already behaves this way for `mrAutoMerge`. Named, not
  resolved.
- **D6: C at `regulated` is a configuration error,** never a silent fallback.
- **D7: declared versus effective mode,** reported separately; effective B requires #1133, #1134,
  distinct identities and a verdict for the head. Until then the effective default is A.
- **D8: C's intent-approver path is unowned.** The ADR records it as a prerequisite rather than
  relaxing `issueCreate`'s refusal.

## Evidence used

`gh issue view` for #1121, #1123, #1107, #1133, #1134, and #313's history; `vcs-contract.md`
rows `mrCreate`, `mrAutoMerge`, `issueCreate`, `prReviewComment`; ADR-0034 Context (:28), L2 and
Amendment 4; ADR-0026 Decision (tier parameters, the never-tiered reviewer rule) and Amendments
1, 3, 6; `reviewer-protocol.md` §1–§2; ADR-0033 Decision; `brain/scripts/vcs/actor-check.mjs`
(`compareTimestamps`); `brain/scripts/vcs/governance-tiers.mjs` `TIER_PARAMS.requiredReviews`;
`brain.config.json` `governance.{tier,reviewActors,agentActors}`; the 2026-09-24 analysis's
principle 1 (as carried by #1121).

## Verification

A scratch script imports `transformDraft`, `destinationFor`, `insertAdrLink`,
`checkShippedContent`, `parseAmendmentDraft`, `assessEdit` and `planAmendment` and runs them on
both drafts against `origin/main`'s `brain/HOME.md` and `agent-authorities.md`.
`npm run brain:repo:check` must pass.

## Open questions (for the maintainer)

- Ratify the `lite` solo exception, the key name, and C-at-`regulated` as an error (the ADR's
  "Requires ratification at promotion").
- Which issue owns mode C's intent-approver identity.
- Whether an approving review from a non-human identity may ever satisfy `standard` (would amend
  ADR-0026 and `reviewer-protocol.md`).
