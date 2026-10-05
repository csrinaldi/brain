---
status: approved
issue: 1282
---

# Proposal — unreadable-sdd-doc-not-present (issue 1282)

## What
The SDD tab, when sourced from a worktree or an origin branch, MUST NOT mark a document it could not read as present or done, and its row MUST say why it could not be read.

## Why
Issue #1282. `buildSourcedSddTab` (`ui/change-route.mjs`) computes `present` as "not missing and not deleted", so an `unreadable` document counts as present and done. On origin, a failed `ls-tree` makes every document unreadable and the row carries no reason, so the tab shows six done stages for a tree nobody read. This violates #1276 R1276-8 ("present exactly when the source holds that document") and R1276-5 ("a step that was not read MUST NOT be reported as a step that holds nothing", here the inverse: unread must not read as held).

## Scope
- In: the `present` computation and the row `detail` of the sourced SDD tab, for the worktree and origin sources; a class sweep of other document-state checks.
- Out: the head source (its rows come from the snapshot's `artefacts`, not from documents); the Spec and Tasks tabs (they already say the reason through `documentFailure`); any change to `readHeadDocuments` or the local overlay.
