---
status: approved
issue: 1282
---

# Design — unreadable-sdd-doc-not-present (issue 1282)

### D106: the fix sits where `present` is computed, not in the readers
`readHeadDocuments` and the local overlay already say `unreadable` with a reason; only `buildSourcedSddTab` drops that fact. The fix changes that one function: `present` excludes `unreadable`, and an unreadable row carries `could not be read: <reason>` as its detail for both source kinds. `drawer-model.sddEntries` already prints `item.detail` and derives `done`/`pending` from `item.present`, so it needs no change.

### D107: class sweep result
Every other consumer of document state uses a positive allow-list (`present`/`truncated`) or handles `unreadable` explicitly: `drawer-model.documentView`, `documentFailure`, `resumeOutcome`, `local-overlay` (`clean`), `change-route` resume checks. The only negative check over a document state was line 479. No other instance exists.
