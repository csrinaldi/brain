# The tier answers the approval question, and nothing else (#743)

Applies the 2026-08-20 ruling on #743 to the tree.

## REQ-743-1 — No tier carries a parameter of the review system

- **WHEN** `tierParams(tier)` is read for any tier
  **THEN** it carries no `reviewProtocol`, no `inferentialEnabled` and no
  `challengerAxis`, and it still carries the parameters that answer the approval
  question (`requiredReviews`, `memoryAssertion`, `diffBudget`, `artefacts`).

The complement is half the requirement: a guard that only forbids would pass on an
empty table.

## REQ-743-2 — One produced protocol

- **WHEN** `reviewer.protocol` is absent or null
  **THEN** `resolveReviewProtocol` returns `brain-review/2`, at every tier.
- **WHEN** it explicitly names `brain-review/1`
  **THEN** that is honoured — the ruling retired a default, not an operator's
  explicit choice (reviewer-protocol.md §5).
- **WHEN** it names anything else
  **THEN** the run fails closed, as before.

`brain-review/1` remains parseable. Every verdict already posted is one, and
`cold-boot.mjs` reads that history for `rev` and the anti-loop lock.

## REQ-743-3 — The judgment half is a capability with an untiered default

- **WHEN** `reviewer.inferential.enabled` is absent, null or true
  **THEN** the judgment half is ON.
- **WHEN** it is exactly `false`
  **THEN** it is OFF, and the reason names the key an operator can change, never a
  tier.
- **WHEN** no challenger axis is declared
  **THEN** the axis is `DEFAULT_AXIS` (`human`), which must be an axis this build
  implements — a default naming an unbuilt axis would promise a strength of
  evidence nobody can deliver.

## REQ-743-4 — The consequence is declared on the wire

- **WHEN** the half is enabled and no transport is configured (every repo, until
  #682 slice 3)
  **THEN** the verdict carries `the judgment half is enabled but no transport is
  configured`, and `controls_not_applied` includes `inferential`.

## Not in this change

- The capability SURFACE (#743 criteria 2 and 4: an install-time choice and a verb
  to change it afterwards). This change makes the key authoritative; it does not
  build `brain:config`.
- The rulings on the borderline rows (`honorSkipMemoryGate`, `diffBudget`,
  `artefacts`) — #743 criterion 1, still open.
- Whether three tiers are worth their complexity — #743 criterion 6.
