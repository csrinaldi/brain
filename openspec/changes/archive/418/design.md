---
status: design
issue: 418
epic: 313
artifact_store: openspec
topic_key: sdd/issue-418-lite-distinct-act-rearm/design
---

# Design — `lite` distinct-act over foreign commits (issue #418)

## D1 — doctrine before code

The change amends ADR-0026's evidence table; the amendment draft (with accepted
losses and residuals) precedes any implementation and carries the signature. The code
task is inert until then. This mirrors ADR-0027's flow on #396.

## D2 — the comparison target moves; the comparator does not

`compareTimestamps` (pure) stays. `evaluateDistinctAct` changes its input: instead of
`commits[commits.length - 1]` (head), it selects the latest commit whose author fails
the exemption test. The exemption set = `{ approval actor } ∪ governance.reviewActors`,
compared case-insensitively (same folding as #413 — logins are case-insensitive).

## D3 — author resolution is the platform's, not the commit's

The exemption keys off `prCommits()`'s `login` — the account the PLATFORM attributes
the commit to — never the raw commit-header name/email, which anyone can spell. An
unresolvable login (`null`) is foreign: fail closed. Consequences accepted in the
amendment: GitLab gets no relief (its logins are always null today); unattributed
authors (e.g. `noreply@anthropic.com` session commits) get no relief.

## D4 — reviewActors is read, never widened

The exemption reuses the L6-only key as-is. No new config key, no new semantics on
write; what changes is what the key *buys* (a non-re-arming push), which the
amendment records out loud. The narrower fallback (drop the reviewActors exemption,
keep only the approver's) is pre-approved in the amendment text as the retreat
position if the owner rejects that residual.

## D5 — lite-only by construction

The new selection runs inside the `lite` branch of `evaluateActor` only.
`standard`/`regulated` keep calling the head-commit path — their evidence definitions
did not change, so their code must not either (REQ-418-6).

## Alternatives rejected

Recorded in the amendment §4 (PR-creation scoping, content-scoped re-arming,
document-and-accept) — all three fail either the final-state property at higher tiers
or the #409 automation requirement.
