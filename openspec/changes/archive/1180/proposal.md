# Proposal: promote the phase-1 doctrine drafts (#1180)

Parent #1121, phase 1 exit. Four doctrine drafts merged with phase-1 fixes but were never promoted; the 1.10.0 cut should ship doctrine matching the code.

- Convert the two free-form VCS row drafts (#1163 `labelCreate`, #1162 `workflowRunSucceeded`) into one `brain-amendment/1` draft against `brain/core/methodology/vcs-contract.md`.
- Also update the Phase-3 adapter status table and the "exporting the N verbs" count (21 -> 30, the length of `VERBS` in `brain/scripts/vcs/cli.mjs`).
- Empty `PENDING_PROMOTION` in `verb-contract-drift-guard.test.mjs` in the same promote commit.
- The maintainer promotes all four drafts (Tier 2/3). Nothing under `brain/core/**` or `brain/project/**` is edited here.
