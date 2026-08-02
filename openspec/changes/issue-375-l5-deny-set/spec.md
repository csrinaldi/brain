---
status: spec
issue: 375
epic: 313
artifact_store: openspec
topic_key: sdd/issue-375-l5-deny-set/spec
---

# Spec — L5 deny-set (issue 375)

## REQ-375-1 — a deny-listed actor may not unlock the approved label

`evaluateActor` MUST accept `denyActors` and MUST return `level: 'fail'` when the approving actor
appears in it, **regardless of authorship**. The failure reason MUST name the actor and
`governance.reviewActors`.

### Scenario 1 — denied even when neither author matches

```
GIVEN a PR authored by "alice" closing an issue authored by "bob"
  AND the approved label applied by "brain-reviewer[bot]"
  AND denyActors containing "brain-reviewer[bot]"
WHEN evaluateActor runs
THEN level is 'fail'
  AND the reason names the actor
```

Without the deny-set this falls to rule 5 and PASSES. Making both authors differ from the actor is
what makes this scenario causal: no other rule can produce the failure.

### Scenario 2 — negative control: an unlisted actor still passes

```
GIVEN the same PR and issue authors
  AND the approved label applied by "carol"
  AND denyActors containing only "brain-reviewer[bot]"
WHEN evaluateActor runs
THEN level is 'pass'
```

A deny rule that failed everything would satisfy Scenario 1 and still be wrong.

## REQ-375-2 — deny beats allow, fail-closed

When an actor appears in BOTH `denyActors` and `botAllowlist`, `evaluateActor` MUST return
`level: 'fail'`. The deny check MUST be evaluated **before** the allow-list branch.

### Scenario 3 — a contradictory config resolves against the approval

```
GIVEN the approved label applied by "brain-reviewer[bot]"
  AND that identity present in BOTH denyActors and botAllowlist
WHEN evaluateActor runs
THEN level is 'fail'
```

The shipped config already forbids the overlap (`reviewer-identity-config.test.mjs`), so this is
defense in depth. It pins that a **misregistration must not hand the reviewer the merge keystroke**.

## REQ-375-3 — the two governance keys stay separate at the source

`gatherActorCheckInputs` MUST source `denyActors` from `governance.reviewActors` and `botAllowlist`
from `governance.approvalActors`, via **separate readers**, and MUST surface both.

### Scenario 4 — each key reaches its own field

```
GIVEN a config with approvalActors ["release-bot"] and reviewActors ["brain-reviewer[bot]"]
WHEN gatherActorCheckInputs runs
THEN denyActors === ["brain-reviewer[bot]"]
  AND botAllowlist === ["release-bot"]
```

## REQ-375-4 — the SHIPPED config must deny, not merely be well-shaped

A test MUST feed the repository's own committed `brain.config.json` into `evaluateActor` and assert
the shipped `reviewer.handle` is refused, with both authors set to other identities.

### Scenario 5 — behaviour, not shape

```
GIVEN the committed brain.config.json
  AND a PR and issue authored by identities other than reviewer.handle
  AND the approved label applied by reviewer.handle
WHEN evaluateActor runs with denyActors from the shipped governance.reviewActors
THEN level is 'fail'
```

Shape assertions alone would stay green if the shipped handle stopped matching the deny list — the
green-in-test / inert-in-production class this repo has already been bitten by twice.

## REQ-375-5 — the doctrine that becomes stale is corrected

`reviewer-protocol.md` **§9** MUST state the deny-set is enforced at L5, not only hardcoded in the
reviewer's caller. **§3** MUST stop presenting `reviewActors` as L6-only. Both are `brain/core/**`
→ **Tier 2**: drafted here, promoted by the human.

## Non-requirements

- Changing rule 1 (fail-open on missing label evidence, REQ-L5-2).
- Changing rule 2 (`override:*` admin bypass) — the deny check sits below it.
- Any change to L6.
