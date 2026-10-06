# Spec (#1196)

- REQ-1: `package.json` reads 1.10.1 and every install/upgrade pin in `README.md` and `docs/adoption.md` names `v1.10.1`.
- REQ-2: `CHANGELOG.md` opens with a `## v1.10.1` entry that starts with what a consumer's automation now observes, then lists one row per merged PR (#1191, #1192, #1193), then states why this is a patch.
- REQ-3: Every factual claim in the entry, the `adoption.md` diff and the `KNOWN-LIMITATIONS.md` diff is checked against the code in this tree before the commit, including scope words, tiers, exit codes and provider.
- REQ-4: `brain-drafts/vcs-contract.issueclose.draft.md` is a `brain-amendment/1` draft. `planAmendment()` finds each anchor exactly once in the current `vcs-contract.md`. It adds the `issueClose` Required-verbs row at the end of the table, an adapter-status row, and corrects the verb count from 29 to 30.
- REQ-5: With the current doc and `PENDING_PROMOTION` emptied, the drift guard fails; with the planned doc text it passes. The test edit is not part of the release commit.
