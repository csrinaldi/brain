# Spec: phase-1 doctrine promotion (#1180)

- REQ-1: `vcs-contract.verbs.draft.md` parses as `brain-amendment/1` and `planAmendment()` succeeds against current `vcs-contract.md`, every `amend-find` anchor occurring exactly once.
- REQ-2: After applying it, the Required-verbs table has `labelCreate` and `workflowRunSucceeded` rows (verbatim from the #1163/#1162 drafts), the adapter status table lists both (`workflowRunSucceeded` GitLab `unsupported`), and the provider-guidance count reads "29 verbs (and the `capabilities` probe)": the Required-verbs table has 29 rows, and `capabilities` is a probe documented separately (a first promotion wrote 30, corrected by `vcs-contract.verb-count.draft.md` after the #1181 review).
- REQ-3: With the promoted doc and an empty `PENDING_PROMOTION`, `verb-contract-drift-guard.test.mjs` passes; against the unpromoted doc it fails, so both halves land together.
- REQ-4: The #1165 memory-backend-contract and ADR-0024 Amendment 3 drafts still plan cleanly.
