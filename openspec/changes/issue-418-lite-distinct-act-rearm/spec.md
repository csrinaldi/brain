---
status: spec
issue: 418
epic: 313
artifact_store: openspec
topic_key: sdd/issue-418-lite-distinct-act-rearm/spec
---

# Spec — `lite` distinct-act over foreign commits (issue #418)

**Contingent on the ADR-0026 Amendment 1 signature** (`brain-drafts/`). Requirements
are tagged `REQ-418-N`; tests will live in `actor-check.test.mjs`.

## REQ-418-1 — foreign pushes re-arm; the stale-green property survives

At `lite`, the approval event MUST be strictly later than the latest commit whose
author is neither the approval actor nor a registered `governance.reviewActors`
identity. A later foreign commit ⇒ fail, exactly as today. **Must be red against
pre-#418 code only in the exemption cases (REQ-418-2/3); this case pins parity.**

## REQ-418-2 — the approver's own later pushes do not re-arm

Approval by A, then commits authored by A ⇒ pass. **Red against pre-#418 code.**

## REQ-418-3 — a registered reviewer identity's pushes do not re-arm

Approval by A, then commits authored by R ∈ `governance.reviewActors` ⇒ pass.
**Red against pre-#418 code.** Guarded by #413's verification (PR #424).

## REQ-418-4 — unresolvable authorship is foreign (fail closed)

A commit with `login: null` (GitLab's documented residual, unattributed authors like
`noreply@anthropic.com`) counts as foreign ⇒ re-arms. Pins that the relief never
extends to an identity the platform cannot vouch for. **Green on both old and new
code by design** — the negative control against an over-permissive exemption.

## REQ-418-5 — no foreign commit ⇒ any approval event satisfies

A branch whose every commit is approver/reviewer-authored passes with any labeled
approval event. **Red against pre-#418 code** (today the label must postdate the
head).

## REQ-418-6 — `standard` and `regulated` are byte-identical

Their evaluate paths and messages are unchanged; the existing tier tests stay green
untouched. Any diff in their behavior is a defect of this change.

## REQ-418-7 — the failure message names the foreign commit

When re-armed, the message MUST name the foreign author and timestamp it compared
against — the operator's next action (re-approve after reviewing THAT commit) must be
derivable from the message alone.
