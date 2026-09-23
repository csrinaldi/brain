---
status: draft
issue: 590
---

# Proposal — adr-0018-gitlab-fragment (issue 590)

## What

Write ADR-0018 from what the code does today, and add a check that fails when a
cited `ADR-NNNN` does not resolve to a file.

## Why

Five live sites cite `ADR-0018` and the file does not exist (#590). The GitLab
surface — a managed fragment that travels to consumers, dogfooded by this repo,
audited by `workflow-auth.mjs`, pinned by two tests — runs on a decision nobody
can read. It is #586's class one step worse: there the pointer had *moved*; here
there is no target at all.

## Scope

- **In:** the ADR-0018 draft (re-derived from the tree, not promoted from the
  2026-07-10 draft); the citation-resolution check; an honest record of the
  ADR-0023 gap the check uncovers.
- **Out:** touching the five files that cite ADR-0018 — if the ADR is written
  they are already correct, which #590 asks for explicitly; promoting the ADR
  (human signature, ADR-0028); ADR-0023 itself (real gap, own ticket — #599).

## The decision taken

**Write it**, do not renumber to ADR-0016. The decisions the fragment encodes —
fragment-not-root, the `include:` opt-in, Node entry points, the
REQUIRED/DETECTION class mapping, the single image pin, `merge_request_event`
scoping, its own credential audit — are not in ADR-0016 and are not its subject.
Re-pointing the citations there would make them resolve to a document that does
not hold the reasoning: a pointer that lands on the wrong place is harder to
detect than one that lands on nothing.
