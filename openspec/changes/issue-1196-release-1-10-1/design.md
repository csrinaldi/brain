# Design (#1196)

## Mirror the 1.10.0 cut
Same files (`CHANGELOG.md`, `README.md`, `docs/adoption.md`, `docs/KNOWN-LIMITATIONS.md`, `package.json`), same voice: a "read before upgrading" table first, then one section per observable change, then what ships, then why this bump level.

## Claims are read from the code
Each merge was read with `git show` and every sentence traced to a function (`brain-check.mjs`, `lib/local-gate-context.mjs`, `checks/memory-gate.mjs`, `lib/merge-walk.mjs`, `postmerge/alarm.mjs`, the workflow steps). Where the 1.10.0 cut needed corrections after review, the cause was a scope word, so the sweep targets "every", "all", "never", "only", the tier and the provider.

## The doctrine draft
`vcs-contract.md` is `brain/core`, read-only for an agent. The draft follows `issue-1180`'s shape: a `brain-amendment/1` contract block and three `amend-find`/`amend-replace` pairs (the Required-verbs row, the verb count, the adapter-status row). The Required-verbs table holds 29 rows today, so the count after the row is 30 (31 entries in `VERBS` with `capabilities`). The drift guard's `PENDING_PROMOTION` is emptied in the working tree but left unstaged: it must land in the maintainer's promote commit, because on its own it fails against the un-promoted doc.
