---
status: draft
issue: 518
---

# Spec

## REQ-518-6 — the audit names what it skipped
A window containing first-parent non-merge commits MUST report how many were not audited.

## REQ-518-7 — silence when fully covered
A window of merges only MUST NOT emit the line.

## REQ-518-8 — the count is the unaudited set
Not the window size.

## REQ-518-9 — unknown is not zero
An uncountable range MUST report coverage unknown.

## REQ-518-10 — advisory
The line MUST NOT change the verdict, the exit code or the cursor.
